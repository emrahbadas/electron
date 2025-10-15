import React from 'react';
import { createRoot } from 'react-dom/client';
import UstaModu from './UstaModu';

// Wait for legacy system to be ready
const initUstaModu = async () => {
  const { waitForLegacySystem } = await import('@adapters/legacy-runner');
  
  try {
    await waitForLegacySystem(5000);
    console.log('[UstaModu Entry] Legacy system ready, mounting React component...');
    
    // Create container
    const container = document.createElement('div');
    container.id = 'usta-modu-react-root';
    document.body.appendChild(container);
    
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
