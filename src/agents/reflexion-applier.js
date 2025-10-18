/**
 * Reflexion Applier - Auto-fix Execution Layer
 * 
 * Bu modül, Reflexion System'in ürettiği "SUGGESTED FIXES"'leri gerçek dosya
 * işlemlerine çevirir. ChatGPT-5'in tespit ettiği "reflection var ama uygulama yok"
 * sorununu çözer.
 */

class ReflexionApplier {
    constructor(toolBridge) {
        this.toolBridge = toolBridge;
        this.fixHistory = [];
        this.circuitBreakerThreshold = 3; // Same fix applied 3 times = stop
    }

    /**
     * Check if we're in a fix loop (same fix repeated multiple times)
     */
    checkCircuitBreaker(fix) {
        const fixSignature = `${fix.type}:${fix.path}:${fix.content?.substring(0, 100)}`;
        
        // Count how many times this exact fix was applied recently
        const recentFixes = this.fixHistory.slice(-10); // Last 10 fixes
        const identicalCount = recentFixes.filter(h => h.signature === fixSignature).length;
        
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
     * Apply a single fix from Reflexion system
     */
    async applySingleFix(fix) {
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
        const fixSignature = `${fix.type}:${fix.path}:${fix.content?.substring(0, 100)}`;
        
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
        
        console.log(`🧠 [ReflexionApplier] Fix application complete:`, summary);
        
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

export function initializeReflexionApplier(toolBridge) {
    if (!reflexionApplierInstance) {
        reflexionApplierInstance = new ReflexionApplier(toolBridge);
        console.log('🧠 [ReflexionApplier] Initialized');
        
        // Attach to window for debugging
        window.reflexionApplier = reflexionApplierInstance;
        console.log('💡 Debug: Use window.reflexionApplier in console');
    }
    
    return reflexionApplierInstance;
}

export function getReflexionApplier() {
    if (!reflexionApplierInstance) {
        throw new Error('ReflexionApplier not initialized! Call initializeReflexionApplier() first.');
    }
    return reflexionApplierInstance;
}

export { ReflexionApplier };
