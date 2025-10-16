/**
 * 🛡️ TOOL ARGUMENT VALIDATION UTILITIES
 * 
 * Inspired by Continue's parseArgs.ts
 * Provides type-safe argument parsing with clear error messages
 */

/**
 * Get required string argument
 * @throws {Error} If argument is missing or not a string
 */
export function getStringArg(args, key) {
    if (!(key in args)) {
        throw new Error(`❌ Missing required argument: ${key}`);
    }
    if (typeof args[key] !== 'string') {
        throw new Error(`❌ Argument '${key}' must be a string, got ${typeof args[key]}`);
    }
    return args[key];
}

/**
 * Get optional boolean argument with default
 */
export function getBooleanArg(args, key, defaultValue = undefined) {
    if (!(key in args)) {
        return defaultValue;
    }
    if (typeof args[key] !== 'boolean') {
        throw new Error(`❌ Argument '${key}' must be a boolean, got ${typeof args[key]}`);
    }
    return args[key];
}

/**
 * Get optional number argument with default
 */
export function getNumberArg(args, key, defaultValue = undefined) {
    if (!(key in args)) {
        return defaultValue;
    }
    if (typeof args[key] !== 'number') {
        throw new Error(`❌ Argument '${key}' must be a number, got ${typeof args[key]}`);
    }
    return args[key];
}

/**
 * Get required array argument
 * @throws {Error} If argument is missing or not an array
 */
export function getArrayArg(args, key) {
    if (!(key in args)) {
        throw new Error(`❌ Missing required argument: ${key}`);
    }
    if (!Array.isArray(args[key])) {
        throw new Error(`❌ Argument '${key}' must be an array, got ${typeof args[key]}`);
    }
    return args[key];
}

/**
 * Get optional object argument with default
 */
export function getObjectArg(args, key, defaultValue = {}) {
    if (!(key in args)) {
        return defaultValue;
    }
    if (typeof args[key] !== 'object' || args[key] === null || Array.isArray(args[key])) {
        throw new Error(`❌ Argument '${key}' must be an object, got ${typeof args[key]}`);
    }
    return args[key];
}

/**
 * Validate Night Orders step structure
 * @throws {Error} If step is invalid
 */
export function validateNightOrdersStep(step) {
    // Required fields
    getStringArg(step, 'id');
    getStringArg(step, 'tool');
    
    // Optional fields with defaults
    const args = getObjectArg(step, 'args', {});
    const explain = getObjectArg(step, 'explain', {});
    const verify = step.verify || []; // Optional array
    
    // Validate explain if present
    if (Object.keys(explain).length > 0) {
        if ('goal' in explain) {
            getStringArg(explain, 'goal');
            if (explain.goal.length < 30) {
                throw new Error(`❌ explain.goal must be at least 30 characters (got ${explain.goal.length})`);
            }
        }
        if ('rationale' in explain) {
            getStringArg(explain, 'rationale');
            if (explain.rationale.length < 50) {
                throw new Error(`❌ explain.rationale must be at least 50 characters (got ${explain.rationale.length})`);
            }
        }
    }
    
    // Validate tool-specific args
    validateToolArgs(step.tool, args);
    
    return { step, args, explain, verify };
}

/**
 * Validate tool-specific arguments
 * @throws {Error} If tool args are invalid
 */
function validateToolArgs(tool, args) {
    switch (tool) {
        case 'fs.write':
            getStringArg(args, 'path');
            getStringArg(args, 'content');
            break;
            
        case 'fs.read':
            getStringArg(args, 'path');
            break;
            
        case 'run_cmd':
            getStringArg(args, 'command');
            getBooleanArg(args, 'waitForCompletion', true);
            break;
            
        case 'fs.multiEdit':
            getStringArg(args, 'filepath');
            const edits = getArrayArg(args, 'edits');
            
            // Validate each edit operation
            edits.forEach((edit, index) => {
                if (typeof edit !== 'object' || edit === null) {
                    throw new Error(`❌ edits[${index}] must be an object`);
                }
                getStringArg(edit, 'old_string');
                getStringArg(edit, 'new_string');
                
                if (edit.old_string === edit.new_string) {
                    throw new Error(`❌ edits[${index}]: old_string and new_string must be different`);
                }
                
                // Optional replace_all
                if ('replace_all' in edit) {
                    getBooleanArg(edit, 'replace_all');
                }
            });
            break;
            
        default:
            // Unknown tool - just ensure args is an object
            if (typeof args !== 'object' || args === null) {
                throw new Error(`❌ Tool '${tool}' args must be an object`);
            }
    }
}

/**
 * Validate entire Night Orders JSON
 * @throws {Error} If Night Orders structure is invalid
 */
export function validateNightOrders(nightOrders) {
    // Required fields
    getStringArg(nightOrders, 'mission');
    const acceptance = getArrayArg(nightOrders, 'acceptance');
    const steps = getArrayArg(nightOrders, 'steps');
    
    // Validate mission length
    if (nightOrders.mission.length < 10) {
        throw new Error(`❌ mission must be at least 10 characters (got ${nightOrders.mission.length})`);
    }
    
    // Validate acceptance criteria
    if (acceptance.length === 0) {
        throw new Error(`❌ acceptance array cannot be empty`);
    }
    
    acceptance.forEach((criterion, index) => {
        if (typeof criterion !== 'string') {
            throw new Error(`❌ acceptance[${index}] must be a string`);
        }
    });
    
    // Validate steps
    if (steps.length === 0) {
        throw new Error(`❌ steps array cannot be empty`);
    }
    
    const validatedSteps = steps.map((step, index) => {
        try {
            return validateNightOrdersStep(step);
        } catch (error) {
            throw new Error(`❌ Invalid step[${index}] (id: ${step.id || 'unknown'}): ${error.message}`);
        }
    });
    
    return {
        mission: nightOrders.mission,
        acceptance,
        steps: validatedSteps
    };
}

// Singleton export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getStringArg,
        getBooleanArg,
        getNumberArg,
        getArrayArg,
        getObjectArg,
        validateNightOrdersStep,
        validateNightOrders
    };
}
