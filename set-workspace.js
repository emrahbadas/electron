// Quick script to set workspace root via Electron IPC
// Run this in DevTools Console

const workspacePath = 'C:\\Users\\emrah badas\\OneDrive\\Desktop\\kodlama\\Yeni klasör (5)\\blog-platform';

// Set localStorage
localStorage.setItem('currentFolder', workspacePath);

// Set runtime variable
window.__CURRENT_FOLDER__ = workspacePath;

// Verify
console.log('✅ Workspace set to:', localStorage.getItem('currentFolder'));
console.log('✅ Window variable:', window.__CURRENT_FOLDER__);

// Reload
console.log('🔄 Reloading in 2 seconds...');
setTimeout(() => location.reload(), 2000);
