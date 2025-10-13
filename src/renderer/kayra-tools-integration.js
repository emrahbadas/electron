/**
 * KayraDeniz Tool System Integration
 * Continue.dev pattern'ini mevcut app.js sistemine entegre eder
 */

import { KayraToolRegistry, KayraToolDispatcher } from './kayra-tools-architecture.js';
import { 
    readFileToolDefinition, readFileToolImpl,
    writeFileToolDefinition, writeFileToolImpl, 
    runCommandToolDefinition, runCommandToolImpl,
    listDirectoryToolDefinition, listDirectoryToolImpl,
    createProjectToolDefinition, createProjectToolImpl
} from './kayra-tools-definitions.js';

// Tool name aliases mapping - camelCase to snake_case (expanded)
const TOOL_NAME_ALIASES = {
    // File operations
    writeFile: 'write_file',
    readFile: 'read_file',
    createFile: 'create_file',
    deleteFile: 'delete_file',
    renameFile: 'rename_file',
    copyFile: 'copy_file',
    
    // Directory operations
    listDirectory: 'list_dir',
    listDir: 'list_dir',
    createDirectory: 'create_dir',
    createDir: 'create_dir',
    
    // Terminal
    runCommand: 'run_cmd',
    executeCommand: 'run_cmd',
    shellCommand: 'run_cmd',
    
    // Code operations
    analyzeCode: 'analyze_code',
    searchFiles: 'search_files',
    findInFiles: 'search_files',
    
    // Project
    createProject: 'create_project',
    initProject: 'create_project',
    scaffoldProject: 'create_project',
    
    // Git (future)
    gitOperations: 'git_ops',
    gitCommit: 'git_commit',
    gitPush: 'git_push'
};

export class KayraToolsIntegration {
    constructor(kodCanavariInstance) {
        this.app = kodCanavariInstance;
        this.registry = new KayraToolRegistry();
        this.dispatcher = new KayraToolDispatcher(this.registry);
        
        // Mini MCP client configuration
        this.mcpBaseUrl = 'http://127.0.0.1:3001/mcp';
        this.mcpHealthy = false;
        this.mcpLastCheck = 0;
        this.mcpCheckInterval = 30000; // 30s cache
        
        this.initializeTools();
        this.checkMcpHealth();
        
        // Otomatik periyodik health check (her dakika)
        this.healthCheckTimer = setInterval(() => {
            this.checkMcpHealth();
        }, 60000); // 60s
    }
    
    /**
     * Mini MCP health check (with cache + timeout + retry)
     */
    async checkMcpHealth(forceCheck = false) {
        const now = Date.now();
        
        // Cache kontrolü - son 30s içinde check yapıldıysa tekrar yapma
        if (!forceCheck && now - this.mcpLastCheck < this.mcpCheckInterval) {
            return this.mcpHealthy;
        }
        
        try {
            // Timeout mekanizması (3 saniye)
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            
            const response = await fetch(`${this.mcpBaseUrl}/health`, {
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const data = await response.json();
                this.mcpHealthy = data.ok === true;
                this.mcpLastCheck = now;
                
                if (this.mcpHealthy) {
                    console.log('✅ Mini MCP: Çevrimiçi');
                } else {
                    console.warn('⚠️ Mini MCP: Unhealthy response');
                }
            } else {
                this.mcpHealthy = false;
                this.mcpLastCheck = now;
                console.warn('⚠️ Mini MCP: HTTP', response.status);
            }
        } catch (error) {
            this.mcpHealthy = false;
            this.mcpLastCheck = now;
            
            // AbortError için sessiz log (timeout normal bir durum)
            if (error.name === 'AbortError') {
                console.warn('⚠️ Mini MCP: Timeout (3s)');
            } else {
                console.warn('⚠️ Mini MCP kullanılamıyor, fallback mode aktif:', error.message);
            }
        }
        
        return this.mcpHealthy;
    }
    
    /**
     * Cleanup function - timer'ı temizle
     */
    destroy() {
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
            this.healthCheckTimer = null;
        }
    }
    
    /**
     * MCP tool çağrısı (HTTP)
     */
    async callMcp(endpoint, body = {}) {
        if (!this.mcpHealthy) {
            throw new Error('Mini MCP kullanılamıyor');
        }
        
        try {
            const response = await fetch(`${this.mcpBaseUrl}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            
            const result = await response.json();
            return result;
            
        } catch (error) {
            throw new Error(`MCP çağrısı başarısız (${endpoint}): ${error.message}`);
        }
    }
    
    initializeTools() {
        console.log('🔧 Initializing KayraDeniz Tool System...');
        
        // Register all tools
        this.registry.register(readFileToolDefinition, readFileToolImpl);
        this.registry.register(writeFileToolDefinition, writeFileToolImpl);
        this.registry.register(runCommandToolDefinition, runCommandToolImpl);
        this.registry.register(listDirectoryToolDefinition, listDirectoryToolImpl);
        this.registry.register(createProjectToolDefinition, createProjectToolImpl);
        
        console.log('✅ Tool system initialized with', this.registry.getAllTools().length, 'tools');
    }
    
    // Mevcut app.js interface'ine uyumlu wrapper
    async executeToolWithAgent(toolName, args) {
        // Convert camelCase to snake_case if needed
        const canonicalName = TOOL_NAME_ALIASES[toolName] || toolName;
        
        const extras = this.createToolExtras();
        
        try {
            const result = await this.dispatcher.executeTool(canonicalName, args, extras);
            
            if (result.success) {
                // Convert to app.js format
                return {
                    success: true,
                    output: result.result.map(item => item.content).join('\n'),
                    contextItems: result.result
                };
            } else {
                return {
                    success: false,
                    error: result.error
                };
            }
            
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    // Tool extras factory - mevcut app.js functionality'sini kullanır
    createToolExtras() {
        return {
            workingDirectory: this.app.currentFolder || process.cwd(),
            
            fileSystem: {
                readFile: async (filepath) => {
                    // Use existing electronAPI
                    if (window.electronAPI && window.electronAPI.readFile) {
                        const result = await window.electronAPI.readFile(filepath);
                        if (result.success) {
                            return result.content;
                        } else {
                            throw new Error(result.error);
                        }
                    } else {
                        throw new Error('File system API not available');
                    }
                },
                
                writeFile: async (filepath, content) => {
                    if (window.electronAPI && window.electronAPI.writeFile) {
                        const result = await window.electronAPI.writeFile(filepath, content);
                        return result.success;
                    } else {
                        // Fallback to tab system
                        this.app.tabs.set(filepath, {
                            content: content,
                            language: this.app.detectLanguage(filepath),
                            isModified: true
                        });
                        return true;
                    }
                },
                
                fileExists: async (filepath) => {
                    if (window.electronAPI && window.electronAPI.fileExists) {
                        return await window.electronAPI.fileExists(filepath);
                    }
                    return false;
                },
                
                createDirectory: async (dirpath) => {
                    if (window.electronAPI && window.electronAPI.createDirectory) {
                        const result = await window.electronAPI.createDirectory(dirpath);
                        return result.success;
                    }
                    return false;
                }
            },
            
            terminal: {
                execute: async (command) => {
                    const errors = [];
                    
                    // 1️⃣ Try Tool Server first (with timeout)
                    const toolServerUrl = 'http://127.0.0.1:7777';
                    
                    try {
                        // Timeout: 30 seconds
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), 30000);
                        
                        const response = await fetch(`${toolServerUrl}/run_cmd`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ command }),
                            signal: controller.signal
                        });
                        
                        clearTimeout(timeoutId);
                        
                        if (response.ok) {
                            const result = await response.json();
                            return result.output || result.stdout || '';
                        }
                        
                        errors.push(`Tool Server: ${response.status} ${response.statusText}`);
                    } catch (fetchError) {
                        if (fetchError.name === 'AbortError') {
                            errors.push('Tool Server: Timeout (30s exceeded)');
                        } else {
                            errors.push(`Tool Server: ${fetchError.message}`);
                        }
                    }
                    
                    // 2️⃣ Fallback to Electron IPC
                    if (window.electronAPI && window.electronAPI.runCommand) {
                        try {
                            const result = await window.electronAPI.runCommand(command);
                            if (result.success) {
                                return result.output || result.stdout || '';
                            }
                            errors.push(`Electron IPC: ${result.error || 'Command failed'}`);
                        } catch (ipcError) {
                            errors.push(`Electron IPC: ${ipcError.message}`);
                        }
                    } else {
                        errors.push('Electron IPC: Not available');
                    }
                    
                    // 3️⃣ All methods failed - throw detailed error
                    throw new Error(
                        `Terminal execution failed:\n${errors.map((e, i) => `  ${i + 1}. ${e}`).join('\n')}`
                    );
                }
            },
            
            ui: {
                showNotification: (message, type) => {
                    this.app.showNotification(message, type);
                },
                
                showProgress: (message) => {
                    this.app.showLoading(message);
                }
            }
        };
    }
    
    // AI'ya tool descriptions sağla
    getToolsForAI() {
        const tools = this.registry.getAllTools();
        
        return tools.map(tool => ({
            type: "function",
            function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters
            }
        }));
    }
    
    // Tool çağrısını parse et ve execute et
    async handleAIToolCall(toolCall) {
        const { name, arguments: args } = toolCall;
        
        console.log(`🤖 AI Tool Call: ${name}`, args);
        
        // executeToolWithAgent already handles alias conversion
        return await this.executeToolWithAgent(name, args);
    }
    
    // Helper: Get canonical tool name
    getCanonicalToolName(toolName) {
        return TOOL_NAME_ALIASES[toolName] || toolName;
    }
    
    /**
     * MCP ile build işlemi
     */
    async buildProject(cwd = '.') {
        if (!this.mcpHealthy) {
            throw new Error('Mini MCP kullanılamıyor - manuel build gerekli');
        }
        
        console.log('🏗️ MCP Build başlatılıyor...');
        const result = await this.callMcp('/build', { cwd });
        
        if (result.ok) {
            console.log('✅ Build başarılı');
        } else if (result.skip) {
            console.log('⚠️ Build atlandı:', result.reason);
        } else {
            console.error('❌ Build hatası:', result.stderr?.slice(-500));
        }
        
        return result;
    }
    
    /**
     * MCP ile test çalıştırma
     */
    async runTests(cwd = '.', testFile = null) {
        if (!this.mcpHealthy) {
            throw new Error('Mini MCP kullanılamıyor');
        }
        
        console.log('🧪 MCP Test başlatılıyor...');
        const result = await this.callMcp('/test', { cwd, testFile });
        
        return result;
    }
    
    /**
     * MCP ile probe (HTTP health check)
     */
    async probeUrl(url = 'http://localhost:5173') {
        if (!this.mcpHealthy) {
            throw new Error('Mini MCP kullanılamıyor');
        }
        
        console.log(`🔍 MCP Probe: ${url}`);
        const result = await this.callMcp('/probe', { url });
        
        return result;
    }
    
    /**
     * Context Guard kontrolü (Next.js vs Vite)
     */
    async checkContextGuard(cwd = '.') {
        if (!this.mcpHealthy) {
            return { ok: true, framework: 'unknown', rules: [] };
        }
        
        const result = await this.callMcp('/context/guard', { cwd });
        return result;
    }
    
    /**
     * Verification Matrix (hepsini birden)
     */
    async runVerification(options = {}) {
        if (!this.mcpHealthy) {
            throw new Error('Mini MCP kullanılamıyor');
        }
        
        console.log('🔍 Verification Matrix başlatılıyor...');
        const result = await this.callMcp('/verify', {
            cwd: options.cwd || '.',
            checkLint: options.checkLint !== false,
            checkBuild: options.checkBuild !== false,
            checkProbe: options.checkProbe || false,
            probeUrl: options.probeUrl || 'http://localhost:5173'
        });
        
        return result;
    }
    
    // Available tools listesi
    listAvailableTools() {
        return this.registry.listAvailableTools();
    }
    
    // Category'ye göre tool'ları getir
    getToolsByCategory(category) {
        return this.registry.getToolsByCategory(category);
    }
    
    // Tool suggestion engine
    suggestToolsForContext(userMessage) {
        const suggestions = this.dispatcher.suggestTools({
            intent: this.detectIntent(userMessage),
            hasFiles: this.app.currentFile !== null,
            fileType: this.app.currentFile ? this.app.detectLanguage(this.app.currentFile) : null
        });
        
        return suggestions;
    }
    
    detectIntent(message) {
        const lowerMessage = message.toLowerCase();
        
        if (lowerMessage.includes('oku') || lowerMessage.includes('göster') || lowerMessage.includes('read')) {
            return 'read';
        }
        
        if (lowerMessage.includes('oluştur') || lowerMessage.includes('yaz') || lowerMessage.includes('create')) {
            return 'create';
        }
        
        if (lowerMessage.includes('çalıştır') || lowerMessage.includes('komut') || lowerMessage.includes('run')) {
            return 'execute';
        }
        
        if (lowerMessage.includes('analiz') || lowerMessage.includes('incele') || lowerMessage.includes('analyze')) {
            return 'analyze';
        }
        
        return 'general';
    }
}

// Make KayraToolsIntegration available globally for app.js
if (typeof window !== 'undefined') {
    window.KayraToolsIntegration = KayraToolsIntegration;
}