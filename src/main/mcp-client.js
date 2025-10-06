const { spawn } = require('child_process');

/**
 * Electron uygulaması için Basit MCP-Style Client
 * Python JSON-RPC server'ı child process olarak çalıştırır
 */
class ElectronMCPClient {
    constructor() {
        this.serverProcess = null;
        this.tools = new Map();
        this.isConnected = false;
        this.requestId = 1;
        this.pendingRequests = new Map();
    }

    /**
     * MCP Server'ı başlat ve bağlan
     */
    async connect(serverPath = null) {
        try {
            // Default server path - ana projedeki Python server
            const defaultServerPath = serverPath || require('path').join(__dirname, '../mcp-tools/server.py');
            
            console.log('KayraDeniz Tool Server başlatılıyor:', defaultServerPath);
            
            // Python server'ı child process olarak başlat
            this.serverProcess = spawn('python', [defaultServerPath], {
                stdio: ['pipe', 'pipe', 'pipe'],
                cwd: process.cwd()
            });

            // Server çıkış kodunu dinle
            this.serverProcess.on('exit', (code) => {
                console.log(`Tool Server kapandı, çıkış kodu: ${code}`);
                this.isConnected = false;
            });

            // Bağlantı kontrol değişkeni
            let serverReady = false;
            
            // Server stdout'tan gelen JSON yanıtlarını dinle
            let stdoutBuffer = '';
            this.serverProcess.stdout.on('data', (data) => {
                stdoutBuffer += data.toString();
                
                // Tam JSON mesajlarını ayır
                const lines = stdoutBuffer.split('\n');
                stdoutBuffer = lines.pop(); // Son satırı buffer'da tut
                
                for (const line of lines) {
                    if (line.trim()) {
                        try {
                            const response = JSON.parse(line.trim());
                            this.handleResponse(response);
                        } catch (e) {
                            console.log('MCP Server output:', line.trim());
                        }
                    }
                }
            });
            
            // Server stderr'dan gelen logları dinle ve ready signal'ı yakala
            this.serverProcess.stderr.on('data', (data) => {
                const message = data.toString();
                console.log('Tool Server Log:', message);
                
                if (message.includes('Tool Server started')) {
                    serverReady = true;
                }
            });
            
            // Server'ın hazır olmasını bekle
            let attempts = 0;
            while (!serverReady && attempts < 20) {
                await new Promise(resolve => setTimeout(resolve, 500));
                attempts++;
            }
            
            if (!serverReady) {
                console.warn('Server ready signal alınamadı, devam ediliyor...');
            }
            
            // Biraz daha bekle ve bağlantıyı işaretle
            await new Promise(resolve => setTimeout(resolve, 2000));
            this.isConnected = true;
            
            // Tools'ları yükle
            await this.loadTools();
            
            console.log('Tool Client başarıyla bağlandı');
            return true;
            
        } catch (error) {
            console.error('Tool Client bağlantı hatası:', error);
            this.isConnected = false;
            return false;
        }
    }

    /**
     * JSON-RPC isteği gönder
     */
    async sendRequest(method, params = {}) {
        return new Promise((resolve, reject) => {
            if (!this.serverProcess || !this.isConnected) {
                reject(new Error('Server bağlı değil'));
                return;
            }

            const id = this.requestId++;
            const request = {
                jsonrpc: "2.0",
                method: method,
                params: params,
                id: id
            };

            // Yanıt bekleme
            this.pendingRequests.set(id, { resolve, reject });

            // İsteği gönder
            try {
                this.serverProcess.stdin.write(JSON.stringify(request) + '\n');
            } catch (error) {
                this.pendingRequests.delete(id);
                reject(error);
            }

            // Timeout
            setTimeout(() => {
                if (this.pendingRequests.has(id)) {
                    this.pendingRequests.delete(id);
                    reject(new Error('Request timeout'));
                }
            }, 10000);
        });
    }

    /**
     * Server'dan gelen yanıtları işle
     */
    handleResponse(response) {
        const id = response.id;
        
        if (this.pendingRequests.has(id)) {
            const { resolve, reject } = this.pendingRequests.get(id);
            this.pendingRequests.delete(id);

            if (response.error) {
                reject(new Error(response.error.message));
            } else {
                resolve(response.result);
            }
        }
    }

    /**
     * Mevcut tools'ları server'dan al
     */
    async loadTools() {
        try {
            const response = await this.sendRequest('list_tools');
            
            this.tools.clear();
            if (response && response.tools) {
                response.tools.forEach(tool => {
                    this.tools.set(tool.name, tool);
                    console.log(`Tool yüklendi: ${tool.name} - ${tool.description}`);
                });
            }

            return Array.from(this.tools.values());
        } catch (error) {
            console.error('Tools yükleme hatası:', error);
            return [];
        }
    }

    /**
     * Belirli bir tool'u çalıştır
     */
    async callTool(toolName, args = {}) {
        if (!this.isConnected) {
            throw new Error('Tool Client bağlı değil');
        }

        if (!this.tools.has(toolName)) {
            throw new Error(`Tool bulunamadı: ${toolName}`);
        }

        try {
            console.log(`Tool çalıştırılıyor: ${toolName}`, args);
            
            const response = await this.sendRequest('call_tool', {
                name: toolName,
                arguments: args
            });

            console.log(`Tool sonucu:`, response);
            return response;
        } catch (error) {
            console.error(`Tool çalıştırma hatası (${toolName}):`, error);
            throw error;
        }
    }

    /**
     * Mevcut tools'ların listesini al
     */
    getAvailableTools() {
        return Array.from(this.tools.values());
    }

    /**
     * Bağlantı durumunu kontrol et
     */
    isClientConnected() {
        return Boolean(this.isConnected && this.serverProcess && !this.serverProcess.killed);
    }

    /**
     * Bağlantıyı kapat
     */
    async disconnect() {
        try {
            this.isConnected = false;

            if (this.serverProcess) {
                this.serverProcess.kill('SIGTERM');
                this.serverProcess = null;
            }

            this.tools.clear();
            this.pendingRequests.clear();
            
            console.log('Tool Client bağlantısı kapatıldı');
        } catch (error) {
            console.error('Bağlantı kapatma hatası:', error);
        }
    }

    /**
     * Dosya işlemleri için yardımcı metodlar
     */
    async createFile(filePath, content, workingDirectory = null) {
        const params = { 
            file_path: filePath, 
            content: content 
        };
        
        // Add working_directory if provided
        if (workingDirectory) {
            params.working_directory = workingDirectory;
        }
        
        const result = await this.callTool('create_file', params);
        return result.content?.[0]?.text || result.toString();
    }

    async readFile(filePath) {
        const result = await this.callTool('read_file', { 
            file_path: filePath 
        });
        return result.content?.[0]?.text || result.toString();
    }

    async listFiles(directoryPath = '.') {
        const result = await this.callTool('list_files', { 
            directory_path: directoryPath 
        });
        return result.content?.[0]?.text || result.toString();
    }

    async writeCode(filePath, content, language = 'text', workingDirectory = null) {
        const params = { 
            file_path: filePath, 
            content: content,
            language: language
        };
        
        // Add working_directory if provided
        if (workingDirectory) {
            params.working_directory = workingDirectory;
        }
        
        const result = await this.callTool('write_code', params);
        return result.content?.[0]?.text || result.toString();
    }

    async generateProject(projectName, projectType = 'web', basePath = '.', workingDirectory = null) {
        const params = {
            project_name: projectName,
            project_type: projectType,
            base_path: basePath
        };
        
        // Add working_directory if provided
        if (workingDirectory) {
            params.working_directory = workingDirectory;
        }
        
        const result = await this.callTool('generate_project_structure', params);
        return result.content?.[0]?.text || result.toString();
    }

    async testConnection() {
        const result = await this.callTool('hello_world', { 
            message: 'Electron App Test' 
        });
        return result.content?.[0]?.text || result.toString();
    }
}

module.exports = ElectronMCPClient;