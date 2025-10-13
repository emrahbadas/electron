# 🚀 KayraDeniz Canavar Yükseltme - 3 PR Sprint Plan

## 📊 **Genel Bakış**

ChatGPT-5'in önerdiği 3 PR ile sistemi "canavara" dönüştürme planı.

```
PR-1: Usta Modu (Konuşan AI) - 4 saat
  ↓
PR-2: Güvenlik Kapıları - 3 saat
  ↓
PR-3: Öğrenme Sistemi - 4 saat
  ↓
TOPLAM: 11 saat (2 gün sprint)
```

---

## 🔴 **PR-1: USTA MODU (Konuşan, Öğreten Ajan)**

### **Hedef:**
"Onay verildi" yerine → Her adımı **hedef-gerekçe-alternatif-diff-doğrulama** ile anlatsın.

### **Dosyalar:**
- `src/renderer/app.js` (Step schema + executor)
- `src/renderer/event-bus.js` (NarrationBus)
- `src/renderer/policy-engine.js` (Explain validation)
- `src/renderer/usta-modu-ui.js` (YENİ - UI panel)

### **Görevler:**

#### ✅ **1.1: Step Schema Genişletme** (30 dk)

**Konum:** `src/renderer/app.js` → `executeNightOrders()`

**Değişiklik:**
```javascript
// ÖNCESİ:
{
  id: "S1",
  tool: "fs.write",
  args: { path: "index.html", content: "..." }
}

// SONRASI:
{
  id: "S1",
  tool: "fs.write",
  args: { path: "index.html", content: "..." },
  explain: {
    goal: "Blog platform ana HTML iskeletini oluştur",
    rationale: "Vite entry point olarak index.html gerekir. Root div + script import zorunlu.",
    tradeoffs: "Alternatif: SSR (Next.js) - Seçilmeme nedeni: Basit blog için overhead",
    showDiff: true
  },
  verify: ["probe:file client/index.html", "probe:http http://localhost:5173"]
}
```

**Uygulama:**
```javascript
// Plan prompt'una ekle:
const EXPLAIN_TEMPLATE = `
Her step için explain alanı ZORUNLU:
{
  goal: "Ne yapıyorum? (1 cümle)",
  rationale: "Neden böyle? (teknik detay)",
  tradeoffs: "Alternatifler ve neden seçilmedi",
  showDiff: true/false
}

Örnek:
{
  explain: {
    goal: "Vite config dosyası oluştur",
    rationale: "HMR + proxy ayarları için. Port 5173 default.",
    tradeoffs: "Webpack: daha yavaş build. Parcel: eksik özellik.",
    showDiff: true
  }
}
`;
```

#### ✅ **1.2: NarrationBus Events** (45 dk)

**Konum:** `src/renderer/event-bus.js`

**Yeni Event Tipleri:**
```javascript
// Event Bus'a ekle:
const NARRATION_EVENTS = {
  BEFORE: 'NARRATION_BEFORE',  // Step başlamadan önce
  AFTER: 'NARRATION_AFTER',    // Step tamamlandıktan sonra
  VERIFY: 'NARRATION_VERIFY'   // Probe verification sonrası
};

// Emit örneği:
eventBus.emit({
  type: 'NARRATION_BEFORE',
  stepId: 'S1',
  timestamp: Date.now(),
  explain: {
    goal: "...",
    rationale: "...",
    tradeoffs: "..."
  }
});

eventBus.emit({
  type: 'NARRATION_AFTER',
  stepId: 'S1',
  diff: "...",
  summary: "3 files changed, 125 insertions(+)"
});

eventBus.emit({
  type: 'NARRATION_VERIFY',
  stepId: 'S1',
  probes: [
    { type: 'file', target: 'client/index.html', status: 'pass' },
    { type: 'http', url: 'http://localhost:5173', status: 'pass' }
  ]
});
```

#### ✅ **1.3: Teach-While-Doing Bayrağı** (15 dk)

**Konum:** `src/renderer/app.js` → Constructor

```javascript
constructor() {
  // ... mevcut kod
  
  this.settings = {
    teachWhileDoing: localStorage.getItem('teachWhileDoing') !== 'false', // Default: AÇIK
    developerMode: localStorage.getItem('developerMode') === 'true'
  };
  
  console.log('🎓 Teach-While-Doing:', this.settings.teachWhileDoing ? 'ENABLED' : 'DISABLED');
}

// Console toggle:
window.toggleTeachMode = function() {
  kodCanavari.settings.teachWhileDoing = !kodCanavari.settings.teachWhileDoing;
  localStorage.setItem('teachWhileDoing', kodCanavari.settings.teachWhileDoing);
  console.log('🎓 Teach mode:', kodCanavari.settings.teachWhileDoing ? 'ON' : 'OFF');
  location.reload();
};
```

#### ✅ **1.4: Politika Kuralı (Zorunlu Açıklama)** (20 dk)

**Konum:** `src/renderer/policy-engine.js` → `evaluate()`

```javascript
evaluate(proposal) {
  const { operations } = proposal;
  
  // Teach mode açıksa explain zorunlu
  if (window.kodCanavari?.settings?.teachWhileDoing) {
    const steps = operations?.steps || [];
    const missingExplain = steps.filter(s => 
      !s.explain || 
      !s.explain.goal || s.explain.goal.length < 20 ||
      !s.explain.rationale || s.explain.rationale.length < 40
    );
    
    if (missingExplain.length > 0) {
      return {
        allow: false,
        risk: 'HIGH',
        reason: `Teach mode: ${missingExplain.length} steps missing explain`,
        violations: missingExplain.map(s => ({
          rule: 'EXPLAIN_REQUIRED',
          stepId: s.id,
          message: 'Goal and rationale must be detailed'
        }))
      };
    }
  }
  
  // ... mevcut policy checks
}
```

#### ✅ **1.5: Usta Modu UI Panel** (2 saat)

**YENİ DOSYA:** `src/renderer/usta-modu-ui.js`

```javascript
/**
 * 🎓 USTA MODU UI PANEL
 * 
 * Chat'in üstünde, step-by-step anlatım gösterir
 */

class UstaModuUI {
  constructor() {
    this.container = null;
    this.currentNarrations = [];
    this.init();
  }
  
  init() {
    // Panel container oluştur (Chat'in üstüne)
    this.container = document.createElement('div');
    this.container.id = 'usta-modu-panel';
    this.container.className = 'usta-panel hidden';
    this.container.innerHTML = `
      <div class="usta-header">
        <h3>🎓 Usta Modu Anlatımı</h3>
        <button id="usta-toggle" title="Aç/Kapat">
          <i class="fas fa-chevron-up"></i>
        </button>
      </div>
      <div class="usta-content" id="usta-content"></div>
    `;
    
    // Chat container'dan önce ekle
    const chatContainer = document.querySelector('.chat-container');
    chatContainer.parentNode.insertBefore(this.container, chatContainer);
    
    // Toggle button
    document.getElementById('usta-toggle').addEventListener('click', () => {
      this.container.classList.toggle('collapsed');
    });
    
    // Event listener
    if (window.kodCanavari?.eventBus) {
      window.kodCanavari.eventBus.on('NARRATION_BEFORE', (e) => this.addBefore(e));
      window.kodCanavari.eventBus.on('NARRATION_AFTER', (e) => this.addAfter(e));
      window.kodCanavari.eventBus.on('NARRATION_VERIFY', (e) => this.addVerify(e));
    }
    
    console.log('✅ Usta Modu UI initialized');
  }
  
  show() {
    this.container.classList.remove('hidden');
  }
  
  hide() {
    this.container.classList.add('hidden');
  }
  
  clear() {
    document.getElementById('usta-content').innerHTML = '';
    this.currentNarrations = [];
  }
  
  addBefore(event) {
    const { stepId, explain } = event;
    const html = `
      <div class="narration-step" data-step="${stepId}">
        <div class="step-header">
          <span class="step-id">📍 Step ${stepId}</span>
          <span class="step-phase phase-before">BEFORE</span>
        </div>
        
        <div class="step-goal">
          <strong>🎯 HEDEF:</strong>
          <p>${explain.goal}</p>
        </div>
        
        <div class="step-rationale">
          <strong>🔎 GEREKÇE:</strong>
          <p>${explain.rationale}</p>
        </div>
        
        ${explain.tradeoffs ? `
          <div class="step-tradeoffs">
            <strong>↔️ ALTERNATİFLER:</strong>
            <p>${explain.tradeoffs}</p>
          </div>
        ` : ''}
        
        ${explain.checklist ? `
          <div class="step-checklist">
            <strong>✅ DİKKAT LİSTESİ:</strong>
            <ul>
              ${explain.checklist.map(item => `<li>☑️ ${item}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
        
        <div class="step-separator"></div>
      </div>
    `;
    
    document.getElementById('usta-content').insertAdjacentHTML('beforeend', html);
    this.scrollToBottom();
  }
  
  addAfter(event) {
    const { stepId, diff, summary } = event;
    const stepEl = document.querySelector(`[data-step="${stepId}"]`);
    
    if (stepEl) {
      const html = `
        <div class="step-after">
          <div class="step-header">
            <span class="step-phase phase-after">AFTER</span>
          </div>
          
          <div class="step-changes">
            <strong>🧾 DEĞİŞİKLİKLER:</strong>
            <p>${summary}</p>
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
    const { stepId, probes } = event;
    const stepEl = document.querySelector(`[data-step="${stepId}"]`);
    
    if (stepEl) {
      const html = `
        <div class="step-verify">
          <div class="step-header">
            <span class="step-phase phase-verify">VERIFY</span>
          </div>
          
          <div class="step-probes">
            <strong>✅ DOĞRULAMA:</strong>
            <ul class="probe-list">
              ${probes.map(p => `
                <li class="probe-item probe-${p.status}">
                  ${p.status === 'pass' ? '✓' : '✗'} 
                  ${p.type}: ${p.target || p.url}
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
    content.scrollTop = content.scrollHeight;
  }
  
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Auto-initialize
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    window.ustaModuUI = new UstaModuUI();
  });
}
```

**CSS:** `src/renderer/styles.css`

```css
/* 🎓 USTA MODU PANEL */
.usta-panel {
  position: absolute;
  top: 60px;
  right: 20px;
  width: 400px;
  max-height: calc(100vh - 100px);
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border: 1px solid #4a5568;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  z-index: 999;
  overflow: hidden;
  transition: all 0.3s ease;
}

.usta-panel.hidden {
  display: none;
}

.usta-panel.collapsed .usta-content {
  display: none;
}

.usta-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid #4a5568;
}

.usta-header h3 {
  margin: 0;
  font-size: 14px;
  color: #fbbf24;
}

#usta-toggle {
  background: none;
  border: none;
  color: #9ca3af;
  cursor: pointer;
  font-size: 16px;
  transition: color 0.2s;
}

#usta-toggle:hover {
  color: #fbbf24;
}

.usta-content {
  padding: 16px;
  max-height: calc(100vh - 160px);
  overflow-y: auto;
}

.narration-step {
  margin-bottom: 20px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  border-left: 3px solid #fbbf24;
}

.step-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.step-id {
  font-weight: 600;
  color: #60a5fa;
}

.step-phase {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
}

.phase-before {
  background: #3b82f6;
  color: white;
}

.phase-after {
  background: #10b981;
  color: white;
}

.phase-verify {
  background: #8b5cf6;
  color: white;
}

.step-goal,
.step-rationale,
.step-tradeoffs,
.step-checklist,
.step-changes,
.step-probes {
  margin-bottom: 10px;
}

.step-goal strong,
.step-rationale strong,
.step-tradeoffs strong,
.step-checklist strong,
.step-changes strong,
.step-probes strong {
  display: block;
  margin-bottom: 4px;
  color: #fbbf24;
  font-size: 12px;
}

.step-goal p,
.step-rationale p,
.step-tradeoffs p {
  margin: 0;
  color: #d1d5db;
  font-size: 13px;
  line-height: 1.5;
}

.step-checklist ul {
  margin: 0;
  padding-left: 20px;
  color: #d1d5db;
  font-size: 13px;
}

.step-separator {
  height: 1px;
  background: #4a5568;
  margin: 12px 0;
}

.diff-content {
  background: #0f172a;
  padding: 12px;
  border-radius: 6px;
  overflow-x: auto;
  font-size: 11px;
  color: #e5e7eb;
}

.probe-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.probe-item {
  padding: 6px;
  margin: 4px 0;
  border-radius: 4px;
  font-size: 12px;
}

.probe-pass {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.probe-fail {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.complete-badge {
  display: inline-block;
  padding: 4px 12px;
  background: rgba(16, 185, 129, 0.2);
  color: #10b981;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
}
```

---

### **📊 PR-1 Özet:**

**Değişiklikler:**
- ✅ Step schema genişletildi (explain fields)
- ✅ NarrationBus event sistemi
- ✅ Teach-While-Doing toggle
- ✅ Policy: Explain zorunlu
- ✅ UI: Usta Modu Panel (sağ üst)

**Sonuç:**
```
ÖNCESİ: "Onay verildi, devam ediyorum..."
SONRASI: "🎯 Hedef: ... 🔎 Gerekçe: ... ↔️ Alternatifler: ..."
```

---

## 🟡 **PR-2: APPROVAL GATE + POLICY + PROBE MATRIX**

*(Bir sonraki mesajda devam edelim mi? Çok uzun oldu)*

**Hızlı özet:**
- Approval token (10 dk, tek kullanım)
- Policy: CWD SSOT, cd && yasak, workspace zorunlu
- Probes: file, http, port, lint, test

---

## 🟢 **PR-3: REFLECTION + LEARNING STORE**

**Hızlı özet:**
- learn/reflections.jsonl (FAIL → PASS tracking)
- Pattern injection (plan öncesi)
- Quality gates (TS strict, ESLint, Zod, tests)

---

**Şimdi ne yapalım?**

**A)** PR-1'i hemen uygula (4 saat)
**B)** Detaylı PR-2 planını iste
**C)** Hepsini tek dosyada iste (mega plan)
**D)** İlk olarak console'da test et

Hangisi? 🚀
