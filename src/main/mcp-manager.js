/**
 * MCP Manager - Model Context Protocol Client
 * 
 * Manages connections to multiple MCP servers and provides unified tool access.
 * Servers:
 * - ws://127.0.0.1:4001 - Files (read/write file operations)
 * - ws://127.0.0.1:4002 - Shell (command execution with whitelist)
 * - ws://127.0.0.1:4003 - Git (version control operations)
 * 
 * Features:
 * - Multi-server connection management
 * - Tool discovery and routing
 * - Permission middleware for each tool call
 * - Call logging
 * - Security controls
 */

const WebSocket = require('ws');
const path = require('path');

class MCPManager {
    constructor(permissionCallback) {
        this.servers = {
            files: {
                url: 'ws://127.0.0.1:4001',
                connection: null,
                status: 'disconnected',
                tools: []
            },
            shell: {
                url: 'ws://127.0.0.1:4002',
                connection: null,
                status: 'disconnected',
                tools: []
            },
            git: {
                url: 'ws://127.0.0.1:4003',
                connection: null,
                status: 'disconnected',
                tools: []
            }
        };
        
        // Permission callback - must be set from main process to show UI dialog
        this.permissionCallback = permissionCallback;
        
        // Call log for auditing
        this.callLog = [];
        
        // Security whitelist for shell commands
        this.shellWhitelist = [
            'node -v',
            'npm -v',
            'npm run dev',
            'npm run build',
            'npm start',
            'npm test',
            'git status',
            'git log --oneline',
            'git branch',
            'git diff'
        ];
        
        // File operations whitelist (project root)
        this.fileWhitelistRoot = null;
        
        console.log('✅ MCP Manager initialized (servers not connected)');
    }
    
    /**
     * Set project root for file whitelist
     * @param {string} rootPath - Absolute path to project root
     */
    setFileWhitelistRoot(rootPath) {
        this.fileWhitelistRoot = path.resolve(rootPath);
        console.log(`🔒 File whitelist root set: ${this.fileWhitelistRoot}`);
    }
    
    /**
     * Connect to all MCP servers
     * @returns {Promise<Object>} Connection results
     */
    async connectAll() {
        const results = {};
        
        for (const [name, server] of Object.entries(this.servers)) {
            try {
                console.log(`🔌 Connecting to ${name} MCP server: ${server.url}`);
                await this.connectServer(name);
                results[name] = { success: true, status: 'connected' };
            } catch (error) {
                console.error(`❌ Failed to connect to ${name} server:`, error.message);
                results[name] = { success: false, error: error.message };
            }
        }
        
        return results;
    }
    
    /**
     * Connect to a specific MCP server
     * @param {string} serverName - Server name (files, shell, git)
     * @returns {Promise<void>}
     */
    connectServer(serverName) {
        return new Promise((resolve, reject) => {
            const server = this.servers[serverName];
            
            if (!server) {
                return reject(new Error(`Unknown server: ${serverName}`));
            }
            
            // Create WebSocket connection
            const ws = new WebSocket(server.url);
            
            ws.on('open', async () => {
                console.log(`✅ Connected to ${serverName} MCP server`);
                server.connection = ws;
                server.status = 'connected';
                
                // Discover tools
                try {
                    server.tools = await this.discoverTools(serverName);
                    console.log(`🔧 Discovered ${server.tools.length} tools from ${serverName}`);
                    resolve();
                } catch (error) {
                    console.warn(`⚠️ Failed to discover tools from ${serverName}:`, error.message);
                    resolve(); // Still connected, just no tools
                }
            });
            
            ws.on('error', (error) => {
                console.error(`❌ ${serverName} WebSocket error:`, error.message);
                server.status = 'error';
                reject(error);
            });
            
            ws.on('close', () => {
                console.log(`🔌 ${serverName} connection closed`);
                server.connection = null;
                server.status = 'disconnected';
            });
            
            // Timeout after 5 seconds
            setTimeout(() => {
                if (server.status !== 'connected') {
                    ws.close();
                    reject(new Error(`Connection timeout for ${serverName}`));
                }
            }, 5000);
        });
    }
    
    /**
     * Discover tools from a server
     * @param {string} serverName - Server name
     * @returns {Promise<Array>} List of tools
     */
    async discoverTools(serverName) {
        const server = this.servers[serverName];
        
        if (!server.connection) {
            throw new Error(`${serverName} server not connected`);
        }
        
        return new Promise((resolve, reject) => {
            const ws = server.connection;
            
            // Send list_tools request
            const request = {
                jsonrpc: '2.0',
                id: Date.now(),
                method: 'tools/list',
                params: {}
            };
            
            ws.send(JSON.stringify(request));
            
            // Wait for response
            const responseHandler = (data) => {
                try {
                    const response = JSON.parse(data.toString());
                    
                    if (response.id === request.id) {
                        ws.off('message', responseHandler);
                        
                        if (response.error) {
                            reject(new Error(response.error.message));
                        } else {
                            resolve(response.result?.tools || []);
                        }
                    }
                } catch (error) {
                    // Ignore parsing errors for other messages
                }
            };
            
            ws.on('message', responseHandler);
            
            // Timeout
            setTimeout(() => {
                ws.off('message', responseHandler);
                reject(new Error('Tool discovery timeout'));
            }, 5000);
        });
    }
    
    /**
     * Get list of all available tools from all servers
     * @returns {Promise<Array>} Merged tool list
     */
    async listTools() {
        const allTools = [];
        
        for (const [serverName, server] of Object.entries(this.servers)) {
            if (server.status === 'connected' && server.tools.length > 0) {
                // Add server prefix to tool names for routing
                const prefixedTools = server.tools.map(tool => ({
                    ...tool,
                    name: `${serverName}:${tool.name}`,
                    _server: serverName,
                    _originalName: tool.name
                }));
                
                allTools.push(...prefixedTools);
            }
        }
        
        console.log(`📋 Total available tools: ${allTools.length}`);
        return allTools;
    }
    
    /**
     * Call a tool with permission check
     * @param {string} toolName - Tool name (with server prefix)
     * @param {Object} args - Tool arguments
     * @returns {Promise<any>} Tool result
     */
    async callTool(toolName, args) {
        // Parse server name from tool name
        const [serverName, originalToolName] = toolName.includes(':') 
            ? toolName.split(':')
            : [null, toolName];
        
        if (!serverName || !this.servers[serverName]) {
            throw new Error(`Unknown server for tool: ${toolName}`);
        }
        
        const server = this.servers[serverName];
        
        if (server.status !== 'connected') {
            throw new Error(`Server ${serverName} not connected`);
        }
        
        // Security checks
        if (!this.securityCheck(serverName, originalToolName, args)) {
            throw new Error(`Security check failed for ${toolName}`);
        }
        
        // Request permission
        const permission = await this.requestPermission(toolName, args);
        
        if (!permission.allowed) {
            const logEntry = {
                timestamp: new Date().toISOString(),
                tool: toolName,
                args: this.summarizeArgs(args),
                decision: 'DENIED',
                reason: permission.reason
            };
            
            this.callLog.push(logEntry);
            console.log('🚫 Tool call denied:', logEntry);
            
            throw new Error(`Permission denied: ${permission.reason || 'User rejected'}`);
        }
        
        // Execute tool
        try {
            const result = await this.executeToolOnServer(
                server.connection,
                originalToolName,
                args
            );
            
            const logEntry = {
                timestamp: new Date().toISOString(),
                tool: toolName,
                args: this.summarizeArgs(args),
                decision: 'ALLOWED',
                result: this.summarizeResult(result)
            };
            
            this.callLog.push(logEntry);
            console.log('✅ Tool call succeeded:', logEntry);
            
            return result;
            
        } catch (error) {
            const logEntry = {
                timestamp: new Date().toISOString(),
                tool: toolName,
                args: this.summarizeArgs(args),
                decision: 'ERROR',
                error: error.message
            };
            
            this.callLog.push(logEntry);
            console.error('❌ Tool call failed:', logEntry);
            
            throw error;
        }
    }
    
    /**
     * Security check for tool calls
     * @param {string} serverName - Server name
     * @param {string} toolName - Tool name
     * @param {Object} args - Tool arguments
     * @returns {boolean} Pass/fail
     */
    securityCheck(serverName, toolName, args) {
        // Shell security: Check command whitelist
        if (serverName === 'shell') {
            const command = args.command || args.cmd || '';
            const isWhitelisted = this.shellWhitelist.some(allowed => 
                command.toLowerCase().startsWith(allowed.toLowerCase())
            );
            
            if (!isWhitelisted) {
                console.warn(`🚫 Shell command not whitelisted: ${command}`);
                return false;
            }
        }
        
        // Files security: Check path traversal
        if (serverName === 'files' && this.fileWhitelistRoot) {
            const filePath = args.path || args.file || args.filePath || '';
            const resolvedPath = path.resolve(filePath);
            
            if (!resolvedPath.startsWith(this.fileWhitelistRoot)) {
                console.warn(`🚫 File path outside whitelist root: ${resolvedPath}`);
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * Request permission from user (via callback to main process)
     * @param {string} toolName - Tool name
     * @param {Object} args - Tool arguments
     * @returns {Promise<Object>} Permission result {allowed, reason}
     */
    async requestPermission(toolName, args) {
        if (!this.permissionCallback) {
            console.warn('⚠️ No permission callback set, auto-allowing');
            return { allowed: true };
        }
        
        try {
            const result = await this.permissionCallback(toolName, args);
            return result;
        } catch (error) {
            console.error('❌ Permission check failed:', error);
            return { allowed: false, reason: 'Permission check failed' };
        }
    }
    
    /**
     * Execute tool on server via WebSocket
     * @param {WebSocket} ws - WebSocket connection
     * @param {string} toolName - Tool name
     * @param {Object} args - Tool arguments
     * @returns {Promise<any>} Tool result
     */
    executeToolOnServer(ws, toolName, args) {
        return new Promise((resolve, reject) => {
            const request = {
                jsonrpc: '2.0',
                id: Date.now(),
                method: 'tools/call',
                params: {
                    name: toolName,
                    arguments: args
                }
            };
            
            ws.send(JSON.stringify(request));
            
            const responseHandler = (data) => {
                try {
                    const response = JSON.parse(data.toString());
                    
                    if (response.id === request.id) {
                        ws.off('message', responseHandler);
                        
                        if (response.error) {
                            reject(new Error(response.error.message));
                        } else {
                            resolve(response.result);
                        }
                    }
                } catch (error) {
                    // Ignore parsing errors
                }
            };
            
            ws.on('message', responseHandler);
            
            // Timeout
            setTimeout(() => {
                ws.off('message', responseHandler);
                reject(new Error('Tool execution timeout'));
            }, 30000); // 30 seconds
        });
    }
    
    /**
     * Summarize args for logging
     * @param {Object} args - Tool arguments
     * @returns {string} Summary
     */
    summarizeArgs(args) {
        const str = JSON.stringify(args);
        return str.length > 100 ? str.substring(0, 100) + '...' : str;
    }
    
    /**
     * Summarize result for logging
     * @param {any} result - Tool result
     * @returns {string} Summary
     */
    summarizeResult(result) {
        const str = JSON.stringify(result);
        return str.length > 200 ? str.substring(0, 200) + '...' : str;
    }
    
    /**
     * Get call log
     * @returns {Array} Call log entries
     */
    getCallLog() {
        return [...this.callLog];
    }
    
    /**
     * Clear call log
     */
    clearCallLog() {
        this.callLog = [];
        console.log('🗑️ MCP call log cleared');
    }
    
    /**
     * Get status of all servers
     * @returns {Object} Status information
     */
    getStatus() {
        const status = {};
        
        for (const [name, server] of Object.entries(this.servers)) {
            status[name] = {
                url: server.url,
                status: server.status,
                toolCount: server.tools.length
            };
        }
        
        return {
            servers: status,
            totalTools: Object.values(this.servers)
                .reduce((sum, s) => sum + s.tools.length, 0),
            logEntries: this.callLog.length
        };
    }
    
    /**
     * Disconnect all servers
     */
    disconnectAll() {
        for (const [name, server] of Object.entries(this.servers)) {
            if (server.connection) {
                server.connection.close();
                server.connection = null;
                server.status = 'disconnected';
                console.log(`🔌 Disconnected from ${name} server`);
            }
        }
    }
}

module.exports = MCPManager;
