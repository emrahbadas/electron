/**
 * 📊 LEARNING DASHBOARD ENTRY POINT
 * 
 * Renders Learning Dashboard React component
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { LearningDashboard } from './components/LearningDashboard';

// Extend Window interface
declare global {
    interface Window {
        kodCanavari?: {
            learningStore?: any;
        };
    }
}

// Wait for Learning Store to be available
const waitForLearningStore = (timeout = 5000): Promise<void> => {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        const check = () => {
            if (window.kodCanavari?.learningStore) {
                resolve();
            } else if (Date.now() - startTime > timeout) {
                reject(new Error('Learning Store not available within timeout'));
            } else {
                setTimeout(check, 100);
            }
        };
        
        check();
    });
};

// Initialize Learning Dashboard
const initLearningDashboard = async () => {
    try {
        console.log('[Learning Dashboard] Waiting for Learning Store...');
        await waitForLearningStore(5000);
        console.log('[Learning Dashboard] Learning Store ready, mounting React component...');

        // Create mount point
        const mountPoint = document.createElement('div');
        mountPoint.id = 'learning-dashboard-root';
        document.body.appendChild(mountPoint);

        // Mount React component
        const root = ReactDOM.createRoot(mountPoint);
        root.render(
            <React.StrictMode>
                <LearningDashboard />
            </React.StrictMode>
        );

        console.log('[Learning Dashboard] React component mounted successfully! 📊');
    } catch (error) {
        console.error('[Learning Dashboard] Failed to initialize:', error);
    }
};

// Start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLearningDashboard);
} else {
    initLearningDashboard();
}
