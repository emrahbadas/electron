/**
 * Reflexion Applier - Auto-fix Execution Layer
 * 
 * Bu modül, Reflexion System'in ürettiği "SUGGESTED FIXES"'leri gerçek dosya
 * işlemlerine çevirir. ChatGPT-5'in tespit ettiği "reflection var ama uygulama yok"
 * sorununu çözer.
 * 
 * 🧠 MEMORY INTEGRATION: Now queries Knowledge Graph for past errors/fixes
 * to avoid repeating mistakes and learn from previous attempts.
 */

// 🌉 Import Learning Store Bridge for Memory access
const { LearningStoreBridge } = require('../mcp-tools/learning-store-bridge.js');
const path = require('path');

class ReflexionApplier {
    constructor(toolBridge, options = {}) {
        this.toolBridge = toolBridge;
        this.fixHistory = [];
        this.circuitBreakerThreshold = 3; // Same fix applied 3 times = stop
        
        // 🧠 Initialize Memory System connection
        this.memoryEnabled = options.memoryEnabled !== false;
        if (this.memoryEnabled) {
            try {
                const memoryFile = options.memoryFile || path.join(process.cwd(), 'memory.jsonl');
                this.memory = new LearningStoreBridge({ memoryFile });
                console.log('🧠 [ReflexionApplier] Memory System connected');
            } catch (error) {
                console.warn('⚠️ [ReflexionApplier] Memory System unavailable:', error.message);
                this.memoryEnabled = false;
            }
        }
    }

    /**
     * Check if we're in a fix loop (same fix repeated multiple times)
     */
    checkCircuitBreaker(fix) {
        // Use simpler signature: just type + path (ignore content variations)
        const fixSignature = `${fix.type}:${fix.path}`;
        
        // Count how many times this exact fix was applied recently
        const recentFixes = this.fixHistory.slice(-10); // Last 10 fixes
        const identicalCount = recentFixes.filter(h => {
            const historySignature = `${h.fix.type}:${h.fix.path}`;
            return historySignature === fixSignature;
        }).length;
        
        if (identicalCount >= this.circuitBreakerThreshold) {
            console.warn(`⚠️ [ReflexionApplier] Circuit breaker triggered: Same fix attempted ${identicalCount} times`);
            return {
                shouldStop: true,
                reason: `Circuit breaker: Fix "${fix.type} ${fix.path}" attempted ${identicalCount} times without success`
            };
        }
        
        return { shouldStop: false };
    }

    /**
     * 🧠 NEW: Query Memory for past attempts before applying fix
     */
    async queryPastAttempts(fix) {
        if (!this.memoryEnabled || !this.memory) {
            return null;
        }
        
        try {
            // Search for similar errors
            const errorQuery = fix.error || fix.path || fix.type;
            const pastReflections = await this.memory.getPastReflections(errorQuery);
            
            if (pastReflections.errors.length > 0) {
                console.log(`🔍 [ReflexionApplier] Found ${pastReflections.errors.length} past errors, ${pastReflections.fixes.length} fixes`);
                
                // Check if this exact fix was tried before
                const similarFix = pastReflections.fixes.find(f => {
                    const observations = f.observations.join(' ');
                    return observations.includes(fix.type) && observations.includes(fix.path);
                });
                
                if (similarFix) {
                    console.log(`⚠️ [ReflexionApplier] WARNING: Similar fix was attempted before!`);
                    console.log(`Previous attempt: ${similarFix.observations[0]}`);
                }
                
                return pastReflections;
            }
            
            return null;
        } catch (error) {
            console.error('❌ [ReflexionApplier] Memory query failed:', error.message);
            return null;
        }
    }
    
    /**
     * 🧠 NEW: Save fix attempt to Memory for future learning
     */
    async saveFixAttemptToMemory(fix, result) {
        if (!this.memoryEnabled || !this.memory) {
            return;
        }
        
        try {
            // Convert to Learning Store reflection format
            const reflection = {
                timestamp: Date.now(),
                mission: fix.mission || 'Unknown Mission',
                step: fix.stepId || 'Unknown Step',
                tool: fix.type,
                error: fix.error || `${fix.type} ${fix.path}`,
                rootCause: fix.rootCause || 'Auto-detected by Reflexion',
                fix: fix.content ? `${fix.type} ${fix.path}` : `${fix.type} ${fix.command || fix.path}`,
                result: result.success ? 'PASS' : 'FAIL',
                pattern: fix.pattern || null,
                metadata: {
                    fixType: fix.type,
                    path: fix.path,
                    success: result.success
                }
            };
            
            // Convert to Knowledge Graph
            await this.memory.convertReflectionToKG(reflection);
            console.log(`💾 [ReflexionApplier] Fix attempt saved to Memory`);
            
        } catch (error) {
            console.error('❌ [ReflexionApplier] Failed to save to Memory:', error.message);
        }
    }
    
    /**
     * Apply a single fix from Reflexion system
     */
    async applySingleFix(fix) {
        // 🧠 NEW: Query Memory for past attempts
        const pastAttempts = await this.queryPastAttempts(fix);
        
        // Circuit breaker check
        const circuitCheck = this.checkCircuitBreaker(fix);
        if (circuitCheck.shouldStop) {
            return {
                success: false,
                skipped: true,
                reason: circuitCheck.reason
            };
        }
        
        console.log(`🧠 [ReflexionApplier] Applying fix: ${fix.type} ${fix.path}`);
        
        let result;
        const fixSignature = `${fix.type}:${fix.path}`; // Simplified signature
        
        try {
            switch (fix.type) {
                case 'UPDATE_FILE':
                case 'CREATE_FILE':
                    if (!this.toolBridge) {
                        throw new Error('ToolBridge not available');
                    }
                    
                    result = await this.toolBridge.executeTool('fs.write', {
                        path: fix.path,
                        content: fix.content || fix.newContent || ''
                    });
                    break;
                    
                case 'DELETE_FOLDER':
                case 'DELETE_FILE':
                    if (!this.toolBridge) {
                        throw new Error('ToolBridge not available');
                    }
                    
                    result = await this.toolBridge.executeTool('fs.delete', {
                        path: fix.path
                    });
                    break;
                    
                case 'CREATE_FOLDER':
                case 'MKDIR':
                    if (!this.toolBridge) {
                        throw new Error('ToolBridge not available');
                    }
                    
                    // Use terminal command for mkdir
                    const isWindows = navigator.platform.toLowerCase().includes('win');
                    const mkdirCmd = isWindows 
                        ? `New-Item -ItemType Directory -Path "${fix.path}" -Force`
                        : `mkdir -p "${fix.path}"`;
                    
                    result = await this.toolBridge.executeTool('terminal.exec', {
                        cmd: mkdirCmd,
                        cwd: this.toolBridge.workspaceRoot
                    });
                    break;
                    
                case 'RUN_COMMAND':
                case 'EXEC':
                    if (!this.toolBridge) {
                        throw new Error('ToolBridge not available');
                    }
                    
                    result = await this.toolBridge.executeTool('terminal.exec', {
                        cmd: fix.command || fix.cmd,
                        cwd: fix.cwd || this.toolBridge.workspaceRoot
                    });
                    break;
                    
                case 'RENAME_FILE':
                case 'MOVE_FILE':
                    if (!this.toolBridge) {
                        throw new Error('ToolBridge not available');
                    }
                    
                    // Use terminal command for rename/move
                    const isWin = navigator.platform.toLowerCase().includes('win');
                    const moveCmd = isWin 
                        ? `Move-Item -Path "${fix.oldPath || fix.path}" -Destination "${fix.newPath}" -Force`
                        : `mv "${fix.oldPath || fix.path}" "${fix.newPath}"`;
                    
                    result = await this.toolBridge.executeTool('terminal.exec', {
                        cmd: moveCmd,
                        cwd: this.toolBridge.workspaceRoot
                    });
                    break;
                    
                default:
                    result = {
                        success: false,
                        error: `Unknown fix type: ${fix.type}`
                    };
            }
            
            // Record fix in history
            this.fixHistory.push({
                timestamp: Date.now(),
                signature: fixSignature,
                fix: fix,
                result: result,
                success: result.success
            });
            
            // Keep history limited to last 20 fixes
            if (this.fixHistory.length > 20) {
                this.fixHistory.shift();
            }
            
            if (result.success) {
                console.log(`✅ [ReflexionApplier] Fix applied successfully: ${fix.type} ${fix.path}`);
            } else {
                console.warn(`⚠️ [ReflexionApplier] Fix failed: ${fix.type} ${fix.path}`, result.error);
            }
            
            // 🧠 NEW: Save fix attempt to Memory
            await this.saveFixAttemptToMemory(fix, result);
            
            return result;
            
        } catch (error) {
            console.error(`❌ [ReflexionApplier] Error applying fix:`, fix, error);
            
            // Record failed fix
            this.fixHistory.push({
                timestamp: Date.now(),
                signature: fixSignature,
                fix: fix,
                result: { success: false, error: error.message },
                success: false
            });
            
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Apply multiple fixes from Reflexion system
     */
    async applyFixes(fixes) {
        if (!Array.isArray(fixes) || fixes.length === 0) {
            console.log('🧠 [ReflexionApplier] No fixes to apply');
            return {
                success: true,
                total: 0,
                successful: 0,
                skipped: 0,
                results: []
            };
        }
        
        console.log(`🧠 [ReflexionApplier] Applying ${fixes.length} fixes...`);
        
        const results = [];
        let successCount = 0;
        let skippedCount = 0;
        
        for (const fix of fixes) {
            const result = await this.applySingleFix(fix);
            results.push({ fix, result });
            
            if (result.success) {
                successCount++;
            } else if (result.skipped) {
                skippedCount++;
            }
            
            // If circuit breaker triggered, stop applying remaining fixes
            if (result.skipped && result.reason?.includes('Circuit breaker')) {
                console.warn(`⚠️ [ReflexionApplier] Stopping auto-fix due to circuit breaker`);
                break;
            }
        }
        
        const summary = {
            success: successCount > 0,
            total: fixes.length,
            successful: successCount,
            skipped: skippedCount,
            failed: fixes.length - successCount - skippedCount,
            results
        };
        
        // ✅ IMPROVED: Detailed reflexion summary logging (ChatGPT önerisi)
        console.log(`📘 Reflexion Summary: ${successCount} fixes applied, ${successCount} successes, ${summary.failed} fails, ${skippedCount} skipped.`);
        console.log(`🧠 [ReflexionApplier] Fix application complete:`, summary);
        
        // Additional breakdown logging
        if (summary.failed > 0) {
            const failedFixes = results.filter(r => !r.result.success && !r.result.skipped);
            console.warn(`❌ Failed fixes:`, failedFixes.map(f => `${f.fix.type} ${f.fix.path}`));
        }
        
        if (summary.skipped > 0) {
            const skippedFixes = results.filter(r => r.result.skipped);
            console.warn(`⏭️ Skipped fixes:`, skippedFixes.map(f => `${f.fix.type} ${f.fix.path} (${f.result.reason})`));
        }
        
        return summary;
    }

    /**
     * Get fix history for debugging
     */
    getHistory() {
        return this.fixHistory;
    }

    /**
     * Clear fix history
     */
    clearHistory() {
        this.fixHistory = [];
        console.log('🧠 [ReflexionApplier] Fix history cleared');
    }

    /**
     * Get circuit breaker status
     */
    getCircuitBreakerStatus() {
        const recentFixes = this.fixHistory.slice(-10);
        const signatures = recentFixes.map(h => h.signature);
        const uniqueSignatures = new Set(signatures);
        
        // Find most repeated fix
        let mostRepeated = null;
        let maxCount = 0;
        
        for (const sig of uniqueSignatures) {
            const count = signatures.filter(s => s === sig).length;
            if (count > maxCount) {
                maxCount = count;
                mostRepeated = sig;
            }
        }
        
        return {
            threshold: this.circuitBreakerThreshold,
            recentFixes: recentFixes.length,
            uniqueFixes: uniqueSignatures.size,
            mostRepeatedFix: mostRepeated,
            mostRepeatedCount: maxCount,
            wouldTrigger: maxCount >= this.circuitBreakerThreshold
        };
    }
}

// Export singleton instance
let reflexionApplierInstance = null;

function initializeReflexionApplier(toolBridge) {
    if (!reflexionApplierInstance) {
        reflexionApplierInstance = new ReflexionApplier(toolBridge);
        console.log('🧠 [ReflexionApplier] Initialized');
        
        // Attach to window for debugging (browser only)
        if (typeof window !== 'undefined') {
            window.reflexionApplier = reflexionApplierInstance;
            console.log('💡 Debug: Use window.reflexionApplier in console');
        }
    }
    
    return reflexionApplierInstance;
}

function getReflexionApplier() {
    if (!reflexionApplierInstance) {
        throw new Error('ReflexionApplier not initialized! Call initializeReflexionApplier() first.');
    }
    return reflexionApplierInstance;
}


// CommonJS exports
module.exports = { 
    ReflexionApplier,
    initializeReflexionApplier,
    getReflexionApplier
};

// ES6 exports for module scripts
export { ReflexionApplier, initializeReflexionApplier, getReflexionApplier };

