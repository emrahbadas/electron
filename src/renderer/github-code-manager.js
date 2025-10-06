/**
 * KayraDeniz GitHub ve Code Agent Entegrasyon Yöneticisi
 * Electron renderer için GitHub API ve Code Agent işlevlerini yönetir
 */

class KayraGitHubCodeManager {
    constructor() {
        this.mcpClient = null;
        this.githubToken = null;
        this.openaiApiKey = null;
        this.currentProject = null;
        this.activeFiles = new Map();
        
        this.init();
    }

    init() {
        console.log('🚀 KayraGitHubCodeManager başlatılıyor...');
        this.setupEventListeners();
        this.createUI();
    }

    /**
     * MCP Client'ı ayarla
     * @param {object} mcpClient - MCP client instance
     */
    setMCPClient(mcpClient) {
        this.mcpClient = mcpClient;
        console.log('✅ MCP Client bağlandı');
    }

    /**
     * GitHub token ayarla
     * @param {string} token - GitHub Fine-grained token
     * @param {string} userName - Git user name
     * @param {string} userEmail - Git user email
     */
    async setGitHubToken(token, userName, userEmail) {
        try {
            this.githubToken = token;
            
            if (this.mcpClient) {
                const result = await this.mcpClient.callTool('set_github_token', {
                    token: token,
                    git_user_name: userName,
                    git_user_email: userEmail
                });
                
                this.showNotification('GitHub Token Ayarlandı', result.content[0].text, 'success');
                return true;
            }
            
            throw new Error('MCP Client bağlı değil');
        } catch (error) {
            this.showNotification('GitHub Token Hatası', error.message, 'error');
            return false;
        }
    }

    /**
     * OpenAI API key ayarla
     * @param {string} apiKey - OpenAI API key
     */
    setOpenAIKey(apiKey) {
        this.openaiApiKey = apiKey;
        this.showNotification('OpenAI Key Ayarlandı', 'Code Agent artık kullanılabilir', 'success');
    }

    /**
     * Repository clone et
     * @param {string} repoUrl - GitHub repository URL
     * @param {string} targetDir - Target directory
     */
    async cloneRepository(repoUrl, targetDir) {
        try {
            if (!this.mcpClient) throw new Error('MCP Client bağlı değil');
            
            const result = await this.mcpClient.callTool('github_clone', {
                repo_url: repoUrl,
                target_dir: targetDir,
                working_directory: this.currentProject
            });
            
            this.showNotification('Repository Clone', result.content[0].text, 'success');
            this.refreshProjectView();
            
        } catch (error) {
            this.showNotification('Clone Hatası', error.message, 'error');
        }
    }

    /**
     * Repository oluştur
     * @param {string} name - Repository name
     * @param {string} description - Repository description
     * @param {boolean} isPrivate - Private repository
     */
    async createRepository(name, description, isPrivate = false) {
        try {
            if (!this.mcpClient) throw new Error('MCP Client bağlı değil');
            
            const result = await this.mcpClient.callTool('github_create_repo', {
                name: name,
                description: description,
                private: isPrivate
            });
            
            this.showNotification('Repository Oluşturuldu', result.content[0].text, 'success');
            
        } catch (error) {
            this.showNotification('Repository Oluşturma Hatası', error.message, 'error');
        }
    }

    /**
     * Gist oluştur ve paylaş
     * @param {string} filename - File name
     * @param {string} content - File content
     * @param {string} description - Gist description
     * @param {boolean} isPublic - Public gist
     */
    async createGist(filename, content, description, isPublic = true) {
        try {
            if (!this.mcpClient) throw new Error('MCP Client bağlı değil');
            
            const result = await this.mcpClient.callTool('github_create_gist', {
                filename: filename,
                content: content,
                description: description,
                public: isPublic
            });
            
            this.showNotification('Gist Oluşturuldu', result.content[0].text, 'success');
            
        } catch (error) {
            this.showNotification('Gist Oluşturma Hatası', error.message, 'error');
        }
    }

    /**
     * Kod arama
     * @param {string} query - Search query
     */
    async searchCode(query) {
        try {
            if (!this.mcpClient) throw new Error('MCP Client bağlı değil');
            
            const result = await this.mcpClient.callTool('github_search_code', {
                query: query
            });
            
            this.displaySearchResults(result.content[0].text);
            
        } catch (error) {
            this.showNotification('Arama Hatası', error.message, 'error');
        }
    }

    /**
     * Git commit işlemi
     * @param {string} message - Commit message
     * @param {string} repoPath - Repository path
     */
    async gitCommit(message, repoPath = '.') {
        try {
            if (!this.mcpClient) throw new Error('MCP Client bağlı değil');
            
            const result = await this.mcpClient.callTool('git_commit', {
                message: message,
                repo_path: repoPath,
                working_directory: this.currentProject
            });
            
            this.showNotification('Git Commit', result.content[0].text, 'success');
            
        } catch (error) {
            this.showNotification('Commit Hatası', error.message, 'error');
        }
    }

    /**
     * Git push işlemi
     * @param {string} remote - Remote name
     * @param {string} branch - Branch name
     */
    async gitPush(remote = 'origin', branch = 'main') {
        try {
            if (!this.mcpClient) throw new Error('MCP Client bağlı değil');
            
            const result = await this.mcpClient.callTool('git_push', {
                remote: remote,
                branch: branch,
                repo_path: '.',
                working_directory: this.currentProject
            });
            
            this.showNotification('Git Push', result.content[0].text, 'success');
            
        } catch (error) {
            this.showNotification('Push Hatası', error.message, 'error');
        }
    }

    /**
     * Kod analizi yap
     * @param {string} filePath - File path
     */
    async analyzeCode(filePath) {
        try {
            if (!this.mcpClient) throw new Error('MCP Client bağlı değil');
            
            const result = await this.mcpClient.callTool('code_agent_analyze', {
                file_path: filePath,
                working_directory: this.currentProject
            });
            
            this.displayAnalysisResult(result.content[0].text, filePath);
            
        } catch (error) {
            this.showNotification('Analiz Hatası', error.message, 'error');
        }
    }

    /**
     * Kod düzenleme önerileri
     * @param {string} filePath - File path
     * @param {string} editType - Edit type (optimize, refactor, fix)
     */
    async getEditSuggestions(filePath, editType = 'optimize') {
        try {
            if (!this.mcpClient) throw new Error('MCP Client bağlı değil');
            
            const result = await this.mcpClient.callTool('code_agent_edit', {
                file_path: filePath,
                edit_type: editType,
                working_directory: this.currentProject
            });
            
            this.displayEditSuggestions(result.content[0].text, filePath);
            
        } catch (error) {
            this.showNotification('Düzenleme Önerileri Hatası', error.message, 'error');
        }
    }

    /**
     * Kod refactoring yap
     * @param {string} filePath - File path
     * @param {string} refactorType - Refactor type
     */
    async refactorCode(filePath, refactorType = 'general') {
        try {
            if (!this.mcpClient) throw new Error('MCP Client bağlı değil');
            
            const result = await this.mcpClient.callTool('code_agent_refactor', {
                file_path: filePath,
                refactor_type: refactorType,
                working_directory: this.currentProject
            });
            
            this.displayRefactorResult(result.content[0].text, filePath);
            this.refreshFileContent(filePath);
            
        } catch (error) {
            this.showNotification('Refactoring Hatası', error.message, 'error');
        }
    }

    /**
     * UI oluştur
     */
    createUI() {
        const container = document.createElement('div');
        container.className = 'kayra-github-manager';
        container.innerHTML = `
            <div class="kayra-panel">
                <h3>🐙 GitHub & Code Agent</h3>
                
                <!-- GitHub Token Setup -->
                <div class="section">
                    <h4>🔑 GitHub Token</h4>
                    <input type="password" id="github-token" placeholder="GitHub Fine-grained Token">
                    <input type="text" id="git-username" placeholder="Git Username">
                    <input type="email" id="git-email" placeholder="Git Email">
                    <button onclick="kayraGitHubManager.setupGitHub()">Token Ayarla</button>
                </div>

                <!-- OpenAI Key Setup -->
                <div class="section">
                    <h4>🤖 OpenAI API Key</h4>
                    <input type="password" id="openai-key" placeholder="OpenAI API Key">
                    <button onclick="kayraGitHubManager.setupOpenAI()">API Key Ayarla</button>
                </div>

                <!-- Repository Operations -->
                <div class="section">
                    <h4>📁 Repository İşlemleri</h4>
                    <div class="repo-ops">
                        <input type="text" id="repo-url" placeholder="Repository URL">
                        <input type="text" id="target-dir" placeholder="Hedef Dizin">
                        <button onclick="kayraGitHubManager.cloneRepo()">Clone</button>
                    </div>
                    <div class="repo-create">
                        <input type="text" id="new-repo-name" placeholder="Yeni Repo Adı">
                        <input type="text" id="new-repo-desc" placeholder="Açıklama">
                        <label><input type="checkbox" id="private-repo"> Private</label>
                        <button onclick="kayraGitHubManager.createRepo()">Oluştur</button>
                    </div>
                </div>

                <!-- Git Operations -->
                <div class="section">
                    <h4>🔄 Git İşlemleri</h4>
                    <div class="git-ops">
                        <input type="text" id="commit-message" placeholder="Commit mesajı">
                        <button onclick="kayraGitHubManager.commitChanges()">Commit</button>
                        <button onclick="kayraGitHubManager.pushChanges()">Push</button>
                    </div>
                </div>

                <!-- Code Agent -->
                <div class="section">
                    <h4>🤖 Code Agent</h4>
                    <div class="code-agent-ops">
                        <input type="text" id="analyze-file" placeholder="Dosya yolu">
                        <button onclick="kayraGitHubManager.analyzeFile()">Analiz Et</button>
                        <select id="edit-type">
                            <option value="optimize">Optimize</option>
                            <option value="refactor">Refactor</option>
                            <option value="fix">Fix</option>
                            <option value="modernize">Modernize</option>
                        </select>
                        <button onclick="kayraGitHubManager.getEditSuggestions()">Öneriler</button>
                        <button onclick="kayraGitHubManager.performRefactor()">Refactor</button>
                    </div>
                </div>

                <!-- Search -->
                <div class="section">
                    <h4>🔍 Kod Arama</h4>
                    <input type="text" id="search-query" placeholder="Arama sorgusu">
                    <button onclick="kayraGitHubManager.performSearch()">Ara</button>
                </div>

                <!-- Results Area -->
                <div class="results-area">
                    <h4>📋 Sonuçlar</h4>
                    <div id="results-content"></div>
                </div>
            </div>
        `;

        // Stil ekle
        const style = document.createElement('style');
        style.textContent = `
            .kayra-github-manager {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 20px;
                border-radius: 10px;
                margin: 20px;
                max-width: 800px;
            }

            .kayra-panel h3 {
                margin-top: 0;
                text-align: center;
                font-size: 1.5em;
            }

            .section {
                background: rgba(255, 255, 255, 0.1);
                padding: 15px;
                margin: 15px 0;
                border-radius: 8px;
                border: 1px solid rgba(255, 255, 255, 0.2);
            }

            .section h4 {
                margin-top: 0;
                color: #ffffff;
                font-size: 1.1em;
            }

            .section input, .section select {
                background: rgba(255, 255, 255, 0.9);
                border: none;
                padding: 8px 12px;
                margin: 5px;
                border-radius: 5px;
                color: #333;
                min-width: 200px;
            }

            .section button {
                background: #4CAF50;
                color: white;
                border: none;
                padding: 8px 16px;
                margin: 5px;
                border-radius: 5px;
                cursor: pointer;
                transition: background 0.3s;
            }

            .section button:hover {
                background: #45a049;
            }

            .repo-ops, .repo-create, .git-ops, .code-agent-ops {
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                gap: 10px;
            }

            .results-area {
                background: rgba(0, 0, 0, 0.3);
                padding: 15px;
                border-radius: 8px;
                margin-top: 20px;
                max-height: 400px;
                overflow-y: auto;
            }

            #results-content {
                font-family: 'Courier New', monospace;
                font-size: 0.9em;
                white-space: pre-wrap;
                line-height: 1.4;
            }

            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 15px 20px;
                border-radius: 5px;
                color: white;
                font-weight: bold;
                z-index: 1000;
                animation: slideIn 0.3s ease-out;
            }

            .notification.success {
                background: #4CAF50;
            }

            .notification.error {
                background: #f44336;
            }

            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;

        document.head.appendChild(style);
        document.body.appendChild(container);
    }

    /**
     * Event listener'ları ayarla
     */
    setupEventListeners() {
        // Global methods for UI
        window.kayraGitHubManager = {
            setupGitHub: () => {
                const token = document.getElementById('github-token').value;
                const username = document.getElementById('git-username').value;
                const email = document.getElementById('git-email').value;
                this.setGitHubToken(token, username, email);
            },

            setupOpenAI: () => {
                const apiKey = document.getElementById('openai-key').value;
                this.setOpenAIKey(apiKey);
            },

            cloneRepo: () => {
                const repoUrl = document.getElementById('repo-url').value;
                const targetDir = document.getElementById('target-dir').value;
                this.cloneRepository(repoUrl, targetDir);
            },

            createRepo: () => {
                const name = document.getElementById('new-repo-name').value;
                const description = document.getElementById('new-repo-desc').value;
                const isPrivate = document.getElementById('private-repo').checked;
                this.createRepository(name, description, isPrivate);
            },

            commitChanges: () => {
                const message = document.getElementById('commit-message').value;
                this.gitCommit(message);
            },

            pushChanges: () => {
                this.gitPush();
            },

            analyzeFile: () => {
                const filePath = document.getElementById('analyze-file').value;
                this.analyzeCode(filePath);
            },

            getEditSuggestions: () => {
                const filePath = document.getElementById('analyze-file').value;
                const editType = document.getElementById('edit-type').value;
                this.getEditSuggestions(filePath, editType);
            },

            performRefactor: () => {
                const filePath = document.getElementById('analyze-file').value;
                const refactorType = document.getElementById('edit-type').value;
                this.refactorCode(filePath, refactorType);
            },

            performSearch: () => {
                const query = document.getElementById('search-query').value;
                this.searchCode(query);
            }
        };
    }

    /**
     * Notification göster
     * @param {string} title - Notification title
     * @param {string} message - Notification message
     * @param {string} type - Notification type (success, error)
     */
    showNotification(title, message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `<strong>${title}</strong><br>${message}`;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    /**
     * Arama sonuçlarını göster
     * @param {string} results - Search results
     */
    displaySearchResults(results) {
        const resultsContent = document.getElementById('results-content');
        resultsContent.textContent = results;
    }

    /**
     * Analiz sonuçlarını göster
     * @param {string} analysis - Analysis result
     * @param {string} filePath - File path
     */
    displayAnalysisResult(analysis, filePath) {
        const resultsContent = document.getElementById('results-content');
        resultsContent.textContent = `📊 ${filePath} Analiz Sonucu:\n\n${analysis}`;
    }

    /**
     * Düzenleme önerilerini göster
     * @param {string} suggestions - Edit suggestions
     * @param {string} filePath - File path
     */
    displayEditSuggestions(suggestions, filePath) {
        const resultsContent = document.getElementById('results-content');
        resultsContent.textContent = `💡 ${filePath} Düzenleme Önerileri:\n\n${suggestions}`;
    }

    /**
     * Refactor sonuçlarını göster
     * @param {string} result - Refactor result
     * @param {string} filePath - File path
     */
    displayRefactorResult(result, filePath) {
        const resultsContent = document.getElementById('results-content');
        resultsContent.textContent = `♻️ ${filePath} Refactor Sonucu:\n\n${result}`;
    }

    /**
     * Proje görünümünü yenile
     */
    refreshProjectView() {
        // Implementation for refreshing project view
        console.log('🔄 Proje görünümü yenileniyor...');
    }

    /**
     * Dosya içeriğini yenile
     * @param {string} filePath - File path
     */
    refreshFileContent(filePath) {
        // Implementation for refreshing file content
        console.log(`🔄 ${filePath} dosyası yenileniyor...`);
    }

    /**
     * Aktif projeyi ayarla
     * @param {string} projectPath - Project path
     */
    setCurrentProject(projectPath) {
        this.currentProject = projectPath;
        this.showNotification('Proje Ayarlandı', `Aktif proje: ${projectPath}`, 'success');
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = KayraGitHubCodeManager;
}

// Global instance
if (typeof window !== 'undefined') {
    window.KayraGitHubCodeManager = KayraGitHubCodeManager;
}