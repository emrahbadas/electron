/**
 * 🎓 NARRATOR AGENT
 * 
 * Live commentary system that explains agent actions in real-time.
 * Implements USTA MODU (Teacher Mode) from USTA_MODU_PLAN.md
 * 
 * Receives NARRATION events from EventBus and displays them in UI panel.
 * 
 * Events:
 * - NARRATION (phase: 'before') → Show goal, rationale, tradeoffs, checklist
 * - NARRATION (phase: 'after') → Show diff, file changes summary
 * - NARRATION (phase: 'verify') → Show probe results
 */

export class NarratorAgent {
    constructor({ panelEl } = {}) {
        this.panelEl = panelEl || 
                      document.getElementById('usta-modu-panel') || 
                      document.getElementById('narratorPanel');
        
        this.messages = [];
        this.currentStepId = null;
        
        console.log('🎓 Narrator Agent initialized');
        
        // Create panel if not exists
        if (!this.panelEl) {
            this.createPanel();
        }
    }
    
    /**
     * Create Usta Modu panel if not exists
     */
    createPanel() {
        // Check if already exists
        if (document.getElementById('usta-modu-panel')) {
            this.panelEl = document.getElementById('usta-modu-panel');
            return;
        }
        
        const panel = document.createElement('div');
        panel.id = 'usta-modu-panel';
        panel.className = 'usta-modu-panel';
        panel.innerHTML = `
            <div class="panel-header">
                <h3>🎓 Usta Modu Anlatımı</h3>
                <button class="panel-toggle" onclick="this.parentElement.parentElement.classList.toggle('collapsed')">_</button>
            </div>
            <div class="panel-content"></div>
        `;
        
        // Add to body
        document.body.appendChild(panel);
        this.panelEl = panel;
        
        // Add styles if not exists
        if (!document.getElementById('usta-modu-styles')) {
            const style = document.createElement('style');
            style.id = 'usta-modu-styles';
            style.textContent = `
                .usta-modu-panel {
                    position: fixed;
                    right: 20px;
                    top: 80px;
                    width: 400px;
                    max-height: 600px;
                    background: #1a1a1a;
                    border: 1px solid #333;
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.5);
                    z-index: 9000;
                    overflow: hidden;
                    transition: all 0.3s;
                }
                .usta-modu-panel.collapsed {
                    max-height: 40px;
                }
                .usta-modu-panel .panel-header {
                    padding: 10px 15px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .usta-modu-panel .panel-header h3 {
                    margin: 0;
                    font-size: 14px;
                }
                .usta-modu-panel .panel-toggle {
                    background: transparent;
                    border: none;
                    color: white;
                    cursor: pointer;
                    font-size: 18px;
                }
                .usta-modu-panel .panel-content {
                    padding: 15px;
                    max-height: 550px;
                    overflow-y: auto;
                    font-size: 13px;
                    color: #e0e0e0;
                }
                .narration-entry {
                    margin-bottom: 15px;
                    padding: 10px;
                    background: #252525;
                    border-left: 3px solid #667eea;
                    border-radius: 4px;
                }
                .narration-entry .timestamp {
                    font-size: 11px;
                    color: #888;
                    margin-bottom: 5px;
                }
                .narration-entry .phase-badge {
                    display: inline-block;
                    padding: 2px 8px;
                    border-radius: 3px;
                    font-size: 10px;
                    font-weight: bold;
                    margin-right: 8px;
                }
                .phase-badge.before { background: #4CAF50; }
                .phase-badge.after { background: #2196F3; }
                .phase-badge.verify { background: #FF9800; }
            `;
            document.head.appendChild(style);
        }
    }
    
    /**
     * Add narration entry
     * @param {Object} entry - {phase, stepId, timestamp, content}
     */
    addNarration(entry) {
        this.messages.push(entry);
        
        if (!this.panelEl) {
            console.warn('⚠️ Narrator panel not available');
            return;
        }
        
        const contentDiv = this.panelEl.querySelector('.panel-content');
        if (!contentDiv) return;
        
        const { phase, stepId, content, timestamp } = entry;
        const ts = new Date(timestamp || Date.now()).toLocaleTimeString();
        
        const entryDiv = document.createElement('div');
        entryDiv.className = 'narration-entry';
        
        if (phase === 'before') {
            entryDiv.innerHTML = `
                <div class="timestamp">${ts}</div>
                <span class="phase-badge before">BAŞLANGIÇ</span>
                <strong>Step ${stepId}</strong>
                <div style="margin-top: 8px;">
                    <div><strong>🎯 Hedef:</strong> ${content?.goal || 'N/A'}</div>
                    ${content?.rationale ? `<div style="margin-top: 5px;"><strong>🔎 Gerekçe:</strong> ${content.rationale}</div>` : ''}
                    ${content?.tradeoffs ? `<div style="margin-top: 5px;"><strong>↔️ Alternatifler:</strong> ${content.tradeoffs}</div>` : ''}
                    ${content?.checklist && content.checklist.length > 0 ? `
                        <div style="margin-top: 5px;"><strong>✅ Dikkat:</strong></div>
                        <ul style="margin: 5px 0 0 20px; padding: 0;">
                            ${content.checklist.map(item => `<li>${item}</li>`).join('')}
                        </ul>
                    ` : ''}
                </div>
            `;
        } else if (phase === 'after') {
            entryDiv.innerHTML = `
                <div class="timestamp">${ts}</div>
                <span class="phase-badge after">TAMAMLANDI</span>
                <strong>Step ${stepId}</strong>
                <div style="margin-top: 8px;">
                    <div><strong>🧾 Özet:</strong> ${content?.summary || 'İşlem tamamlandı'}</div>
                    ${content?.diff ? `<div style="margin-top: 5px; font-size: 11px; color: #888;">(Diff mevcut)</div>` : ''}
                </div>
            `;
        } else if (phase === 'verify') {
            const probes = content?.probes || [];
            const passed = probes.filter(p => p.status === 'pass').length;
            const total = probes.length;
            
            entryDiv.innerHTML = `
                <div class="timestamp">${ts}</div>
                <span class="phase-badge verify">DOĞRULAMA</span>
                <strong>Step ${stepId}</strong>
                <div style="margin-top: 8px;">
                    <div><strong>✅ Sonuçlar:</strong> ${passed}/${total} başarılı</div>
                    ${probes.length > 0 ? `
                        <ul style="margin: 5px 0 0 20px; padding: 0; font-size: 11px;">
                            ${probes.map(p => `
                                <li>${p.status === 'pass' ? '✓' : '✗'} ${p.type}: ${p.target || p.url || 'N/A'}</li>
                            `).join('')}
                        </ul>
                    ` : ''}
                </div>
            `;
        }
        
        contentDiv.appendChild(entryDiv);
        
        // Auto-scroll to bottom
        contentDiv.scrollTop = contentDiv.scrollHeight;
    }
    
    /**
     * Clear all narrations
     */
    clear() {
        this.messages = [];
        const contentDiv = this.panelEl?.querySelector('.panel-content');
        if (contentDiv) {
            contentDiv.innerHTML = '';
        }
    }
    
    /**
     * Get statistics
     */
    getStats() {
        return {
            totalNarrations: this.messages.length,
            byPhase: {
                before: this.messages.filter(m => m.phase === 'before').length,
                after: this.messages.filter(m => m.phase === 'after').length,
                verify: this.messages.filter(m => m.phase === 'verify').length
            }
        };
    }
}
