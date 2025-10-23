/**
 * MCP Completion System
 * Implements completion/complete for argument autocomplete per MCP spec
 */

const fs = require('fs');
const path = require('path');

class CompletionManager {
    constructor() {
        this.toolSchemas = new Map();
        this.promptSchemas = new Map();
        this.resourceSchemas = new Map();
        this.completionCache = new Map();
        this.cacheTTL = 30000; // 30 seconds
    }
    
    /**
     * Register tool schema for completion
     * @param {string} toolName - Tool name
     * @param {object} schema - Tool schema with parameters
     */
    registerTool(toolName, schema) {
        this.toolSchemas.set(toolName, schema);
    }
    
    /**
     * Register prompt schema for completion
     * @param {string} promptName - Prompt name
     * @param {object} schema - Prompt schema with arguments
     */
    registerPrompt(promptName, schema) {
        this.promptSchemas.set(promptName, schema);
    }
    
    /**
     * Register resource schema for completion
     * @param {string} resourceType - Resource type
     * @param {object} schema - Resource schema
     */
    registerResource(resourceType, schema) {
        this.resourceSchemas.set(resourceType, schema);
    }
    
    /**
     * Complete argument value
     * @param {object} params - Parameters
     * @param {string} params.ref - Reference URI (tool:name, prompt:name, resource:type)
     * @param {string} params.argumentName - Argument name to complete
     * @param {string} params.value - Partial value for completion
     * @returns {object} - Completion suggestions
     */
    async complete(params) {
        const { ref, argumentName, value = '' } = params;
        
        if (!ref) {
            throw new Error('Reference URI is required');
        }
        
        if (!argumentName) {
            throw new Error('Argument name is required');
        }
        
        // Parse reference
        const [refType, refName] = ref.split(':', 2);
        
        if (!refType || !refName) {
            throw new Error('Invalid reference format. Expected: type:name');
        }
        
        // Check cache
        const cacheKey = `${ref}:${argumentName}:${value}`;
        const cached = this.getFromCache(cacheKey);
        if (cached) {
            return cached;
        }
        
        // Get completions based on type
        let completions = [];
        
        switch (refType) {
            case 'tool':
                completions = await this.completeToolArgument(refName, argumentName, value);
                break;
            case 'prompt':
                completions = await this.completePromptArgument(refName, argumentName, value);
                break;
            case 'resource':
                completions = await this.completeResourceArgument(refName, argumentName, value);
                break;
            default:
                throw new Error(`Unknown reference type: ${refType}`);
        }
        
        const result = {
            completion: {
                values: completions,
                total: completions.length,
                hasMore: false
            }
        };
        
        // Cache result
        this.addToCache(cacheKey, result);
        
        return result;
    }
    
    /**
     * Complete tool argument
     */
    async completeToolArgument(toolName, argumentName, value) {
        const schema = this.toolSchemas.get(toolName);
        
        if (!schema) {
            return [];
        }
        
        const param = schema.parameters?.[argumentName];
        
        if (!param) {
            return [];
        }
        
        // Handle different parameter types
        switch (param.type) {
            case 'file':
            case 'path':
                return await this.completeFilePath(value);
            case 'enum':
                return this.completeEnum(param.enum, value);
            case 'boolean':
                return this.completeBoolean(value);
            case 'level':
                return this.completeLogLevel(value);
            default:
                return [];
        }
    }
    
    /**
     * Complete prompt argument
     */
    async completePromptArgument(promptName, argumentName, value) {
        const schema = this.promptSchemas.get(promptName);
        
        if (!schema) {
            return [];
        }
        
        const arg = schema.arguments?.[argumentName];
        
        if (!arg) {
            return [];
        }
        
        // Handle file paths
        if (argumentName.includes('path') || argumentName.includes('file')) {
            return await this.completeFilePath(value);
        }
        
        return [];
    }
    
    /**
     * Complete resource argument
     */
    async completeResourceArgument(resourceType, argumentName, value) {
        const schema = this.resourceSchemas.get(resourceType);
        
        if (!schema) {
            return [];
        }
        
        // Handle resource-specific completions
        if (argumentName === 'uri') {
            return await this.completeResourceURI(resourceType, value);
        }
        
        return [];
    }
    
    /**
     * Complete file path
     */
    async completeFilePath(value) {
        try {
            // Determine directory and prefix
            let dir, prefix;
            
            if (value.includes('/') || value.includes('\\')) {
                const parts = value.split(/[/\\]/);
                prefix = parts.pop();
                dir = parts.join(path.sep);
            } else {
                dir = process.cwd();
                prefix = value;
            }
            
            // Read directory
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            
            // Filter and format
            const completions = entries
                .filter(entry => entry.name.toLowerCase().startsWith(prefix.toLowerCase()))
                .map(entry => ({
                    value: path.join(dir, entry.name),
                    label: entry.name,
                    type: entry.isDirectory() ? 'directory' : 'file',
                    description: entry.isDirectory() ? 'Directory' : 'File'
                }))
                .slice(0, 20); // Limit to 20 results
            
            return completions;
        } catch (error) {
            return [];
        }
    }
    
    /**
     * Complete enum values
     */
    completeEnum(enumValues, value) {
        return enumValues
            .filter(v => v.toLowerCase().startsWith(value.toLowerCase()))
            .map(v => ({
                value: v,
                label: v,
                type: 'enum',
                description: `Enum value: ${v}`
            }));
    }
    
    /**
     * Complete boolean values
     */
    completeBoolean(value) {
        const values = ['true', 'false'];
        return values
            .filter(v => v.startsWith(value.toLowerCase()))
            .map(v => ({
                value: v,
                label: v,
                type: 'boolean',
                description: `Boolean: ${v}`
            }));
    }
    
    /**
     * Complete log level
     */
    completeLogLevel(value) {
        const levels = ['debug', 'info', 'warning', 'error'];
        return levels
            .filter(l => l.startsWith(value.toLowerCase()))
            .map(l => ({
                value: l,
                label: l,
                type: 'level',
                description: `Log level: ${l}`
            }));
    }
    
    /**
     * Complete resource URI
     */
    async completeResourceURI(resourceType, value) {
        // Handle different resource types
        switch (resourceType) {
            case 'file':
                return await this.completeFilePath(value);
            case 'git':
                return this.completeGitURI(value);
            case 'web':
                return this.completeWebURI(value);
            default:
                return [];
        }
    }
    
    /**
     * Complete git URI
     */
    completeGitURI(value) {
        const schemes = ['git://github.com/', 'git://gitlab.com/', 'git://'];
        return schemes
            .filter(s => s.startsWith(value))
            .map(s => ({
                value: s,
                label: s,
                type: 'uri',
                description: 'Git repository URI'
            }));
    }
    
    /**
     * Complete web URI
     */
    completeWebURI(value) {
        const schemes = ['https://', 'http://'];
        return schemes
            .filter(s => s.startsWith(value))
            .map(s => ({
                value: s,
                label: s,
                type: 'uri',
                description: 'Web URL'
            }));
    }
    
    /**
     * Get from cache
     */
    getFromCache(key) {
        const cached = this.completionCache.get(key);
        
        if (!cached) {
            return null;
        }
        
        if (Date.now() - cached.timestamp > this.cacheTTL) {
            this.completionCache.delete(key);
            return null;
        }
        
        return cached.data;
    }
    
    /**
     * Add to cache
     */
    addToCache(key, data) {
        this.completionCache.set(key, {
            data,
            timestamp: Date.now()
        });
    }
    
    /**
     * Clear cache
     */
    clearCache() {
        this.completionCache.clear();
    }
    
    /**
     * Get statistics
     */
    getStats() {
        return {
            toolSchemas: this.toolSchemas.size,
            promptSchemas: this.promptSchemas.size,
            resourceSchemas: this.resourceSchemas.size,
            cachedCompletions: this.completionCache.size
        };
    }
}

// Singleton instance
let completionManager = null;

function getCompletionManager() {
    if (!completionManager) {
        completionManager = new CompletionManager();
    }
    return completionManager;
}

module.exports = {
    CompletionManager,
    getCompletionManager
};
