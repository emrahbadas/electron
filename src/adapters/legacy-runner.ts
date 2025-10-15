/**
 * 🌉 LEGACY RUNNER ADAPTER
 * 
 * Bridge between new TypeScript/React UI and existing vanilla JS system.
 * Allows new components to interact with KodCanavari (app.js) without rewriting it.
 */

import type {
    NightOrders,
    EventBusEvent,
    EventType,
    LearningStats,
    PhaseContext,
    ApprovalResult
} from '../../types/contracts';

/**
 * Adapter for legacy KodCanavari system
 */
export class LegacyRunner {
    private kodCanavari: any;
    private eventListeners: Map<string, Set<(event: EventBusEvent) => void>>;
    
    constructor() {
        // Get global KodCanavari instance
        this.kodCanavari = (window as any).kodCanavari;
        this.eventListeners = new Map();
        
        if (!this.kodCanavari) {
            console.warn('⚠️ KodCanavari not found. Make sure app.js is loaded.');
        } else {
            console.log('✅ Legacy Runner initialized');
        }
    }
    
    /**
     * Check if legacy system is available
     */
    isAvailable(): boolean {
        return !!this.kodCanavari;
    }
    
    /**
     * Execute Night Orders via legacy system
     */
    async executeNightOrders(orders: NightOrders, approvalToken?: string): Promise<void> {
        if (!this.kodCanavari) {
            throw new Error('KodCanavari not available');
        }
        
        return this.kodCanavari.executeNightOrders(orders, approvalToken);
    }
    
    /**
     * Subscribe to EventBus events
     */
    subscribeToEvents(
        eventType: EventType | '*',
        callback: (event: EventBusEvent) => void
    ): () => void {
        if (!this.kodCanavari?.eventBus) {
            console.warn('⚠️ EventBus not available');
            return () => {};
        }
        
        // Store listener
        if (!this.eventListeners.has(eventType)) {
            this.eventListeners.set(eventType, new Set());
        }
        this.eventListeners.get(eventType)!.add(callback);
        
        // Register with legacy EventBus
        this.kodCanavari.eventBus.on(eventType, callback);
        
        // Return unsubscribe function
        return () => {
            this.eventListeners.get(eventType)?.delete(callback);
            if (this.kodCanavari?.eventBus) {
                this.kodCanavari.eventBus.off(eventType, callback);
            }
        };
    }
    
    /**
     * Get learning statistics
     */
    getLearningStats(): LearningStats | null {
        if (!this.kodCanavari?.learningStore) {
            return null;
        }
        
        return this.kodCanavari.learningStore.getStats();
    }
    
    /**
     * Get phase context
     */
    getPhaseContext(): PhaseContext | null {
        if (!this.kodCanavari?.phaseContext) {
            return null;
        }
        
        return this.kodCanavari.phaseContext;
    }
    
    /**
     * Request approval for operation
     */
    async requestApproval(proposal: any, options?: any): Promise<ApprovalResult> {
        if (!this.kodCanavari?.approvalSystem) {
            throw new Error('Approval system not available');
        }
        
        return this.kodCanavari.approvalSystem.requestApproval(proposal, options);
    }
    
    /**
     * Check if developer mode is enabled
     */
    isDeveloperMode(): boolean {
        return this.kodCanavari?.developerMode || false;
    }
    
    /**
     * Get current mission
     */
    getCurrentMission(): string | null {
        return this.kodCanavari?.currentMission || null;
    }
    
    /**
     * Get workspace root
     */
    getWorkspaceRoot(): string | null {
        return this.kodCanavari?.workspaceRoot || null;
    }
    
    /**
     * Add chat message (for legacy UI compatibility)
     */
    addChatMessage(sender: 'user' | 'ai', message: string): void {
        if (!this.kodCanavari) {
            return;
        }
        
        this.kodCanavari.addChatMessage(sender, message);
    }
    
    /**
     * Emit event to EventBus
     */
    emitEvent(event: EventBusEvent): void {
        if (!this.kodCanavari?.eventBus) {
            console.warn('⚠️ EventBus not available, cannot emit event');
            return;
        }
        
        this.kodCanavari.eventBus.emit(event);
    }
    
    /**
     * Clean up all listeners
     */
    destroy(): void {
        for (const [eventType, listeners] of this.eventListeners) {
            for (const listener of listeners) {
                if (this.kodCanavari?.eventBus) {
                    this.kodCanavari.eventBus.off(eventType, listener);
                }
            }
        }
        this.eventListeners.clear();
        console.log('✅ Legacy Runner destroyed');
    }
}

/**
 * Singleton instance
 */
let instance: LegacyRunner | null = null;

/**
 * Get or create singleton instance
 */
export function getLegacyRunner(): LegacyRunner {
    if (!instance) {
        instance = new LegacyRunner();
    }
    return instance;
}

/**
 * Check if legacy system is ready
 */
export function isLegacySystemReady(): boolean {
    return !!(window as any).kodCanavari;
}

/**
 * Wait for legacy system to be ready
 */
export function waitForLegacySystem(timeout = 5000): Promise<void> {
    return new Promise((resolve, reject) => {
        if (isLegacySystemReady()) {
            resolve();
            return;
        }
        
        const startTime = Date.now();
        const interval = setInterval(() => {
            if (isLegacySystemReady()) {
                clearInterval(interval);
                resolve();
            } else if (Date.now() - startTime > timeout) {
                clearInterval(interval);
                reject(new Error('Timeout waiting for legacy system'));
            }
        }, 100);
    });
}
