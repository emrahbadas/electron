/**
 * MCP Sequential Thinking - Chain of Thought with Branching
 * Implements reasoning visibility per MCP specification
 */

class SequentialThinking {
    constructor() {
        this.sessions = new Map();
        this.thoughtHistory = [];
    }
    
    /**
     * Start thinking session
     * @param {object} params - Parameters
     * @param {string} params.sessionId - Optional session ID
     * @param {string} params.problem - Problem description
     * @returns {object} - Session info
     */
    async startSession(params) {
        const { sessionId = this.generateSessionId(), problem } = params;
        
        if (!problem) {
            throw new Error('Problem description is required');
        }
        
        const session = {
            id: sessionId,
            problem,
            thoughts: [],
            branches: [],
            startTime: Date.now(),
            status: 'active'
        };
        
        this.sessions.set(sessionId, session);
        
        return {
            success: true,
            sessionId,
            problem
        };
    }
    
    /**
     * Add thought to chain
     * @param {object} params - Parameters
     * @param {string} params.sessionId - Session ID
     * @param {string} params.content - Thought content
     * @param {string} params.type - Thought type (analysis, hypothesis, verification, conclusion)
     * @param {number} params.confidence - Confidence level (0-1)
     * @returns {object} - Thought added
     */
    async addThought(params) {
        const { sessionId, content, type = 'analysis', confidence = 0.5 } = params;
        
        if (!sessionId) {
            throw new Error('Session ID is required');
        }
        
        if (!content) {
            throw new Error('Thought content is required');
        }
        
        const session = this.sessions.get(sessionId);
        
        if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
        }
        
        const thought = {
            id: this.generateThoughtId(),
            content,
            type,
            confidence,
            timestamp: Date.now(),
            index: session.thoughts.length
        };
        
        session.thoughts.push(thought);
        this.thoughtHistory.push({ sessionId, ...thought });
        
        return {
            success: true,
            thought,
            chainLength: session.thoughts.length
        };
    }
    
    /**
     * Create reasoning branch
     * @param {object} params - Parameters
     * @param {string} params.sessionId - Session ID
     * @param {number} params.fromThoughtIndex - Branch point
     * @param {string} params.branchReason - Reason for branching
     * @returns {object} - Branch created
     */
    async createBranch(params) {
        const { sessionId, fromThoughtIndex, branchReason } = params;
        
        if (!sessionId) {
            throw new Error('Session ID is required');
        }
        
        const session = this.sessions.get(sessionId);
        
        if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
        }
        
        const branch = {
            id: this.generateBranchId(),
            fromThoughtIndex,
            branchReason,
            thoughts: [],
            timestamp: Date.now()
        };
        
        session.branches.push(branch);
        
        return {
            success: true,
            branchId: branch.id,
            fromThought: fromThoughtIndex
        };
    }
    
    /**
     * Add thought to branch
     * @param {object} params - Parameters
     * @param {string} params.sessionId - Session ID
     * @param {string} params.branchId - Branch ID
     * @param {string} params.content - Thought content
     * @param {string} params.type - Thought type
     * @returns {object} - Thought added to branch
     */
    async addToBranch(params) {
        const { sessionId, branchId, content, type = 'analysis' } = params;
        
        if (!sessionId || !branchId) {
            throw new Error('Session ID and Branch ID are required');
        }
        
        const session = this.sessions.get(sessionId);
        
        if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
        }
        
        const branch = session.branches.find(b => b.id === branchId);
        
        if (!branch) {
            throw new Error(`Branch not found: ${branchId}`);
        }
        
        const thought = {
            id: this.generateThoughtId(),
            content,
            type,
            timestamp: Date.now(),
            index: branch.thoughts.length
        };
        
        branch.thoughts.push(thought);
        
        return {
            success: true,
            thought,
            branchLength: branch.thoughts.length
        };
    }
    
    /**
     * Revise thought
     * @param {object} params - Parameters
     * @param {string} params.sessionId - Session ID
     * @param {number} params.thoughtIndex - Thought index to revise
     * @param {string} params.newContent - New content
     * @param {string} params.revisionReason - Reason for revision
     * @returns {object} - Revised thought
     */
    async reviseThought(params) {
        const { sessionId, thoughtIndex, newContent, revisionReason } = params;
        
        if (!sessionId) {
            throw new Error('Session ID is required');
        }
        
        const session = this.sessions.get(sessionId);
        
        if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
        }
        
        const thought = session.thoughts[thoughtIndex];
        
        if (!thought) {
            throw new Error(`Thought not found at index: ${thoughtIndex}`);
        }
        
        const revision = {
            oldContent: thought.content,
            newContent,
            revisionReason,
            timestamp: Date.now()
        };
        
        thought.content = newContent;
        thought.revised = true;
        thought.revisions = thought.revisions || [];
        thought.revisions.push(revision);
        
        return {
            success: true,
            thoughtIndex,
            revision
        };
    }
    
    /**
     * Get thinking chain
     * @param {object} params - Parameters
     * @param {string} params.sessionId - Session ID
     * @returns {object} - Full thinking chain
     */
    async getChain(params) {
        const { sessionId } = params;
        
        if (!sessionId) {
            throw new Error('Session ID is required');
        }
        
        const session = this.sessions.get(sessionId);
        
        if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
        }
        
        return {
            success: true,
            session: {
                id: session.id,
                problem: session.problem,
                thoughts: session.thoughts,
                branches: session.branches,
                startTime: session.startTime,
                status: session.status
            }
        };
    }
    
    /**
     * End thinking session
     * @param {object} params - Parameters
     * @param {string} params.sessionId - Session ID
     * @param {string} params.conclusion - Final conclusion
     * @returns {object} - Session summary
     */
    async endSession(params) {
        const { sessionId, conclusion } = params;
        
        if (!sessionId) {
            throw new Error('Session ID is required');
        }
        
        const session = this.sessions.get(sessionId);
        
        if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
        }
        
        session.status = 'completed';
        session.conclusion = conclusion;
        session.endTime = Date.now();
        session.duration = session.endTime - session.startTime;
        
        return {
            success: true,
            sessionId,
            conclusion,
            thoughtCount: session.thoughts.length,
            branchCount: session.branches.length,
            duration: session.duration
        };
    }
    
    /**
     * Generate visual representation
     * @param {object} params - Parameters
     * @param {string} params.sessionId - Session ID
     * @returns {object} - Visual chain
     */
    async visualize(params) {
        const { sessionId } = params;
        
        const session = this.sessions.get(sessionId);
        
        if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
        }
        
        let visual = `\n🧠 Sequential Thinking Chain: ${session.problem}\n`;
        visual += '='.repeat(60) + '\n\n';
        
        // Main chain
        visual += 'Main Chain:\n';
        for (let i = 0; i < session.thoughts.length; i++) {
            const thought = session.thoughts[i];
            visual += `${i + 1}. [${thought.type}] ${thought.content}\n`;
            
            if (thought.revised) {
                visual += `   🔄 Revised (${thought.revisions.length} times)\n`;
            }
            
            // Check for branches
            const branches = session.branches.filter(b => b.fromThoughtIndex === i);
            if (branches.length > 0) {
                visual += `   ↳ ${branches.length} branch(es) from here\n`;
            }
            
            visual += '\n';
        }
        
        // Branches
        if (session.branches.length > 0) {
            visual += '\nBranches:\n';
            for (const branch of session.branches) {
                visual += `\nBranch ${branch.id} (from thought ${branch.fromThoughtIndex + 1}):\n`;
                visual += `Reason: ${branch.branchReason}\n`;
                
                for (let i = 0; i < branch.thoughts.length; i++) {
                    const thought = branch.thoughts[i];
                    visual += `  ${i + 1}. [${thought.type}] ${thought.content}\n`;
                }
            }
        }
        
        if (session.conclusion) {
            visual += `\n✅ Conclusion: ${session.conclusion}\n`;
        }
        
        return {
            success: true,
            visual
        };
    }
    
    /**
     * Get statistics
     */
    getStats() {
        return {
            activeSessions: Array.from(this.sessions.values()).filter(s => s.status === 'active').length,
            completedSessions: Array.from(this.sessions.values()).filter(s => s.status === 'completed').length,
            totalThoughts: this.thoughtHistory.length,
            averageChainLength: this.sessions.size > 0 
                ? this.thoughtHistory.length / this.sessions.size 
                : 0
        };
    }
    
    generateSessionId() {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    generateThoughtId() {
        return `thought_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    generateBranchId() {
        return `branch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

// Singleton instance
let sequentialThinking = null;

function getSequentialThinking() {
    if (!sequentialThinking) {
        sequentialThinking = new SequentialThinking();
    }
    return sequentialThinking;
}

module.exports = {
    SequentialThinking,
    getSequentialThinking
};
