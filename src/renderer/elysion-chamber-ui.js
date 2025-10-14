/**
 * 🎨 ELYSION CHAMBER UI CONTROLLER
 * 
 * Manages all Elysion Chamber UI components:
 * - Approval Modal
 * - Probe Results Modal
 * - Narrator Panel
 * - Policy Violation Display
 * 
 * Connects UI to approval-system.js, policy-engine.js, probe-matrix.js
 */

class ElysionChamberUI {
    constructor() {
        // Modal elements
        this.approvalModal = document.getElementById('approvalModal');
        this.probeModal = document.getElementById('probeModal');
        this.narratorPanel = document.getElementById('narratorPanel');
        
        // Current approval data
        this.currentApprovalId = null;
        this.approvalTimeoutTimer = null;
        
        // Initialize event listeners
        this.initializeEventListeners();
        
        console.log('✅ Elysion Chamber UI initialized');
    }
    
    /**
     * Initialize all event listeners
     */
    initializeEventListeners() {
        // Approval modal buttons
        const approveBtn = document.getElementById('approveButton');
        const denyBtn = document.getElementById('denyApproval');
        
        if (approveBtn) {
            approveBtn.addEventListener('click', () => this.handleApprove());
        }
        
        if (denyBtn) {
            denyBtn.addEventListener('click', () => this.handleDeny());
        }
        
        // Probe modal
        const closeProbeBtn = document.getElementById('closeProbeModal');
        const closeProbeResultsBtn = document.getElementById('closeProbeResults');
        
        if (closeProbeBtn) {
            closeProbeBtn.addEventListener('click', () => this.hideProbeModal());
        }
        
        if (closeProbeResultsBtn) {
            closeProbeResultsBtn.addEventListener('click', () => this.hideProbeModal());
        }
        
        // Narrator panel toggle
        const narratorToggle = document.getElementById('narratorToggle');
        if (narratorToggle) {
            narratorToggle.addEventListener('click', () => this.toggleNarratorPanel());
        }
        
        // Listen for approval requests (from approval-system.js)
        window.addEventListener('approval-request', (event) => {
            this.showApprovalModal(event.detail);
        });
        
        console.log('✅ Event listeners initialized');
    }
    
    /**
     * Show approval modal with proposal data
     * @param {Object} data - { id, proposal }
     */
    showApprovalModal(data) {
        const { id, proposal } = data;
        
        console.log('🔐 Showing approval modal:', id);
        
        this.currentApprovalId = id;
        
        // Populate modal
        this.populateApprovalModal(proposal);
        
        // Show modal
        this.approvalModal.classList.remove('hidden');
        
        // Start timeout countdown
        this.startApprovalTimeout(60);
    }
    
    /**
     * Populate approval modal with proposal data
     * @param {Object} proposal - Proposal object
     */
    populateApprovalModal(proposal) {
        const { step, commands = [], files = [], risks = 'None specified', probes = [] } = proposal;
        
        // Step info
        document.getElementById('approvalStepTitle').textContent = step?.title || 'Unknown';
        document.getElementById('approvalStepIntent').textContent = step?.intent || 'No description';
        
        // Approval ID
        document.getElementById('approvalId').textContent = `#${this.currentApprovalId?.substr(-8) || 'N/A'}`;
        
        // Commands
        const commandList = document.getElementById('commandList');
        document.getElementById('commandCount').textContent = commands.length;
        
        commandList.innerHTML = commands.length > 0
            ? commands.map(cmd => `
                <div class="command-item">
                    <i class="fas fa-terminal"></i>
                    <code>${this.escapeHtml(typeof cmd === 'string' ? cmd : cmd.command || JSON.stringify(cmd))}</code>
                </div>
            `).join('')
            : '<p class="empty-state">No commands</p>';
        
        // Files
        const fileList = document.getElementById('fileList');
        document.getElementById('fileCount').textContent = files.length;
        
        fileList.innerHTML = files.length > 0
            ? files.map(file => `
                <div class="file-item">
                    <i class="fas fa-file-code"></i>
                    <span class="file-path">${this.escapeHtml(file.path || file)}</span>
                    <span class="file-operation">${file.operation || 'modify'}</span>
                </div>
            `).join('')
            : '<p class="empty-state">No file modifications</p>';
        
        // Risk assessment
        document.getElementById('riskAssessment').innerHTML = `
            <p>${this.escapeHtml(risks)}</p>
        `;
        
        // Probes
        const probeList = document.getElementById('probeList');
        document.getElementById('probeCount').textContent = probes.length;
        
        probeList.innerHTML = probes.length > 0
            ? probes.map(probe => `
                <div class="probe-item">
                    <i class="fas fa-check-circle"></i>
                    <span class="probe-type">${probe.type}</span>
                    <span class="probe-target">${this.escapeHtml(probe.target)}</span>
                </div>
            `).join('')
            : '<p class="empty-state">No validation checks</p>';
        
        // Policy violations (if any)
        if (proposal.policyViolations && proposal.policyViolations.length > 0) {
            this.showPolicyViolations(proposal.policyViolations);
        } else {
            document.getElementById('policySection').classList.add('hidden');
        }
    }
    
    /**
     * Show policy violations in approval modal
     * @param {Array} violations - Policy violations
     */
    showPolicyViolations(violations) {
        const policySection = document.getElementById('policySection');
        const policyViolations = document.getElementById('policyViolations');
        
        policySection.classList.remove('hidden');
        
        policyViolations.innerHTML = violations.map(v => `
            <div class="violation-item severity-${v.severity.toLowerCase()}">
                <div class="violation-header">
                    <span class="violation-severity">${v.severity}</span>
                    <span class="violation-rule">${v.rule}</span>
                </div>
                <div class="violation-message">${this.escapeHtml(v.message)}</div>
                <div class="violation-fix">
                    <strong>Fix:</strong> ${this.escapeHtml(v.fix)}
                </div>
            </div>
        `).join('');
    }
    
    /**
     * Start approval timeout countdown
     * @param {number} seconds - Timeout in seconds
     */
    startApprovalTimeout(seconds) {
        let remaining = seconds;
        const timeoutEl = document.getElementById('approvalTimeout');
        
        // Clear existing timer
        if (this.approvalTimeoutTimer) {
            clearInterval(this.approvalTimeoutTimer);
        }
        
        // Update display
        this.approvalTimeoutTimer = setInterval(() => {
            remaining--;
            timeoutEl.textContent = `${remaining}s`;
            
            if (remaining <= 0) {
                clearInterval(this.approvalTimeoutTimer);
                this.handleTimeout();
            }
        }, 1000);
    }
    
    /**
     * Handle approval timeout
     */
    handleTimeout() {
        console.warn('⏰ Approval timeout');
        this.hideApprovalModal();
        
        // Notify approval system
        if (window.kodCanavari && window.kodCanavari.approvalSystem) {
            window.kodCanavari.approvalSystem.denyProposal(
                this.currentApprovalId,
                'Approval timeout (60 seconds)'
            );
        }
    }
    
    /**
     * Handle approve button click
     */
    handleApprove() {
        console.log('✅ User approved:', this.currentApprovalId);
        
        // Stop timeout FIRST
        if (this.approvalTimeoutTimer) {
            clearInterval(this.approvalTimeoutTimer);
            this.approvalTimeoutTimer = null;
        }
        
        // Notify approval system BEFORE hiding modal
        let result = { success: false, error: 'Unknown error' };
        if (window.kodCanavari && window.kodCanavari.approvalSystem) {
            result = window.kodCanavari.approvalSystem.approveProposal(this.currentApprovalId);
            console.log('🔐 Approval result:', result);
        }
        
        // Hide modal AFTER approval
        this.hideApprovalModal();
        
        // Show result
        if (result.success) {
            this.showNotification('Approval granted! Executing...', 'success');
        } else {
            this.showNotification('Approval failed: ' + result.error, 'error');
        }
    }
    
    /**
     * Handle deny button click
     */
    handleDeny() {
        console.log('❌ User denied:', this.currentApprovalId);
        
        // Stop timeout
        if (this.approvalTimeoutTimer) {
            clearInterval(this.approvalTimeoutTimer);
        }
        
        // Hide modal
        this.hideApprovalModal();
        
        // Notify approval system
        if (window.kodCanavari && window.kodCanavari.approvalSystem) {
            window.kodCanavari.approvalSystem.denyProposal(
                this.currentApprovalId,
                'User denied'
            );
        }
        
        this.showNotification('Operation cancelled', 'info');
    }
    
    /**
     * Hide approval modal
     */
    hideApprovalModal() {
        this.approvalModal.classList.add('hidden');
        this.currentApprovalId = null;
        
        if (this.approvalTimeoutTimer) {
            clearInterval(this.approvalTimeoutTimer);
        }
    }
    
    /**
     * Show probe results modal
     * @param {Object} results - Probe results
     */
    showProbeResults(results) {
        console.log('🔍 Showing probe results:', results);
        
        // Populate summary
        document.getElementById('probeTotal').textContent = results.total || 0;
        document.getElementById('probePassed').textContent = results.passedCount || 0;
        document.getElementById('probeFailed').textContent = results.failedCount || 0;
        
        // Populate results list
        const resultsList = document.getElementById('probeResultsList');
        
        if (results.results && results.results.length > 0) {
            resultsList.innerHTML = results.results.map(r => `
                <div class="probe-result-item ${r.ok ? 'success' : 'failed'}">
                    <div class="probe-result-header">
                        <i class="fas fa-${r.ok ? 'check-circle' : 'times-circle'}"></i>
                        <span class="probe-result-type">${r.type}</span>
                        <span class="probe-result-status">${r.ok ? 'PASS' : 'FAIL'}</span>
                    </div>
                    <div class="probe-result-target">${this.escapeHtml(r.target)}</div>
                    <div class="probe-result-message">${this.escapeHtml(r.message)}</div>
                    ${r.details ? `<div class="probe-result-details"><pre>${JSON.stringify(r.details, null, 2)}</pre></div>` : ''}
                </div>
            `).join('');
        } else {
            resultsList.innerHTML = '<p class="empty-state">No probe results</p>';
        }
        
        // Show modal
        this.probeModal.classList.remove('hidden');
    }
    
    /**
     * Hide probe results modal
     */
    hideProbeModal() {
        this.probeModal.classList.add('hidden');
    }
    
    /**
     * Show narrator panel
     */
    showNarratorPanel() {
        this.narratorPanel.classList.remove('hidden');
    }
    
    /**
     * Hide narrator panel
     */
    hideNarratorPanel() {
        this.narratorPanel.classList.add('hidden');
    }
    
    /**
     * Toggle narrator panel
     */
    toggleNarratorPanel() {
        const body = this.narratorPanel.querySelector('.narrator-body');
        const icon = document.querySelector('#narratorToggle i');
        
        if (body.style.display === 'none') {
            body.style.display = 'block';
            icon.className = 'fas fa-chevron-down';
        } else {
            body.style.display = 'none';
            icon.className = 'fas fa-chevron-up';
        }
    }
    
    /**
     * Add narrator message
     * @param {string} message - Narrator message
     */
    addNarratorMessage(message) {
        // 🔇 DEVELOPER MODE: Hide narrator panel (use Usta Modu UI instead)
        if (window.kodCanavari?.developerMode) {
            // Silently ignore in dev mode - Usta Modu UI handles narration
            return;
        }
        
        const content = document.getElementById('narratorContent');
        
        // Remove waiting message
        const waiting = content.querySelector('.narrator-waiting');
        if (waiting) {
            waiting.remove();
        }
        
        // Add new message
        const messageEl = document.createElement('div');
        messageEl.className = 'narrator-message';
        messageEl.innerHTML = `
            <span class="narrator-timestamp">${new Date().toLocaleTimeString()}</span>
            <p>${this.escapeHtml(message)}</p>
        `;
        
        content.appendChild(messageEl);
        
        // Scroll to bottom
        content.scrollTop = content.scrollHeight;
        
        // Show panel if hidden
        this.showNarratorPanel();
    }
    
    /**
     * Escape HTML
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * Show notification
     * @param {string} message - Notification message
     * @param {string} type - Notification type (success, error, info, warning)
     */
    showNotification(message, type = 'info') {
        // Use existing notification system if available
        if (window.kodCanavari && window.kodCanavari.showNotification) {
            window.kodCanavari.showNotification(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }
}

// Initialize UI when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.elysionUI = new ElysionChamberUI();
    });
} else {
    window.elysionUI = new ElysionChamberUI();
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ElysionChamberUI;
}
