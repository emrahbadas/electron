/**
 * 🔧 Workspace Root Manual Setter (SSOT Compatible)
 * 
 * 📌 Usage:
 *   1. Press F12 to open DevTools
 *   2. Go to Console tab
 *   3. Copy-paste this entire file into console
 *   4. Press Enter
 *   5. Wait for reload
 * 
 * 🎯 Purpose:
 *   - Manually set workspace root when UI "Klasör Seç" button fails
 *   - Sync with main process (SSOT: Single Source of Truth)
 *   - Update all renderer state (localStorage + global variables)
 * 
 * ⚠️ Important:
 *   - This syncs BOTH renderer AND main process
 *   - Main process cwdRef is the single source of truth for spawn operations
 *   - Without main sync, spawn commands will use wrong directory
 * 
 * 🔗 Related:
 *   - WORKSPACE_ROOT_FIX_COMPLETE.md (full documentation)
 *   - src/main/main.js (SSOT implementation)
 *   - src/renderer/app.js (getWorkspaceRoot, setWorkspaceRoot)
 */

// ===== CONFIGURATION =====
// 👇 CHANGE THIS to your desired workspace path
const workspacePath = 'C:\\Users\\emrah badas\\OneDrive\\Desktop\\kodlama\\Yeni klasör (5)\\blog-platform';

// ===== VALIDATION =====
if (!workspacePath || typeof workspacePath !== 'string') {
    console.error('❌ Invalid workspace path! Please set a valid path.');
    throw new Error('Invalid workspace path');
}

console.log('🚀 Setting workspace root via SSOT system...');
console.log('📁 Target path:', workspacePath);

// ===== SSOT SYNC (Main Process) =====
// 🔑 CRITICAL: Always sync with main process (single source of truth)
if (window.electronAPI && window.electronAPI.setCwd) {
    window.electronAPI.setCwd(workspacePath)
        .then(result => {
            console.log('✅ Main process synced:', result);
            
            // After main sync, update renderer state
            localStorage.setItem('currentFolder', workspacePath);
            window.__CURRENT_FOLDER__ = workspacePath;
            
            // Update app instance if available
            if (window.kodCanavari) {
                window.kodCanavari.workspaceRoot = workspacePath;
                window.kodCanavari.currentWorkingDirectory = workspacePath;
                window.kodCanavari.currentFolder = workspacePath;
                console.log('✅ KodCanavari instance updated');
            }
            
            // Verify all locations
            console.log('\n📊 Workspace Root Status:');
            console.log('  1. localStorage:', localStorage.getItem('currentFolder'));
            console.log('  2. window.__CURRENT_FOLDER__:', window.__CURRENT_FOLDER__);
            if (window.kodCanavari) {
                console.log('  3. kodCanavari.workspaceRoot:', window.kodCanavari.workspaceRoot);
            }
            
            // Get main process CWD to verify sync
            return window.electronAPI.getCwd();
        })
        .then(result => {
            console.log('  4. Main process cwdRef:', result.cwd);
            console.log('\n✅ ALL SYSTEMS SYNCED!');
            
            // Reload app
            console.log('🔄 Reloading in 3 seconds...');
            setTimeout(() => location.reload(), 3000);
        })
        .catch(err => {
            console.error('❌ Failed to sync with main process:', err);
            console.warn('⚠️ Falling back to localStorage only (not recommended)');
            
            // Fallback: Update renderer state only (risky, main process still null)
            localStorage.setItem('currentFolder', workspacePath);
            window.__CURRENT_FOLDER__ = workspacePath;
            if (window.kodCanavari) {
                window.kodCanavari.workspaceRoot = workspacePath;
                window.kodCanavari.currentWorkingDirectory = workspacePath;
            }
            
            console.log('🔄 Reloading in 3 seconds...');
            setTimeout(() => location.reload(), 3000);
        });
} else {
    console.error('❌ electronAPI.setCwd not available! Cannot sync with main process.');
    console.warn('⚠️ This will cause spawn operations to fail (no CWD in main process).');
    
    // Fallback: Update renderer state only
    localStorage.setItem('currentFolder', workspacePath);
    window.__CURRENT_FOLDER__ = workspacePath;
    if (window.kodCanavari) {
        window.kodCanavari.workspaceRoot = workspacePath;
        window.kodCanavari.currentWorkingDirectory = workspacePath;
    }
    
    console.log('🔄 Reloading in 3 seconds...');
    setTimeout(() => location.reload(), 3000);
}
