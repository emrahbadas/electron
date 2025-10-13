/**
 * 🔬 CRITIC AGENT
 * 
 * Root cause analysis and minimal fix generation.
 * Analyzes failures and generates fix plans.
 * 
 * Features:
 * - Rule-based first aid (fast pattern matching)
 * - LLM-based analysis (complex failures)
 * - Minimal fix plans (surgical fixes, not rewrites)
 * - Automatic retry logic
 * - Learning from failures
 */

class CriticAgent {
    constructor() {
        // Failure patterns database
        this.patterns = this.initializePatterns();
        
        // Statistics
        this.stats = {
            totalAnalyses: 0,
            successfulFixes: 0,
            failedFixes: 0,
            patternMatches: 0,
            llmAnalyses: 0
        };
        
        console.log('✅ Critic Agent initialized with', Object.keys(this.patterns).length, 'patterns');
    }
    
    /**
     * Initialize failure patterns
     * @returns {Object} Pattern database
     */
    initializePatterns() {
        return {
            // Pattern 1: Module not found
            MODULE_NOT_FOUND: {
                regex: /ModuleNotFoundError|cannot find module|No module named/i,
                extract: (stderr) => {
                    const match = stderr.match(/['"]([^'"]+)['"]/);
                    return match ? match[1] : 'unknown';
                },
                analyze: (module) => ({
                    rootCause: `Missing dependency: ${module}`,
                    fixPlan: [
                        {
                            tool: 'npm.install',
                            args: { package: module },
                            description: `Install missing package: ${module}`
                        },
                        {
                            tool: 'retry',
                            args: { delay: 1000 },
                            description: 'Retry original operation'
                        }
                    ]
                })
            },
            
            // Pattern 2: File not found
            FILE_NOT_FOUND: {
                regex: /ENOENT|no such file|cannot find|file not found/i,
                extract: (stderr) => {
                    const match = stderr.match(/['"`]([^'"`]+\.[\w]+)['"`]/);
                    return match ? match[1] : null;
                },
                analyze: (filepath) => ({
                    rootCause: `Missing file: ${filepath}`,
                    fixPlan: [
                        {
                            tool: 'fs.create',
                            args: { path: filepath, template: 'auto' },
                            description: `Create missing file: ${filepath}`
                        },
                        {
                            tool: 'retry',
                            args: { delay: 500 },
                            description: 'Retry original operation'
                        }
                    ]
                })
            },
            
            // Pattern 3: Port already in use
            PORT_IN_USE: {
                regex: /EADDRINUSE|port.*already in use|address already in use/i,
                extract: (stderr) => {
                    const match = stderr.match(/port\s+(\d+)/i);
                    return match ? match[1] : '8080';
                },
                analyze: (port) => ({
                    rootCause: `Port ${port} is already in use`,
                    fixPlan: [
                        {
                            tool: 'process.kill',
                            args: { port: port },
                            description: `Kill process using port ${port}`
                        },
                        {
                            tool: 'retry',
                            args: { delay: 2000 },
                            description: 'Retry starting server'
                        }
                    ]
                })
            },
            
            // Pattern 4: Permission denied
            PERMISSION_DENIED: {
                regex: /EPERM|EACCES|permission denied|access denied/i,
                extract: (stderr) => {
                    const match = stderr.match(/['"`]([^'"`]+)['"`]/);
                    return match ? match[1] : null;
                },
                analyze: (target) => ({
                    rootCause: `Permission denied: ${target}`,
                    fixPlan: [
                        {
                            tool: 'permission.fix',
                            args: { target: target },
                            description: `Fix permissions for: ${target}`
                        },
                        {
                            tool: 'retry',
                            args: { delay: 1000 },
                            description: 'Retry with corrected permissions'
                        }
                    ]
                })
            },
            
            // Pattern 5: Syntax error
            SYNTAX_ERROR: {
                regex: /SyntaxError|Invalid syntax|Unexpected token/i,
                extract: (stderr) => {
                    const lineMatch = stderr.match(/line (\d+)/i);
                    const fileMatch = stderr.match(/File "([^"]+)"/i);
                    return {
                        file: fileMatch ? fileMatch[1] : null,
                        line: lineMatch ? lineMatch[1] : null
                    };
                },
                analyze: (info) => ({
                    rootCause: `Syntax error at ${info.file || 'file'}${info.line ? ':' + info.line : ''}`,
                    fixPlan: [
                        {
                            tool: 'lint.check',
                            args: { file: info.file, line: info.line },
                            description: 'Run linter to identify syntax issue'
                        },
                        {
                            tool: 'code.fix',
                            args: { file: info.file, line: info.line, type: 'syntax' },
                            description: 'Fix syntax error'
                        },
                        {
                            tool: 'retry',
                            args: { delay: 500 },
                            description: 'Retry execution'
                        }
                    ]
                })
            },
            
            // Pattern 6: Vite build error (entry module)
            VITE_ENTRY_ERROR: {
                regex: /could not resolve entry module.*index\.html/i,
                extract: () => 'client/index.html',
                analyze: (entryFile) => ({
                    rootCause: 'Vite build failed: Entry module (index.html) not found or misconfigured',
                    fixPlan: [
                        {
                            tool: 'fs.ensure',
                            args: { path: entryFile, template: 'vite-react' },
                            description: `Ensure ${entryFile} exists with correct structure`
                        },
                        {
                            tool: 'fs.write',
                            args: {
                                path: 'client/vite.config.ts',
                                content: 'import { defineConfig } from "vite";\nimport react from "@vitejs/plugin-react";\nexport default defineConfig({ plugins:[react()], server:{ port:5173 } });'
                            },
                            description: 'Create/update vite.config.ts'
                        },
                        {
                            tool: 'retry',
                            args: { delay: 1000 },
                            description: 'Retry build'
                        }
                    ]
                })
            },
            
            // Pattern 7: Network timeout
            NETWORK_TIMEOUT: {
                regex: /ETIMEDOUT|ECONNREFUSED|network timeout|connection timed out/i,
                extract: (stderr) => {
                    const urlMatch = stderr.match(/(https?:\/\/[^\s]+)/i);
                    return urlMatch ? urlMatch[1] : 'unknown';
                },
                analyze: (url) => ({
                    rootCause: `Network timeout or connection refused: ${url}`,
                    fixPlan: [
                        {
                            tool: 'network.check',
                            args: { url: url },
                            description: `Check network connectivity to ${url}`
                        },
                        {
                            tool: 'retry',
                            args: { delay: 5000, maxRetries: 3 },
                            description: 'Retry with exponential backoff'
                        }
                    ]
                })
            }
        };
    }
    
    /**
     * Analyze failure and generate fix plan
     * @param {Object} failureData - { step, observations, stderr, exitCode }
     * @returns {Promise<Object>} Analysis result
     */
    async analyze(failureData) {
        this.stats.totalAnalyses++;
        
        const { step, observations = [], stderr = '', exitCode } = failureData;
        
        console.log('🔬 Analyzing failure:', step?.title || 'Unknown step');
        
        // Try rule-based analysis first (fast)
        const ruleBasedResult = this.ruleBasedAnalysis(stderr, observations);
        
        if (ruleBasedResult) {
            this.stats.patternMatches++;
            console.log('✅ Pattern matched:', ruleBasedResult.pattern);
            return {
                method: 'rule-based',
                pattern: ruleBasedResult.pattern,
                ...ruleBasedResult.analysis
            };
        }
        
        // Fallback to LLM-based analysis (slower but comprehensive)
        console.log('🤖 No pattern match, using LLM analysis...');
        this.stats.llmAnalyses++;
        
        return await this.llmBasedAnalysis(failureData);
    }
    
    /**
     * Rule-based analysis (fast pattern matching)
     * @param {string} stderr - Standard error output
     * @param {Array} observations - Observations
     * @returns {Object|null} Analysis result or null
     */
    ruleBasedAnalysis(stderr, observations) {
        // Combine all stderr
        const allStderr = [
            stderr,
            ...observations.map(o => o.stderr || '')
        ].join('\n');
        
        // Try each pattern
        for (const [patternName, pattern] of Object.entries(this.patterns)) {
            if (pattern.regex.test(allStderr)) {
                console.log(`🎯 Pattern matched: ${patternName}`);
                
                // Extract relevant info
                const extracted = pattern.extract(allStderr);
                
                // Generate fix plan
                const analysis = pattern.analyze(extracted);
                
                return {
                    pattern: patternName,
                    analysis
                };
            }
        }
        
        return null; // No pattern matched
    }
    
    /**
     * LLM-based analysis (for complex failures)
     * @param {Object} failureData - Failure data
     * @returns {Promise<Object>} Analysis result
     */
    async llmBasedAnalysis(failureData) {
        // TODO: Integrate with LLM API
        // For now, return a generic analysis
        
        const { step, stderr, observations } = failureData;
        
        return {
            method: 'llm-based',
            rootCause: 'Unknown error - requires manual investigation',
            fixPlan: [
                {
                    tool: 'manual.review',
                    args: { stderr, observations },
                    description: 'Review error logs manually'
                }
            ],
            confidence: 'low'
        };
    }
    
    /**
     * Execute fix plan
     * @param {Object} fixPlan - Fix plan from analysis
     * @returns {Promise<Object>} Execution result
     */
    async executeFix(fixPlan) {
        console.log('🔧 Executing fix plan with', fixPlan.length, 'steps');
        
        const results = [];
        
        for (const [index, step] of fixPlan.entries()) {
            console.log(`📋 Step ${index + 1}/${fixPlan.length}:`, step.description);
            
            try {
                const result = await this.executeFixStep(step);
                results.push({
                    step: index + 1,
                    description: step.description,
                    success: result.success,
                    output: result.output
                });
                
                if (!result.success) {
                    console.warn(`⚠️ Fix step ${index + 1} failed:`, result.error);
                    // Continue to next step
                }
                
            } catch (error) {
                console.error(`❌ Fix step ${index + 1} error:`, error);
                results.push({
                    step: index + 1,
                    description: step.description,
                    success: false,
                    error: error.message
                });
            }
        }
        
        const success = results.every(r => r.success);
        
        if (success) {
            this.stats.successfulFixes++;
        } else {
            this.stats.failedFixes++;
        }
        
        return {
            success,
            results,
            summary: `${results.filter(r => r.success).length}/${results.length} steps completed`
        };
    }
    
    /**
     * Execute single fix step
     * @param {Object} step - Fix step
     * @returns {Promise<Object>} Result
     */
    async executeFixStep(step) {
        const { tool, args } = step;
        
        // TODO: Implement tool execution
        // For now, simulate execution
        
        console.log(`🔧 Executing ${tool} with args:`, args);
        
        return {
            success: true,
            output: `${tool} executed successfully`
        };
    }
    
    /**
     * Get statistics
     * @returns {Object} Stats
     */
    getStats() {
        return {
            ...this.stats,
            successRate: this.stats.totalAnalyses > 0
                ? Math.round((this.stats.successfulFixes / this.stats.totalAnalyses) * 100)
                : 0
        };
    }
    
    /**
     * Add custom pattern
     * @param {string} name - Pattern name
     * @param {Object} pattern - Pattern definition
     */
    addPattern(name, pattern) {
        this.patterns[name] = pattern;
        console.log(`✅ Pattern added: ${name}`);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CriticAgent;
}
