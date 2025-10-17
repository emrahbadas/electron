/**
 * 🚪 ARTIFACT GATING SYSTEM
 * 
 * OpenAI Agents SDK style artifact verification before handoffs.
 * Ensures required files exist before agent transitions.
 * 
 * Features:
 * - Gate registration with required artifacts
 * - File existence verification
 * - Missing file detection
 * - Integration with Policy Engine
 * - Trace system integration
 * 
 * Usage:
 * ```javascript
 * gating.registerGate('design-complete', [
 *     'design/design_spec.md',
 *     'design/wireframe.md'
 * ]);
 * 
 * const result = await gating.verifyGate('design-complete');
 * if (!result.passed) {
 *     console.error('Missing files:', result.missingFiles);
 * }
 * ```
 */

class ArtifactGatingSystem {
    constructor(workspaceRoot, electronAPI) {
        this.workspaceRoot = workspaceRoot;
        this.electronAPI = electronAPI;
        
        // Gate definitions: name -> { files, verified, lastCheck }
        this.gates = new Map();
        
        // Verification history
        this.history = [];
        this.maxHistory = 100;
        
        console.log('🚪 Artifact Gating System initialized');
    }
    
    /**
     * Register a new gate with required artifacts
     * @param {string} gateName - Gate identifier
     * @param {Array<string>} requiredFiles - List of required file paths (relative to workspace)
     * @param {Object} options - Additional options
     */
    registerGate(gateName, requiredFiles, options = {}) {
        if (this.gates.has(gateName)) {
            console.warn(`⚠️ Gate '${gateName}' already exists, overwriting`);
        }
        
        const gate = {
            name: gateName,
            files: requiredFiles,
            optional: options.optional || [],
            verified: false,
            missingFiles: [],
            lastCheck: null,
            description: options.description || '',
            createdAt: Date.now()
        };
        
        this.gates.set(gateName, gate);
        
        console.log(`🚪 Registered gate: ${gateName} (${requiredFiles.length} required files)`);
        
        return gate;
    }
    
    /**
     * Verify a gate - check if all required artifacts exist
     * @param {string} gateName - Gate identifier
     * @returns {Promise<Object>} Verification result
     */
    async verifyGate(gateName) {
        const gate = this.gates.get(gateName);
        
        if (!gate) {
            return {
                passed: false,
                gateName: gateName,
                error: 'Gate not found',
                timestamp: Date.now()
            };
        }
        
        const missing = [];
        const found = [];
        
        // Check each required file
        for (const file of gate.files) {
            const fullPath = this.resolvePath(file);
            const exists = await this.fileExists(fullPath);
            
            if (exists) {
                found.push(file);
            } else {
                missing.push(file);
            }
        }
        
        // Check optional files
        const optionalFound = [];
        for (const file of gate.optional || []) {
            const fullPath = this.resolvePath(file);
            const exists = await this.fileExists(fullPath);
            if (exists) {
                optionalFound.push(file);
            }
        }
        
        // Update gate status
        gate.verified = missing.length === 0;
        gate.missingFiles = missing;
        gate.lastCheck = Date.now();
        
        const result = {
            passed: gate.verified,
            gateName: gateName,
            requiredFiles: gate.files.length,
            foundFiles: found.length,
            missingFiles: missing,
            optionalFound: optionalFound,
            message: gate.verified
                ? `✅ Gate '${gateName}' passed - All ${found.length} artifacts verified`
                : `❌ Gate '${gateName}' failed - Missing ${missing.length} artifacts: ${missing.join(', ')}`,
            timestamp: Date.now()
        };
        
        // Record in history
        this.history.unshift(result);
        if (this.history.length > this.maxHistory) {
            this.history.pop();
        }
        
        console.log(result.message);
        
        return result;
    }
    
    /**
     * Verify multiple gates at once
     * @param {Array<string>} gateNames - Array of gate names
     * @returns {Promise<Object>} Combined verification result
     */
    async verifyMultipleGates(gateNames) {
        const results = await Promise.all(
            gateNames.map(name => this.verifyGate(name))
        );
        
        const allPassed = results.every(r => r.passed);
        const failedGates = results.filter(r => !r.passed);
        
        return {
            passed: allPassed,
            gatesChecked: gateNames.length,
            gatesPassed: results.filter(r => r.passed).length,
            gatesFailed: failedGates.length,
            failedGates: failedGates.map(r => r.gateName),
            results: results,
            message: allPassed
                ? `✅ All ${gateNames.length} gates passed`
                : `❌ ${failedGates.length}/${gateNames.length} gates failed`,
            timestamp: Date.now()
        };
    }
    
    /**
     * Get gate status without re-verification
     * @param {string} gateName - Gate identifier
     * @returns {Object} Gate status
     */
    getGateStatus(gateName) {
        const gate = this.gates.get(gateName);
        
        if (!gate) {
            return {
                exists: false,
                message: `Gate '${gateName}' not found`
            };
        }
        
        return {
            exists: true,
            name: gate.name,
            verified: gate.verified,
            requiredFiles: gate.files.length,
            missingFiles: gate.missingFiles.length,
            lastCheck: gate.lastCheck,
            description: gate.description
        };
    }
    
    /**
     * List all registered gates
     * @returns {Array} All gates
     */
    listGates() {
        return Array.from(this.gates.values()).map(gate => ({
            name: gate.name,
            requiredFiles: gate.files.length,
            verified: gate.verified,
            lastCheck: gate.lastCheck,
            description: gate.description
        }));
    }
    
    /**
     * Remove a gate
     * @param {string} gateName - Gate identifier
     */
    removeGate(gateName) {
        const removed = this.gates.delete(gateName);
        if (removed) {
            console.log(`🗑️ Removed gate: ${gateName}`);
        }
        return removed;
    }
    
    /**
     * Clear all gates
     */
    clearGates() {
        this.gates.clear();
        console.log('🗑️ All gates cleared');
    }
    
    /**
     * Get verification history
     * @param {number} limit - Max results
     * @returns {Array} Recent verifications
     */
    getHistory(limit = 20) {
        return this.history.slice(0, limit);
    }
    
    /**
     * Helper: Resolve file path relative to workspace
     * @param {string} filePath - Relative or absolute path
     * @returns {string} Absolute path
     */
    resolvePath(filePath) {
        const path = require('path');
        
        if (path.isAbsolute(filePath)) {
            return filePath;
        }
        
        return path.join(this.workspaceRoot, filePath);
    }
    
    /**
     * Helper: Check if file exists
     * @param {string} fullPath - Absolute file path
     * @returns {Promise<boolean>} File exists?
     */
    async fileExists(fullPath) {
        try {
            if (this.electronAPI && this.electronAPI.fileExists) {
                return await this.electronAPI.fileExists(fullPath);
            }
            
            // Fallback for Node.js environment
            const fs = require('fs').promises;
            await fs.access(fullPath);
            return true;
        } catch (error) {
            return false;
        }
    }
    
    /**
     * Create a policy rule for gate verification
     * @param {string} gateName - Gate to verify
     * @returns {Object} Policy rule
     */
    createPolicyRule(gateName) {
        return {
            check: async (data) => {
                // Skip if no gate specified
                if (!data.gate || data.gate !== gateName) {
                    return true;
                }
                
                const result = await this.verifyGate(gateName);
                return result.passed;
            },
            severity: 'HIGH',
            message: `Gate '${gateName}' must pass before proceeding`,
            fix: `Ensure all required artifacts exist for gate '${gateName}'`,
            reason: 'Required artifacts missing'
        };
    }
}

// Export for use in app.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ArtifactGatingSystem;
}
