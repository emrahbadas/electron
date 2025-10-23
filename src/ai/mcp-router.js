const AIManager = require('./ai-manager');
const ClaudeMCPService = require('./claude-mcp-service');
const EventEmitter = require('events');

/**
 * MCP Router - AI seçimine göre doğru servise route eder
 * 
 * İki bağımsız sistem:
 * - OpenAI → KodCanavarı'nın kendi mini MCP server'ı (AIManager)
 * - Claude → Anthropic'in resmi MCP sistemi (ClaudeMCPService)
 * 
 * İkisi de AYNI ANDA çalışır, sadece kullanıcının seçimine göre route edilir
 */
class MCPRouter extends EventEmitter {
    constructor() {
        super();
        
        // Her iki service'i de başlat
        this.aiManager = new AIManager(); // KodCanavarı mini MCP (OpenAI için)
        this.claudeService = new ClaudeMCPService(); // Claude MCP (Anthropic için)
        
        // Aktif AI provider
        this.activeProvider = 'openai'; // Default: OpenAI (mevcut sistem)
        
        // İki service de çalışıyor mu?
        this.servicesStatus = {
            openai: false,
            claude: false
        };

        // İstatistikler
        this.stats = {
            routedToOpenAI: 0,
            routedToClaude: 0,
            lastRoutedTime: null,
            totalRequests: 0
        };

        // Claude events'i forward et
        this.claudeService.on('streamingChunk', (chunk) => {
            this.emit('claude:streamingChunk', chunk);
        });

        this.claudeService.on('toolUsed', (tool) => {
            this.emit('claude:toolUsed', tool);
        });

        this.claudeService.on('messageComplete', (data) => {
            this.emit('claude:messageComplete', data);
        });

        this.claudeService.on('error', (error) => {
            this.emit('claude:error', error);
        });
    }

    /**
     * Her iki service'i de initialize et
     */
    async initialize(config = {}) {
        const results = {
            openai: null,
            claude: null
        };

        try {
            // OpenAI service (mevcut AIManager)
            if (config.workspacePath) {
                console.log('[MCP Router] 🚀 Initializing OpenAI service (AIManager)...');
                results.openai = await this.aiManager.initialize(config.workspacePath);
                this.servicesStatus.openai = results.openai?.success || false;
                
                if (this.servicesStatus.openai) {
                    console.log('[MCP Router] ✅ OpenAI service ready');
                } else {
                    console.warn('[MCP Router] ⚠️  OpenAI service failed');
                }
            }

            // Claude service (yeni)
            if (config.anthropicApiKey) {
                console.log('[MCP Router] 🚀 Initializing Claude service...');
                results.claude = await this.claudeService.initialize(
                    config.anthropicApiKey, 
                    config.workspacePath // workspace path'i Claude'a da geçir
                );
                this.servicesStatus.claude = results.claude?.success || false;
                
                if (this.servicesStatus.claude) {
                    console.log('[MCP Router] ✅ Claude service ready');
                } else {
                    console.warn('[MCP Router] ⚠️  Claude service failed');
                }
            }

            this.emit('initialized', {
                openai: this.servicesStatus.openai,
                claude: this.servicesStatus.claude,
                activeProvider: this.activeProvider
            });

            return {
                success: true,
                services: this.servicesStatus,
                activeProvider: this.activeProvider,
                details: results
            };

        } catch (error) {
            console.error('[MCP Router] ❌ Initialization error:', error);
            return {
                success: false,
                error: error.message,
                services: this.servicesStatus
            };
        }
    }

    /**
     * AI provider'ı değiştir (OpenAI ↔ Claude)
     */
    switchProvider(provider) {
        const validProviders = ['openai', 'claude'];
        
        if (!validProviders.includes(provider)) {
            return {
                success: false,
                error: `Invalid provider. Must be: ${validProviders.join(' or ')}`
            };
        }

        // Service hazır mı kontrol et
        if (!this.servicesStatus[provider]) {
            return {
                success: false,
                error: `${provider} service not initialized. Initialize it first.`
            };
        }

        const previousProvider = this.activeProvider;
        this.activeProvider = provider;

        this.emit('providerSwitched', {
            from: previousProvider,
            to: provider
        });

        console.log(`[MCP Router] 🔄 Switched from ${previousProvider} to ${provider}`);

        return {
            success: true,
            activeProvider: this.activeProvider,
            previousProvider: previousProvider
        };
    }

    /**
     * Mesaj gönder (aktif provider'a route et)
     */
    async sendMessage(message, context = {}) {
        this.stats.totalRequests++;
        this.stats.lastRoutedTime = new Date().toISOString();

        try {
            if (this.activeProvider === 'claude') {
                // Claude MCP'ye route et
                console.log('[MCP Router] 📨 Routing to Claude MCP...');
                this.stats.routedToClaude++;
                
                const result = await this.claudeService.sendMessage(message, context);
                
                this.emit('messageRouted', {
                    provider: 'claude',
                    success: result.success
                });
                
                return {
                    ...result,
                    provider: 'claude'
                };

            } else {
                // OpenAI (AIManager) MCP'ye route et
                console.log('[MCP Router] 📨 Routing to OpenAI (AIManager)...');
                this.stats.routedToOpenAI++;
                
                const result = await this.aiManager.chatCompletion(message, {
                    ...context,
                    stream: false
                });
                
                this.emit('messageRouted', {
                    provider: 'openai',
                    success: result.success
                });
                
                return {
                    ...result,
                    provider: 'openai'
                };
            }

        } catch (error) {
            console.error(`[MCP Router] ❌ Route error (${this.activeProvider}):`, error);
            
            this.emit('routeError', {
                provider: this.activeProvider,
                error: error.message
            });
            
            return {
                success: false,
                error: error.message,
                provider: this.activeProvider
            };
        }
    }

    /**
     * Tool çalıştır (aktif provider'a route et)
     */
    async executeTool(toolName, params) {
        this.stats.totalRequests++;

        try {
            if (this.activeProvider === 'claude') {
                // Claude tool'u çalıştır
                console.log(`[MCP Router] 🔧 Executing Claude tool: ${toolName}`);
                return await this.claudeService.executeTool(toolName, params);

            } else {
                // OpenAI için tool execution (AIManager üzerinden)
                console.log(`[MCP Router] 🔧 Executing OpenAI tool via chat: ${toolName}`);
                
                // OpenAI tool execution'ı chat mesajı olarak gönder
                const toolPrompt = `Execute tool: ${toolName}\nParameters: ${JSON.stringify(params, null, 2)}`;
                return await this.aiManager.chatCompletion(toolPrompt);
            }

        } catch (error) {
            console.error(`[MCP Router] ❌ Tool execution error:`, error);
            return {
                success: false,
                error: error.message,
                provider: this.activeProvider
            };
        }
    }

    /**
     * Available tools listele (aktif provider'a göre)
     */
    listTools() {
        if (this.activeProvider === 'claude') {
            // Claude'un tools'ları
            return {
                success: true,
                provider: 'claude',
                tools: this.claudeService.getAvailableTools()
            };
        } else {
            // OpenAI için KodCanavarı tools'ları
            // AIManager'da tool listesi yoksa manuel liste döndür
            return {
                success: true,
                provider: 'openai',
                tools: [
                    {
                        name: 'kod_canavar_analyzer',
                        description: 'KodCanavarı kod analiz sistemi'
                    },
                    {
                        name: 'night_orders_executor',
                        description: 'Night Orders protokolü ile kod üretimi'
                    },
                    {
                        name: 'reflexion_learner',
                        description: 'Reflexion modülü ile öğrenme'
                    }
                ]
            };
        }
    }

    /**
     * Conversation history temizle (aktif provider'ın)
     */
    clearHistory() {
        if (this.activeProvider === 'claude') {
            this.claudeService.clearHistory();
        } else {
            // AIManager'da history clear varsa çağır
            if (this.aiManager.clearContext) {
                this.aiManager.clearContext();
            }
        }

        this.emit('historyCleared', { provider: this.activeProvider });
        
        return {
            success: true,
            provider: this.activeProvider
        };
    }

    /**
     * Claude model değiştir (sadece Claude aktifken)
     */
    setClaudeModel(model) {
        if (this.activeProvider !== 'claude') {
            return {
                success: false,
                error: 'Claude is not the active provider'
            };
        }

        return this.claudeService.setModel(model);
    }

    /**
     * OpenAI model değiştir (sadece OpenAI aktifken)
     */
    setOpenAIModel(model) {
        if (this.activeProvider !== 'openai') {
            return {
                success: false,
                error: 'OpenAI is not the active provider'
            };
        }

        if (this.aiManager.currentModel !== undefined) {
            this.aiManager.currentModel = model;
            return { success: true, model: model };
        }

        return { success: false, error: 'Model change not supported' };
    }

    /**
     * Router istatistikleri
     */
    getStats() {
        return {
            ...this.stats,
            activeProvider: this.activeProvider,
            services: this.servicesStatus,
            openaiStats: this.aiManager.fileCache ? {
                cachedFiles: this.aiManager.fileCache.size
            } : {},
            claudeStats: this.claudeService.getStats()
        };
    }

    /**
     * Service durumları
     */
    getStatus() {
        return {
            activeProvider: this.activeProvider,
            services: {
                openai: {
                    initialized: this.servicesStatus.openai,
                    isReady: this.aiManager.isInitialized
                },
                claude: {
                    initialized: this.servicesStatus.claude,
                    isReady: this.claudeService.isInitialized,
                    ...this.claudeService.getStatus()
                }
            },
            routing: {
                totalRequests: this.stats.totalRequests,
                routedToOpenAI: this.stats.routedToOpenAI,
                routedToClaude: this.stats.routedToClaude
            }
        };
    }

    /**
     * Her iki service'i de kapat
     */
    async shutdown() {
        console.log('[MCP Router] 🛑 Shutting down services...');
        
        // İstatistikleri kaydet
        const finalStats = this.getStats();
        console.log('[MCP Router] 📊 Final stats:', finalStats);
        
        this.emit('shutdown', finalStats);
        
        return {
            success: true,
            finalStats: finalStats
        };
    }

    /**
     * Claude API key güncelle (runtime'da)
     */
    async updateClaudeApiKey(apiKey) {
        try {
            await this.claudeService.updateApiKey(apiKey);
            this.servicesStatus.claude = true;
            
            this.emit('claudeApiKeyUpdated');
            
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

module.exports = MCPRouter;
