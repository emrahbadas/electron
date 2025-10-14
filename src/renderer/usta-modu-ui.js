/**
 * 🎓 USTA MODU UI PANEL
 * 
 * Chat'in üstünde, step-by-step anlatım gösterir.
 * Events: NARRATION_BEFORE, NARRATION_AFTER, NARRATION_VERIFY
 */

class UstaModuUI {
    constructor() {
        this.container = null;
        this.currentNarrations = [];
        this.isVisible = false;
        this.init();
    }
    
    init() {
        // Panel container oluştur (Chat'in üstüne)
        this.container = document.createElement('div');
        this.container.id = 'usta-modu-panel';
        this.container.className = 'usta-panel hidden';
        this.container.innerHTML = `
            <div class="usta-header">
                <div class="usta-title">
                    <span class="usta-icon">🎓</span>
                    <h3>Usta Modu Anlatımı</h3>
                    <span class="usta-badge" id="usta-step-count">0 steps</span>
                </div>
                <div class="usta-controls">
                    <button id="usta-clear" class="usta-btn" title="Temizle">
                        <i class="fas fa-trash"></i>
                    </button>
                    <button id="usta-toggle" class="usta-btn" title="Aç/Kapat">
                        <i class="fas fa-chevron-up"></i>
                    </button>
                    <button id="usta-close" class="usta-btn" title="Kapat">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
            <div class="usta-content" id="usta-content"></div>
        `;
        
        // Body'ye ekle (Chat container'dan önce)
        document.body.appendChild(this.container);
        
        // Button event listeners
        this.setupEventListeners();
        
        // EventBus integration
        if (window.kodCanavari?.eventBus) {
            window.kodCanavari.eventBus.on('NARRATION_BEFORE', (e) => this.addBefore(e));
            window.kodCanavari.eventBus.on('NARRATION_AFTER', (e) => this.addAfter(e));
            window.kodCanavari.eventBus.on('NARRATION_VERIFY', (e) => this.addVerify(e));
        }
        
        console.log('✅ Usta Modu UI initialized');
    }
    
    setupEventListeners() {
        // Toggle (collapse/expand)
        document.getElementById('usta-toggle')?.addEventListener('click', () => {
            this.container.classList.toggle('collapsed');
            const icon = document.querySelector('#usta-toggle i');
            if (icon) {
                icon.className = this.container.classList.contains('collapsed') 
                    ? 'fas fa-chevron-down' 
                    : 'fas fa-chevron-up';
            }
        });
        
        // Clear
        document.getElementById('usta-clear')?.addEventListener('click', () => {
            this.clear();
        });
        
        // Close
        document.getElementById('usta-close')?.addEventListener('click', () => {
            this.hide();
        });
    }
    
    show() {
        this.container.classList.remove('hidden');
        this.isVisible = true;
    }
    
    hide() {
        this.container.classList.add('hidden');
        this.isVisible = false;
    }
    
    clear() {
        document.getElementById('usta-content').innerHTML = '';
        this.currentNarrations = [];
        this.updateStepCount();
    }
    
    updateStepCount() {
        const count = this.currentNarrations.length;
        const badge = document.getElementById('usta-step-count');
        if (badge) {
            badge.textContent = count === 0 ? 'No steps' : `${count} step${count > 1 ? 's' : ''}`;
        }
    }
    
    addBefore(event) {
        const { stepId, explain, timestamp } = event;
        
        // Show panel when first step arrives
        if (!this.isVisible) {
            this.show();
        }
        
        const html = `
            <div class="narration-step" data-step="${stepId}" id="step-${stepId}">
                <div class="step-header">
                    <span class="step-id">📍 Step ${stepId}</span>
                    <span class="step-phase phase-before">BEFORE</span>
                    <span class="step-time">${this.formatTime(timestamp)}</span>
                </div>
                
                <div class="step-goal">
                    <strong>🎯 HEDEF:</strong>
                    <p>${this.escapeHtml(explain.goal || 'N/A')}</p>
                </div>
                
                <div class="step-rationale">
                    <strong>🔎 GEREKÇE:</strong>
                    <p>${this.escapeHtml(explain.rationale || 'N/A')}</p>
                </div>
                
                ${explain.tradeoffs ? `
                    <div class="step-tradeoffs">
                        <strong>↔️ ALTERNATİFLER:</strong>
                        <p>${this.escapeHtml(explain.tradeoffs)}</p>
                    </div>
                ` : ''}
                
                ${explain.checklist && explain.checklist.length > 0 ? `
                    <div class="step-checklist">
                        <strong>✅ DİKKAT LİSTESİ:</strong>
                        <ul>
                            ${explain.checklist.map(item => `<li>☑️ ${this.escapeHtml(item)}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
                
                <div class="step-separator"></div>
            </div>
        `;
        
        document.getElementById('usta-content').insertAdjacentHTML('beforeend', html);
        this.currentNarrations.push({ stepId, type: 'before' });
        this.updateStepCount();
        this.scrollToBottom();
    }
    
    addAfter(event) {
        const { stepId, diff, summary, timestamp } = event;
        const stepEl = document.getElementById(`step-${stepId}`);
        
        if (stepEl) {
            const html = `
                <div class="step-after">
                    <div class="step-header">
                        <span class="step-phase phase-after">AFTER</span>
                        <span class="step-time">${this.formatTime(timestamp)}</span>
                    </div>
                    
                    <div class="step-changes">
                        <strong>🧾 DEĞİŞİKLİKLER:</strong>
                        <p>${this.escapeHtml(summary || 'No changes')}</p>
                        ${diff ? `
                            <details>
                                <summary>Diff'i Göster</summary>
                                <pre class="diff-content">${this.escapeHtml(diff)}</pre>
                            </details>
                        ` : ''}
                    </div>
                    
                    <div class="step-separator"></div>
                </div>
            `;
            stepEl.insertAdjacentHTML('beforeend', html);
            this.scrollToBottom();
        }
    }
    
    addVerify(event) {
        const { stepId, probes, timestamp } = event;
        const stepEl = document.getElementById(`step-${stepId}`);
        
        if (stepEl) {
            const html = `
                <div class="step-verify">
                    <div class="step-header">
                        <span class="step-phase phase-verify">VERIFY</span>
                        <span class="step-time">${this.formatTime(timestamp)}</span>
                    </div>
                    
                    <div class="step-probes">
                        <strong>✅ DOĞRULAMA:</strong>
                        <ul class="probe-list">
                            ${probes.map(p => `
                                <li class="probe-item probe-${p.status}">
                                    ${p.status === 'pass' ? '✓' : '✗'} 
                                    ${p.type}: ${this.escapeHtml(p.target || p.url || 'N/A')}
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                    
                    <div class="step-complete">
                        <span class="complete-badge">⏱️ Tamamlandı</span>
                    </div>
                </div>
            `;
            stepEl.insertAdjacentHTML('beforeend', html);
            this.scrollToBottom();
        }
    }
    
    scrollToBottom() {
        const content = document.getElementById('usta-content');
        if (content) {
            content.scrollTop = content.scrollHeight;
        }
    }
    
    formatTime(timestamp) {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Auto-initialize when DOM ready
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        window.ustaModuUI = new UstaModuUI();
    });
}
