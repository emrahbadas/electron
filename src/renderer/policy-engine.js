/**
 * 🛡️ POLICY ENGINE
 * 
 * Enforces security policies and best practices.
 * Prevents dangerous operations before they execute.
 * 
 * Critical Rules:
 * - NO_CHAINED_CD: Prevents "cd ... && ..." on Windows
 * - REQUIRE_ABSOLUTE_CWD: Forces absolute paths
 * - NO_DESTRUCTIVE_WITHOUT_BACKUP: Warns on rm/del operations
 * - VALIDATE_WORKSPACE: Ensures npm commands use --workspace
 * - BLOCK_SYSTEM_DIRS: Prevents operations in system directories
 */

class PolicyEngine {
    constructor() {
        // Policy rules
        this.rules = {
            // CRITICAL: Block execution
            NO_CHAINED_CD: {
                pattern: /cd\s+[^&\n]*&&/i,
                severity: 'CRITICAL',
                message: 'Chained "cd && ..." commands are forbidden on Windows',
                fix: 'Use absolute cwd option instead of cd command',
                reason: 'Windows command chaining causes ENOENT errors'
            },
            
            REQUIRE_ABSOLUTE_CWD: {
                check: (data) => {
                    if (!data.cwd) return true; // No cwd = OK (will use default)
                    return require('path').isAbsolute(data.cwd);
                },
                severity: 'CRITICAL',
                message: 'Current working directory must be an absolute path',
                fix: 'Convert relative path to absolute',
                reason: 'Relative paths cause unpredictable behavior'
            },
            
            BLOCK_SYSTEM_DIRS: {
                check: (data) => {
                    if (!data.cwd) return true;
                    const forbidden = ['C:\\Windows', 'C:\\Program Files', 'C:\\System32'];
                    return !forbidden.some(dir => data.cwd.toLowerCase().startsWith(dir.toLowerCase()));
                },
                severity: 'CRITICAL',
                message: 'Operations in system directories are forbidden',
                fix: 'Change to user directory',
                reason: 'System directory modifications can break Windows'
            },
            
            // HIGH: Strong warning but can proceed with approval
            NO_DESTRUCTIVE_WITHOUT_BACKUP: {
                pattern: /rm\s+-rf|del\s+\/[sS]|Remove-Item.*-Recurse|rmdir.*\/[sS]/i,
                severity: 'HIGH',
                message: 'Destructive operation detected (recursive delete)',
                fix: 'Create backup before deletion or use safer alternatives',
                reason: 'Data loss risk'
            },
            
            VALIDATE_WORKSPACE: {
                check: (data) => {
                    // If npm command without --workspace flag in monorepo
                    if (!data.command) return true;
                    
                    const isNpmCommand = /npm\s+(run|install|build|test)/i.test(data.command);
                    const hasWorkspaceFlag = /--workspace/i.test(data.command);
                    const isMonorepo = data.context?.isMonorepo || false;
                    
                    // If monorepo + npm command → must have workspace flag
                    if (isMonorepo && isNpmCommand && !hasWorkspaceFlag) {
                        return false;
                    }
                    
                    return true;
                },
                severity: 'HIGH',
                message: 'npm command in monorepo must use --workspace flag',
                fix: 'Add --workspace <name> to command',
                reason: 'Prevents installing packages in wrong location'
            },
            
            NO_SUDO_ON_WINDOWS: {
                pattern: /sudo\s+/i,
                severity: 'HIGH',
                message: 'sudo command does not exist on Windows',
                fix: 'Run terminal as Administrator or remove sudo',
                reason: 'sudo is Linux/Mac only'
            },
            
            // MEDIUM: Suggestions
            PREFER_POWERSHELL_SYNTAX: {
                pattern: /ls\s+(?!-)/i,
                severity: 'MEDIUM',
                message: 'Linux "ls" may not work on Windows PowerShell',
                fix: 'Use "Get-ChildItem" or "dir" instead',
                reason: 'Better compatibility with PowerShell'
            },
            
            WARN_NETWORK_OPERATIONS: {
                pattern: /curl\s+|wget\s+|Invoke-WebRequest/i,
                severity: 'LOW',
                message: 'Network operation detected',
                fix: 'Ensure URL is trusted',
                reason: 'Security awareness'
            }
        };
        
        console.log('✅ Policy Engine initialized with', Object.keys(this.rules).length, 'rules');
    }
    
    /**
     * Validate command and context against all policies
     * @param {Object} data - { command, cwd, context }
     * @returns {Object} Validation result
     */
    validate(data) {
        const { command, cwd, context = {} } = data;
        const violations = [];
        
        // Run all rule checks
        for (const [ruleName, rule] of Object.entries(this.rules)) {
            let violated = false;
            
            // Pattern-based rule
            if (rule.pattern) {
                violated = rule.pattern.test(command || '');
            }
            
            // Function-based rule
            if (rule.check) {
                violated = !rule.check({ command, cwd, context });
            }
            
            if (violated) {
                violations.push({
                    rule: ruleName,
                    severity: rule.severity,
                    message: rule.message,
                    fix: rule.fix,
                    reason: rule.reason
                });
            }
        }
        
        // Determine if can proceed
        const criticalViolations = violations.filter(v => v.severity === 'CRITICAL');
        const canProceed = criticalViolations.length === 0;
        
        return {
            valid: violations.length === 0,
            canProceed,
            violations,
            summary: this.generateSummary(violations)
        };
    }
    
    /**
     * Quick validate - throws error if critical violations
     * @param {Object} data - { command, cwd, context }
     * @throws {Error} If critical violation
     */
    enforce(data) {
        const result = this.validate(data);
        
        if (!result.canProceed) {
            const critical = result.violations.filter(v => v.severity === 'CRITICAL');
            const messages = critical.map(v => `${v.message}\nFix: ${v.fix}`).join('\n\n');
            
            throw new Error(`❌ POLICY VIOLATION (CRITICAL)\n\n${messages}`);
        }
        
        return result;
    }
    
    /**
     * Generate summary of violations
     * @param {Array} violations - Violations
     * @returns {string} Summary text
     */
    generateSummary(violations) {
        if (violations.length === 0) {
            return '✅ All policies passed';
        }
        
        const bySeverity = {
            CRITICAL: violations.filter(v => v.severity === 'CRITICAL'),
            HIGH: violations.filter(v => v.severity === 'HIGH'),
            MEDIUM: violations.filter(v => v.severity === 'MEDIUM'),
            LOW: violations.filter(v => v.severity === 'LOW')
        };
        
        let summary = '⚠️ Policy Violations:\n\n';
        
        if (bySeverity.CRITICAL.length > 0) {
            summary += `🔴 CRITICAL (${bySeverity.CRITICAL.length}):\n`;
            bySeverity.CRITICAL.forEach(v => {
                summary += `  - ${v.message}\n`;
                summary += `    Fix: ${v.fix}\n`;
            });
            summary += '\n';
        }
        
        if (bySeverity.HIGH.length > 0) {
            summary += `🟠 HIGH (${bySeverity.HIGH.length}):\n`;
            bySeverity.HIGH.forEach(v => {
                summary += `  - ${v.message}\n`;
            });
            summary += '\n';
        }
        
        if (bySeverity.MEDIUM.length > 0) {
            summary += `🟡 MEDIUM (${bySeverity.MEDIUM.length}):\n`;
            bySeverity.MEDIUM.forEach(v => {
                summary += `  - ${v.message}\n`;
            });
            summary += '\n';
        }
        
        return summary.trim();
    }
    
    /**
     * Auto-fix violations if possible
     * @param {Object} data - { command, cwd, context }
     * @returns {Object} Fixed data
     */
    autoFix(data) {
        let { command, cwd, context = {} } = data;
        const fixes = [];
        
        // Fix: Convert relative cwd to absolute
        if (cwd && !require('path').isAbsolute(cwd)) {
            cwd = require('path').resolve(cwd);
            fixes.push('Converted cwd to absolute path');
        }
        
        // Fix: Remove chained cd
        if (/cd\s+([^&\n]+)&&/i.test(command)) {
            const match = command.match(/cd\s+([^&\n]+)&&(.+)/i);
            if (match) {
                const targetDir = match[1].trim();
                const restCommand = match[2].trim();
                
                // Extract directory and update cwd
                cwd = require('path').resolve(cwd || process.cwd(), targetDir);
                command = restCommand;
                
                fixes.push('Converted "cd && ..." to cwd option');
            }
        }
        
        // Fix: Add --workspace flag if needed
        if (context.isMonorepo && /npm\s+(run|install)/i.test(command) && !/--workspace/i.test(command)) {
            if (context.workspace) {
                command = command.replace(/npm\s+/i, `npm --workspace ${context.workspace} `);
                fixes.push('Added --workspace flag');
            }
        }
        
        return {
            command,
            cwd,
            context,
            fixes,
            autoFixed: fixes.length > 0
        };
    }
    
    /**
     * Get rule information
     * @param {string} ruleName - Rule name
     * @returns {Object|null} Rule data
     */
    getRule(ruleName) {
        return this.rules[ruleName] || null;
    }
    
    /**
     * Get all rules
     * @returns {Object} All rules
     */
    getAllRules() {
        return { ...this.rules };
    }
    
    /**
     * Get statistics
     * @returns {Object} Stats
     */
    getStats() {
        const bySeverity = {
            CRITICAL: 0,
            HIGH: 0,
            MEDIUM: 0,
            LOW: 0
        };
        
        for (const rule of Object.values(this.rules)) {
            bySeverity[rule.severity]++;
        }
        
        return {
            totalRules: Object.keys(this.rules).length,
            bySeverity
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PolicyEngine;
}
