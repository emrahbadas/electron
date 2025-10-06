const fs = require('fs').promises;
const path = require('path');

/**
 * AI Manager - GitHub Models API entegrasyonu (Güvenli Proxy ile)
 */
class AIManager {
    constructor() {
        this.proxyUrl = 'http://127.0.0.1:3001';
        this.isInitialized = false;
        this.currentWorkspace = null;
        this.fileCache = new Map();
        this.availableModels = [];
        this.currentModel = 'gpt-4o-mini';
    }

    /**
     * AI Manager'ı başlat (proxy ile)
     */
    async initialize(workspacePath = null) {
        try {
            this.currentWorkspace = workspacePath;
            
            // Proxy health check
            const healthResponse = await fetch(`${this.proxyUrl}/health`);
            
            if (!healthResponse.ok) {
                throw new Error('AI Proxy server not running. Please start the proxy first.');
            }
            
            const healthData = await healthResponse.json();
            console.log('AI Proxy Status:', healthData);
            
            if (healthData.github_token !== 'Configured') {
                throw new Error('GitHub token not configured in proxy. Please check .env file.');
            }
            
            // Available models'ı al
            await this.fetchAvailableModels();
            
            // Workspace dosyalarını cache'le
            if (workspacePath) {
                await this.cacheWorkspaceFiles(workspacePath);
            }
            
            this.isInitialized = true;
            
            return {
                success: true,
                proxyStatus: healthData,
                availableModels: this.availableModels.length,
                cachedFiles: this.fileCache.size,
                currentModel: this.currentModel
            };
        } catch (error) {
            console.error('AI Manager initialization failed:', error);
            this.isInitialized = false;
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Available models'ı getir
     */
    async fetchAvailableModels() {
        try {
            const response = await fetch(`${this.proxyUrl}/ai/models`);
            
            if (response.ok) {
                const data = await response.json();
                this.availableModels = data.models || [];
                console.log(`Loaded ${this.availableModels.length} available AI models`);
            } else {
                console.warn('Could not fetch available models, using defaults');
                this.availableModels = [
                    { id: 'gpt-4o-mini', publisher: 'OpenAI' },
                    { id: 'gpt-4', publisher: 'OpenAI' },
                    { id: 'claude-3-5-sonnet', publisher: 'Anthropic' }
                ];
            }
        } catch (error) {
            console.warn('Models fetch failed:', error.message);
            this.availableModels = [
                { id: 'gpt-4o-mini', publisher: 'OpenAI' }
            ];
        }
    }
    async cacheWorkspaceFiles(workspacePath) {
        try {
            const files = await this.scanDirectory(workspacePath);
            
            // Önemli dosyaları cache'le (js, ts, html, css, json, md)
            const importantExtensions = ['.js', '.ts', '.html', '.css', '.json', '.md', '.jsx', '.tsx', '.py'];
            
            for (const file of files) {
                const ext = path.extname(file).toLowerCase();
                if (importantExtensions.includes(ext)) {
                    try {
                        const content = await fs.readFile(file, 'utf8');
                        const relativePath = path.relative(workspacePath, file);
                        
                        this.fileCache.set(relativePath, {
                            path: relativePath,
                            fullPath: file,
                            content: content.substring(0, 5000), // İlk 5KB'ı cache'le
                            lastModified: (await fs.stat(file)).mtime,
                            language: this.getLanguageFromExtension(ext)
                        });
                    } catch (readError) {
                        console.warn('Could not read file:', file, readError.message);
                    }
                }
            }
            
            console.log(`Cached ${this.fileCache.size} files from workspace`);
        } catch (error) {
            console.error('Error caching workspace files:', error);
        }
    }

    /**
     * Dizin tarama
     */
    async scanDirectory(dir, maxDepth = 3, currentDepth = 0) {
        const files = [];
        
        if (currentDepth >= maxDepth) return files;
        
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                
                // node_modules, .git gibi klasörleri atla
                if (entry.isDirectory() && !['node_modules', '.git', 'dist', 'build', '.vscode'].includes(entry.name)) {
                    const subFiles = await this.scanDirectory(fullPath, maxDepth, currentDepth + 1);
                    files.push(...subFiles);
                } else if (entry.isFile()) {
                    files.push(fullPath);
                }
            }
        } catch (error) {
            console.warn('Error scanning directory:', dir, error.message);
        }
        
        return files;
    }

    /**
     * AI ile sohbet et (GitHub Models API ile)
     */
    async chat(message, options = {}) {
        if (!this.isInitialized) {
            throw new Error('AI Manager not initialized. Please call initialize() first.');
        }

        try {
            // File context hazırla
            const fileContents = Array.from(this.fileCache.values()).slice(0, 5); // İlk 5 dosya
            
            // System message hazırla
            const systemMessage = {
                role: 'system',
                content: `You are an AI assistant integrated into "KayraDeniz Kod Çanarı" Electron application. 
                
Project Info:
- Name: KayraDeniz Kod Çanarı
- Type: Electron Application
- Workspace: ${this.currentWorkspace || 'Not set'}
- Total Files: ${this.fileCache.size}

Available files in context:
${fileContents.map(file => `- ${file.path}: ${file.content.substring(0, 100)}...`).join('\n')}

Please provide helpful, code-focused responses and suggest specific implementations when possible.`
            };

            const messages = [
                systemMessage,
                { role: 'user', content: message }
            ];

            // GitHub Models API'ye istek gönder
            const response = await fetch(`${this.proxyUrl}/ai/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: options.model || this.currentModel,
                    messages: messages,
                    temperature: options.temperature || 0.7,
                    max_tokens: options.maxTokens || 2000
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`AI API Error: ${errorData.error || response.statusText}`);
            }

            const data = await response.json();
            
            return {
                success: true,
                message: data.choices?.[0]?.message?.content || 'No response from AI',
                usage: data.usage,
                model: data.model
            };
        } catch (error) {
            console.error('Chat error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Kod analizi (GitHub Models API ile)
     */
    async analyzeCode(code, language = 'javascript', request = 'Analyze and improve this code') {
        if (!this.isInitialized) {
            throw new Error('AI Manager not initialized');
        }

        const messages = [
            {
                role: 'system',
                content: `You are a code analysis expert specializing in ${language} development. Provide helpful analysis and suggestions.`
            },
            {
                role: 'user',
                content: `${request}\n\n\`\`\`${language}\n${code}\n\`\`\``
            }
        ];

        try {
            const response = await fetch(`${this.proxyUrl}/ai/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: this.currentModel,
                    messages: messages,
                    temperature: 0.3
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`AI API Error: ${errorData.error || response.statusText}`);
            }

            const data = await response.json();
            
            return {
                success: true,
                message: data.choices?.[0]?.message?.content || 'No analysis available',
                usage: data.usage
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Kod üret (GitHub Models API ile)
     */
    async generateCode(prompt, language = 'javascript') {
        if (!this.isInitialized) {
            throw new Error('AI Manager not initialized');
        }

        const messages = [
            {
                role: 'system',
                content: `You are a code generation assistant. Generate clean, modern, well-commented ${language} code based on user requirements. Only return code, no explanations unless asked.`
            },
            {
                role: 'user',
                content: prompt
            }
        ];

        try {
            const response = await fetch(`${this.proxyUrl}/ai/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: this.currentModel,
                    messages: messages,
                    temperature: 0.3
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`AI API Error: ${errorData.error || response.statusText}`);
            }

            const data = await response.json();
            
            return {
                success: true,
                message: data.choices?.[0]?.message?.content || 'No code generated',
                usage: data.usage
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Workspace'i yenile
     */
    async refreshWorkspace(newWorkspacePath = null) {
        const workspacePath = newWorkspacePath || this.currentWorkspace;
        if (workspacePath) {
            this.fileCache.clear();
            this.currentWorkspace = workspacePath;
            await this.cacheWorkspaceFiles(workspacePath);
        }
    }

    /**
     * Dosya extension'dan dil çıkar
     */
    getLanguageFromExtension(ext) {
        const langMap = {
            '.js': 'javascript',
            '.ts': 'typescript',
            '.py': 'python',
            '.html': 'html',
            '.css': 'css',
            '.json': 'json',
            '.md': 'markdown',
            '.jsx': 'jsx',
            '.tsx': 'tsx'
        };
        return langMap[ext] || 'text';
    }

    /**
     * Manager durumu
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            connected: this.isInitialized,
            workspace: this.currentWorkspace,
            cachedFiles: this.fileCache.size,
            availableModels: this.availableModels.length,
            currentModel: this.currentModel,
            proxyUrl: this.proxyUrl
        };
    }

    /**
     * Model değiştir
     */
    setModel(modelName) {
        if (this.availableModels.find(m => m.id === modelName)) {
            this.currentModel = modelName;
            return true;
        }
        return false;
    }

    /**
     * Cleanup
     */
    cleanup() {
        this.fileCache.clear();
        this.isInitialized = false;
    }
}

module.exports = AIManager;