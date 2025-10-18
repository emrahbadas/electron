/**
 * Tool Bridge Initialization Script
 * 
 * Bu script, ToolBridge'i başlatır ve KodCanavari ile entegre eder.
 * ChatGPT-5'in tespit ettiği "eksik kas sistemi" sorununu çözer.
 */

// ToolBridge module yüklendikten sonra initialize et
import { initializeToolBridge } from '../agents/tool-bridge.js';
import { initializeReflexionApplier } from '../agents/reflexion-applier.js';

// Sayfa yüklendiğinde ToolBridge'i başlat
window.addEventListener('DOMContentLoaded', () => {
    console.log('🔧 [ToolBridge Init] Starting initialization...');
    
    // Wait for KodCanavari instance to be available
    const waitForKodCanavari = setInterval(() => {
        if (window.kodCanavari && window.kodCanavari.workspaceRoot) {
            clearInterval(waitForKodCanavari);
            
            const workspaceRoot = window.kodCanavari.workspaceRoot;
            console.log(`🔧 [ToolBridge Init] Initializing with workspace: ${workspaceRoot}`);
            
            try {
                // Initialize Tool Bridge
                const toolBridge = initializeToolBridge(workspaceRoot);
                console.log(`✅ [ToolBridge Init] Successfully initialized with ${toolBridge.getSupportedTools().length} tools`);
                console.log(`📋 [ToolBridge Init] Available tools:`, toolBridge.getSupportedTools());
                
                // Initialize Reflexion Applier
                const reflexionApplier = initializeReflexionApplier(toolBridge);
                console.log('✅ [ReflexionApplier Init] Successfully initialized');
                
                // Export to window for console debugging
                window.toolBridge = toolBridge;
                window.reflexionApplier = reflexionApplier;
                
                console.log('💡 Debug: Use window.toolBridge.getSupportedTools() to see available tools');
                console.log('💡 Debug: Use window.toolBridge.getLog() to see execution history');
                console.log('💡 Debug: Use window.toolBridge.executeTool(name, args) to test tools');
                console.log('💡 Debug: Use window.reflexionApplier.getHistory() to see fix history');
                console.log('💡 Debug: Use window.reflexionApplier.getCircuitBreakerStatus() to check circuit breaker');
            } catch (error) {
                console.error('❌ [ToolBridge Init] Initialization failed:', error);
            }
        }
    }, 100);
    
    // Timeout after 10 seconds
    setTimeout(() => {
        clearInterval(waitForKodCanavari);
        if (!window.toolBridge) {
            console.warn('⚠️ [ToolBridge Init] Timeout: KodCanavari instance not found after 10 seconds');
        }
    }, 10000);
});

// Also listen for workspace changes
window.addEventListener('workspaceChanged', (event) => {
    if (window.toolBridge && event.detail && event.detail.newWorkspace) {
        const newWorkspace = event.detail.newWorkspace;
        console.log(`🔧 [ToolBridge Init] Workspace changed to: ${newWorkspace}`);
        window.toolBridge.setWorkspaceRoot(newWorkspace);
    }
});

console.log('🔧 [ToolBridge Init] Script loaded, waiting for KodCanavari...');
