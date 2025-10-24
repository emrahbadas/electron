const Anthropic = require('@anthropic-ai/sdk');
const EventEmitter = require('events');

/**
 * Claude MCP Service - Anthropic API ile tam entegrasyon
 * KodCanavarı'nın mevcut mini MCP sisteminden BAĞIMSIZ çalışır
 * Claude seçildiğinde bu service aktif olur
 */
class ClaudeMCPService extends EventEmitter {
    constructor() {
        super();
        this.anthropic = null;
        this.isInitialized = false;
        this.conversationHistory = [];
        this.apiKey = null;
        this.workspacePath = null; // Tool'lar için workspace root
        this.currentModel = 'claude-sonnet-4-20250514'; // Claude 3.5 Sonnet
        this.maxTokens = 4096;
        this.temperature = 1.0;
        
        // İstatistikler
        this.stats = {
            messagesProcessed: 0,
            toolsExecuted: 0,
            tokensUsed: 0,
            lastMessageTime: null,
            errors: 0
        };
    }

    /**
     * Claude servisi başlat
     * @param {string} apiKey - Anthropic API key (sk-ant-...)
     * @param {string} workspacePath - Workspace root path (tool operations için)
     */
    async initialize(apiKey, workspacePath = null) {
        try {
            if (!apiKey || !apiKey.startsWith('sk-ant-')) {
                throw new Error('Geçersiz Anthropic API key');
            }

            this.apiKey = apiKey;
            this.workspacePath = workspacePath || process.cwd();
            
            this.anthropic = new Anthropic({
                apiKey: this.apiKey
            });

            // API key test
            await this.testConnection();

            this.isInitialized = true;
            this.emit('initialized', {
                model: this.currentModel,
                maxTokens: this.maxTokens,
                workspacePath: this.workspacePath
            });

            console.log('[Claude MCP] ✅ Service initialized successfully');
            return { success: true, model: this.currentModel };

        } catch (error) {
            console.error('[Claude MCP] ❌ Initialization failed:', error);
            this.isInitialized = false;
            this.stats.errors++;
            throw error;
        }
    }

    /**
     * API bağlantısını test et
     */
    async testConnection() {
        try {
            const response = await this.anthropic.messages.create({
                model: this.currentModel,
                max_tokens: 100,
                messages: [{ role: 'user', content: 'test' }]
            });
            return response.content[0].text;
        } catch (error) {
            throw new Error(`Claude API bağlantı hatası: ${error.message}`);
        }
    }

    /**
     * Claude'un resmi MCP tool'larını tanımla
     * LUMA projesinden alınan orijinal Claude MCP tool tag'leri
     * Bu tool'lar Claude'un native MCP protokolü ile uyumlu
     */
    getAvailableTools() {
        return [
            // ===== CODE ANALYSIS TOOLS =====
            {
                name: "code_analyzer",
                description: "Kod analizi yapar, hataları ve iyileştirme önerilerini bulur. Complexity, maintainability, security kontrolleri yapar.",
                input_schema: {
                    type: "object",
                    properties: {
                        code: { 
                            type: "string", 
                            description: "Analiz edilecek kod (tüm dosya veya seçili bölüm)" 
                        },
                        language: { 
                            type: "string", 
                            description: "Programlama dili (javascript, typescript, python, java, etc.)" 
                        },
                        check_security: {
                            type: "boolean",
                            description: "Güvenlik açığı kontrolü yapılsın mı (XSS, injection, etc.)"
                        }
                    },
                    required: ["code"]
                }
            },
            {
                name: "code_generator",
                description: "İstenen özelliklerde yeni kod üretir. Component, function, class, API endpoint gibi kod blokları oluşturur.",
                input_schema: {
                    type: "object",
                    properties: {
                        description: { 
                            type: "string", 
                            description: "Üretilecek kodun detaylı açıklaması (ne yapmalı, hangi özellikler olmalı)" 
                        },
                        language: { 
                            type: "string", 
                            description: "Hedef programlama dili" 
                        },
                        framework: { 
                            type: "string", 
                            description: "Kullanılacak framework (React, Vue, Express, Django, etc.) - opsiyonel" 
                        },
                        style: {
                            type: "string",
                            enum: ["functional", "oop", "mixed"],
                            description: "Kod stili tercihi"
                        }
                    },
                    required: ["description", "language"]
                }
            },
            {
                name: "refactor_code",
                description: "Mevcut kodu refactor eder, temizler, optimize eder. DRY, SOLID prensiplerini uygular.",
                input_schema: {
                    type: "object",
                    properties: {
                        code: { 
                            type: "string", 
                            description: "Refactor edilecek kod" 
                        },
                        improvements: { 
                            type: "array", 
                            items: { type: "string" },
                            description: "İstenilen iyileştirmeler (readability, performance, modularity, etc.)"
                        },
                        keepBehavior: {
                            type: "boolean",
                            description: "Kod davranışı aynı kalmalı mı (breaking change yapma)"
                        }
                    },
                    required: ["code"]
                }
            },
            {
                name: "explain_code",
                description: "Kodu detaylı şekilde açıklar. Algorithm, data flow, edge cases, complexity analizi yapar.",
                input_schema: {
                    type: "object",
                    properties: {
                        code: { 
                            type: "string", 
                            description: "Açıklanacak kod" 
                        },
                        detailLevel: { 
                            type: "string", 
                            enum: ["basic", "detailed", "expert"],
                            description: "Açıklama detay seviyesi (basic: genel bakış, expert: derinlemesine analiz)"
                        },
                        explainAlgorithm: {
                            type: "boolean",
                            description: "Algoritma mantığını açıkla (time/space complexity)"
                        }
                    },
                    required: ["code"]
                }
            },
            {
                name: "find_bugs",
                description: "Kodda bug'ları, edge case'leri, race condition'ları ve güvenlik açıklarını bulur.",
                input_schema: {
                    type: "object",
                    properties: {
                        code: { 
                            type: "string", 
                            description: "Kontrol edilecek kod" 
                        },
                        checkSecurity: { 
                            type: "boolean", 
                            description: "Güvenlik kontrolü (SQL injection, XSS, CSRF, etc.)" 
                        },
                        checkPerformance: {
                            type: "boolean",
                            description: "Performance sorunlarını kontrol et (memory leak, infinite loop, etc.)"
                        }
                    },
                    required: ["code"]
                }
            },
            {
                name: "write_tests",
                description: "Kod için comprehensive unit test'ler ve edge case'ler yazar.",
                input_schema: {
                    type: "object",
                    properties: {
                        code: { 
                            type: "string", 
                            description: "Test yazılacak kod (function, class, module)" 
                        },
                        testFramework: { 
                            type: "string", 
                            description: "Test framework (jest, mocha, pytest, junit, etc.)" 
                        },
                        coverage: {
                            type: "string",
                            enum: ["basic", "comprehensive", "edge-cases"],
                            description: "Test coverage seviyesi"
                        }
                    },
                    required: ["code", "testFramework"]
                }
            },
            {
                name: "debug_code",
                description: "Kod hatalarını debug eder, çözüm önerir, step-by-step açıklama yapar.",
                input_schema: {
                    type: "object",
                    properties: {
                        code: {
                            type: "string",
                            description: "Debug edilecek kod"
                        },
                        error: {
                            type: "string",
                            description: "Alınan hata mesajı (stack trace, error message)"
                        },
                        context: {
                            type: "string",
                            description: "Hatanın oluştuğu context (input values, environment, etc.)"
                        }
                    },
                    required: ["code"]
                }
            },
            {
                name: "optimize_performance",
                description: "Kod performance'ını optimize eder. Algorithm complexity, caching, lazy loading gibi teknikler uygular.",
                input_schema: {
                    type: "object",
                    properties: {
                        code: {
                            type: "string",
                            description: "Optimize edilecek kod"
                        },
                        bottleneck: {
                            type: "string",
                            description: "Bilinen performans sorunu (slow query, memory leak, etc.)"
                        },
                        target: {
                            type: "string",
                            enum: ["speed", "memory", "both"],
                            description: "Optimizasyon hedefi"
                        }
                    },
                    required: ["code"]
                }
            },
            
            // ===== FILE SYSTEM TOOLS (Claude MCP Native) =====
            {
                name: "read_file",
                description: "Workspace'deki bir dosyayı okur. Claude'un resmi MCP tool'u.",
                input_schema: {
                    type: "object",
                    properties: {
                        file_path: {
                            type: "string",
                            description: "Okunacak dosyanın relative path'i (workspace root'dan)"
                        }
                    },
                    required: ["file_path"]
                }
            },
            {
                name: "write_file",
                description: "Workspace'de dosya oluşturur veya üzerine yazar. Claude'un resmi MCP tool'u.",
                input_schema: {
                    type: "object",
                    properties: {
                        file_path: {
                            type: "string",
                            description: "Yazılacak dosyanın relative path'i (workspace root'dan)"
                        },
                        content: {
                            type: "string",
                            description: "Dosyaya yazılacak içerik"
                        }
                    },
                    required: ["file_path", "content"]
                }
            },
            {
                name: "list_directory",
                description: "Workspace'deki bir klasörün içeriğini listeler. Claude'un resmi MCP tool'u.",
                input_schema: {
                    type: "object",
                    properties: {
                        dir_path: {
                            type: "string",
                            description: "Listelenecek klasörün relative path'i (workspace root'dan). Boş bırakılırsa root listelenir."
                        }
                    },
                    required: []
                }
            },
            {
                name: "create_directory",
                description: "Workspace'de yeni klasör oluşturur. Claude'un resmi MCP tool'u.",
                input_schema: {
                    type: "object",
                    properties: {
                        dir_path: {
                            type: "string",
                            description: "Oluşturulacak klasörün relative path'i"
                        }
                    },
                    required: ["dir_path"]
                }
            },
            {
                name: "delete_file",
                description: "Workspace'den dosya siler. Claude'un resmi MCP tool'u.",
                input_schema: {
                    type: "object",
                    properties: {
                        file_path: {
                            type: "string",
                            description: "Silinecek dosyanın relative path'i"
                        }
                    },
                    required: ["file_path"]
                }
            },
            {
                name: "search_files",
                description: "Workspace'de dosya/klasör ismine göre arama yapar. Claude'un resmi MCP tool'u.",
                input_schema: {
                    type: "object",
                    properties: {
                        pattern: {
                            type: "string",
                            description: "Aranacak dosya/klasör ismi veya pattern (*.js, README.md, vb.)"
                        }
                    },
                    required: ["pattern"]
                }
            },
            {
                name: "get_file_tree",
                description: "Workspace'in tüm dosya ağacını gösterir (maximum 3 seviye derinlik). Claude'un resmi MCP tool'u.",
                input_schema: {
                    type: "object",
                    properties: {
                        max_depth: {
                            type: "number",
                            description: "Maximum klasör derinliği (default: 3)"
                        }
                    },
                    required: []
                }
            },
            
            // ===== ADVANCED FILE EDITOR (Claude MCP Native) =====
            {
                name: "str_replace_editor",
                description: "Advanced file editor with view, create, find-replace, insert and undo capabilities. Claude'un en güçlü dosya edit tool'u. Use this for precise file editing operations.",
                input_schema: {
                    type: "object",
                    properties: {
                        command: {
                            type: "string",
                            enum: ["view", "create", "str_replace", "insert", "undo_edit"],
                            description: "Command: view (display file), create (new file), str_replace (find & replace), insert (add lines), undo_edit (revert last change)"
                        },
                        path: {
                            type: "string",
                            description: "File path relative to workspace root"
                        },
                        file_text: {
                            type: "string",
                            description: "File content for create command"
                        },
                        old_str: {
                            type: "string",
                            description: "String to find for str_replace command (exact match required)"
                        },
                        new_str: {
                            type: "string",
                            description: "String to replace with for str_replace command"
                        },
                        insert_line: {
                            type: "number",
                            description: "Line number to insert at (0-indexed)"
                        },
                        insert_text: {
                            type: "string",
                            description: "Text to insert"
                        },
                        view_range: {
                            type: "array",
                            items: { type: "number" },
                            description: "Optional [start_line, end_line] for viewing specific lines"
                        }
                    },
                    required: ["command", "path"]
                }
            },
            
            // ===== TERMINAL & TEST TOOLS =====
            {
                name: "run_terminal_command",
                description: "Terminal'de komut çalıştırır (npm, git, vb.). Claude'un resmi MCP tool'u.",
                input_schema: {
                    type: "object",
                    properties: {
                        command: {
                            type: "string",
                            description: "Çalıştırılacak komut"
                        },
                        args: {
                            type: "array",
                            items: { type: "string" },
                            description: "Komut argümanları (opsiyonel)"
                        }
                    },
                    required: ["command"]
                }
            },
            {
                name: "run_tests",
                description: "Projedeki testleri çalıştırır. Claude'un resmi MCP tool'u.",
                input_schema: {
                    type: "object",
                    properties: {
                        test_file: {
                            type: "string",
                            description: "Spesifik test dosyası (opsiyonel, boş bırakılırsa tüm testler)"
                        }
                    },
                    required: []
                }
            }
        ];
    }

    /**
     * Claude'a mesaj gönder (Streaming ile)
     */
    async sendMessage(message, context = {}) {
        if (!this.isInitialized) {
            throw new Error('Claude service not initialized. Call initialize() first.');
        }

        try {
            const tools = this.getAvailableTools();
            
            // Context varsa mesaja ekle
            let fullMessage = message;
            if (context.selectedCode) {
                fullMessage = `📝 Seçili kod:\n\`\`\`${context.language || 'javascript'}\n${context.selectedCode}\n\`\`\`\n\n${message}`;
            }
            if (context.filePath) {
                fullMessage = `📁 Dosya: ${context.filePath}\n\n${fullMessage}`;
            }

            // Conversation history'ye ekle
            this.conversationHistory.push({
                role: 'user',
                content: fullMessage
            });

            let finalResponse = '';
            let toolsUsed = [];

            // Streaming API call
            const stream = await this.anthropic.messages.create({
                model: this.currentModel,
                max_tokens: this.maxTokens,
                temperature: this.temperature,
                tools: tools,
                messages: this.conversationHistory,
                stream: true,
            });

            // Stream events'i işle
            for await (const event of stream) {
                // Text delta (streaming chunks)
                if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                    const chunk = event.delta.text;
                    finalResponse += chunk;
                    
                    // Streaming chunk'ı emit et (UI'a gerçek zamanlı göstermek için)
                    this.emit('streamingChunk', chunk);
                }
                
                // Tool kullanımı başladı
                if (event.type === 'content_block_start' && event.content_block.type === 'tool_use') {
                    const toolUse = event.content_block;
                    toolsUsed.push({
                        id: toolUse.id,
                        name: toolUse.name,
                        input: toolUse.input
                    });
                    
                    this.emit('toolUsed', {
                        name: toolUse.name,
                        id: toolUse.id,
                        input: toolUse.input
                    });
                    
                    console.log(`[Claude MCP] 🔧 Tool requested: ${toolUse.name}`, toolUse.input);
                }

                // Token usage
                if (event.type === 'message_delta' && event.usage) {
                    this.stats.tokensUsed += event.usage.output_tokens || 0;
                }
            }

            // ===== CRITICAL: EXECUTE TOOLS IF ANY =====
            // Claude MCP Protocol: Execute tools and send results back
            if (toolsUsed.length > 0) {
                console.log(`[Claude MCP] ⚙️  Executing ${toolsUsed.length} tools...`);
                
                // ✅ Emit separator before tool execution
                this.emit('streamingChunk', '\n\n🔧 **Tool Execution:**\n');
                
                const toolResults = [];
                for (const toolUse of toolsUsed) {
                    console.log(`[Claude MCP] 🔧 Executing tool: ${toolUse.name}`);
                    
                    // ✅ Show tool execution in UI
                    this.emit('streamingChunk', `\n- ${toolUse.name}... `);
                    
                    try {
                        const result = await this.executeTool(toolUse.name, toolUse.input);
                        toolResults.push({
                            type: 'tool_result',
                            tool_use_id: toolUse.id,
                            content: result.success 
                                ? JSON.stringify(result.data || result.result || result) 
                                : `Error: ${result.error}`
                        });
                        
                        console.log(`[Claude MCP] ✅ Tool executed: ${toolUse.name}`);
                        // ✅ Show success in UI
                        this.emit('streamingChunk', `✅`);
                    } catch (error) {
                        console.error(`[Claude MCP] ❌ Tool execution failed: ${toolUse.name}`, error);
                        toolResults.push({
                            type: 'tool_result',
                            tool_use_id: toolUse.id,
                            content: `Error executing tool: ${error.message}`,
                            is_error: true
                        });
                        // ✅ Show error in UI
                        this.emit('streamingChunk', `❌ (${error.message})`);
                    }
                }

                // Send tool results back to Claude for final response
                console.log(`[Claude MCP] 📤 Sending tool results back to Claude...`);
                
                // Add tool results to conversation
                this.conversationHistory.push({
                    role: 'user',
                    content: toolResults
                });

                // ✅ Emit separator and heading before final analysis
                this.emit('streamingChunk', '\n\n📊 **Analysis Result:**\n\n');

                // Get Claude's final response with tool results
                const finalStream = await this.anthropic.messages.create({
                    model: this.currentModel,
                    max_tokens: this.maxTokens,
                    temperature: this.temperature,
                    messages: this.conversationHistory,
                    stream: true,
                });

                // Process final response (stream continues in same message)
                let finalText = '';
                for await (const event of finalStream) {
                    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                        const chunk = event.delta.text;
                        finalText += chunk;
                        this.emit('streamingChunk', chunk);
                    }
                    
                    // Track token usage
                    if (event.type === 'message_delta' && event.usage) {
                        this.stats.tokensUsed += event.usage.output_tokens || 0;
                    }
                }

                finalResponse += '\n\n' + finalText;
            }

            // Conversation history'ye assistant response ekle
            this.conversationHistory.push({
                role: 'assistant',
                content: finalResponse
            });

            // İstatistikleri güncelle
            this.stats.messagesProcessed++;
            this.stats.toolsExecuted += toolsUsed.length;
            this.stats.lastMessageTime = new Date().toISOString();

            this.emit('messageComplete', {
                response: finalResponse,
                toolsUsed: toolsUsed,
                tokensUsed: this.stats.tokensUsed
            });

            return {
                success: true,
                response: finalResponse,
                toolsUsed: toolsUsed,
                stats: {
                    tokensUsed: this.stats.tokensUsed,
                    messagesProcessed: this.stats.messagesProcessed
                }
            };

        } catch (error) {
            console.error('[Claude MCP] ❌ Send message error:', error);
            this.stats.errors++;
            this.emit('error', error);
            
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Tool'ları direkt çalıştır (Claude'a sormadan)
     * 
     * 3 Execution Strategy:
     * 1. MAP: KodCanavarı'nın mevcut tools'una route et
     * 2. IMPLEMENT: Yeni tool implementasyonu
     * 3. AI: Claude AI'ya havale et (code analysis tools)
     */
    async executeTool(toolName, params) {
        const tool = this.getAvailableTools().find(t => t.name === toolName);
        if (!tool) {
            return { 
                success: false, 
                error: `Tool not found: ${toolName}` 
            };
        }

        try {
            this.stats.toolsExecuted++;
            
            // ===== STRATEGY 1: MAP TO KODCANAVARI MINI MCP TOOLS (HTTP) =====
            const miniMCPUrl = 'http://localhost:7777';
            
            if (toolName === 'read_file') {
                // Mini MCP fs.read tool
                const fetch = require('node-fetch');
                const response = await fetch(`${miniMCPUrl}/mcp/fs/read`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        path: params.file_path || params.path,
                        workingDirectory: this.workspacePath
                    })
                });
                
                if (!response.ok) {
                    const error = await response.text();
                    return { success: false, error };
                }
                
                const result = await response.json();
                return { success: true, content: result.content };
            }
            
            if (toolName === 'list_directory' || toolName === 'get_file_tree') {
                // Mini MCP shell.run with 'dir' or 'ls'
                const fetch = require('node-fetch');
                const isWindows = require('os').platform() === 'win32';
                const command = isWindows 
                    ? `dir "${params.directory_path || params.path || '.'}" /s /b` 
                    : `find "${params.directory_path || params.path || '.'}" -type f`;
                
                const response = await fetch(`${miniMCPUrl}/mcp/shell/run`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        command,
                        workingDirectory: this.workspacePath
                    })
                });
                
                if (!response.ok) {
                    const error = await response.text();
                    return { success: false, error };
                }
                
                const result = await response.json();
                return { success: true, tree: result.stdout || result.output };
            }
            
            if (toolName === 'str_replace_editor') {
                // Mini MCP fs.read and fs.write for editing
                const fetch = require('node-fetch');
                
                switch (params.command) {
                    case 'view':
                        // Read file via Mini MCP
                        const viewResponse = await fetch(`${miniMCPUrl}/mcp/fs/read`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                path: params.path,
                                workingDirectory: this.workspacePath
                            })
                        });
                        
                        if (!viewResponse.ok) {
                            const error = await viewResponse.text();
                            return { success: false, error };
                        }
                        
                        const viewResult = await viewResponse.json();
                        return { success: true, content: viewResult.content };
                    
                    case 'create':
                    case 'str_replace':
                    case 'insert':
                        // Write/edit file via Mini MCP
                        let content = params.file_text; // for create
                        
                        if (params.command === 'str_replace') {
                            // Read current content, replace, write back
                            const readResponse = await fetch(`${miniMCPUrl}/mcp/fs/read`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    path: params.path,
                                    workingDirectory: this.workspacePath
                                })
                            });
                            
                            if (!readResponse.ok) {
                                const error = await readResponse.text();
                                return { success: false, error };
                            }
                            
                            const readData = await readResponse.json();
                            content = readData.content.replace(params.old_str, params.new_str);
                        } else if (params.command === 'insert') {
                            // Read, insert at line, write back
                            const readResponse = await fetch(`${miniMCPUrl}/mcp/fs/read`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    path: params.path,
                                    workingDirectory: this.workspacePath
                                })
                            });
                            
                            if (!readResponse.ok) {
                                const error = await readResponse.text();
                                return { success: false, error };
                            }
                            
                            const readData = await readResponse.json();
                            const lines = readData.content.split('\n');
                            lines.splice(params.insert_line, 0, params.new_str);
                            content = lines.join('\n');
                        }
                        
                        // Write file via Mini MCP
                        const writeResponse = await fetch(`${miniMCPUrl}/mcp/fs/write`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                path: params.path,
                                content: content,
                                workingDirectory: this.workspacePath
                            })
                        });
                        
                        if (!writeResponse.ok) {
                            const error = await writeResponse.text();
                            return { success: false, error };
                        }
                        
                        const writeResult = await writeResponse.json();
                        return { success: true, result: writeResult };
                    
                    case 'undo_edit':
                        return { success: false, error: 'Undo not yet implemented' };
                    
                    default:
                        return { success: false, error: `Unknown str_replace_editor command: ${params.command}` };
                }
            }
            
            // ===== STRATEGY 2: NEW IMPLEMENTATION (VIA MINI MCP HTTP) =====
            if (toolName === 'write_file') {
                const fetch = require('node-fetch');
                const writeResponse = await fetch(`${miniMCPUrl}/mcp/fs/write`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        path: params.file_path || params.path,
                        content: params.content,
                        workingDirectory: this.workspacePath
                    })
                });
                
                if (!writeResponse.ok) {
                    const error = await writeResponse.text();
                    return { success: false, error };
                }
                
                const writeResult = await writeResponse.json();
                return { success: true, result: writeResult };
            }
            
            if (toolName === 'create_directory') {
                return await this._createDirectory(params.directory_path || params.path);
            }
            
            if (toolName === 'delete_file') {
                return await this._deleteFile(params.file_path || params.path);
            }
            
            if (toolName === 'search_files') {
                return await this._searchFiles(params.query, params.directory_path || params.path || '.');
            }
            
            if (toolName === 'run_terminal_command') {
                const fetch = require('node-fetch');
                const shellResponse = await fetch(`${miniMCPUrl}/mcp/shell/run`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        command: params.command,
                        workingDirectory: params.working_directory || this.workspacePath
                    })
                });
                
                if (!shellResponse.ok) {
                    const error = await shellResponse.text();
                    return { success: false, error };
                }
                
                const shellResult = await shellResponse.json();
                return { 
                    success: true, 
                    output: shellResult.stdout || shellResult.output,
                    error: shellResult.stderr,
                    exitCode: shellResult.exitCode
                };
            }
            
            if (toolName === 'run_tests') {
                return await this._runTests(params.test_file);
            }
            
            // ===== STRATEGY 3: AI DELEGATION (Code Analysis Tools) =====
            const codeAnalysisTools = [
                'code_analyzer', 'code_generator', 'refactor_code', 'explain_code',
                'find_bugs', 'write_tests', 'debug_code', 'optimize_performance'
            ];
            
            if (codeAnalysisTools.includes(toolName)) {
                // Bu tool'lar AI işi, Claude'un kendisine yaptır
                let prompt = `🤖 ${tool.description}\n\n`;
                
                if (params.code) {
                    prompt += `📝 Kod:\n\`\`\`${params.language || 'javascript'}\n${params.code}\n\`\`\`\n\n`;
                }
                
                if (params.instructions) {
                    prompt += `📋 İnstrüksiyonlar: ${params.instructions}\n`;
                }
                
                // Claude'a AI analizi yaptır
                const result = await this.sendMessage(prompt);
                return { success: true, analysis: result.response, ai_generated: true };
            }
            
            // Tool bulunamadı veya implement edilmemiş
            return { 
                success: false, 
                error: `Tool "${toolName}" implementation not found` 
            };
            
        } catch (error) {
            this.stats.errors++;
            this.emit('error', { tool: toolName, error: error.message });
            return { 
                success: false, 
                error: error.message 
            };
        }
    }
    
    // ===== HELPER METHODS: NEW TOOL IMPLEMENTATIONS =====
    
    async _writeFile(filePath, content) {
        const fs = require('fs').promises;
        const path = require('path');
        
        try {
            // Workspace root'a göre absolute path oluştur
            const fullPath = path.isAbsolute(filePath) 
                ? filePath 
                : path.join(this.workspacePath || process.cwd(), filePath);
            
            // Parent directory'yi oluştur (yoksa)
            await fs.mkdir(path.dirname(fullPath), { recursive: true });
            
            // Dosyayı yaz
            await fs.writeFile(fullPath, content, 'utf-8');
            
            return { 
                success: true, 
                path: fullPath,
                message: `File written: ${filePath}` 
            };
        } catch (error) {
            return { 
                success: false, 
                error: `Write file failed: ${error.message}` 
            };
        }
    }
    
    async _createDirectory(dirPath) {
        const fs = require('fs').promises;
        const path = require('path');
        
        try {
            const fullPath = path.isAbsolute(dirPath) 
                ? dirPath 
                : path.join(this.workspacePath || process.cwd(), dirPath);
            
            await fs.mkdir(fullPath, { recursive: true });
            
            return { 
                success: true, 
                path: fullPath,
                message: `Directory created: ${dirPath}` 
            };
        } catch (error) {
            return { 
                success: false, 
                error: `Create directory failed: ${error.message}` 
            };
        }
    }
    
    async _deleteFile(filePath) {
        const fs = require('fs').promises;
        const path = require('path');
        
        try {
            const fullPath = path.isAbsolute(filePath) 
                ? filePath 
                : path.join(this.workspacePath || process.cwd(), filePath);
            
            await fs.unlink(fullPath);
            
            return { 
                success: true, 
                path: fullPath,
                message: `File deleted: ${filePath}` 
            };
        } catch (error) {
            return { 
                success: false, 
                error: `Delete file failed: ${error.message}` 
            };
        }
    }
    
    async _searchFiles(query, dirPath) {
        const fs = require('fs').promises;
        const path = require('path');
        
        try {
            const fullPath = path.isAbsolute(dirPath) 
                ? dirPath 
                : path.join(this.workspacePath || process.cwd(), dirPath);
            
            const results = [];
            
            // Recursive search
            async function search(dir) {
                const entries = await fs.readdir(dir, { withFileTypes: true });
                
                for (const entry of entries) {
                    const entryPath = path.join(dir, entry.name);
                    
                    if (entry.isDirectory()) {
                        // node_modules, .git gibi klasörleri atla
                        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
                            await search(entryPath);
                        }
                    } else {
                        // Dosya adında veya içinde query var mı?
                        if (entry.name.toLowerCase().includes(query.toLowerCase())) {
                            results.push({ path: entryPath, matchType: 'filename' });
                        } else {
                            // Dosya içeriğinde ara (sadece text dosyalar)
                            if (entry.name.match(/\.(js|ts|jsx|tsx|json|md|txt|css|html)$/)) {
                                try {
                                    const content = await fs.readFile(entryPath, 'utf-8');
                                    if (content.toLowerCase().includes(query.toLowerCase())) {
                                        results.push({ path: entryPath, matchType: 'content' });
                                    }
                                } catch (e) {
                                    // Okuma hatası, skip
                                }
                            }
                        }
                    }
                }
            }
            
            await search(fullPath);
            
            return { 
                success: true, 
                results: results,
                count: results.length 
            };
        } catch (error) {
            return { 
                success: false, 
                error: `Search files failed: ${error.message}` 
            };
        }
    }
    
    async _runTerminalCommand(command, workingDirectory) {
        const { exec } = require('child_process');
        const util = require('util');
        const execPromise = util.promisify(exec);
        
        try {
            const cwd = workingDirectory || this.workspacePath || process.cwd();
            
            const { stdout, stderr } = await execPromise(command, { 
                cwd: cwd,
                timeout: 30000 // 30 saniye timeout
            });
            
            return { 
                success: true, 
                stdout: stdout,
                stderr: stderr,
                command: command 
            };
        } catch (error) {
            return { 
                success: false, 
                error: error.message,
                stdout: error.stdout || '',
                stderr: error.stderr || '' 
            };
        }
    }
    
    async _runTests(testFile) {
        // Test framework'ünü algıla ve çalıştır
        const fs = require('fs').promises;
        const path = require('path');
        
        try {
            const packageJsonPath = path.join(this.workspacePath || process.cwd(), 'package.json');
            const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
            
            // Test script'i var mı?
            if (packageJson.scripts && packageJson.scripts.test) {
                const command = testFile 
                    ? `npm test -- ${testFile}` 
                    : 'npm test';
                
                return await this._runTerminalCommand(command);
            } else {
                return { 
                    success: false, 
                    error: 'No test script found in package.json' 
                };
            }
        } catch (error) {
            return { 
                success: false, 
                error: `Run tests failed: ${error.message}` 
            };
        }
    }

    /**
     * Conversation history'yi temizle
     */
    clearHistory() {
        this.conversationHistory = [];
        this.emit('historyCleared');
        console.log('[Claude MCP] 🗑️ Conversation history cleared');
    }

    /**
     * Model değiştir
     */
    setModel(model) {
        const validModels = [
            'claude-sonnet-4-20250514',
            'claude-3-5-sonnet-20241022',
            'claude-3-opus-20240229',
            'claude-3-haiku-20240307'
        ];

        if (validModels.includes(model)) {
            this.currentModel = model;
            this.emit('modelChanged', model);
            console.log(`[Claude MCP] 🔄 Model changed to: ${model}`);
            return { success: true, model: this.currentModel };
        } else {
            return { 
                success: false, 
                error: `Invalid model. Valid models: ${validModels.join(', ')}` 
            };
        }
    }

    /**
     * İstatistikleri getir
     */
    getStats() {
        const tools = this.getAvailableTools();
        return {
            ...this.stats,
            isInitialized: this.isInitialized,
            currentModel: this.currentModel,
            conversationLength: this.conversationHistory.length,
            availableTools: tools.length, // 17 tools (LUMA projesinden)
            toolCategories: {
                codeAnalysis: 8, // code_analyzer, code_generator, refactor_code, explain_code, find_bugs, write_tests, debug_code, optimize_performance
                fileSystem: 6,   // read_file, write_file, list_directory, create_directory, delete_file, search_files
                advanced: 1,     // str_replace_editor (Claude'un en güçlü tool'u)
                fileTree: 1,     // get_file_tree
                terminal: 2      // run_terminal_command, run_tests
            }
        };
    }

    /**
     * API key'i değiştir (runtime'da)
     */
    async updateApiKey(newApiKey) {
        try {
            await this.initialize(newApiKey);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Service durumu
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            model: this.currentModel,
            messagesProcessed: this.stats.messagesProcessed,
            toolsExecuted: this.stats.toolsExecuted,
            tokensUsed: this.stats.tokensUsed,
            errors: this.stats.errors,
            hasApiKey: !!this.apiKey
        };
    }
}

module.exports = ClaudeMCPService;
