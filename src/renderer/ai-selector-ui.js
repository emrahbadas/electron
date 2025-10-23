const { ipcRenderer } = require('electron');

/**
 * AI Selector Switch - OpenAI ↔ Claude toggle
 * Mevcut prompt box'ın üstüne entegre edilecek
 */
class AISelectorUI {
    constructor() {
        this.container = null;
        this.activeProvider = 'openai'; // Default
        this.servicesStatus = {
            openai: false,
            claude: false
        };
        this.routerStats = {
            routedToOpenAI: 0,
            routedToClaude: 0
        };
        
        // Event listeners
        this.onProviderChange = null;
        
        this.init();
        this.setupIPCListeners();
    }

    /**
     * UI'ı başlat
     */
    init() {
        this.container = document.createElement('div');
        this.container.className = 'ai-selector-container';
        this.container.innerHTML = this.renderHTML();
        
        // Event listeners
        this.attachEventListeners();
        
        // Router status'u al
        this.refreshStatus();
    }

    /**
     * HTML render
     */
    renderHTML() {
        return `
            <div class="ai-selector-card">
                <!-- Header -->
                <div class="ai-selector-header">
                    <span class="ai-selector-label">AI Provider</span>
                    <div class="ai-selector-stats">
                        <span id="ai-stats-text" class="ai-stats-text">
                            OpenAI: ${this.routerStats.routedToOpenAI} | Claude: ${this.routerStats.routedToClaude}
                        </span>
                    </div>
                </div>

                <!-- Toggle Switch -->
                <div class="ai-selector-switch-container">
                    <div class="ai-provider-option ${this.activeProvider === 'openai' ? 'active' : ''}" id="openai-option">
                        <span class="provider-icon">🤖</span>
                        <div class="provider-info">
                            <span class="provider-name">OpenAI</span>
                            <span class="provider-desc">KodCanavarı Tools</span>
                            <span class="provider-status ${this.servicesStatus.openai ? 'ready' : 'not-ready'}" id="openai-status">
                                ${this.servicesStatus.openai ? '● Ready' : '○ Not Ready'}
                            </span>
                        </div>
                    </div>

                    <div class="ai-toggle-divider">
                        <button class="ai-toggle-button" id="ai-toggle-btn">
                            <span class="toggle-icon">⇄</span>
                        </button>
                    </div>

                    <div class="ai-provider-option ${this.activeProvider === 'claude' ? 'active' : ''}" id="claude-option">
                        <span class="provider-icon">🧠</span>
                        <div class="provider-info">
                            <span class="provider-name">Claude</span>
                            <span class="provider-desc">Anthropic MCP</span>
                            <span class="provider-status ${this.servicesStatus.claude ? 'ready' : 'not-ready'}" id="claude-status">
                                ${this.servicesStatus.claude ? '● Ready' : '○ Not Ready'}
                            </span>
                        </div>
                    </div>
                </div>

                <!-- Tools Preview -->
                <div class="ai-selector-tools-preview" id="tools-preview">
                    <div class="tools-loading">Loading tools...</div>
                </div>
            </div>

            <style>
                .ai-selector-container {
                    margin-bottom: 15px;
                }

                .ai-selector-card {
                    background: linear-gradient(135deg, #1e1e2e 0%, #252533 100%);
                    border: 1px solid #3a3a4a;
                    border-radius: 12px;
                    padding: 16px;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                }

                .ai-selector-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 12px;
                }

                .ai-selector-label {
                    font-size: 13px;
                    font-weight: 600;
                    color: #a0a0b0;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .ai-stats-text {
                    font-size: 11px;
                    color: #707080;
                    font-family: 'Consolas', monospace;
                }

                .ai-selector-switch-container {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 12px;
                }

                .ai-provider-option {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 12px;
                    background: #2a2a3a;
                    border: 2px solid transparent;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }

                .ai-provider-option:hover {
                    background: #323242;
                    border-color: #4a4a5a;
                }

                .ai-provider-option.active {
                    background: linear-gradient(135deg, #0e639c 0%, #1177bb 100%);
                    border-color: #1a88cc;
                    box-shadow: 0 0 20px rgba(14, 99, 156, 0.4);
                }

                .provider-icon {
                    font-size: 28px;
                    line-height: 1;
                }

                .provider-info {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }

                .provider-name {
                    font-size: 14px;
                    font-weight: 600;
                    color: #ffffff;
                }

                .provider-desc {
                    font-size: 11px;
                    color: #9090a0;
                }

                .provider-status {
                    font-size: 10px;
                    font-weight: 500;
                    margin-top: 4px;
                }

                .provider-status.ready {
                    color: #4caf50;
                }

                .provider-status.not-ready {
                    color: #f44336;
                }

                .ai-toggle-divider {
                    display: flex;
                    align-items: center;
                }

                .ai-toggle-button {
                    background: #3a3a4a;
                    border: 2px solid #4a4a5a;
                    border-radius: 50%;
                    width: 40px;
                    height: 40px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }

                .ai-toggle-button:hover {
                    background: #4a4a5a;
                    border-color: #5a5a6a;
                    transform: rotate(180deg);
                }

                .toggle-icon {
                    font-size: 18px;
                    color: #ffffff;
                }

                .ai-selector-tools-preview {
                    background: #2a2a3a;
                    border-radius: 6px;
                    padding: 10px;
                    max-height: 120px;
                    overflow-y: auto;
                }

                .tools-loading {
                    text-align: center;
                    color: #707080;
                    font-size: 11px;
                    padding: 8px;
                }

                .tools-list {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 6px;
                }

                .tool-badge {
                    background: #3a3a4a;
                    color: #e0e0f0;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 10px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }

                .tool-badge:hover {
                    background: #0e639c;
                    transform: translateY(-2px);
                }
            </style>
        `;
    }

    /**
     * Event listeners ekle
     */
    attachEventListeners() {
        // OpenAI option click
        const openaiOption = this.container.querySelector('#openai-option');
        openaiOption?.addEventListener('click', () => this.switchTo('openai'));

        // Claude option click
        const claudeOption = this.container.querySelector('#claude-option');
        claudeOption?.addEventListener('click', () => this.switchTo('claude'));

        // Toggle button click
        const toggleBtn = this.container.querySelector('#ai-toggle-btn');
        toggleBtn?.addEventListener('click', () => {
            const newProvider = this.activeProvider === 'openai' ? 'claude' : 'openai';
            this.switchTo(newProvider);
        });
    }

    /**
     * IPC listeners setup
     */
    setupIPCListeners() {
        // Provider switched event
        ipcRenderer.on('mcp-router:providerSwitched', (event, data) => {
            console.log('[AI Selector] Provider switched:', data);
            this.activeProvider = data.to;
            this.updateUI();
        });

        // Claude streaming chunk
        ipcRenderer.on('claude:streamingChunk', (event, chunk) => {
            // Forward to chat UI
            if (this.onStreamingChunk) {
                this.onStreamingChunk(chunk);
            }
        });

        // Claude tool used
        ipcRenderer.on('claude:toolUsed', (event, tool) => {
            console.log('[AI Selector] Claude tool used:', tool);
        });
    }

    /**
     * Provider switch
     */
    async switchTo(provider) {
        if (provider === this.activeProvider) {
            return; // Already active
        }

        // Check if service is ready
        if (!this.servicesStatus[provider]) {
            this.showNotification(`${provider} service is not initialized!`, 'error');
            return;
        }

        try {
            const result = await ipcRenderer.invoke('mcp-router:switch-provider', provider);
            
            if (result.success) {
                this.activeProvider = provider;
                this.updateUI();
                await this.loadTools();
                
                if (this.onProviderChange) {
                    this.onProviderChange(provider);
                }
                
                this.showNotification(`Switched to ${provider}`, 'success');
            } else {
                this.showNotification(result.error, 'error');
            }
        } catch (error) {
            console.error('[AI Selector] Switch error:', error);
            this.showNotification('Failed to switch provider', 'error');
        }
    }

    /**
     * Router status'u yenile
     */
    async refreshStatus() {
        try {
            const result = await ipcRenderer.invoke('mcp-router:get-status');
            
            if (result.success) {
                this.activeProvider = result.activeProvider;
                this.servicesStatus = result.services;
                this.routerStats = result.routing || {};
                
                this.updateUI();
                await this.loadTools();
            }
        } catch (error) {
            console.error('[AI Selector] Status refresh error:', error);
        }
    }

    /**
     * Tools listesi yükle
     */
    async loadTools() {
        const toolsPreview = this.container.querySelector('#tools-preview');
        if (!toolsPreview) return;

        try {
            const result = await ipcRenderer.invoke('mcp-router:list-tools');
            
            if (result.success && result.tools) {
                const toolsHTML = `
                    <div class="tools-list">
                        ${result.tools.slice(0, 8).map(tool => `
                            <div class="tool-badge" title="${tool.description || tool.name}">
                                ${tool.name.replace(/_/g, ' ')}
                            </div>
                        `).join('')}
                        ${result.tools.length > 8 ? `
                            <div class="tool-badge">+${result.tools.length - 8} more</div>
                        ` : ''}
                    </div>
                `;
                toolsPreview.innerHTML = toolsHTML;
            } else {
                toolsPreview.innerHTML = '<div class="tools-loading">No tools available</div>';
            }
        } catch (error) {
            console.error('[AI Selector] Load tools error:', error);
            toolsPreview.innerHTML = '<div class="tools-loading">Error loading tools</div>';
        }
    }

    /**
     * UI güncelle
     */
    updateUI() {
        // Update active state
        const openaiOption = this.container.querySelector('#openai-option');
        const claudeOption = this.container.querySelector('#claude-option');
        
        if (this.activeProvider === 'openai') {
            openaiOption?.classList.add('active');
            claudeOption?.classList.remove('active');
        } else {
            claudeOption?.classList.add('active');
            openaiOption?.classList.remove('active');
        }

        // Update status indicators
        const openaiStatus = this.container.querySelector('#openai-status');
        const claudeStatus = this.container.querySelector('#claude-status');
        
        if (openaiStatus) {
            openaiStatus.textContent = this.servicesStatus.openai ? '● Ready' : '○ Not Ready';
            openaiStatus.className = `provider-status ${this.servicesStatus.openai ? 'ready' : 'not-ready'}`;
        }
        
        if (claudeStatus) {
            claudeStatus.textContent = this.servicesStatus.claude ? '● Ready' : '○ Not Ready';
            claudeStatus.className = `provider-status ${this.servicesStatus.claude ? 'ready' : 'not-ready'}`;
        }

        // Update stats
        const statsText = this.container.querySelector('#ai-stats-text');
        if (statsText) {
            statsText.textContent = `OpenAI: ${this.routerStats.routedToOpenAI || 0} | Claude: ${this.routerStats.routedToClaude || 0}`;
        }
    }

    /**
     * Notification göster
     */
    showNotification(message, type = 'info') {
        // Basit notification sistemi
        console.log(`[AI Selector] ${type.toUpperCase()}: ${message}`);
        
        // TODO: Mevcut notification sistemine entegre et
    }

    /**
     * DOM'a ekle
     */
    appendTo(parentElement) {
        if (parentElement && this.container) {
            parentElement.appendChild(this.container);
            
            // İlk yükleme
            setTimeout(() => this.refreshStatus(), 500);
        }
    }

    /**
     * Aktif provider'ı getir
     */
    getActiveProvider() {
        return this.activeProvider;
    }

    /**
     * Service status'u getir
     */
    getServicesStatus() {
        return this.servicesStatus;
    }
}

// Global export
if (typeof window !== 'undefined') {
    window.AISelectorUI = AISelectorUI;
}

module.exports = AISelectorUI;
