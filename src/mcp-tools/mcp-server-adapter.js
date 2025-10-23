/**
 * MCP Server Adapter - Final Integration Layer
 * Exposes all KodCanavarı tools via MCP protocol
 * Compatible with Claude Desktop and Cursor IDE
 */

const { ResourceManager } = require('./resources.js');
const { PromptsManager } = require('./prompts.js');
const { getLoggingManager } = require('./logging.js');
const { getNotificationsManager } = require('./notifications.js');
const { getCompletionManager } = require('./completion.js');
const { KnowledgeGraphManager } = require('./memory.js');
const { getFileEditor } = require('./edit-file.js');
const { getAdvancedFileOps } = require('./advanced-file-ops.js');
const { getSequentialThinking } = require('./sequential-thinking.js');
const { getHttpClient } = require('./http-client.js');
const { getGitAdvanced } = require('./git-advanced.js');

class MCPServerAdapter {
    constructor() {
        this.capabilities = {
            tools: true,
            resources: true,
            prompts: true,
            logging: true,
            completion: true
        };
        
        this.toolRegistry = new Map();
        this.initialized = false;
        
        // Initialize all managers
        this.resources = new ResourceManager();
        this.prompts = new PromptsManager();
        this.logger = getLoggingManager();
        this.notifications = getNotificationsManager();
        this.completion = getCompletionManager();
        this.memory = new KnowledgeGraphManager();
        this.fileEditor = getFileEditor();
        this.advancedFileOps = getAdvancedFileOps();
        this.thinking = getSequentialThinking();
        this.http = getHttpClient();
        this.git = getGitAdvanced();
        
        this.registerAllTools();
    }
    
    /**
     * Initialize MCP server
     * @param {object} clientInfo - Client information
     * @returns {object} - Server capabilities
     */
    async initialize(clientInfo) {
        this.initialized = true;
        
        await this.notifications.sendInitialized({
            clientInfo,
            serverCapabilities: this.capabilities
        });
        
        this.logger.info('MCP Server initialized', {
            client: clientInfo.name,
            tools: this.toolRegistry.size
        });
        
        return {
            protocolVersion: '2024-11-05',
            capabilities: this.capabilities,
            serverInfo: {
                name: 'KodCanavarı MCP Server',
                version: '1.0.0'
            }
        };
    }
    
    /**
     * Register all available tools
     */
    registerAllTools() {
        // Sprint 1: Resources
        this.registerTool('kc.resources.list', {
            description: 'List available resources (files, git, web)',
            inputSchema: {
                type: 'object',
                properties: {
                    cursor: { type: 'string', description: 'Pagination cursor' }
                }
            },
            handler: (params) => this.resources.list(params)
        });
        
        this.registerTool('kc.resources.read', {
            description: 'Read resource content by URI',
            inputSchema: {
                type: 'object',
                properties: {
                    uri: { type: 'string', description: 'Resource URI' }
                },
                required: ['uri']
            },
            handler: (params) => this.resources.read(params)
        });
        
        // Sprint 1: Prompts
        this.registerTool('kc.prompts.list', {
            description: 'List available prompt templates',
            inputSchema: {
                type: 'object',
                properties: {
                    cursor: { type: 'string' }
                }
            },
            handler: (params) => this.prompts.list(params)
        });
        
        this.registerTool('kc.prompts.get', {
            description: 'Get prompt content with arguments',
            inputSchema: {
                type: 'object',
                properties: {
                    name: { type: 'string', description: 'Prompt name' },
                    arguments: { type: 'object', description: 'Prompt arguments' }
                },
                required: ['name']
            },
            handler: (params) => this.prompts.get(params)
        });
        
        // Sprint 1: Logging
        this.registerTool('kc.logging.setLevel', {
            description: 'Set log level (debug, info, warning, error)',
            inputSchema: {
                type: 'object',
                properties: {
                    level: { type: 'string', enum: ['debug', 'info', 'warning', 'error'] }
                },
                required: ['level']
            },
            handler: (params) => this.logger.setLevel(params)
        });
        
        // Sprint 1: Notifications
        this.registerTool('kc.notifications.message', {
            description: 'Send notification message',
            inputSchema: {
                type: 'object',
                properties: {
                    level: { type: 'string' },
                    message: { type: 'string' },
                    metadata: { type: 'object' }
                },
                required: ['message']
            },
            handler: (params) => this.notifications.sendMessage(params)
        });
        
        // Sprint 1: Completion
        this.registerTool('kc.completion.complete', {
            description: 'Autocomplete argument values',
            inputSchema: {
                type: 'object',
                properties: {
                    ref: { type: 'string', description: 'Reference (tool:name)' },
                    argumentName: { type: 'string' },
                    value: { type: 'string' }
                },
                required: ['ref', 'argumentName']
            },
            handler: (params) => this.completion.complete(params)
        });
        
        // Sprint 2: Memory System
        this.registerTool('kc.memory.createEntities', {
            description: 'Create knowledge graph entities',
            inputSchema: {
                type: 'object',
                properties: {
                    entities: { type: 'array', description: 'Entities to create' }
                },
                required: ['entities']
            },
            handler: (params) => this.memory.createEntities(params)
        });
        
        this.registerTool('kc.memory.searchNodes', {
            description: 'Search knowledge graph',
            inputSchema: {
                type: 'object',
                properties: {
                    query: { type: 'string', description: 'Search query' }
                },
                required: ['query']
            },
            handler: (params) => this.memory.searchNodes(params)
        });
        
        // Sprint 3: File Operations
        this.registerTool('kc.files.edit', {
            description: 'Edit file with line-based operations (CRITICAL: safe editing)',
            inputSchema: {
                type: 'object',
                properties: {
                    path: { type: 'string' },
                    edits: { type: 'array' },
                    dryRun: { type: 'boolean' }
                },
                required: ['path', 'edits']
            },
            handler: (params) => this.fileEditor.editFile(params)
        });
        
        this.registerTool('kc.files.readMedia', {
            description: 'Read media file as base64',
            inputSchema: {
                type: 'object',
                properties: {
                    path: { type: 'string' }
                },
                required: ['path']
            },
            handler: (params) => this.advancedFileOps.readMediaFile(params)
        });
        
        this.registerTool('kc.files.directoryTree', {
            description: 'Get recursive directory tree',
            inputSchema: {
                type: 'object',
                properties: {
                    path: { type: 'string' },
                    maxDepth: { type: 'number' },
                    excludePatterns: { type: 'array' }
                },
                required: ['path']
            },
            handler: (params) => this.advancedFileOps.directoryTree(params)
        });
        
        // Sprint 4: Reasoning + HTTP
        this.registerTool('kc.thinking.start', {
            description: 'Start sequential thinking session',
            inputSchema: {
                type: 'object',
                properties: {
                    problem: { type: 'string' }
                },
                required: ['problem']
            },
            handler: (params) => this.thinking.startSession(params)
        });
        
        this.registerTool('kc.thinking.addThought', {
            description: 'Add thought to chain',
            inputSchema: {
                type: 'object',
                properties: {
                    sessionId: { type: 'string' },
                    content: { type: 'string' },
                    type: { type: 'string' }
                },
                required: ['sessionId', 'content']
            },
            handler: (params) => this.thinking.addThought(params)
        });
        
        this.registerTool('kc.http.get', {
            description: 'HTTP GET request',
            inputSchema: {
                type: 'object',
                properties: {
                    url: { type: 'string' },
                    headers: { type: 'object' }
                },
                required: ['url']
            },
            handler: (params) => this.http.get(params)
        });
        
        this.registerTool('kc.http.post', {
            description: 'HTTP POST request',
            inputSchema: {
                type: 'object',
                properties: {
                    url: { type: 'string' },
                    body: { type: 'object' },
                    headers: { type: 'object' }
                },
                required: ['url']
            },
            handler: (params) => this.http.post(params)
        });
        
        // Sprint 5: Git Advanced
        this.registerTool('kc.git.diff', {
            description: 'Get git diff',
            inputSchema: {
                type: 'object',
                properties: {
                    path: { type: 'string' },
                    ref1: { type: 'string' },
                    ref2: { type: 'string' }
                }
            },
            handler: (params) => this.git.diff(params)
        });
        
        this.registerTool('kc.git.log', {
            description: 'Get git log with filters',
            inputSchema: {
                type: 'object',
                properties: {
                    path: { type: 'string' },
                    maxCount: { type: 'number' },
                    since: { type: 'string' }
                }
            },
            handler: (params) => this.git.log(params)
        });
        
        this.logger.info('All tools registered', { count: this.toolRegistry.size });
    }
    
    /**
     * Register single tool
     */
    registerTool(name, config) {
        this.toolRegistry.set(name, config);
        
        // Register schema for completion
        if (config.inputSchema) {
            this.completion.registerTool(name, {
                parameters: config.inputSchema.properties
            });
        }
    }
    
    /**
     * List all tools (MCP endpoint)
     * @returns {object} - Tools list
     */
    async listTools() {
        const tools = [];
        
        for (const [name, config] of this.toolRegistry.entries()) {
            tools.push({
                name,
                description: config.description,
                inputSchema: config.inputSchema
            });
        }
        
        return {
            tools
        };
    }
    
    /**
     * Call tool (MCP endpoint)
     * @param {object} params - Parameters
     * @param {string} params.name - Tool name
     * @param {object} params.arguments - Tool arguments
     * @returns {object} - Tool result
     */
    async callTool(params) {
        const { name, arguments: args } = params;
        
        const tool = this.toolRegistry.get(name);
        
        if (!tool) {
            throw new Error(`Tool not found: ${name}`);
        }
        
        this.logger.debug('Tool called', { name, args });
        
        try {
            const result = await tool.handler(args);
            
            this.logger.debug('Tool succeeded', { name });
            
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify(result, null, 2)
                }]
            };
        } catch (error) {
            this.logger.error('Tool failed', { name, error: error.message });
            
            throw error;
        }
    }
    
    /**
     * Get server statistics
     */
    getStats() {
        return {
            initialized: this.initialized,
            tools: this.toolRegistry.size,
            capabilities: this.capabilities,
            memory: this.memory.getStats(),
            http: this.http.getStats(),
            git: this.git.getStats()
        };
    }
}

// Singleton instance
let mcpServer = null;

function getMCPServer() {
    if (!mcpServer) {
        mcpServer = new MCPServerAdapter();
    }
    return mcpServer;
}

module.exports = {
    MCPServerAdapter,
    getMCPServer
};
