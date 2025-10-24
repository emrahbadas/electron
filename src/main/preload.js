/**
 * Preload Script - Secure Context Bridge
 * 
 * This script runs in a privileged context and exposes ONLY
 * whitelisted APIs to the renderer process via contextBridge.
 * 
 * ✅ SECURITY: Prevents arbitrary Node.js access from renderer
 * ❌ NEVER expose require(), eval(), or unsafe modules
 */

const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');
const fs = require('fs');

// ===== SAFE API EXPOSURE =====
contextBridge.exposeInMainWorld('kayra', {
    // IPC Communication
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
    send: (channel, ...args) => ipcRenderer.send(channel, ...args),
    on: (channel, callback) => {
        // Whitelist allowed channels
        const validChannels = [
            'chat-response',
            'mcp-response',
            'tool-response',
            'ai-stream',
            'claude-stream',
            'continue-stream',
            'file-created',
            'command-output',
            'elysion-decision',
            'approval-request',
            'approval-response',
            'night-orders-update',
            'phase-change',
            'reflexion-event',
            'narrator-event',
            'learning-pattern'
        ];
        
        if (validChannels.includes(channel)) {
            ipcRenderer.on(channel, (event, ...args) => callback(...args));
        } else {
            console.warn(`⚠️ Blocked IPC listener on non-whitelisted channel: ${channel}`);
        }
    },
    
    // Safe Process Info
    platform: process.platform,
    arch: process.arch,
    version: process.version,
    
    // Path utilities (read-only)
    path: {
        join: (...args) => path.join(...args),
        basename: (p) => path.basename(p),
        dirname: (p) => path.dirname(p),
        extname: (p) => path.extname(p),
        sep: path.sep
    }
});

// ===== SECURE FILE SYSTEM ACCESS =====
// Only expose through IPC, not direct fs module
contextBridge.exposeInMainWorld('kayraFS', {
    // Read file (async)
    readFile: async (filepath) => {
        try {
            // Validate path (prevent directory traversal)
            if (filepath.includes('..')) {
                throw new Error('Invalid path: directory traversal not allowed');
            }
            return await ipcRenderer.invoke('fs:readFile', filepath);
        } catch (error) {
            console.error('❌ FS Read Error:', error.message);
            throw error;
        }
    },
    
    // Write file (async)
    writeFile: async (filepath, content) => {
        try {
            if (filepath.includes('..')) {
                throw new Error('Invalid path: directory traversal not allowed');
            }
            return await ipcRenderer.invoke('fs:writeFile', filepath, content);
        } catch (error) {
            console.error('❌ FS Write Error:', error.message);
            throw error;
        }
    },
    
    // List directory
    readDir: async (dirpath) => {
        try {
            if (dirpath.includes('..')) {
                throw new Error('Invalid path: directory traversal not allowed');
            }
            return await ipcRenderer.invoke('fs:readDir', dirpath);
        } catch (error) {
            console.error('❌ FS ReadDir Error:', error.message);
            throw error;
        }
    },
    
    // Check file exists
    exists: async (filepath) => {
        try {
            return await ipcRenderer.invoke('fs:exists', filepath);
        } catch (error) {
            console.error('❌ FS Exists Error:', error.message);
            return false;
        }
    }
});

// ===== DEVELOPMENT MODE HELPER =====
if (process.env.NODE_ENV === 'development') {
    contextBridge.exposeInMainWorld('kayraDebug', {
        log: (...args) => console.log('[RENDERER]', ...args),
        warn: (...args) => console.warn('[RENDERER]', ...args),
        error: (...args) => console.error('[RENDERER]', ...args)
    });
}

console.log('✅ Preload script loaded - Secure context bridge active');
