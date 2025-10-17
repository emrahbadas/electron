// MCP Proxy Auto-Restart Monitor
// Monitors MCP proxy server (port 7777) and auto-restarts on failure

class MCPProxyMonitor {
    constructor() {
        this.checkInterval = 30000; // 30 seconds
        this.healthCheckUrl = 'http://127.0.0.1:7777/health';
        this.consecutiveFailures = 0;
        this.maxFailures = 2; // Restart after 2 consecutive failures
        this.monitorTimer = null;
        this.isRestarting = false;
    }

    /**
     * Start monitoring MCP proxy server
     */
    start() {
        console.log('🔍 [MCP Monitor] Starting health check monitoring...');
        
        // Initial check after 5 seconds
        setTimeout(() => this.checkHealth(), 5000);
        
        // Periodic checks
        this.monitorTimer = setInterval(() => {
            this.checkHealth();
        }, this.checkInterval);
    }

    /**
     * Stop monitoring
     */
    stop() {
        if (this.monitorTimer) {
            clearInterval(this.monitorTimer);
            this.monitorTimer = null;
            console.log('🛑 [MCP Monitor] Health check monitoring stopped');
        }
    }

    /**
     * Check MCP proxy health
     */
    async checkHealth() {
        // Skip if already restarting
        if (this.isRestarting) {
            console.log('⏳ [MCP Monitor] Restart in progress, skipping check...');
            return;
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

            const response = await fetch(this.healthCheckUrl, {
                method: 'GET',
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (response.ok) {
                const data = await response.json();
                
                // Reset failure counter on success
                if (this.consecutiveFailures > 0) {
                    console.log('✅ [MCP Monitor] Proxy recovered, resetting failure counter');
                }
                this.consecutiveFailures = 0;
                
                // Log heartbeat every 5 checks (2.5 minutes)
                if (Math.random() < 0.2) {
                    console.log('💓 [MCP Monitor] Proxy healthy:', data.status);
                }
                
                return true;
            } else {
                throw new Error(`HTTP ${response.status}`);
            }

        } catch (error) {
            this.consecutiveFailures++;
            
            console.warn(`⚠️ [MCP Monitor] Health check failed (${this.consecutiveFailures}/${this.maxFailures}):`, 
                error.name === 'AbortError' ? 'Timeout' : error.message);

            // Attempt restart if threshold reached
            if (this.consecutiveFailures >= this.maxFailures) {
                console.error('❌ [MCP Monitor] Max failures reached, attempting restart...');
                await this.attemptRestart();
            }

            return false;
        }
    }

    /**
     * Attempt to restart MCP proxy server
     */
    async attemptRestart() {
        if (this.isRestarting) {
            console.log('⏳ [MCP Monitor] Already restarting, skipping...');
            return;
        }

        this.isRestarting = true;
        console.log('🔄 [MCP Monitor] Initiating proxy restart...');

        try {
            // Request restart via Electron IPC
            if (window.electronAPI && window.electronAPI.restartMCPProxy) {
                const result = await window.electronAPI.restartMCPProxy();
                
                if (result.success) {
                    console.log('✅ [MCP Monitor] Restart command sent successfully');
                    
                    // Wait for restart to complete (5 seconds)
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    
                    // Verify restart
                    const isHealthy = await this.checkHealth();
                    if (isHealthy) {
                        console.log('🎉 [MCP Monitor] Proxy restarted and healthy!');
                        this.consecutiveFailures = 0;
                    } else {
                        console.error('❌ [MCP Monitor] Proxy restart failed verification');
                    }
                } else {
                    console.error('❌ [MCP Monitor] Restart command failed:', result.error);
                }
            } else {
                console.error('❌ [MCP Monitor] electronAPI.restartMCPProxy not available');
                console.warn('💡 [MCP Monitor] Please restart proxy manually: cd proxy && node server.js');
            }

        } catch (error) {
            console.error('❌ [MCP Monitor] Restart error:', error);
        } finally {
            this.isRestarting = false;
        }
    }

    /**
     * Force restart (manual trigger)
     */
    async forceRestart() {
        console.log('🔨 [MCP Monitor] Force restart requested');
        this.consecutiveFailures = this.maxFailures; // Trigger threshold
        await this.attemptRestart();
    }

    /**
     * Get current status
     */
    getStatus() {
        return {
            isMonitoring: this.monitorTimer !== null,
            consecutiveFailures: this.consecutiveFailures,
            maxFailures: this.maxFailures,
            isRestarting: this.isRestarting,
            healthCheckUrl: this.healthCheckUrl,
            checkInterval: this.checkInterval
        };
    }
}

// Initialize monitor when DOM is ready
let mcpProxyMonitor = null;

if (typeof window !== 'undefined') {
    // Wait for document ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeMonitor);
    } else {
        initializeMonitor();
    }
}

function initializeMonitor() {
    // Wait for KodCanavari to be ready
    const checkKodCanavari = setInterval(() => {
        if (window.kodCanavari) {
            clearInterval(checkKodCanavari);
            
            // Initialize monitor
            mcpProxyMonitor = new MCPProxyMonitor();
            
            // Attach to global for debugging
            window.mcpProxyMonitor = mcpProxyMonitor;
            
            // Start monitoring after 10 seconds (allow Electron to fully initialize)
            setTimeout(() => {
                mcpProxyMonitor.start();
                console.log('✅ [MCP Monitor] Initialized and started');
            }, 10000);
            
            // Expose control methods in console
            console.log('💡 Use mcpProxyMonitor.forceRestart() to manually restart proxy');
            console.log('💡 Use mcpProxyMonitor.getStatus() to check monitor status');
        }
    }, 500);

    // Timeout after 30 seconds
    setTimeout(() => {
        clearInterval(checkKodCanavari);
        console.warn('⚠️ [MCP Monitor] KodCanavari not found after 30s, monitor not started');
    }, 30000);
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MCPProxyMonitor;
}
