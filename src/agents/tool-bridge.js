/**
 * Tool Bridge - Agent'ların Fiziksel Aksiyonları
 * 
 * Bu modül, agent'ların zihinsel kararlarını gerçek dosya/terminal işlemlerine çevirir.
 * ChatGPT-5'in tespit ettiği "eksik kas sistemi" burada tanımlanıyor.
 */

class ToolBridge {
    constructor(workspaceRoot) {
        this.workspaceRoot = workspaceRoot;
        this.supportedTools = new Map();
        this.executionLog = [];
        
        // Register all tools
        this.registerFileSystemTools();
        this.registerTerminalTools();
        this.registerReflexionTools();
        this.registerCognitiveTools(); // 🧠 NEW: ChatGPT önerisi
        
        console.log(`🔧 Tool Bridge initialized with ${this.supportedTools.size} tools`);
    }

    /**
     * Register File System Tools (fs.read, fs.write, fs.exists, fs.delete)
     */
    registerFileSystemTools() {
        // fs.read - Dosya okuma
        this.supportedTools.set('fs.read', async (args) => {
            const { path } = args;
            const absolutePath = this.resolveAbsolutePath(path);
            
            try {
                if (!window.electronAPI) {
                    throw new Error('electronAPI not available');
                }
                
                const content = await window.electronAPI.readFile(absolutePath);
                this.log('fs.read', path, 'SUCCESS', `Read ${content.length} bytes`);
                return { success: true, content, path: absolutePath };
            } catch (error) {
                this.log('fs.read', path, 'FAILED', error.message);
                return { success: false, error: error.message, path: absolutePath };
            }
        });

        // fs.write - Dosya yazma
        this.supportedTools.set('fs.write', async (args) => {
            const { path, content } = args;
            const absolutePath = this.resolveAbsolutePath(path);
            
            try {
                if (!window.electronAPI) {
                    throw new Error('electronAPI not available');
                }
                
                await window.electronAPI.writeFile(absolutePath, content);
                this.log('fs.write', path, 'SUCCESS', `Wrote ${content.length} bytes`);
                return { success: true, path: absolutePath, bytes: content.length };
            } catch (error) {
                this.log('fs.write', path, 'FAILED', error.message);
                return { success: false, error: error.message, path: absolutePath };
            }
        });

        // fs.exists - Dosya varlık kontrolü
        this.supportedTools.set('fs.exists', async (args) => {
            const { path } = args;
            const absolutePath = this.resolveAbsolutePath(path);
            
            try {
                if (!window.electronAPI) {
                    throw new Error('electronAPI not available');
                }
                
                // Try to read file, if succeeds it exists
                try {
                    await window.electronAPI.readFile(absolutePath);
                    this.log('fs.exists', path, 'SUCCESS', 'File exists');
                    return { success: true, exists: true, path: absolutePath };
                } catch {
                    this.log('fs.exists', path, 'SUCCESS', 'File not found');
                    return { success: true, exists: false, path: absolutePath };
                }
            } catch (error) {
                this.log('fs.exists', path, 'FAILED', error.message);
                return { success: false, error: error.message, path: absolutePath };
            }
        });

        // fs.delete - Dosya/klasör silme (Reflexion için)
        this.supportedTools.set('fs.delete', async (args) => {
            const { path } = args;
            const absolutePath = this.resolveAbsolutePath(path);
            
            try {
                if (!window.electronAPI) {
                    throw new Error('electronAPI not available');
                }
                
                // Electron'da delete API'si yoksa, terminal üzerinden sil
                const isWindows = navigator.platform.toLowerCase().includes('win');
                const deleteCmd = isWindows 
                    ? `Remove-Item -Path "${absolutePath}" -Recurse -Force -ErrorAction SilentlyContinue`
                    : `rm -rf "${absolutePath}"`;
                
                const result = await window.electronAPI.runCommand(deleteCmd, this.workspaceRoot);
                this.log('fs.delete', path, 'SUCCESS', `Deleted ${absolutePath}`);
                return { success: true, path: absolutePath, output: result };
            } catch (error) {
                this.log('fs.delete', path, 'FAILED', error.message);
                return { success: false, error: error.message, path: absolutePath };
            }
        });

        // fs.readFileSync - Alias for fs.read (Agent bazen bu ismi kullanıyor)
        this.supportedTools.set('fs.readFileSync', this.supportedTools.get('fs.read'));
        
        // fs.writeFile - Alias for fs.write
        this.supportedTools.set('fs.writeFile', this.supportedTools.get('fs.write'));
        
        // fs.readFile - Alias for fs.read
        this.supportedTools.set('fs.readFile', this.supportedTools.get('fs.read'));
    }

    /**
     * Register Terminal Tools (terminal.exec, terminal.run)
     */
    registerTerminalTools() {
        // terminal.exec - Komut çalıştırma
        this.supportedTools.set('terminal.exec', async (args) => {
            const { cmd, cwd } = args;
            const workingDir = cwd ? this.resolveAbsolutePath(cwd) : this.workspaceRoot;
            
            try {
                if (!window.electronAPI) {
                    throw new Error('electronAPI not available');
                }
                
                console.log(`🔧 [ToolBridge] Running command: ${cmd} in ${workingDir}`);
                const result = await window.electronAPI.runCommand(cmd, workingDir);
                
                // Parse exit code from output
                const exitCodeMatch = result.match(/Exit code: (\d+)/);
                const exitCode = exitCodeMatch ? parseInt(exitCodeMatch[1]) : 0;
                
                this.log('terminal.exec', cmd, exitCode === 0 ? 'SUCCESS' : 'FAILED', 
                    `Exit code: ${exitCode}`);
                
                return { 
                    success: exitCode === 0, 
                    output: result, 
                    exitCode,
                    cwd: workingDir 
                };
            } catch (error) {
                this.log('terminal.exec', cmd, 'FAILED', error.message);
                return { success: false, error: error.message, exitCode: 1, cwd: workingDir };
            }
        });

        // terminal.run - Alias
        this.supportedTools.set('terminal.run', this.supportedTools.get('terminal.exec'));
    }

    /**
     * Register Reflexion Tools (apply fixes from self-analysis)
     */
    registerReflexionTools() {
        // reflexion.apply - Otomatik düzeltmeleri uygula
        this.supportedTools.set('reflexion.apply', async (args) => {
            const { fixes } = args;
            const results = [];
            
            console.log(`🧠 [ToolBridge] Applying ${fixes.length} reflexion fixes...`);
            
            for (const fix of fixes) {
                try {
                    let result;
                    
                    switch (fix.type) {
                        case 'UPDATE_FILE':
                            result = await this.executeTool('fs.write', {
                                path: fix.path,
                                content: fix.content
                            });
                            break;
                            
                        case 'DELETE_FOLDER':
                        case 'DELETE_FILE':
                            result = await this.executeTool('fs.delete', {
                                path: fix.path
                            });
                            break;
                            
                        case 'CREATE_FOLDER':
                            result = await this.executeTool('terminal.exec', {
                                cmd: `mkdir -p "${fix.path}"`,
                                cwd: this.workspaceRoot
                            });
                            break;
                            
                        default:
                            result = { success: false, error: `Unknown fix type: ${fix.type}` };
                    }
                    
                    results.push({ fix, result });
                    
                    if (result.success) {
                        console.log(`✅ [ToolBridge] Applied fix: ${fix.type} ${fix.path}`);
                    } else {
                        console.warn(`⚠️ [ToolBridge] Failed to apply fix: ${fix.type} ${fix.path}`, result.error);
                    }
                    
                } catch (error) {
                    console.error(`❌ [ToolBridge] Error applying fix:`, fix, error);
                    results.push({ fix, result: { success: false, error: error.message } });
                }
            }
            
            const successCount = results.filter(r => r.result.success).length;
            this.log('reflexion.apply', `${fixes.length} fixes`, 'SUCCESS', 
                `Applied ${successCount}/${fixes.length} fixes`);
            
            return { 
                success: successCount > 0, 
                total: fixes.length,
                successful: successCount,
                results 
            };
        });
    }

    /**
     * 🧠 Register Cognitive Tools (ChatGPT önerisi)
     * intent.analyze, dialog.context, cognitive.replay
     */
    registerCognitiveTools() {
        // 🧭 intent.analyze - Prompt'un amacını belirler
        this.supportedTools.set('intent.analyze', async (args) => {
            const { prompt } = args;
            
            try {
                // Simple intent analysis (geliştirilecek)
                const isQuestion = /\?|nasıl|neden|ne|kim|hangi/.test(prompt.toLowerCase());
                const isCommand = /yap|oluştur|başlat|çalıştır|kur/.test(prompt.toLowerCase());
                const isExploration = /açıkla|anlat|göster|bilgi/.test(prompt.toLowerCase());
                
                let intentType = "unclear";
                let confidence = 0.5;
                
                if (isCommand) {
                    intentType = "directive";
                    confidence = 0.8;
                } else if (isQuestion) {
                    intentType = "exploratory";
                    confidence = 0.7;
                } else if (isExploration) {
                    intentType = "informational";
                    confidence = 0.6;
                }
                
                const result = {
                    type: intentType,
                    confidence,
                    isQuestion,
                    isCommand,
                    isExploration,
                    emotionalTone: prompt.includes("!") ? "excited" : "neutral"
                };
                
                this.log('intent.analyze', prompt, 'SUCCESS', `Detected: ${intentType} (${confidence})`);
                return { success: true, result };
                
            } catch (error) {
                this.log('intent.analyze', prompt, 'FAILED', error.message);
                return { success: false, error: error.message };
            }
        });

        // 💬 dialog.context - Önceki konuşma tınısını okur
        this.supportedTools.set('dialog.context', async (args) => {
            const { lastMessages = [], currentPrompt } = args;
            
            try {
                // Simple context analysis
                const hasPhaseContext = lastMessages.some(msg => 
                    msg.includes("phase") || msg.includes("faz") || msg.includes("adım")
                );
                
                const isFollowUp = lastMessages.length > 0 && (
                    currentPrompt.includes("evet") || 
                    currentPrompt.includes("devam") ||
                    currentPrompt.includes("tamam")
                );
                
                const conversationFlow = {
                    isFollowUp,
                    hasPhaseContext,
                    messageCount: lastMessages.length,
                    tone: this.analyzeConversationalTone(lastMessages),
                    contextType: hasPhaseContext ? "project_execution" : "general_chat"
                };
                
                this.log('dialog.context', `${lastMessages.length} messages`, 'SUCCESS', 
                    `Context: ${conversationFlow.contextType}`);
                return { success: true, context: conversationFlow };
                
            } catch (error) {
                this.log('dialog.context', 'context analysis', 'FAILED', error.message);
                return { success: false, error: error.message };
            }
        });

        // 🔄 cognitive.replay - Son aksiyonları yeniden oynatır
        this.supportedTools.set('cognitive.replay', async (args) => {
            const { actionCount = 5 } = args;
            
            try {
                // Get last N actions from execution log
                const recentActions = this.executionLog
                    .slice(-actionCount)
                    .map(entry => ({
                        tool: entry.tool,
                        target: entry.target,
                        status: entry.status,
                        timestamp: entry.timestamp,
                        details: entry.details
                    }));
                
                // Analyze pattern
                const analysis = {
                    actionCount: recentActions.length,
                    successRate: recentActions.filter(a => a.status === 'SUCCESS').length / recentActions.length,
                    toolUsage: this.groupBy(recentActions, 'tool'),
                    recentPattern: this.detectPattern(recentActions),
                    suggestions: this.generateSuggestions(recentActions)
                };
                
                this.log('cognitive.replay', `${actionCount} actions`, 'SUCCESS', 
                    `Success rate: ${(analysis.successRate * 100).toFixed(1)}%`);
                return { success: true, actions: recentActions, analysis };
                
            } catch (error) {
                this.log('cognitive.replay', 'replay analysis', 'FAILED', error.message);
                return { success: false, error: error.message };
            }
        });
    }

    /**
     * Helper methods for cognitive tools
     */
    analyzeConversationalTone(messages) {
        if (!messages.length) return "neutral";
        
        const lastMessage = messages[messages.length - 1]?.toLowerCase() || "";
        if (lastMessage.includes("!")) return "excited";
        if (lastMessage.includes("?")) return "questioning";
        if (lastMessage.includes("hata") || lastMessage.includes("problem")) return "concerned";
        return "neutral";
    }
    
    groupBy(array, key) {
        return array.reduce((groups, item) => {
            const group = groups[item[key]] || [];
            group.push(item);
            groups[item[key]] = group;
            return groups;
        }, {});
    }
    
    detectPattern(actions) {
        if (actions.length < 3) return "insufficient_data";
        
        const tools = actions.map(a => a.tool);
        if (tools.includes("fs.write") && tools.includes("terminal.exec")) {
            return "code_and_test";
        }
        if (tools.filter(t => t.includes("fs.")).length > 2) {
            return "file_intensive";
        }
        return "mixed_operations";
    }
    
    generateSuggestions(actions) {
        const failedActions = actions.filter(a => a.status === 'FAILED');
        if (failedActions.length > 1) {
            return ["Consider checking error patterns", "Verify prerequisites"];
        }
        if (actions.every(a => a.tool === "fs.write")) {
            return ["Consider running tests", "Verify file contents"];
        }
        return ["Continue current workflow"];
    }

    /**
     * Execute a tool by name
     */
    async executeTool(toolName, args) {
        console.log(`🔧 [ToolBridge] Executing tool: ${toolName}`, args);
        
        // Check if tool exists
        if (!this.supportedTools.has(toolName)) {
            console.error(`❌ [ToolBridge] Unknown tool: ${toolName}`);
            console.log(`📋 Available tools:`, Array.from(this.supportedTools.keys()));
            
            return { 
                success: false, 
                error: `Unknown tool: ${toolName}`,
                availableTools: Array.from(this.supportedTools.keys())
            };
        }
        
        // Execute tool
        const toolHandler = this.supportedTools.get(toolName);
        
        try {
            const result = await toolHandler(args);
            return result;
        } catch (error) {
            console.error(`❌ [ToolBridge] Tool execution failed:`, toolName, error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Resolve relative path to absolute path
     */
    resolveAbsolutePath(relativePath) {
        // If already absolute, return as-is
        if (relativePath.match(/^[A-Za-z]:\\/i) || relativePath.startsWith('/')) {
            return relativePath;
        }
        
        // Otherwise, resolve relative to workspace root
        const path = require('path') || {
            join: (...parts) => parts.join('/').replace(/\/+/g, '/')
        };
        
        return path.join(this.workspaceRoot, relativePath);
    }

    /**
     * Log tool execution
     */
    log(tool, target, status, details) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            tool,
            target,
            status,
            details
        };
        
        this.executionLog.push(logEntry);
        
        // Keep only last 100 entries
        if (this.executionLog.length > 100) {
            this.executionLog.shift();
        }
    }

    /**
     * Get execution log
     */
    getLog() {
        return this.executionLog;
    }

    /**
     * Get supported tools list
     */
    getSupportedTools() {
        return Array.from(this.supportedTools.keys());
    }

    /**
     * Update workspace root (when user changes project)
     */
    setWorkspaceRoot(newRoot) {
        this.workspaceRoot = newRoot;
        console.log(`🔧 [ToolBridge] Workspace root updated: ${newRoot}`);
    }
}

// Export singleton instance
let toolBridgeInstance = null;

export function initializeToolBridge(workspaceRoot) {
    if (!toolBridgeInstance) {
        toolBridgeInstance = new ToolBridge(workspaceRoot);
        
        // Attach to window for debugging
        window.toolBridge = toolBridgeInstance;
        console.log('💡 Debug: Use window.toolBridge in console');
    } else {
        toolBridgeInstance.setWorkspaceRoot(workspaceRoot);
    }
    
    return toolBridgeInstance;
}

export function getToolBridge() {
    if (!toolBridgeInstance) {
        throw new Error('ToolBridge not initialized! Call initializeToolBridge() first.');
    }
    return toolBridgeInstance;
}

export { ToolBridge };
