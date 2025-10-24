/**
 * 🔄 REFLEXION QUEUE - Async Operation Queue
 * 
 * Ensures reflexion/auto-fix operations run sequentially, not in parallel.
 * Prevents race conditions when multiple failures trigger reflexion simultaneously.
 * 
 * ChatGPT-5 Audit Fix: criticAgent.analyze() concurrent call protection
 */

export class AsyncQueue {
    constructor(name = 'AsyncQueue') {
        this.name = name;
        this.q = Promise.resolve(); // Initial resolved promise
        this.pending = 0;
        this.completed = 0;
        this.errors = 0;
        
        console.log(`🔄 ${name} initialized`);
    }
    
    /**
     * Enqueue an async task (sequential execution)
     * @param {Function} task - Async function to execute
     * @returns {Promise<any>} Task result
     */
    enqueue(task) {
        this.pending++;
        
        // Chain new task to queue
        const result = this.q
            .then(async () => {
                console.log(`⚙️ [${this.name}] Executing task (pending: ${this.pending})`);
                
                try {
                    const res = await task();
                    this.completed++;
                    this.pending--;
                    return res;
                } catch (error) {
                    this.errors++;
                    this.pending--;
                    console.error(`❌ [${this.name}] Task failed:`, error.message);
                    throw error;
                }
            })
            .catch(error => {
                // Don't block queue on error
                console.warn(`⚠️ [${this.name}] Continuing queue after error`);
                return { error: error.message };
            });
        
        // Update queue chain (catch prevents chain break)
        this.q = result.catch(() => {});
        
        return result;
    }
    
    /**
     * Wait for all pending tasks to complete
     * @returns {Promise<void>}
     */
    async waitForIdle() {
        await this.q;
        console.log(`✅ [${this.name}] Queue idle`);
    }
    
    /**
     * Get queue statistics
     */
    getStats() {
        return {
            name: this.name,
            pending: this.pending,
            completed: this.completed,
            errors: this.errors,
            successRate: this.completed > 0 
                ? Math.round((this.completed / (this.completed + this.errors)) * 100) 
                : 0
        };
    }
    
    /**
     * Reset statistics (doesn't clear pending tasks)
     */
    resetStats() {
        this.completed = 0;
        this.errors = 0;
    }
}

/**
 * Global reflexion queue instance (for app.js)
 */
let reflexionQueue = null;

/**
 * Get global reflexion queue
 * @returns {AsyncQueue}
 */
export function getReflexionQueue() {
    if (!reflexionQueue) {
        reflexionQueue = new AsyncQueue('ReflexionQueue');
    }
    return reflexionQueue;
}
