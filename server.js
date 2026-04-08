require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));

// Create uploads directory if it doesn't exist
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

// Create multer instance
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});
console.log("ENV CHECK:", {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    database: process.env.DB_NAME
});
// Database connection pool (Railway MySQL)
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: {
        rejectUnauthorized: false
    }
});
// Test DB connection
(async () => {
    try {
        const connection = await pool.getConnection();
        console.log("✅ Database Connected Successfully");
        connection.release();
    } catch (err) {
        console.error("❌ Database Connection Failed:", err.message);
    }
})();
// Authentication middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token' });
        }
        req.user = user;
        next();
    });
};

// Serve static files
app.use(express.static('.'));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// User Registration
app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        
        // Check if user exists
        const [existing] = await pool.execute(
            'SELECT * FROM users WHERE email = ? OR username = ?',
            [email, username]
        );
        
        if (existing.length > 0) {
            return res.status(400).json({ error: 'User already exists' });
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Insert user
        const [result] = await pool.execute(
            'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
            [username, email, hashedPassword]
        );
        
        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// User Login
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Find user
        const [users] = await pool.execute(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );
        
        if (users.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const user = users[0];
        
        // Check password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Generate JWT token
        const token = jwt.sign(
            { id: user.id, username: user.username, email: user.email },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create Blog with Image Upload
app.post('/api/blogs', authenticateToken, upload.single('image'), async (req, res) => {
    try {
        const { title, content } = req.body;
        const userId = req.user.id;
        
        if (!title || !content) {
            return res.status(400).json({ error: 'Title and content are required' });
        }
        
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        
        const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
        
        const [result] = await pool.execute(
            'INSERT INTO blogs (title, content, image_url, user_id) VALUES (?, ?, ?, ?)',
            [title, content, imageUrl, userId]
        );
        
        res.status(201).json({
            message: 'Blog created successfully',
            blogId: result.insertId
        });
    } catch (error) {
        console.error('Create blog error:', error.message);
        res.status(500).json({ error: 'Internal server error: ' + error.message });
    }
});

// Get All Blogs (Public Feed)
app.get('/api/blogs', async (req, res) => {
    try {
        const [blogs] = await pool.execute(`
            SELECT b.*, u.username, 
                   COUNT(DISTINCT l.id) as like_count,
                   COUNT(DISTINCT c.id) as comment_count
            FROM blogs b
            JOIN users u ON b.user_id = u.id
            LEFT JOIN likes l ON b.id = l.blog_id
            LEFT JOIN comments c ON b.id = c.blog_id
            GROUP BY b.id
            ORDER BY b.created_at DESC
        `);
        
        res.json(blogs);
    } catch (error) {
        console.error('Get blogs error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get Single Blog
app.get('/api/blogs/:id', async (req, res) => {
    try {
        const [blogs] = await pool.execute(`
            SELECT b.*, u.username 
            FROM blogs b
            JOIN users u ON b.user_id = u.id
            WHERE b.id = ?
        `, [req.params.id]);
        
        if (blogs.length === 0) {
            return res.status(404).json({ error: 'Blog not found' });
        }
        
        const blog = blogs[0];
        
        // Get likes count
        const [likes] = await pool.execute(
            'SELECT COUNT(*) as count FROM likes WHERE blog_id = ?',
            [req.params.id]
        );
        
        // Get comments
        const [comments] = await pool.execute(`
            SELECT c.*, u.username 
            FROM comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.blog_id = ?
            ORDER BY c.created_at DESC
        `, [req.params.id]);
        
        blog.like_count = likes[0].count;
        blog.comments = comments;
        
        res.json(blog);
    } catch (error) {
        console.error('Get blog error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get User's Blogs
app.get('/api/my-blogs', authenticateToken, async (req, res) => {
    try {
        const [blogs] = await pool.execute(
            'SELECT * FROM blogs WHERE user_id = ? ORDER BY created_at DESC',
            [req.user.id]
        );
        
        res.json(blogs);
    } catch (error) {
        console.error('Get my blogs error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update Blog endpoint
app.put('/api/blogs/:id', authenticateToken, upload.single('image'), async (req, res) => {
    try {
        const blogId = req.params.id;
        const userId = req.user.id;
        const { title, content } = req.body;
        
        console.log('Update Blog Request:', {
            blogId,
            userId,
            title,
            content,
            hasFile: !!req.file,
            file: req.file
        });
        
        // Check if blog exists and belongs to user
        const [blogs] = await pool.execute(
            'SELECT * FROM blogs WHERE id = ? AND user_id = ?',
            [blogId, userId]
        );
        
        if (blogs.length === 0) {
            return res.status(404).json({ error: 'Blog not found or unauthorized' });
        }
        
        // Validation
        if (!title || title.trim() === '') {
            return res.status(400).json({ error: 'Title is required' });
        }
        
        if (!content || content.trim() === '') {
            return res.status(400).json({ error: 'Content is required' });
        }
        
        let imageUrl = blogs[0].image_url;
        
        // If a new file is uploaded
        if (req.file) {
            // Delete old image if exists
            if (blogs[0].image_url) {
                const oldImagePath = path.join(__dirname, blogs[0].image_url);
                if (fs.existsSync(oldImagePath)) {
                    fs.unlinkSync(oldImagePath);
                }
            }
            imageUrl = `/uploads/${req.file.filename}`;
        }
        // If removeImage flag is set (sent as string 'true')
        else if (req.body.removeImage === 'true') {
            console.log('Removing existing image');
            // Delete old image if exists
            if (blogs[0].image_url) {
                const oldImagePath = path.join(__dirname, blogs[0].image_url);
                if (fs.existsSync(oldImagePath)) {
                    fs.unlinkSync(oldImagePath);
                }
            }
            imageUrl = null;
        }
        
        // Update the blog
        await pool.execute(
            'UPDATE blogs SET title = ?, content = ?, image_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [title, content, imageUrl, blogId]
        );
        
        res.json({ 
            message: 'Blog updated successfully',
            updatedBlog: {
                id: blogId,
                title,
                content,
                image_url: imageUrl
            }
        });
    } catch (error) {
        console.error('Update blog error:', error);
        res.status(500).json({ error: 'Internal server error: ' + error.message });
    }
});

// Delete Blog
app.delete('/api/blogs/:id', authenticateToken, async (req, res) => {
    try {
        const blogId = req.params.id;
        const userId = req.user.id;
        
        // Check if blog exists and belongs to user
        const [blogs] = await pool.execute(
            'SELECT * FROM blogs WHERE id = ? AND user_id = ?',
            [blogId, userId]
        );
        
        if (blogs.length === 0) {
            return res.status(404).json({ error: 'Blog not found or unauthorized' });
        }
        
        // Delete image if exists
        if (blogs[0].image_url) {
            const imagePath = path.join(__dirname, blogs[0].image_url);
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        }
        
        await pool.execute('DELETE FROM blogs WHERE id = ?', [blogId]);
        
        res.json({ message: 'Blog deleted successfully' });
    } catch (error) {
        console.error('Delete blog error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Like/Unlike Blog
app.post('/api/blogs/:id/like', authenticateToken, async (req, res) => {
    try {
        const blogId = req.params.id;
        const userId = req.user.id;
        
        // Check if already liked
        const [existing] = await pool.execute(
            'SELECT * FROM likes WHERE blog_id = ? AND user_id = ?',
            [blogId, userId]
        );
        
        if (existing.length > 0) {
            // Unlike
            await pool.execute(
                'DELETE FROM likes WHERE blog_id = ? AND user_id = ?',
                [blogId, userId]
            );
            res.json({ liked: false });
        } else {
            // Like
            await pool.execute(
                'INSERT INTO likes (blog_id, user_id) VALUES (?, ?)',
                [blogId, userId]
            );
            res.json({ liked: true });
        }
    } catch (error) {
        console.error('Like error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Add Comment
app.post('/api/blogs/:id/comments', authenticateToken, async (req, res) => {
    try {
        const blogId = req.params.id;
        const userId = req.user.id;
        const { comment } = req.body;
        
        const [result] = await pool.execute(
            'INSERT INTO comments (blog_id, user_id, comment) VALUES (?, ?, ?)',
            [blogId, userId, comment]
        );
        
        // Get the created comment with username
        const [comments] = await pool.execute(`
            SELECT c.*, u.username 
            FROM comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.id = ?
        `, [result.insertId]);
        
        res.status(201).json(comments[0]);
    } catch (error) {
        console.error('Add comment error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Check if user liked a blog
app.get('/api/blogs/:id/like-status', authenticateToken, async (req, res) => {
    try {
        const blogId = req.params.id;
        const userId = req.user.id;
        
        const [likes] = await pool.execute(
            'SELECT * FROM likes WHERE blog_id = ? AND user_id = ?',
            [blogId, userId]
        );
        
        res.json({ liked: likes.length > 0 });
    } catch (error) {
        console.error('Check like error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Serve create-blog.html
app.get('/create-blog.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'create-blog.html'));
});

// Error handling for multer
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        console.error('Multer error:', err);
        return res.status(400).json({ error: err.message });
    } else if (err) {
        console.error('General error:', err);
        return res.status(500).json({ error: err.message });
    }
    next();
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});