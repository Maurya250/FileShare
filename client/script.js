class FileShareApp {
    constructor() {
        this.baseURL = window.location.origin;
        this.token = localStorage.getItem('token');
        this.user = null;
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.checkAuth();
        this.handleRouting();
    }

    setupEventListeners() {
        // Navigation
        document.getElementById('loginBtn').addEventListener('click', () => this.showModal('loginModal'));
        document.getElementById('registerBtn').addEventListener('click', () => this.showModal('registerModal'));
        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());
        document.getElementById('getStartedBtn').addEventListener('click', () => this.showModal('loginModal'));

        // Modal close buttons
        document.querySelectorAll('.close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.target.closest('.modal').style.display = 'none';
            });
        });

        // Forms
        document.getElementById('loginForm').addEventListener('submit', (e) => this.handleLogin(e));
        document.getElementById('registerForm').addEventListener('submit', (e) => this.handleRegister(e));

        // File upload
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');

        uploadArea.addEventListener('click', () => fileInput.click());
        uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
        uploadArea.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        uploadArea.addEventListener('drop', (e) => this.handleDrop(e));
        
        fileInput.addEventListener('change', (e) => this.handleFileSelect(e));

        // Browse link
        document.querySelector('.browse-link').addEventListener('click', (e) => {
            e.stopPropagation();
            fileInput.click();
        });

        // Download functionality
        const downloadBtn = document.getElementById('downloadBtn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => this.handleDownload());
        }
    }

    async checkAuth() {
        if (this.token) {
            try {
                const response = await fetch(`${this.baseURL}/api/auth/me`, {
                    headers: {
                        'Authorization': `Bearer ${this.token}`
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    this.user = data.user;
                    this.showDashboard();
                } else {
                    this.clearAuth();
                }
            } catch (error) {
                this.clearAuth();
            }
        }
    }

    handleRouting() {
        const path = window.location.pathname;
        const params = new URLSearchParams(window.location.search);
        const shareId = params.get('share');

        if (shareId) {
            this.showDownloadPage(shareId);
        }
    }

    showModal(modalId) {
        document.getElementById(modalId).style.display = 'block';
    }

    hideModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
    }

    async handleLogin(e) {
        e.preventDefault();
        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;

        try {
            const response = await fetch(`${this.baseURL}/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok) {
                this.token = data.token;
                this.user = data.user;
                localStorage.setItem('token', this.token);
                this.hideModal('loginModal');
                this.showNotification('Login successful!', 'success');
                this.showDashboard();
            } else {
                this.showNotification(data.message, 'error');
            }
        } catch (error) {
            this.showNotification('Login failed. Please try again.', 'error');
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        const username = document.getElementById('registerUsername').value;
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;

        try {
            const response = await fetch(`${this.baseURL}/api/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, email, password })
            });

            const data = await response.json();

            if (response.ok) {
                this.token = data.token;
                this.user = data.user;
                localStorage.setItem('token', this.token);
                this.hideModal('registerModal');
                this.showNotification('Registration successful!', 'success');
                this.showDashboard();
            } else {
                this.showNotification(data.message, 'error');
            }
        } catch (error) {
            this.showNotification('Registration failed. Please try again.', 'error');
        }
    }

    logout() {
        this.clearAuth();
        this.showWelcome();
        this.showNotification('Logged out successfully!', 'info');
    }

    clearAuth() {
        this.token = null;
        this.user = null;
        localStorage.removeItem('token');
    }

    showWelcome() {
        document.getElementById('welcomeSection').style.display = 'block';
        document.getElementById('dashboard').style.display = 'none';
        document.getElementById('downloadPage').style.display = 'none';
        document.getElementById('loginBtn').style.display = 'inline-block';
        document.getElementById('registerBtn').style.display = 'inline-block';
        document.getElementById('userMenu').style.display = 'none';
    }

    showDashboard() {
        document.getElementById('welcomeSection').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
        document.getElementById('downloadPage').style.display = 'none';
        document.getElementById('loginBtn').style.display = 'none';
        document.getElementById('registerBtn').style.display = 'none';
        document.getElementById('userMenu').style.display = 'flex';
        document.getElementById('username').textContent = this.user.username;
        
        this.loadUserFiles();
    }

    async showDownloadPage(shareId) {
        document.getElementById('welcomeSection').style.display = 'none';
        document.getElementById('dashboard').style.display = 'none';
        document.getElementById('downloadPage').style.display = 'block';

        try {
            const response = await fetch(`${this.baseURL}/api/files/info/${shareId}`);
            const data = await response.json();

            if (response.ok) {
                const fileInfo = data.file;
                document.getElementById('fileInfo').innerHTML = `
                    <h3>${fileInfo.originalName}</h3>
                    <div class="file-meta">
                        <p><strong>Size:</strong> ${this.formatFileSize(fileInfo.size)}</p>
                        <p><strong>Type:</strong> ${fileInfo.mimetype}</p>
                        <p><strong>Downloads:</strong> ${fileInfo.downloadCount}</p>
                        <p><strong>Uploaded:</strong> ${new Date(fileInfo.uploadedAt).toLocaleDateString()}</p>
                        ${fileInfo.expiresAt ? `<p><strong>Expires:</strong> ${new Date(fileInfo.expiresAt).toLocaleDateString()}</p>` : ''}
                    </div>
                `;

                if (fileInfo.hasPassword) {
                    document.getElementById('passwordSection').style.display = 'block';
                }

                document.getElementById('downloadBtn').dataset.shareId = shareId;
            } else {
                document.getElementById('fileInfo').innerHTML = `
                    <div class="error">
                        <h3>File Not Found</h3>
                        <p>${data.message}</p>
                    </div>
                `;
                document.getElementById('downloadBtn').style.display = 'none';
            }
        } catch (error) {
            this.showNotification('Failed to load file information', 'error');
        }
    }

    handleDragOver(e) {
        e.preventDefault();
        document.getElementById('uploadArea').classList.add('dragover');
    }

    handleDragLeave(e) {
        e.preventDefault();
        document.getElementById('uploadArea').classList.remove('dragover');
    }

    handleDrop(e) {
        e.preventDefault();
        document.getElementById('uploadArea').classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            this.uploadFile(files[0]);
        }
    }

    handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) {
            this.uploadFile(file);
        }
    }

    async uploadFile(file) {
        const password = document.getElementById('filePassword').value;
        const expiresIn = document.getElementById('expirationTime').value;
        
        const formData = new FormData();
        formData.append('file', file);
        if (password) formData.append('password', password);
        if (expiresIn) formData.append('expiresIn', expiresIn);

        // Show progress
        document.getElementById('uploadProgress').style.display = 'block';
        
        try {
            const response = await fetch(`${this.baseURL}/api/files/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                },
                body: formData
            });

            const data = await response.json();

            if (response.ok) {
                this.showNotification('File uploaded successfully!', 'success');
                this.loadUserFiles();
                
                // Show share link
                const shareLink = data.file.shareLink;
                this.showShareModal(shareLink, data.file);
                
                // Reset form
                document.getElementById('fileInput').value = '';
                document.getElementById('filePassword').value = '';
                document.getElementById('expirationTime').value = 'never';
            } else {
                this.showNotification(data.message, 'error');
            }
        } catch (error) {
            this.showNotification('Upload failed. Please try again.', 'error');
        }

        // Hide progress
        document.getElementById('uploadProgress').style.display = 'none';
    }

    showShareModal(shareLink, fileData) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'block';
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close">&times;</span>
                <h2><i class="fas fa-share-alt"></i> File Uploaded Successfully!</h2>
                <div class="share-info">
                    <h3>${fileData.originalName}</h3>
                    <p><strong>Share Link:</strong></p>
                    <div class="share-link-container">
                        <input type="text" value="${shareLink}" readonly id="shareLinkInput">
                        <button onclick="this.previousElementSibling.select(); document.execCommand('copy'); this.textContent='Copied!'" class="btn btn-primary">Copy</button>
                    </div>
                    ${fileData.expiresAt ? `<p><strong>Expires:</strong> ${new Date(fileData.expiresAt).toLocaleDateString()}</p>` : '<p>This link never expires</p>'}
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        modal.querySelector('.close').onclick = () => {
            document.body.removeChild(modal);
        };
        
        // Auto-select share link for easy copying
        setTimeout(() => {
            modal.querySelector('#shareLinkInput').select();
        }, 100);
    }

    async loadUserFiles() {
        try {
            const response = await fetch(`${this.baseURL}/api/files/my-files`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            const data = await response.json();

            if (response.ok) {
                this.renderFilesList(data.files);
            } else {
                this.showNotification('Failed to load files', 'error');
            }
        } catch (error) {
            this.showNotification('Failed to load files', 'error');
        }
    }

    renderFilesList(files) {
        const filesList = document.getElementById('filesList');
        
        if (files.length === 0) {
            filesList.innerHTML = '<p>No files uploaded yet. Upload your first file!</p>';
            return;
        }

        filesList.innerHTML = files.map(file => `
            <div class="file-item">
                <div class="file-info-left">
                    <i class="fas fa-file${this.getFileIcon(file.originalName)} file-icon ${this.getFileExtension(file.originalName)}"></i>
                    <div class="file-details">
                        <h4>${file.originalName}</h4>
                        <p>${this.formatFileSize(file.size)} • ${file.downloadCount} downloads • ${new Date(file.createdAt).toLocaleDateString()}</p>
                        ${file.expiresAt ? `<p class="expires">Expires: ${new Date(file.expiresAt).toLocaleDateString()}</p>` : ''}
                    </div>
                </div>
                <div class="file-actions">
                    <button onclick="app.copyShareLink('${file.shareLink}')" class="btn btn-primary" title="Copy Share Link">
                        <i class="fas fa-copy"></i>
                    </button>
                    <button onclick="app.deleteFile('${file._id}')" class="btn btn-secondary" title="Delete File">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    getFileIcon(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        switch (ext) {
            case 'pdf': return '-pdf';
            case 'doc':
            case 'docx': return '-word';
            case 'xls':
            case 'xlsx': return '-excel';
            case 'ppt':
            case 'pptx': return '-powerpoint';
            case 'jpg':
            case 'jpeg':
            case 'png':
            case 'gif': return '-image';
            case 'mp4':
            case 'avi':
            case 'mov': return '-video';
            case 'mp3':
            case 'wav': return '-audio';
            case 'zip':
            case 'rar': return '-archive';
            default: return '';
        }
    }

    getFileExtension(filename) {
        return filename.split('.').pop().toLowerCase();
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    copyShareLink(link) {
        navigator.clipboard.writeText(link).then(() => {
            this.showNotification('Share link copied to clipboard!', 'success');
        }).catch(() => {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = link;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            this.showNotification('Share link copied to clipboard!', 'success');
        });
    }

    async deleteFile(fileId) {
        if (!confirm('Are you sure you want to delete this file?')) {
            return;
        }

        try {
            const response = await fetch(`${this.baseURL}/api/files/${fileId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            const data = await response.json();

            if (response.ok) {
                this.showNotification('File deleted successfully!', 'success');
                this.loadUserFiles();
            } else {
                this.showNotification(data.message, 'error');
            }
        } catch (error) {
            this.showNotification('Delete failed. Please try again.', 'error');
        }
    }

    async handleDownload() {
        const shareId = document.getElementById('downloadBtn').dataset.shareId;
        const password = document.getElementById('downloadPassword').value;
        
        let url = `${this.baseURL}/api/files/download/${shareId}`;
        if (password) {
            url += `?password=${encodeURIComponent(password)}`;
        }

        try {
            const response = await fetch(url);
            
            if (response.ok) {
                // Create download link
                const blob = await response.blob();
                const downloadUrl = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = downloadUrl;
                a.download = ''; // Browser will use filename from Content-Disposition header
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(downloadUrl);
                
                this.showNotification('Download started!', 'success');
            } else {
                const data = await response.json();
                this.showNotification(data.message, 'error');
            }
        } catch (error) {
            this.showNotification('Download failed. Please try again.', 'error');
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        notification.textContent = message;
        notification.className = `notification ${type}`;
        notification.classList.add('show');

        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }
}

// Initialize the app
const app = new FileShareApp();