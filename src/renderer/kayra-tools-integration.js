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

export class KayraToolsIntegration {
    constructor(kodCanavariInstance) {
        this.app = kodCanavariInstance;
        this.registry = new KayraToolRegistry();
        this.dispatcher = new KayraToolDispatcher(this.registry);
        
        this.initializeTools();
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
        const extras = this.createToolExtras();
        
        try {
            const result = await this.dispatcher.executeTool(toolName, args, extras);
            
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
                    // Use existing tool server
                    const toolServerUrl = 'http://127.0.0.1:7777';
                    
                    try {
                        const response = await fetch(`${toolServerUrl}/run_cmd`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ command })
                        });
                        
                        if (response.ok) {
                            const result = await response.json();
                            return result.output || result.stdout || '';
                        } else {
                            throw new Error(`Command failed: ${response.statusText}`);
                        }
                    } catch (error) {
                        throw new Error(`Terminal execution failed: ${error.message}`);
                    }
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
        
        return await this.executeToolWithAgent(name, args);
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