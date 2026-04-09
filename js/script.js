class Auth {
    static isLoggedIn() {
        return localStorage.getItem('token') !== null;
    }
    
    static getToken() {
        return localStorage.getItem('token');
    }
    
    static getUser() {
        const user = localStorage.getItem('user');
        return user ? JSON.parse(user) : null;
    }
    
    static async login(email, password) {
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Login failed');
            }
            
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            
            return { success: true, user: data.user };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    static async register(username, email, password) {
        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Registration failed');
            }
            
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    static logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/';
    }
}

class BlogAPI {
    static async getAllBlogs() {
        try {
            const response = await fetch('/api/blogs');
            return await response.json();
        } catch (error) {
            console.error('Error fetching blogs:', error);
            return [];
        }
    }
    
    static async getBlog(id) {
        try {
            const response = await fetch(`/api/blogs/${id}`);
            return await response.json();
        } catch (error) {
            console.error('Error fetching blog:', error);
            return null;
        }
    }
    
    static async createBlog(formData) {
        try {
            const token = Auth.getToken();
            const response = await fetch('/api/blogs', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to create blog');
            }
            
            return { success: true, blogId: data.blogId };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    static async updateBlog(blogId, formData) {
        try {
            const token = Auth.getToken();
            const response = await fetch(`/api/blogs/${blogId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to update blog');
            }
            
            return { success: true, data: data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    static async deleteBlog(id) {
        try {
            const token = Auth.getToken();
            const response = await fetch(`/api/blogs/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to delete blog');
            }
            
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    static async likeBlog(id) {
        try {
            const token = Auth.getToken();
            const response = await fetch(`/api/blogs/${id}/like`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to like blog');
            }
            
            return { success: true, liked: data.liked };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    static async addComment(id, comment) {
        try {
            const token = Auth.getToken();
            const response = await fetch(`/api/blogs/${id}/comments`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ comment })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to add comment');
            }
            
            return { success: true, comment: data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    static async getMyBlogs() {
        try {
            const token = Auth.getToken();
            const response = await fetch('/api/my-blogs', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            return await response.json();
        } catch (error) {
            console.error('Error fetching my blogs:', error);
            return [];
        }
    }
}

class UI {
    static updateNavigation() {
        const isLoggedIn = Auth.isLoggedIn();
        const user = Auth.getUser();
        
        const navLinks = document.querySelector('.nav-links');
        if (navLinks) {
            if (isLoggedIn) {
                navLinks.innerHTML = `
                    <a href="/dashboard.html">Dashboard</a>
                    <a href="/create-blog.html">Create Blog</a>
                    <span>Welcome, ${user.username}</span>
                    <button onclick="Auth.logout()" class="btn btn-secondary">Logout</button>
                `;
            } else {
                navLinks.innerHTML = `
                    <a href="/login.html" class="btn btn-secondary">Login</a>
                    <a href="/register.html" class="btn btn-primary">Register</a>
                `;
            }
        }
    }
    
    static async loadBlogs() {
        const blogGrid = document.querySelector('.blog-grid');
        if (!blogGrid) return;
        
        const blogs = await BlogAPI.getAllBlogs();
        
        if (blogs.length === 0) {
            blogGrid.innerHTML = '<p class="text-center">No blogs found. Be the first to create one!</p>';
            return;
        }
        
        blogGrid.innerHTML = blogs.map(blog => `
            <div class="blog-card">
                ${blog.image_url ? `
                    <img src="${blog.image_url}" alt="${blog.title}" class="blog-image">
                ` : ''}
                <div class="blog-content">
                    <h3 class="blog-title">
                        <a href="/blog-detail.html?id=${blog.id}">${blog.title}</a>
                    </h3>
                    <div class="blog-meta">
                        By ${blog.username} • ${new Date(blog.created_at).toLocaleDateString()}
                    </div>
                    <p class="blog-excerpt">${blog.content.substring(0, 150)}...</p>
                    <div class="blog-stats">
                        <span>❤️ ${blog.like_count || 0} likes</span>
                        <span>💬 ${blog.comment_count || 0} comments</span>
                    </div>
                </div>
            </div>
        `).join('');
    }
    
    static async loadBlogDetail() {
        const urlParams = new URLSearchParams(window.location.search);
        const blogId = urlParams.get('id');
        
        if (!blogId) {
            window.location.href = '/';
            return;
        }
        
        const blog = await BlogAPI.getBlog(blogId);
        
        if (!blog) {
            document.querySelector('main').innerHTML = `
                <div class="text-center">
                    <h2>Blog not found</h2>
                    <a href="/" class="btn btn-primary">Go Home</a>
                </div>
            `;
            return;
        }
        
        const blogDetail = document.querySelector('.blog-detail');
        if (blogDetail) {
            blogDetail.innerHTML = `
                ${blog.image_url ? `
                    <img src="${blog.image_url}" alt="${blog.title}" class="blog-detail-image">
                ` : ''}
                <div class="blog-detail-meta">
                    <div>
                        <h1>${blog.title}</h1>
                        <p>By ${blog.username} • ${new Date(blog.created_at).toLocaleDateString()}</p>
                    </div>
                    <div class="blog-interactions">
                        <button onclick="UI.toggleLike(${blog.id})" class="like-btn" id="likeBtn">
                            ❤️ ${blog.like_count || 0}
                        </button>
                    </div>
                </div>
                <div class="blog-detail-content">
                    ${blog.content.replace(/\n/g, '<br>')}
                </div>
            `;
            
            // Load comments
            UI.loadComments(blog.comments || []);
            
            // Check like status if logged in
            if (Auth.isLoggedIn()) {
                UI.checkLikeStatus(blogId);
            }
        }
    }
    
    static async checkLikeStatus(blogId) {
        try {
            const token = Auth.getToken();
            const response = await fetch(`/api/blogs/${blogId}/like-status`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            const data = await response.json();
            const likeBtn = document.getElementById('likeBtn');
            
            if (data.liked) {
                likeBtn.classList.add('liked');
                likeBtn.innerHTML = '❤️ Unlike';
            }
        } catch (error) {
            console.error('Error checking like status:', error);
        }
    }
    
    static async toggleLike(blogId) {
        if (!Auth.isLoggedIn()) {
            alert('Please login to like blogs');
            window.location.href = '/login.html';
            return;
        }
        
        const result = await BlogAPI.likeBlog(blogId);
        
        if (result.success) {
            const likeBtn = document.getElementById('likeBtn');
            const currentText = likeBtn.innerHTML;
            const currentCount = parseInt(currentText.match(/\d+/)?.[0]) || 0;
            
            if (result.liked) {
                likeBtn.classList.add('liked');
                likeBtn.innerHTML = `❤️ ${currentCount + 1}`;
            } else {
                likeBtn.classList.remove('liked');
                likeBtn.innerHTML = `❤️ ${Math.max(0, currentCount - 1)}`;
            }
        }
    }
    
    static loadComments(comments) {
        const commentsList = document.querySelector('.comments-list');
        const commentForm = document.querySelector('.comment-form');
        
        if (commentsList) {
            if (comments.length === 0) {
                commentsList.innerHTML = '<p>No comments yet. Be the first to comment!</p>';
            } else {
                commentsList.innerHTML = comments.map(comment => `
                    <div class="comment">
                        <div class="comment-header">
                            <strong>${comment.username}</strong>
                            <span>${new Date(comment.created_at).toLocaleDateString()}</span>
                        </div>
                        <p>${comment.comment}</p>
                    </div>
                `).join('');
            }
        }
        
        if (commentForm && Auth.isLoggedIn()) {
            commentForm.innerHTML = `
                <div class="form-group">
                    <textarea id="commentText" placeholder="Add a comment..." required></textarea>
                </div>
                <button onclick="UI.addComment()" class="btn btn-primary">Post Comment</button>
            `;
        }
    }
    
    static async addComment() {
        const urlParams = new URLSearchParams(window.location.search);
        const blogId = urlParams.get('id');
        const commentText = document.getElementById('commentText').value;
        
        if (!commentText.trim()) {
            alert('Please enter a comment');
            return;
        }
        
        const result = await BlogAPI.addComment(blogId, commentText);
        
        if (result.success) {
            document.getElementById('commentText').value = '';
            
            // Add new comment to list
            const commentsList = document.querySelector('.comments-list');
            if (commentsList) {
                const comment = result.comment;
                const commentHTML = `
                    <div class="comment">
                        <div class="comment-header">
                            <strong>${comment.username}</strong>
                            <span>${new Date(comment.created_at).toLocaleDateString()}</span>
                        </div>
                        <p>${comment.comment}</p>
                    </div>
                `;
                
                if (commentsList.querySelector('p')) {
                    commentsList.innerHTML = commentHTML;
                } else {
                    commentsList.insertAdjacentHTML('afterbegin', commentHTML);
                }
            }
        }
    }
    
    static async loadMyBlogs() {
        const blogsList = document.querySelector('.blogs-list');
        if (!blogsList) return;
        
        const blogs = await BlogAPI.getMyBlogs();
        
        if (blogs.length === 0) {
            blogsList.innerHTML = '<p>You haven\'t created any blogs yet. <a href="/create-blog.html">Create your first blog!</a></p>';
            return;
        }
        
        blogsList.innerHTML = blogs.map(blog => `
            <div class="blog-item">
                <div>
                    <h3>${blog.title}</h3>
                    <p>Created: ${new Date(blog.created_at).toLocaleDateString()}</p>
                    <p>${blog.content.substring(0, 100)}...</p>
                </div>
                <div class="blog-actions">
                    <a href="/edit-blog.html?id=${blog.id}" class="btn btn-secondary">Edit</a>
                    <button onclick="UI.deleteBlog(${blog.id})" class="btn btn-danger">Delete</button>
                </div>
            </div>
        `).join('');
    }
    
    static async deleteBlog(blogId) {
        if (!confirm('Are you sure you want to delete this blog?')) {
            return;
        }
        
        const result = await BlogAPI.deleteBlog(blogId);
        
        if (result.success) {
            alert('Blog deleted successfully');
            UI.loadMyBlogs();
        } else {
            alert('Failed to delete blog: ' + result.error);
        }
    }
    
    static async loadEditBlog() {
        const urlParams = new URLSearchParams(window.location.search);
        const blogId = urlParams.get('id');
        
        if (!blogId) {
            window.location.href = '/dashboard.html';
            return;
        }
        
        if (!Auth.isLoggedIn()) {
            window.location.href = '/login.html';
            return;
        }
        
        const blog = await BlogAPI.getBlog(blogId);
        
        if (!blog) {
            alert('Blog not found');
            window.location.href = '/dashboard.html';
            return;
        }
        
        // Populate form fields
        document.getElementById('title').value = blog.title;
        document.getElementById('content').value = blog.content;
        
        // Show current image if exists
        const currentImageContainer = document.getElementById('currentImageContainer');
        if (currentImageContainer) {
            if (blog.image_url) {
                currentImageContainer.innerHTML = `
                    <p><strong>Current Image:</strong></p>
                    <img src="${blog.image_url}" alt="Current blog image" style="max-width: 300px; margin: 10px 0; border-radius: 5px;">
                    <div class="form-group">
                        <label>
                            <input type="checkbox" id="removeImageCheckbox">
                            Remove current image
                        </label>
                    </div>
                `;
            } else {
                currentImageContainer.innerHTML = '<p>No current image</p>';
            }
        }
        
        // Store blog ID in form
        const form = document.getElementById('blogForm');
        if (form) {
            form.dataset.blogId = blogId;
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Update navigation
    UI.updateNavigation();
    
    // Check current page and load appropriate content
    const path = window.location.pathname;
    
    if (path === '/' || path === '/index.html') {
        UI.loadBlogs();
    } else if (path === '/blog-detail.html') {
        UI.loadBlogDetail();
    } else if (path === '/dashboard.html') {
        if (!Auth.isLoggedIn()) {
            window.location.href = '/login.html';
        } else {
            UI.loadMyBlogs();
        }
    } else if (path === '/edit-blog.html') {
        if (!Auth.isLoggedIn()) {
            window.location.href = '/login.html';
        } else {
            UI.loadEditBlog();
        }
    }
    
    // Initialize form handlers
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }
    
    const createBlogForm = document.getElementById('blogForm');
    if (createBlogForm) {
    createBlogForm.addEventListener('submit', handleCreateBlog);
}
});

// Form handlers
async function handleLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    const result = await Auth.login(email, password);
    
    if (result.success) {
        window.location.href = '/dashboard.html';
    } else {
        alert('Login failed: ' + result.error);
    }
}

async function handleRegister(event) {
    event.preventDefault();
    
    const username = document.getElementById('username').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    if (password !== confirmPassword) {
        alert('Passwords do not match');
        return;
    }
    
    const result = await Auth.register(username, email, password);
    
    if (result.success) {
        alert('Registration successful! Please login.');
        window.location.href = '/login.html';
    } else {
        alert('Registration failed: ' + result.error);
    }
}

async function handleCreateBlog(event) {
    event.preventDefault();
    
    if (!Auth.isLoggedIn()) {
        window.location.href = '/login.html';
        return;
    }
    
    const form = event.target;
    const formData = new FormData(form);
    
    const result = await BlogAPI.createBlog(formData);
    
    if (result.success) {
        alert('Blog created successfully!');
        window.location.href = '/dashboard.html';
    } else {
        alert('Failed to create blog: ' + result.error);
    }
}

async function handleUpdateBlog() {
    // Get blog ID from form or URL
    const urlParams = new URLSearchParams(window.location.search);
    let blogId = urlParams.get('id');
    
    if (!blogId) {
        const form = document.getElementById('blogForm');
        blogId = form ? form.dataset.blogId : null;
    }
    
    if (!blogId) {
        alert('Blog ID not found');
        return;
    }
    
    const title = document.getElementById('title').value;
    const content = document.getElementById('content').value;
    const imageFile = document.getElementById('image').files[0];
    const removeImageCheckbox = document.getElementById('removeImageCheckbox');
    
    // Validate inputs
    if (!title.trim()) {
        alert('Title is required');
        return;
    }
    
    if (!content.trim()) {
        alert('Content is required');
        return;
    }
    
    // Create FormData
    const formData = new FormData();
    formData.append('title', title);
    formData.append('content', content);
    
    // Handle image
    if (imageFile) {
        formData.append('image', imageFile);
    }
    
    // Handle remove image option
    if (removeImageCheckbox && removeImageCheckbox.checked) {
        formData.append('removeImage', 'true');
    }
    
    console.log('Sending update request for blog:', blogId);
    console.log('FormData entries:');
    for (let [key, value] of formData.entries()) {
        console.log(key, value);
    }
    
    const result = await BlogAPI.updateBlog(blogId, formData);
    
    if (result.success) {
        alert('Blog updated successfully!');
        window.location.href = '/dashboard.html';
    } else {
        alert('Failed to update blog: ' + result.error);
    }
}

// Make functions available globally
window.Auth = Auth;
window.BlogAPI = BlogAPI;
window.UI = UI;
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.handleCreateBlog = handleCreateBlog;
window.handleUpdateBlog = handleUpdateBlog;