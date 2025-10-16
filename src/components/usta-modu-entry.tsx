import React from 'react';
import { createRoot } from 'react-dom/client';
import UstaModu from './UstaModu';

// Wait for legacy system to be ready
const initUstaModu = async () => {
  const { waitForLegacySystem } = await import('@adapters/legacy-runner');
  
  try {
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
