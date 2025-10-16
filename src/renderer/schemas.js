/**
 * 🔍 ZOD SCHEMA VALIDATION
 * 
 * Type-safe validation for Night Orders and other structures.
 */

const { z } = require('zod');

// ===== NIGHT ORDERS SCHEMA =====

const ExplainSchema = z.object({
    goal: z.string().min(30, 'Goal must be at least 30 characters'),
    rationale: z.string().min(50, 'Rationale must be at least 50 characters'),
    tradeoffs: z.string().optional(),
    showDiff: z.boolean().optional(),
    checklist: z.array(z.string()).optional()
});

const StepSchema = z.object({
    id: z.string().regex(/^S\d+$/, 'Step ID must be S1, S2, S3, etc.'),
    tool: z.enum([
        'fs.write', 
        'fs.read', 
        'fs.delete', 
        'fs.multiEdit',  // NEW: Multi-edit support
        'run_cmd', 
        'terminal.exec'
    ]),
    args: z.record(z.unknown()).refine(
        (args) => {
            // Tool-specific validation will happen in parseArgs
            return true;
        },
        { message: 'Invalid tool arguments' }
    ),
    explain: ExplainSchema.optional(),
    verify: z.array(z.string()).optional()
});

const NightOrdersSchema = z.object({
    mission: z.string().min(10, 'Mission must be at least 10 characters'),
    acceptance: z.array(z.string()).min(1, 'At least one acceptance criteria required'),
    steps: z.array(StepSchema).min(1, 'At least one step required')
});

// ===== VALIDATION FUNCTIONS =====

/**
 * Validate Night Orders JSON
 * @param {Object} orders - Night Orders object
 * @returns {Object} { valid: boolean, errors?: Array }
 */
function validateNightOrders(orders) {
    try {
        NightOrdersSchema.parse(orders);
        return { valid: true };
    } catch (error) {
        return {
            valid: false,
            errors: error.errors.map(e => ({
                path: e.path.join('.'),
                message: e.message,
                code: e.code
            }))
        };
    }
}

/**
 * Validate single step
 * @param {Object} step - Step object
 * @returns {Object} { valid: boolean, errors?: Array }
 */
function validateStep(step) {
    try {
        StepSchema.parse(step);
        return { valid: true };
    } catch (error) {
        return {
            valid: false,
            errors: error.errors.map(e => ({
                path: e.path.join('.'),
                message: e.message,
                code: e.code
            }))
        };
    }
}

/**
 * Validate explain field
 * @param {Object} explain - Explain object
 * @returns {Object} { valid: boolean, errors?: Array }
 */
function validateExplain(explain) {
    try {
        ExplainSchema.parse(explain);
        return { valid: true };
    } catch (error) {
        return {
            valid: false,
            errors: error.errors.map(e => ({
                path: e.path.join('.'),
                message: e.message,
                code: e.code
            }))
        };
    }
}

// ===== EXPORTS =====

module.exports = {
    NightOrdersSchema,
    StepSchema,
    ExplainSchema,
    validateNightOrders,
    validateStep,
    validateExplain
};
