# 🎓 USTA MODU - Öğretmen Sistemi Uygulama Planı

## 📊 **3 Fazlı İyileştirme**

```
PHASE 1: Öğretmen Modu (2 saat) → Sistem anlatır
PHASE 2: Kalite Kapıları (3 saat) → Daha iyi kod
PHASE 3: Learning Store (4 saat) → Kalıcı öğrenme
```

---

## 🔴 **PHASE 1: ÖĞRETMEN MODU**

### **Problem:**
- ❌ "Onay verildi, devam ediyorum" (suskunluk)
- ❌ Kodlar neden öyle yazıldı anlaşılmıyor
- ❌ Alternatifler gösterilmiyor
- ❌ Diff görünmüyor

### **Çözüm:**
✅ Her step için zorunlu açıklama
✅ Goal → Rationale → Tradeoffs → Checklist
✅ Before/After anlatımı
✅ Diff visualization

---

## 📝 **1.1: Step Schema Güncelleme**

**Dosya:** `src/renderer/app.js` (veya ayrı types dosyası)

```javascript
// Mevcut step yapısı:
{
  id: "S1",
  tool: "fs.write",
  args: { path: "index.html", content: "..." }
}

// YENİ yapı (explain zorunlu):
{
  id: "S1",
  tool: "fs.write",
  args: { path: "index.html", content: "..." },
  explain: {
    goal: "Blog platform ana sayfası HTML iskeletini oluştur",
    rationale: "Vite entry point olarak index.html gerekir. Root div + script import zorunlu. SEO için meta tags ekledik.",
    tradeoffs: "Alternatif: SPA yerine SSR (Next.js) kullanılabilirdi, ancak basit blog için overhead. Seçim: Client-side rendering, hız öncelikli.",
    checklist: [
      "Root div id='root' olmalı",
      "Script type='module' olmalı",
      "Viewport meta tag zorunlu"
    ],
    showDiff: true  // Diff göster
  },
  verify: ["probe"]
}
```

---

## 📡 **1.2: NarrationBus Events**

**Yeni event tipleri:**

```javascript
// Mevcut event bus'a ekle:
eventBus.emit('NARRATION', {
  phase: 'before',      // before | after | verify
  stepId: 'S1',
  timestamp: Date.now(),
  message: {
    goal: "...",
    rationale: "...",
    tradeoffs: "...",
    checklist: [...]
  }
})

eventBus.emit('NARRATION', {
  phase: 'after',
  stepId: 'S1',
  diff: "...",          // Git-style diff
  summary: "3 files changed, 125 insertions"
})

eventBus.emit('NARRATION', {
  phase: 'verify',
  stepId: 'S1',
  probes: [
    { type: 'file', target: 'index.html', status: 'pass' },
    { type: 'http', url: 'localhost:5173', status: 'pass' }
  ]
})
```

---

## 🎨 **1.3: UI Panel (Usta Modu)**

**Yer:** Sağ sidebar (Timeline yanına)

**Görünüm:**
```
╔══════════════════════════════════════════════════╗
║  🎓 USTA MODU ANLATIMI                           ║
╠══════════════════════════════════════════════════╣
║                                                  ║
║  📍 Step S1: fs.write (index.html)               ║
║                                                  ║
║  🎯 HEDEF:                                       ║
║  Blog platform ana sayfası HTML iskeletini       ║
║  oluştur.                                        ║
║                                                  ║
║  🔎 GEREKÇE:                                     ║
║  Vite entry point olarak index.html gerekir.    ║
║  Root div + script import zorunlu. SEO için     ║
║  meta tags ekledik.                              ║
║                                                  ║
║  ↔️ ALTERNATİFLER:                              ║
║  SPA yerine SSR (Next.js) kullanılabilirdi,     ║
║  ancak basit blog için overhead. Seçim:         ║
║  Client-side rendering, hız öncelikli.          ║
║                                                  ║
║  ✅ DİKKAT LİSTESİ:                             ║
║  ☑️ Root div id='root' olmalı                   ║
║  ☑️ Script type='module' olmalı                 ║
║  ☑️ Viewport meta tag zorunlu                   ║
║                                                  ║
║  ─────────────────────────────────────────────  ║
║                                                  ║
║  🧾 DEĞİŞİKLİKLER:                              ║
║  + client/index.html (42 lines)                 ║
║                                                  ║
║  [Diff'i Göster] [Kopyala]                      ║
║                                                  ║
║  ─────────────────────────────────────────────  ║
║                                                  ║
║  ✅ DOĞRULAMA:                                  ║
║  ✓ File: client/index.html exists               ║
║  ✓ Probe: #root element detected                ║
║                                                  ║
║  ⏱️ Tamamlandı: 0.12s                          ║
╚══════════════════════════════════════════════════╝
```

---

## 💻 **1.4: Kod İmplementasyonu**

### **A) Event Bus Güncelleme**

**Dosya:** `src/renderer/event-bus.js`

```javascript
// Mevcut emit fonksiyonuna ekle:
emit(event) {
  // ... mevcut kod
  
  // Narration events için özel handler
  if (event.type === 'NARRATION') {
    this.handleNarration(event);
  }
}

handleNarration(event) {
  const { phase, stepId, message, diff, probes } = event;
  
  // UI'ya yayınla
  if (window.kodCanavari?.narratorAgent) {
    window.kodCanavari.narratorAgent.addNarration({
      phase,
      stepId,
      timestamp: Date.now(),
      content: phase === 'before' ? message :
               phase === 'after' ? { diff, summary: message } :
               phase === 'verify' ? { probes } : null
    });
  }
  
  // Log
  console.log(`📖 [Narration/${phase}] Step ${stepId}:`, 
    phase === 'before' ? message.goal : message);
}
```

### **B) Step Executor Güncelleme**

**Dosya:** `src/renderer/app.js` → `executeOrderStep()`

```javascript
async executeOrderStep(step) {
  const { id, tool, args, explain, verify } = step;
  
  // 🎓 USTA MODU: Before narration
  if (this.settings?.teachWhileDoing && explain) {
    this.eventBus.emit({
      type: 'NARRATION',
      phase: 'before',
      stepId: id,
      message: {
        goal: explain.goal,
        rationale: explain.rationale,
        tradeoffs: explain.tradeoffs,
        checklist: explain.checklist
      }
    });
  }
  
  // Tool execution (mevcut kod)
  const result = await this.executeToolCall(tool, args);
  
  // 🎓 USTA MODU: After narration (diff)
  if (this.settings?.teachWhileDoing && explain?.showDiff && result?.diff) {
    this.eventBus.emit({
      type: 'NARRATION',
      phase: 'after',
      stepId: id,
      diff: result.diff,
      message: result.summary || '...'
    });
  }
  
  // Verification
  if (verify && verify.length > 0) {
    const probeResults = await this.runVerificationCheck(step, verify);
    
    // 🎓 USTA MODU: Verify narration
    if (this.settings?.teachWhileDoing) {
      this.eventBus.emit({
        type: 'NARRATION',
        phase: 'verify',
        stepId: id,
        probes: probeResults
      });
    }
  }
  
  return result;
}
```

### **C) Policy Check (Explain Zorunlu)**

**Dosya:** `src/renderer/policy-engine.js`

```javascript
canAutoApprove(proposal) {
  // ... mevcut kod
  
  // 🎓 TEACH-WHILE-DOING: Explain check
  if (window.kodCanavari?.settings?.teachWhileDoing) {
    const steps = proposal.operations?.steps || [];
    const missingExplain = steps.filter(s => 
      !s.explain || 
      !s.explain.goal || 
      s.explain.goal.length < 20 ||
      !s.explain.rationale ||
      s.explain.rationale.length < 40
    );
    
    if (missingExplain.length > 0) {
      console.warn('🎓 Teach mode: Steps missing proper explanation:', 
        missingExplain.map(s => s.id));
      return false; // Otomatik onay yok, açıklama zorunlu
    }
  }
  
  return true;
}
```

---

## ⚙️ **1.5: Settings Toggle**

**Dosya:** `src/renderer/app.js` → Constructor

```javascript
constructor() {
  // ... mevcut kod
  
  // 🎓 Öğretmen modu ayarları
  this.settings = {
    teachWhileDoing: localStorage.getItem('teachWhileDoing') !== 'false', // Varsayılan: AÇIK
    codeQualityProfile: localStorage.getItem('codeQualityProfile') || 'professional'
  };
  
  console.log('🎓 Teach-While-Doing:', this.settings.teachWhileDoing ? 'ENABLED' : 'DISABLED');
}
```

**Console Toggle:**

```javascript
// DevTools Console'da çalıştır:
window.toggleTeachMode = function() {
  kodCanavari.settings.teachWhileDoing = !kodCanavari.settings.teachWhileDoing;
  localStorage.setItem('teachWhileDoing', kodCanavari.settings.teachWhileDoing);
  console.log('🎓 Teach-While-Doing:', kodCanavari.settings.teachWhileDoing ? 'ENABLED ✅' : 'DISABLED ❌');
  location.reload();
};

console.log('💡 TIP: Use toggleTeachMode() to enable/disable teacher mode');
```

---

## 🎯 **Test Senaryosu**

### **Before (Şu anki durum):**
```
User: "Blog platformu yap"
  ↓
✅ Başlat butonu → Onay
  ↓
📝 index.html oluşturuluyor...
📝 style.css oluşturuluyor...
📝 script.js oluşturuluyor...
  ↓
✅ PHASE 1 TAMAMLANDI!
```

**Sorun:** Neden öyle yaptı? Alternatifler neydi? Diff nerede?

### **After (Öğretmen modu):**
```
User: "Blog platformu yap"
  ↓
✅ Başlat butonu → Onay
  ↓
🎓 USTA MODU ANLATIMI:
  
  📍 Step S1: fs.write (index.html)
  
  🎯 HEDEF:
  Blog platform ana HTML iskeletini oluştur.
  Vite entry point + SEO ready.
  
  🔎 GEREKÇE:
  Vite, root'ta index.html bekler. <div id="root"> React mount
  noktası. Meta tags: responsive + charset. Script import module
  mode ile HMR desteği sağlar.
  
  ↔️ ALTERNATİFLER:
  1. Next.js SSR → SEO+ ama overhead, basit blog için gereksiz
  2. Static HTML → Hızlı ama interaktif özellik yok
  3. Vite SPA ✅ → Hız + interaktivity dengesi
  
  ✅ DİKKAT:
  ☑️ Root div id='root' (React mount)
  ☑️ Script type='module' (ESM + HMR)
  ☑️ Viewport meta (mobile responsive)
  
  ─────────────────────────────────────────────
  
  🧾 DEĞİŞİKLİKLER:
  + client/index.html (42 lines)
    <!DOCTYPE html>
    <html lang="tr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ...
  
  [Diff'i Göster] [Kopyala]
  
  ─────────────────────────────────────────────
  
  ✅ DOĞRULAMA:
  ✓ File: client/index.html exists
  ✓ Probe: <div id="root"> detected
  ✓ Probe: <script type="module"> found
  
  ⏱️ Tamamlandı: 0.12s
  
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  📍 Step S2: fs.write (vite.config.ts)
  ...
```

**Fark:** Öğreniyor + Anlıyor + Karar verebiliyor!

---

## 📊 **Metrik Takibi**

```javascript
stats.narration = {
  totalNarrations: 45,
  avgExplainLength: 180, // characters
  userFeedback: {
    helpful: 42,
    notHelpful: 3
  },
  teachModeUsage: {
    enabled: 38,
    disabled: 7
  }
}
```

---

## 🚀 **Hızlı Başlangıç (15 dakika)**

1. **Event Bus'a NARRATION handler ekle** (5 dk)
2. **executeOrderStep'e before/after/verify emit ekle** (5 dk)
3. **Console'da toggleTeachMode() ekle** (2 dk)
4. **Test et: "Basit hesap makinesi yap"** (3 dk)

---

## 📋 **Checklist**

- [ ] Event bus NARRATION event type
- [ ] Step schema explain fields
- [ ] executeOrderStep narration emits
- [ ] Policy engine explain validation
- [ ] Settings teachWhileDoing toggle
- [ ] UI panel (opsiyonel, sonra eklenebilir)
- [ ] Console toggleTeachMode()
- [ ] Test: Diff gösterimi
- [ ] Test: Explain validation

---

## 🔮 **Sonraki Adım: PHASE 2**

Öğretmen modu çalışınca → **Kalite Kapıları**:
- TypeScript strict mode zorunlu
- ESLint + Prettier
- Zod validation
- Repository pattern
- Test coverage minimum

**Hedef:** Copilot'tan daha iyi kod! 🎯
