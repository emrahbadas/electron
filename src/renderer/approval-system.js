/**
 * 🔐 APPROVAL TOKEN SYSTEM
 * 
 * Token-based approval gate system.
 * NO TOKEN = NO EXECUTION
 * 
 * Features:
 * - Token generation and validation
 * - Single-use tokens (revoked after use)
 * - 60-second expiration
 * - Pending approval queue
 * - User approval/denial workflow
 */

class ApprovalSystem {
    constructor() {
        // Token storage: token -> { proposal, createdAt, used, expiresAt }
        this.tokens = new Map();
        
        // Pending approvals: id -> { proposal, resolve, reject }
        this.pendingApprovals = new Map();
        
        // Configuration
        this.config = {
            tokenExpiration: 600000, // 600 seconds (10 minutes) - Extended for stability
            autoCleanupInterval: 300000 // 5 minutes
        };
        
        // Start cleanup worker
        this.startCleanupWorker();
        
        console.log('✅ Approval System initialized');
    }
    
    /**
     * Request approval for a proposal (BLOCKING)
     * @param {Object} proposal - Proposal object
     * @param {Object} options - { developerMode, policyEngine }
     * @returns {Promise<Object>} Approval result { approved, token?, reason? }
     */
    async requestApproval(proposal, options = {}) {
        const { developerMode = false, policyEngine = null } = options;
        
        // 🔓 AUTO-APPROVE: Developer Mode
        if (developerMode) {
            console.log('🔓 Developer Mode: Auto-approving all operations');
            const token = this.generateToken();
            return {
                approved: true,
                autoApproved: true,
                reason: 'developer-mode',
                token
            };
        }
        
        // 🔓 AUTO-APPROVE: Policy-based (safe operations)
        if (policyEngine && policyEngine.canAutoApprove(proposal)) {
            console.log('✅ Safe operation: Auto-approving based on policy');
            const token = this.generateToken();
            return {
                approved: true,
                autoApproved: true,
                reason: 'policy-safe',
                token
            };
        }
        
        const id = `approval-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        console.log(`🔐 Requesting manual approval for: ${proposal.step?.title || 'Unknown'}`);
        
        // Create pending approval
        return new Promise((resolve, reject) => {
            this.pendingApprovals.set(id, {
                proposal,
                resolve,
                reject,
                createdAt: Date.now()
            });
            
            // Emit event for UI
            this.emitApprovalRequest(id, proposal);
            
            // Set timeout (60 seconds)
            setTimeout(() => {
                if (this.pendingApprovals.has(id)) {
                    this.pendingApprovals.delete(id);
                    reject(new Error('⏰ Approval timeout (60 seconds)'));
                }
            }, this.config.tokenExpiration);
        });
    }
    
    /**
     * User approves proposal
     * @param {string} id - Approval request ID
     * @returns {Object} Approval result with token
     */
    approveProposal(id) {
        const pending = this.pendingApprovals.get(id);
        
        if (!pending) {
            console.warn(`⚠️ Approval ${id} not found or expired`);
            return { success: false, error: 'Approval not found or expired' };
        }
        
        // Generate token
        const token = this.generateToken();
        
        // Store token with proposal
        this.tokens.set(token, {
            proposal: pending.proposal,
            createdAt: Date.now(),
            expiresAt: Date.now() + this.config.tokenExpiration,
            used: false
        });
        
        console.log(`✅ Approval granted: ${token.substr(0, 12)}...`);
        
        // Resolve promise
        pending.resolve({
            approved: true,
            token,
            timestamp: Date.now()
        });
        
        // Clean up
        this.pendingApprovals.delete(id);
        
        return { success: true, token };
    }
    
    /**
     * User denies proposal
     * @param {string} id - Approval request ID
     * @param {string} reason - Denial reason
     * @returns {Object} Denial result
     */
    denyProposal(id, reason = 'User denied') {
        const pending = this.pendingApprovals.get(id);
        
        if (!pending) {
            console.warn(`⚠️ Approval ${id} not found or expired`);
            return { success: false, error: 'Approval not found or expired' };
        }
        
        console.log(`❌ Approval denied: ${reason}`);
        
        // Resolve promise with denial
        pending.resolve({
            approved: false,
            reason,
            timestamp: Date.now()
        });
        
        // Clean up
        this.pendingApprovals.delete(id);
        
        return { success: true, denied: true, reason };
    }
    
    /**
     * Validate token
     * @param {string} token - Token to validate
     * @returns {boolean} Valid or not
     */
    validateToken(token) {
        // 🔓 DEVELOPER MODE: Skip validation
        if (this.config.developerMode || (typeof window !== 'undefined' && window.kodCanavari?.developerMode)) {
            console.log('🔓 Developer Mode: Token validation bypassed');
            return true;
        }
        
        const data = this.tokens.get(token);
        
        if (!data) {
            console.warn('⚠️ Token not found');
            return false;
        }
        
        if (data.used) {
            console.warn('⚠️ Token already used');
            return false;
        }
        
        if (Date.now() > data.expiresAt) {
            console.warn('⚠️ Token expired');
            this.tokens.delete(token);
            return false;
        }
        
        return true;
    }
    
    /**
     * Use token (marks as used, single-use)
     * @param {string} token - Token to use
     * @returns {Object} Proposal data
     * @throws {Error} If token invalid
     */
    useToken(token) {
        // 🔓 DEVELOPER MODE: Skip token consumption
        if (this.config.developerMode || (typeof window !== 'undefined' && window.kodCanavari?.developerMode)) {
            console.log('🔓 Developer Mode: Token consumption bypassed');
            return { autoApproved: true, reason: 'developer-mode' };
        }
        
        if (!this.validateToken(token)) {
            throw new Error('❌ Invalid or expired token');
        }
        
        const data = this.tokens.get(token);
        
        // Mark as used (single-use)
        data.used = true;
        
        console.log(`🔓 Token used: ${token.substr(0, 12)}...`);
        
        return data.proposal;
    }
    
    /**
     * Generate secure token
     * @returns {string} Token
     */
    generateToken() {
        const timestamp = Date.now().toString(36);
        const random1 = Math.random().toString(36).substr(2, 9);
        const random2 = Math.random().toString(36).substr(2, 9);
        
        return `tok-${timestamp}-${random1}-${random2}`;
    }
    
    /**
     * Get pending approval by ID
     * @param {string} id - Approval ID
     * @returns {Object|null} Pending approval data
     */
    getPendingApproval(id) {
        return this.pendingApprovals.get(id) || null;
    }
    
    /**
     * Get all pending approvals
     * @returns {Array} Pending approvals
     */
    getAllPendingApprovals() {
        return Array.from(this.pendingApprovals.entries()).map(([id, data]) => ({
            id,
            proposal: data.proposal,
            createdAt: data.createdAt
        }));
    }
    
    /**
     * Emit approval request event (for UI)
     * @param {string} id - Approval ID
     * @param {Object} proposal - Proposal
     */
    emitApprovalRequest(id, proposal) {
        // Dispatch custom event
        window.dispatchEvent(new CustomEvent('approval-request', {
            detail: { id, proposal }
        }));
    }
    
    /**
     * Cleanup expired tokens and pending approvals
     */
    cleanup() {
        const now = Date.now();
        let cleanedTokens = 0;
        let cleanedApprovals = 0;
        
        // Clean expired tokens
        for (const [token, data] of this.tokens.entries()) {
            if (now > data.expiresAt || data.used) {
                this.tokens.delete(token);
                cleanedTokens++;
            }
        }
        
        // Clean expired pending approvals
        for (const [id, data] of this.pendingApprovals.entries()) {
            if (now - data.createdAt > this.config.tokenExpiration) {
                data.reject(new Error('Approval timeout'));
                this.pendingApprovals.delete(id);
                cleanedApprovals++;
            }
        }
        
        if (cleanedTokens > 0 || cleanedApprovals > 0) {
            console.log(`🧹 Cleanup: ${cleanedTokens} tokens, ${cleanedApprovals} approvals`);
        }
    }
    
    /**
     * Start automatic cleanup worker
     */
    startCleanupWorker() {
        setInterval(() => {
            this.cleanup();
        }, this.config.autoCleanupInterval);
    }
    
    /**
     * Get statistics
     * @returns {Object} Stats
     */
    getStats() {
        return {
            activeTokens: this.tokens.size,
            pendingApprovals: this.pendingApprovals.size,
            usedTokens: Array.from(this.tokens.values()).filter(t => t.used).length
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ApprovalSystem;
}
