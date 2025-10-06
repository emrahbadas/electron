/**
 * Continue Agent UI Manager
 * Continue.dev benzeri agent sistemi için UI kontrolleri
 */

class ContinueAgentUI {
    constructor() {
        this.isInitialized = false;
        this.isProcessing = false;
        this.currentWorkspace = null;
        this.agentStatus = null;
    }

    /**
     * Continue agent UI'sini başlat
     */
    async initialize(workspacePath = process.cwd()) {
        try {
            this.currentWorkspace = workspacePath;
            
            // Continue agent'i başlat
            const result = await window.electronAPI.continueInitialize(workspacePath);
            
            if (result.success) {
                this.isInitialized = true;
                this.createUI();
                await this.updateStatus();
                console.log('✅ Continue Agent UI initialized');
            } else {
                console.error('❌ Continue Agent initialization failed:', result.error);
            }
            
            return result;
        } catch (error) {
            console.error('❌ Continue Agent UI initialization error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Continue agent UI'sini oluştur
     */
    createUI() {
        // CSS stilleri
        const style = document.createElement('style');
        style.textContent = `
            .continue-agent-panel {
                background: linear-gradient(135deg, #2D1B69 0%, #11998E 100%);
                color: white;
                padding: 20px;
                border-radius: 10px;
                margin: 20px;
                max-width: 900px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.1);
            }

            .continue-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 20px;
                padding-bottom: 15px;
                border-bottom: 2px solid rgba(255,255,255,0.1);
            }

            .continue-title {
                display: flex;
                align-items: center;
                font-size: 1.5em;
                font-weight: bold;
            }

            .continue-status {
                display: flex;
                align-items: center;
                gap: 10px;
            }

            .status-indicator {
                width: 12px;
                height: 12px;
                border-radius: 50%;
                background: #4CAF50;
            }

            .status-indicator.processing {
                background: #FF9800;
                animation: pulse 1s infinite;
            }

            .status-indicator.error {
                background: #F44336;
            }

            @keyframes pulse {
                0% { opacity: 1; }
                50% { opacity: 0.5; }
                100% { opacity: 1; }
            }

            .continue-input-section {
                margin: 20px 0;
            }

            .continue-input-container {
                display: flex;
                gap: 10px;
                margin-bottom: 10px;
            }

            .continue-prompt-input {
                flex: 1;
                padding: 12px;
                border: 2px solid rgba(255,255,255,0.2);
                border-radius: 8px;
                background: rgba(255,255,255,0.1);
                color: white;
                font-size: 14px;
                min-height: 80px;
                resize: vertical;
            }

            .continue-prompt-input::placeholder {
                color: rgba(255,255,255,0.6);
            }

            .continue-btn {
                padding: 12px 24px;
                border: none;
                border-radius: 8px;
                background: rgba(255,255,255,0.2);
                color: white;
                cursor: pointer;
                font-size: 14px;
                transition: all 0.3s ease;
            }

            .continue-btn:hover {
                background: rgba(255,255,255,0.3);
                transform: translateY(-2px);
            }

            .continue-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
                transform: none;
            }

            .continue-btn.primary {
                background: #4CAF50;
            }

            .continue-btn.primary:hover {
                background: #45a049;
            }

            .continue-output {
                background: rgba(0,0,0,0.2);
                border-radius: 8px;
                padding: 15px;
                min-height: 200px;
                max-height: 400px;
                overflow-y: auto;
                font-family: 'Courier New', monospace;
                font-size: 13px;
                line-height: 1.4;
                margin-top: 15px;
            }

            .continue-section {
                margin: 15px 0;
                padding: 15px;
                background: rgba(255,255,255,0.05);
                border-radius: 8px;
            }

            .continue-section h4 {
                margin-top: 0;
                color: #FFD700;
            }

            .token-input-container {
                display: flex;
                gap: 10px;
                align-items: center;
            }

            .token-input {
                flex: 1;
                padding: 8px 12px;
                border: 2px solid rgba(255,255,255,0.2);
                border-radius: 6px;
                background: rgba(255,255,255,0.1);
                color: white;
                font-size: 13px;
            }

            .step-item {
                margin: 8px 0;
                padding: 8px;
                background: rgba(255,255,255,0.1);
                border-radius: 6px;
                border-left: 4px solid #4CAF50;
            }

            .step-item.error {
                border-left-color: #F44336;
            }

            .step-item.pending {
                border-left-color: #FF9800;
            }
        `;
        document.head.appendChild(style);

        // Ana panel HTML
        const panelHTML = `
            <div id="continue-agent-panel" class="continue-agent-panel">
                <div class="continue-header">
                    <div class="continue-title">
                        <i class="fas fa-robot" style="margin-right: 10px;"></i>
                        Continue Agent
                    </div>
                    <div class="continue-status">
                        <div class="status-indicator" id="continue-status-indicator"></div>
                        <span id="continue-status-text">Ready</span>
                    </div>
                </div>

                <!-- GitHub Token Configuration -->
                <div class="continue-section">
                    <h4>🔐 GitHub Models API Token</h4>
                    <div class="token-input-container">
                        <input type="password" id="continue-github-token" class="token-input" 
                               placeholder="GitHub Personal Access Token for Models API">
                        <button onclick="continueAgentUI.updateToken()" class="continue-btn">
                            Update Token
                        </button>
                    </div>
                </div>

                <!-- Prompt Input -->
                <div class="continue-input-section">
                    <h4>💬 Agent Prompt</h4>
                    <div class="continue-input-container">
                        <textarea id="continue-prompt-input" class="continue-prompt-input" 
                                  placeholder="Enter your task or question for the Continue agent...

Examples:
- Create a new React component for user authentication
- Refactor this function to be more efficient  
- Add error handling to the API calls
- Generate unit tests for the user service"></textarea>
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <button onclick="continueAgentUI.processPrompt()" class="continue-btn primary" 
                                id="continue-process-btn">
                            <i class="fas fa-play"></i> Process Task
                        </button>
                        <button onclick="continueAgentUI.stopProcessing()" class="continue-btn" 
                                id="continue-stop-btn" disabled>
                            <i class="fas fa-stop"></i> Stop
                        </button>
                        <button onclick="continueAgentUI.clearOutput()" class="continue-btn">
                            <i class="fas fa-trash"></i> Clear
                        </button>
                    </div>
                </div>

                <!-- Output Display -->
                <div class="continue-section">
                    <h4>📋 Agent Output</h4>
                    <div id="continue-output" class="continue-output">
                        <div style="color: #888; text-align: center; padding: 40px;">
                            Agent output will appear here...
                        </div>
                    </div>
                </div>

                <!-- Quick Actions -->
                <div class="continue-section">
                    <h4>⚡ Quick Actions</h4>
                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                        <button onclick="continueAgentUI.quickAction('analyze')" class="continue-btn">
                            📊 Analyze Codebase
                        </button>
                        <button onclick="continueAgentUI.quickAction('test')" class="continue-btn">
                            🧪 Generate Tests
                        </button>
                        <button onclick="continueAgentUI.quickAction('docs')" class="continue-btn">
                            📚 Create Documentation
                        </button>
                        <button onclick="continueAgentUI.quickAction('refactor')" class="continue-btn">
                            🔧 Refactor Code
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Panel'i DOM'a ekle
        const container = document.createElement('div');
        container.innerHTML = panelHTML;
        document.body.appendChild(container);

        // Event listener'ları ayarla
        this.setupEventListeners();
    }

    /**
     * Event listener'ları ayarla
     */
    setupEventListeners() {
        // Enter key ile prompt gönder
        const promptInput = document.getElementById('continue-prompt-input');
        if (promptInput) {
            promptInput.addEventListener('keydown', (e) => {
                if (e.ctrlKey && e.key === 'Enter') {
                    this.processPrompt();
                }
            });
        }
    }

    /**
     * GitHub token güncelle
     */
    async updateToken() {
        const tokenInput = document.getElementById('continue-github-token');
        const token = tokenInput.value.trim();
        
        if (!token) {
            this.showMessage('❌ Please enter a GitHub token', 'error');
            return;
        }

        try {
            const result = await window.electronAPI.continueUpdateApiKey(token);
            
            if (result.success) {
                this.showMessage('✅ GitHub token updated successfully', 'success');
                tokenInput.value = ''; // Clear for security
            } else {
                this.showMessage(`❌ Failed to update token: ${result.error}`, 'error');
            }
        } catch (error) {
            this.showMessage(`❌ Error updating token: ${error.message}`, 'error');
        }
    }

    /**
     * Prompt işle
     */
    async processPrompt() {
        const promptInput = document.getElementById('continue-prompt-input');
        const prompt = promptInput.value.trim();
        
        if (!prompt) {
            this.showMessage('❌ Please enter a prompt', 'error');
            return;
        }

        if (this.isProcessing) {
            this.showMessage('⚠️ Agent is already processing a task', 'warning');
            return;
        }

        try {
            this.setProcessingState(true);
            this.showMessage(`🤖 Processing: ${prompt}`, 'info');

            const context = {
                workspace: this.currentWorkspace,
                timestamp: new Date().toISOString()
            };

            const result = await window.electronAPI.continueProcessPrompt(prompt, context);
            
            if (result.success) {
                this.displayResult(result);
            } else {
                this.showMessage(`❌ Processing failed: ${result.error}`, 'error');
            }
        } catch (error) {
            this.showMessage(`❌ Error: ${error.message}`, 'error');
        } finally {
            this.setProcessingState(false);
        }
    }

    /**
     * İşlemi durdur
     */
    async stopProcessing() {
        try {
            await window.electronAPI.continueStop();
            this.setProcessingState(false);
            this.showMessage('⏹️ Processing stopped', 'info');
        } catch (error) {
            console.error('Stop processing error:', error);
        }
    }

    /**
     * Hızlı aksiyonlar
     */
    async quickAction(action) {
        const prompts = {
            analyze: 'Analyze the current codebase structure and provide insights about the architecture, dependencies, and potential improvements.',
            test: 'Generate comprehensive unit tests for the main components in this project.',
            docs: 'Create detailed documentation for this project including setup instructions and API documentation.',
            refactor: 'Identify code that can be refactored for better performance, readability, and maintainability.'
        };

        const promptInput = document.getElementById('continue-prompt-input');
        if (promptInput && prompts[action]) {
            promptInput.value = prompts[action];
            await this.processPrompt();
        }
    }

    /**
     * Sonucu görüntüle
     */
    displayResult(result) {
        const output = document.getElementById('continue-output');
        if (!output) return;

        let html = `
            <div class="step-item">
                <strong>📋 Plan:</strong><br>
                ${result.plan.reasoning.replace(/\n/g, '<br>')}
            </div>
        `;

        if (result.plan.steps && result.plan.steps.length > 0) {
            html += '<div style="margin: 15px 0;"><strong>📝 Execution Steps:</strong></div>';
            
            result.plan.steps.forEach((step, index) => {
                const stepResult = result.results[index];
                const statusClass = stepResult?.success ? '' : 'error';
                
                html += `
                    <div class="step-item ${statusClass}">
                        <strong>Step ${index + 1}:</strong> ${step.description}<br>
                        <small>Action: ${step.action} | Target: ${step.target}</small>
                        ${stepResult ? `<br><strong>Result:</strong> ${stepResult.success ? '✅' : '❌'} ${stepResult.result || stepResult.error}` : ''}
                    </div>
                `;
            });
        }

        if (result.response) {
            html += `
                <div class="step-item">
                    <strong>🎯 Final Response:</strong><br>
                    ${result.response.replace(/\n/g, '<br>')}
                </div>
            `;
        }

        output.innerHTML = html;
        output.scrollTop = output.scrollHeight;
    }

    /**
     * Mesaj göster
     */
    showMessage(message, type = 'info') {
        const output = document.getElementById('continue-output');
        if (!output) return;

        const timestamp = new Date().toLocaleTimeString();
        const icon = type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warning' ? '⚠️' : 'ℹ️';
        
        const messageHtml = `
            <div class="step-item ${type}">
                <small>[${timestamp}]</small> ${icon} ${message}
            </div>
        `;

        output.innerHTML += messageHtml;
        output.scrollTop = output.scrollHeight;
    }

    /**
     * İşlem durumunu ayarla
     */
    setProcessingState(processing) {
        this.isProcessing = processing;
        
        const indicator = document.getElementById('continue-status-indicator');
        const statusText = document.getElementById('continue-status-text');
        const processBtn = document.getElementById('continue-process-btn');
        const stopBtn = document.getElementById('continue-stop-btn');

        if (indicator) {
            indicator.className = processing ? 'status-indicator processing' : 'status-indicator';
        }
        
        if (statusText) {
            statusText.textContent = processing ? 'Processing...' : 'Ready';
        }
        
        if (processBtn) {
            processBtn.disabled = processing;
        }
        
        if (stopBtn) {
            stopBtn.disabled = !processing;
        }
    }

    /**
     * Çıktıyı temizle
     */
    clearOutput() {
        const output = document.getElementById('continue-output');
        if (output) {
            output.innerHTML = `
                <div style="color: #888; text-align: center; padding: 40px;">
                    Agent output will appear here...
                </div>
            `;
        }
    }

    /**
     * Durumu güncelle
     */
    async updateStatus() {
        try {
            this.agentStatus = await window.electronAPI.continueStatus();
            
            const statusText = document.getElementById('continue-status-text');
            if (statusText && this.agentStatus) {
                statusText.textContent = this.agentStatus.initialized ? 'Ready' : 'Not Initialized';
            }
        } catch (error) {
            console.error('Status update error:', error);
        }
    }

    /**
     * Panel'i göster/gizle
     */
    toggle() {
        const panel = document.getElementById('continue-agent-panel');
        if (panel) {
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        }
    }
}

// Global instance
let continueAgentUI = null;

// DOM yüklendiğinde başlat
document.addEventListener('DOMContentLoaded', () => {
    continueAgentUI = new ContinueAgentUI();
});

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ContinueAgentUI;
}

// Global
if (typeof window !== 'undefined') {
    window.ContinueAgentUI = ContinueAgentUI;
}