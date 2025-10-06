/**
 * KayraDeniz Kod Canavarı - Tool System Architecture
 * Continue.dev'den ilham alınarak tasarlanmış modern tool sistemi
 */

// ===== TOOL CONSTANTS =====

export const KayraToolNames = {
    ReadFile: "read_file",
    WriteFile: "write_file", 
    CreateFile: "create_file",
    ListDirectory: "list_dir",
    RunCommand: "run_cmd",
    AnalyzeCode: "analyze_code",
    SearchFiles: "search_files",
    CreateProject: "create_project",
    GitOperations: "git_ops"
};

export const ToolCategories = {
    FILE: "file",
    TERMINAL: "terminal", 
    ANALYSIS: "analysis",
    WEB: "web",
    PROJECT: "project"
};

export const ToolPermissions = {
    ALLOWED: "allowed",
    PROTECTED: "protected",
    ADMIN: "admin"
};

// ===== TOOL REGISTRY =====

export class KayraToolRegistry {
    constructor() {
        this.tools = new Map();
        this.implementations = new Map();
    }
    
    register(definition, implementation) {
        this.tools.set(definition.name, definition);
        this.implementations.set(definition.name, implementation);
        console.log(`🔧 Tool registered: ${definition.name}`);
    }
    
    getDefinition(name) {
        return this.tools.get(name);
    }
    
    getImplementation(name) {
        return this.implementations.get(name);
    }
    
    getAllTools() {
        return Array.from(this.tools.values());
    }
    
    getToolsByCategory(category) {
        return Array.from(this.tools.values()).filter(tool => tool.category === category);
    }
    
    listAvailableTools() {
        const tools = this.getAllTools();
        console.log('📋 Available Tools:');
        tools.forEach(tool => {
            console.log(`  - ${tool.name}: ${tool.description}`);
        });
        return tools;
    }
}

// ===== TOOL DISPATCHER =====

export class KayraToolDispatcher {
    constructor(registry) {
        this.registry = registry;
    }
    
    async executeTool(toolName, args, extras) {
        try {
            console.log(`🚀 Executing tool: ${toolName}`);
            console.log(`📋 Args:`, args);
            
            const definition = this.registry.getDefinition(toolName);
            if (!definition) {
                return {
                    success: false,
                    error: `Tool "${toolName}" not found`
                };
            }
            
            const implementation = this.registry.getImplementation(toolName);
            if (!implementation) {
                return {
                    success: false,
                    error: `Implementation for "${toolName}" not found`
                };
            }
            
            // Validate arguments
            const validationResult = this.validateArgs(args, definition);
            if (!validationResult.valid) {
                return {
                    success: false,
                    error: `Invalid arguments: ${validationResult.error}`
                };
            }
            
            // Execute tool
            const result = await implementation(args, extras);
            
            console.log(`✅ Tool ${toolName} executed successfully`);
            return {
                success: true,
                result
            };
            
        } catch (error) {
            console.error(`❌ Tool ${toolName} failed:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    
    validateArgs(args, definition) {
        // Check required parameters
        for (const required of definition.parameters.required) {
            if (!(required in args)) {
                return {
                    valid: false,
                    error: `Missing required parameter: ${required}`
                };
            }
        }
        
        return { valid: true };
    }
    
    // Tool suggestion based on context
    suggestTools(context) {
        const { intent, fileType, hasFiles } = context;
        const suggestions = [];
        
        if (intent === 'read' && hasFiles) {
            suggestions.push(KayraToolNames.ReadFile);
        }
        
        if (intent === 'create') {
            suggestions.push(KayraToolNames.CreateFile, KayraToolNames.CreateProject);
        }
        
        if (intent === 'analyze') {
            suggestions.push(KayraToolNames.AnalyzeCode, KayraToolNames.SearchFiles);
        }
        
        return suggestions;
    }
}