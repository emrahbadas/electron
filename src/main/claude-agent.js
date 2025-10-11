/**
 * Claude Agent - Anthropic Claude SDK Integration
 * 
 * This module provides Claude AI capabilities with MCP (Model Context Protocol) support.
 * - Non-streaming API calls (streaming can be added later)
 * - MCP tool integration when enabled
 * - Multiple model support (Sonnet 4, Sonnet 3.5, etc.)
 * - Memory-only API key storage (no disk persistence)
 */

const Anthropic = require('@anthropic-ai/sdk');

class ClaudeAgent {
    constructor() {
        this.client = null;
        this.apiKey = null;
        this.mcpManager = null;
        this.conversationHistory = [];
        
        // Supported Claude models (most recent at top)
        // Using OFFICIAL Anthropic API model identifiers (verified October 2025)
        // Source: https://docs.anthropic.com/en/docs/about-claude/models/overview
        this.availableModels = {
            'claude-sonnet-4-5-20250929': 'Claude Sonnet 4.5 (Latest - Sep 2025) 🌟',
            'claude-sonnet-4-20250514': 'Claude Sonnet 4 (May 2025)',
            'claude-3-7-sonnet-20250219': 'Claude Sonnet 3.7 (Feb 2025)',
            'claude-opus-4-1-20250805': 'Claude Opus 4.1 (Aug 2025) 🏆',
            'claude-opus-4-20250514': 'Claude Opus 4 (May 2025)',
            'claude-3-5-haiku-20241022': 'Claude Haiku 3.5 (Oct 2024) ⚡',
            'claude-3-haiku-20240307': 'Claude Haiku 3 (Mar 2024)'
        };
        
        this.defaultModel = 'claude-sonnet-4-5-20250929';
        this.currentModel = this.defaultModel;
        
        console.log('✅ Claude Agent initialized (API key not set yet)');
    }
    
    /**
     * Set API key and initialize Anthropic client
     * @param {string} apiKey - Anthropic API key
     */
    setApiKey(apiKey) {
        if (!apiKey || typeof apiKey !== 'string') {
            throw new Error('Invalid API key');
        }
        
        this.apiKey = apiKey;
        this.client = new Anthropic({
            apiKey: this.apiKey
        });
        
        console.log('✅ Claude API key set, client initialized');
    }
    
    /**
     * Set MCP Manager for tool support
     * @param {Object} mcpManager - MCP Manager instance
     */
    setMCPManager(mcpManager) {
        this.mcpManager = mcpManager;
        console.log('✅ MCP Manager linked to Claude Agent');
    }
    
    /**
     * Change current model
     * @param {string} modelId - Model identifier
     */
    setModel(modelId) {
        if (!this.availableModels[modelId]) {
            throw new Error(`Unknown model: ${modelId}`);
        }
        
        this.currentModel = modelId;
        console.log(`✅ Claude model set to: ${this.availableModels[modelId]}`);
    }
    
    /**
     * Get list of available models
     * @returns {Object} Available models
     */
    getAvailableModels() {
        return { ...this.availableModels };
    }
    
    /**
     * Ask Claude a question (non-streaming)
     * @param {Array} messages - Conversation messages [{role, content}, ...]
     * @param {Object} options - Optional parameters
     * @returns {Promise<string>} Claude's response
     */
    async askClaude(messages, options = {}) {
        if (!this.client) {
            throw new Error('Claude client not initialized. Set API key first.');
        }
        
        const {
            model = this.currentModel,
            toolsEnabled = false,
            maxTokens = 4096,
            temperature = 0.7,
            systemPrompt = null
        } = options;
        
        try {
            // Prepare request parameters
            const requestParams = {
                model: model,
                max_tokens: maxTokens,
                temperature: temperature,
                messages: messages
            };
            
            // Add system prompt if provided
            if (systemPrompt) {
                requestParams.system = systemPrompt;
            }
            
            // Add MCP tools if enabled
            if (toolsEnabled && this.mcpManager) {
                const tools = await this.mcpManager.listTools();
                
                if (tools && tools.length > 0) {
                    // Convert MCP tools to Claude tool format
                    requestParams.tools = tools.map(tool => ({
                        name: tool.name,
                        description: tool.description || `Tool: ${tool.name}`,
                        input_schema: tool.inputSchema || {
                            type: 'object',
                            properties: {},
                            required: []
                        }
                    }));
                    
                    console.log(`🔧 ${tools.length} MCP tools attached to Claude request`);
                }
            }
            
            // Make API call (non-streaming)
            const response = await this.client.messages.create(requestParams);
            
            // Handle tool use if present
            if (response.stop_reason === 'tool_use') {
                return await this.handleToolUse(response, messages, options);
            }
            
            // Extract text response
            const textContent = response.content
                .filter(block => block.type === 'text')
                .map(block => block.text)
                .join('\n');
            
            // Store in conversation history
            this.conversationHistory.push({
                role: 'assistant',
                content: textContent,
                timestamp: new Date().toISOString()
            });
            
            return textContent;
            
        } catch (error) {
            console.error('❌ Claude API error:', error);
            throw new Error(`Claude API Error: ${error.message}`);
        }
    }
    
    /**
     * Handle tool use in Claude's response
     * @param {Object} response - Claude API response with tool_use
     * @param {Array} previousMessages - Previous conversation messages
     * @param {Object} options - Request options
     * @returns {Promise<string>} Final response after tool execution
     */
    async handleToolUse(response, previousMessages, options) {
        if (!this.mcpManager) {
            throw new Error('MCP Manager not available for tool execution');
        }
        
        console.log('🔧 Claude requested tool use');
        
        // Extract tool use blocks
        const toolUseBlocks = response.content.filter(block => block.type === 'tool_use');
        const toolResults = [];
        
        for (const toolBlock of toolUseBlocks) {
            const { id, name, input } = toolBlock;
            
            console.log(`🔧 Executing tool: ${name}`, input);
            
            try {
                // Call tool through MCP Manager (with permission check)
                const result = await this.mcpManager.callTool(name, input);
                
                toolResults.push({
                    type: 'tool_result',
                    tool_use_id: id,
                    content: JSON.stringify(result)
                });
                
                console.log(`✅ Tool ${name} executed successfully`);
                
            } catch (error) {
                console.error(`❌ Tool ${name} failed:`, error);
                
                toolResults.push({
                    type: 'tool_result',
                    tool_use_id: id,
                    content: `Error: ${error.message}`,
                    is_error: true
                });
            }
        }
        
        // Continue conversation with tool results
        const newMessages = [
            ...previousMessages,
            {
                role: 'assistant',
                content: response.content
            },
            {
                role: 'user',
                content: toolResults
            }
        ];
        
        // Recursive call to get final response
        return await this.askClaude(newMessages, { ...options, toolsEnabled: false });
    }
    
    /**
     * Clear conversation history
     */
    clearHistory() {
        this.conversationHistory = [];
        console.log('🗑️ Claude conversation history cleared');
    }
    
    /**
     * Get conversation history
     * @returns {Array} Conversation history
     */
    getHistory() {
        return [...this.conversationHistory];
    }
    
    /**
     * Get agent status
     * @returns {Object} Status information
     */
    getStatus() {
        return {
            initialized: !!this.client,
            hasApiKey: !!this.apiKey,
            currentModel: this.currentModel,
            modelName: this.availableModels[this.currentModel],
            mcpEnabled: !!this.mcpManager,
            historyLength: this.conversationHistory.length
        };
    }
}

module.exports = ClaudeAgent;
