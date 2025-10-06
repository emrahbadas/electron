/**
 * KayraDeniz GitHub API Manager
 * GitHub Fine-grained personal access token ile tam GitHub entegrasyonu
 */

class GitHubAPIManager {
    constructor() {
        this.baseURL = 'https://api.github.com';
        this.token = null;
        this.userInfo = null;
        this.rateLimitInfo = null;
    }

    /**
     * GitHub token'ı ayarla
     * @param {string} token - Fine-grained personal access token
     */
    setToken(token) {
        this.token = token;
        console.log('GitHub token ayarlandı');
    }

    /**
     * API isteği gönder
     * @param {string} endpoint - API endpoint
     * @param {object} options - Fetch options
     * @returns {Promise<object>} API response
     */
    async makeRequest(endpoint, options = {}) {
        if (!this.token) {
            throw new Error('GitHub token ayarlanmamış!');
        }

        const url = endpoint.startsWith('http') ? endpoint : `${this.baseURL}${endpoint}`;
        
        const defaultOptions = {
            headers: {
                'Authorization': `token ${this.token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
                'User-Agent': 'KayraDeniz-Kod-Canavari'
            }
        };

        const finalOptions = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...options.headers
            }
        };

        try {
            const response = await fetch(url, finalOptions);
            
            // Rate limit bilgilerini sakla
            this.rateLimitInfo = {
                limit: response.headers.get('x-ratelimit-limit'),
                remaining: response.headers.get('x-ratelimit-remaining'),
                reset: response.headers.get('x-ratelimit-reset')
            };

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`GitHub API Error: ${response.status} - ${errorData.message || response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('GitHub API request failed:', error);
            throw error;
        }
    }

    /**
     * Kullanıcı bilgilerini al
     * @returns {Promise<object>} User info
     */
    async getUserInfo() {
        try {
            this.userInfo = await this.makeRequest('/user');
            return this.userInfo;
        } catch (error) {
            console.error('Kullanıcı bilgisi alınamadı:', error);
            throw error;
        }
    }

    /**
     * Repository listesi al
     * @param {object} options - Query options
     * @returns {Promise<Array>} Repository list
     */
    async getRepositories(options = {}) {
        const queryParams = new URLSearchParams({
            sort: options.sort || 'updated',
            direction: options.direction || 'desc',
            per_page: options.per_page || 30,
            page: options.page || 1
        });

        return await this.makeRequest(`/user/repos?${queryParams}`);
    }

    /**
     * Repository bilgisi al
     * @param {string} owner - Repository owner
     * @param {string} repo - Repository name
     * @returns {Promise<object>} Repository info
     */
    async getRepository(owner, repo) {
        return await this.makeRequest(`/repos/${owner}/${repo}`);
    }

    /**
     * Repository içeriği al
     * @param {string} owner - Repository owner
     * @param {string} repo - Repository name
     * @param {string} path - File path
     * @returns {Promise<object>} File content
     */
    async getRepositoryContent(owner, repo, path = '') {
        return await this.makeRequest(`/repos/${owner}/${repo}/contents/${path}`);
    }

    /**
     * Repository'deki dosyayı güncelle veya oluştur
     * @param {string} owner - Repository owner
     * @param {string} repo - Repository name
     * @param {string} path - File path
     * @param {string} content - File content (base64 encoded)
     * @param {string} message - Commit message
     * @param {string} sha - File SHA (güncelleme için gerekli)
     * @returns {Promise<object>} Commit info
     */
    async updateFile(owner, repo, path, content, message, sha = null) {
        const body = {
            message,
            content: btoa(unescape(encodeURIComponent(content))), // UTF-8 to base64
        };

        if (sha) {
            body.sha = sha;
        }

        return await this.makeRequest(`/repos/${owner}/${repo}/contents/${path}`, {
            method: 'PUT',
            body: JSON.stringify(body)
        });
    }

    /**
     * Repository fork'la
     * @param {string} owner - Repository owner
     * @param {string} repo - Repository name
     * @returns {Promise<object>} Forked repository info
     */
    async forkRepository(owner, repo) {
        return await this.makeRequest(`/repos/${owner}/${repo}/forks`, {
            method: 'POST'
        });
    }

    /**
     * Issue listesi al
     * @param {string} owner - Repository owner
     * @param {string} repo - Repository name
     * @param {object} options - Query options
     * @returns {Promise<Array>} Issues list
     */
    async getIssues(owner, repo, options = {}) {
        const queryParams = new URLSearchParams({
            state: options.state || 'open',
            sort: options.sort || 'updated',
            direction: options.direction || 'desc',
            per_page: options.per_page || 30,
            page: options.page || 1
        });

        return await this.makeRequest(`/repos/${owner}/${repo}/issues?${queryParams}`);
    }

    /**
     * Issue oluştur
     * @param {string} owner - Repository owner
     * @param {string} repo - Repository name
     * @param {string} title - Issue title
     * @param {string} body - Issue body
     * @param {Array} labels - Issue labels
     * @returns {Promise<object>} Created issue
     */
    async createIssue(owner, repo, title, body = '', labels = []) {
        return await this.makeRequest(`/repos/${owner}/${repo}/issues`, {
            method: 'POST',
            body: JSON.stringify({
                title,
                body,
                labels
            })
        });
    }

    /**
     * Pull Request listesi al
     * @param {string} owner - Repository owner
     * @param {string} repo - Repository name
     * @param {object} options - Query options
     * @returns {Promise<Array>} Pull requests list
     */
    async getPullRequests(owner, repo, options = {}) {
        const queryParams = new URLSearchParams({
            state: options.state || 'open',
            sort: options.sort || 'updated',
            direction: options.direction || 'desc',
            per_page: options.per_page || 30,
            page: options.page || 1
        });

        return await this.makeRequest(`/repos/${owner}/${repo}/pulls?${queryParams}`);
    }

    /**
     * Pull Request oluştur
     * @param {string} owner - Repository owner
     * @param {string} repo - Repository name
     * @param {string} title - PR title
     * @param {string} head - Head branch
     * @param {string} base - Base branch
     * @param {string} body - PR body
     * @returns {Promise<object>} Created pull request
     */
    async createPullRequest(owner, repo, title, head, base, body = '') {
        return await this.makeRequest(`/repos/${owner}/${repo}/pulls`, {
            method: 'POST',
            body: JSON.stringify({
                title,
                head,
                base,
                body
            })
        });
    }

    /**
     * Gist listesi al
     * @param {object} options - Query options
     * @returns {Promise<Array>} Gists list
     */
    async getGists(options = {}) {
        const queryParams = new URLSearchParams({
            per_page: options.per_page || 30,
            page: options.page || 1
        });

        return await this.makeRequest(`/gists?${queryParams}`);
    }

    /**
     * Gist oluştur
     * @param {string} description - Gist description
     * @param {object} files - Files object {filename: {content: string}}
     * @param {boolean} public - Public gist
     * @returns {Promise<object>} Created gist
     */
    async createGist(description, files, isPublic = true) {
        return await this.makeRequest('/gists', {
            method: 'POST',
            body: JSON.stringify({
                description,
                files,
                public: isPublic
            })
        });
    }

    /**
     * Code search
     * @param {string} query - Search query
     * @param {object} options - Search options
     * @returns {Promise<object>} Search results
     */
    async searchCode(query, options = {}) {
        const queryParams = new URLSearchParams({
            q: query,
            sort: options.sort || 'indexed',
            order: options.order || 'desc',
            per_page: options.per_page || 30,
            page: options.page || 1
        });

        return await this.makeRequest(`/search/code?${queryParams}`);
    }

    /**
     * Repository search
     * @param {string} query - Search query
     * @param {object} options - Search options
     * @returns {Promise<object>} Search results
     */
    async searchRepositories(query, options = {}) {
        const queryParams = new URLSearchParams({
            q: query,
            sort: options.sort || 'stars',
            order: options.order || 'desc',
            per_page: options.per_page || 30,
            page: options.page || 1
        });

        return await this.makeRequest(`/search/repositories?${queryParams}`);
    }

    /**
     * Rate limit bilgisi al
     * @returns {Promise<object>} Rate limit info
     */
    async getRateLimit() {
        return await this.makeRequest('/rate_limit');
    }

    /**
     * Repository clone için URL al
     * @param {string} owner - Repository owner
     * @param {string} repo - Repository name
     * @returns {string} Clone URL
     */
    getCloneURL(owner, repo) {
        return `https://github.com/${owner}/${repo}.git`;
    }

    /**
     * Token'ın geçerliliğini test et
     * @returns {Promise<boolean>} Token validity
     */
    async testToken() {
        try {
            await this.getUserInfo();
            return true;
        } catch (error) {
            console.error('Token test failed:', error);
            return false;
        }
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GitHubAPIManager;
}

// Global access
window.GitHubAPIManager = GitHubAPIManager;