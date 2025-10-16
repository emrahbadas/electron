import React from 'react';
import { createRoot } from 'react-dom/client';
import UstaModu from './UstaModu';

// Wait for legacy system to be ready (using global window object)
const waitForLegacySystem = (maxWaitMs = 5000): Promise<void> => {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const checkLegacy = () => {
      // Check if window.legacyRunner exists
      if (typeof window !== 'undefined' && (window as any).legacyRunner) {
        console.log('[UstaModu Entry] Legacy runner found on window object');
        resolve();
        return;
      }
      
      // Timeout check
      if (Date.now() - startTime > maxWaitMs) {
        reject(new Error(`Legacy system not ready after ${maxWaitMs}ms`));
        return;
      }
      
      // Keep checking every 100ms
      setTimeout(checkLegacy, 100);
    };
    
    checkLegacy();
  });
};

// Initialize Usta Modu
const initUstaModu = async () => {
  try {
    console.log('[UstaModu Entry] Waiting for legacy system...');
    await waitForLegacySystem(5000);
    console.log('[UstaModu Entry] Legacy system ready, mounting React component...');
    
    // Find or create container
    let container = document.getElementById('usta-modu-root');
    if (!container) {
      console.warn('[UstaModu Entry] #usta-modu-root not found, creating fallback container');
      container = document.createElement('div');
      container.id = 'usta-modu-root';
      document.body.appendChild(container);
    }
    
    // Mount React
    const root = createRoot(container);
    root.render(
      <React.StrictMode>
        <UstaModu 
          maxMessages={50}
          dedupWindowMs={2000}
          rateLimit={100}
        />
      </React.StrictMode>
    );
    
    console.log('[UstaModu Entry] React component mounted successfully! 🎓');
  } catch (error) {
    console.error('[UstaModu Entry] Failed to initialize:', error);
  }
};

// Auto-init when script loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initUstaModu);
} else {
  initUstaModu();
}
