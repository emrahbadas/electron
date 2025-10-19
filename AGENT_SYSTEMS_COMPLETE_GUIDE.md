# 🤖 KAYRADENIZ AGENT SYSTEMS - COMPLETE GUIDE

> **Tüm Agent'ların Detaylı Listesi ve Görevleri**  
> **Güncelleme:** 19 Ekim 2025  
> **Durum:** Production + v2.1 Planning

---

## 📊 Agent Hierarchy Overview

```
                    ┌──────────────────────────┐
                    │   USER REQUEST           │
                    └──────────┬───────────────┘
                               │
                    ┌──────────▼───────────────┐
                    │  ROUTER AGENT            │
                    │  (Intent Recognition)    │
                    └──────────┬───────────────┘
                               │
                    ┌──────────▼───────────────┐
                    │  LUMA SUPREME AGENT      │
                    │  (Planning & Strategy)   │
                    └──────────┬───────────────┘
                               │
                    ┌──────────▼───────────────┐
                    │  NIGHT ORDERS JSON       │
                    │  (Mission Protocol)      │
                    └──────────┬───────────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
    ┌─────────▼────────┐ ┌────▼─────┐ ┌────────▼────────┐
    │  TOOL BRIDGE     │ │ NARRATOR │ │ APPROVAL SYSTEM │
    │  (Execution)     │ │ (Teaching)│ │ (Safety Gate)   │
    └─────────┬────────┘ └──────────┘ └─────────────────┘
              │
    ┌─────────▼────────┐
    │  REFLEXION       │
    │  (Self-Analysis) │
    └─────────┬────────┘
              │
    ┌─────────▼────────┐
    │  REFLEXION       │
    │  APPLIER         │
    │  (Auto-Fix)      │
    └──────────────────┘
```

---

## 1. 🧠 LUMA SUPREME AGENT

### Dosya Konumu
- `src/agents/luma-supreme-agent.js`

### Görev
**"Proje Mimarı"** - Kullanıcı isteğini anlar ve Night Orders JSON oluşturur.

### Sorumluluklar
```javascript
✅ Intent Analysis (İstek Analizi)
   - "Blog platformu" → Full-stack project
   - "Oyun yap" → Game project with assets
   
✅ Architecture Planning (Mimari Planlama)
   - Multi-phase proje mi? (9+ dosya)
   - Single-phase yeterli mi? (1-8 dosya)
   
✅ Night Orders Generation (Mission Oluşturma)
   - mission: "Tek cümle hedef"
   - acceptance: ["build: exit 0", "lint: pass"]
   - steps: [{tool, args, explain, verify}]
   
✅ Verification Strategy (Doğrulama Stratejisi)
   - Hangi adımda lint çalışacak?
   - Build hangi adımda olacak?
   - Probe (UI test) gerekli mi?
```

### Örnek Çıktı
```json
{
  "mission": "Create React blog with Firebase backend",
  "acceptance": ["build: exit 0", "probe: .post-list exists"],
  "steps": [
    {
      "id": "S1",
      "tool": "fs.write",
      "args": {"path": "package.json", "content": "..."},
      "explain": {
        "goal": "Initialize React project with Vite bundler",
        "rationale": "Vite provides faster builds than webpack for modern React"
      },
      "verify": ["lint"]
    }
  ]
}
```

### AI Provider
- **Primary**: OpenAI GPT-4o
- **Fallback**: Claude 3.5 Sonnet
- **Budget Mode**: Gemini 2.0 Flash

---

## 2. 🧭 ROUTER AGENT

### Dosya Konumu
- `src/agents/router-agent.js`

### Görev
**"İlk Kapı"** - Kullanıcı isteğini kategorize eder ve doğru agent'a yönlendirir.

### Sorumluluklar
```javascript
✅ Intent Classification
   "Basit hesap makinesi" → SIMPLE_PROJECT
   "E-ticaret sitesi" → COMPLEX_PROJECT
   "Kodu düzelt" → CODE_FIX
   "Soru sor" → QUESTION

✅ Routing Decision
   SIMPLE_PROJECT → Luma Supreme Agent
   COMPLEX_PROJECT → Multi-Phase Luma
   CODE_FIX → Reflexion System
   QUESTION → Direct AI Response

✅ Context Preparation
   - Workspace bilgisi toplar
   - Mevcut dosyaları listeler
   - User history kontrol eder
```

### Karar Ağacı
```javascript
if (userRequest.includes("yap") || userRequest.includes("create")) {
    if (estimatedFiles > 9) {
        return "MULTI_PHASE_PROJECT";
    } else {
        return "SINGLE_PHASE_PROJECT";
    }
} else if (userRequest.includes("düzelt") || userRequest.includes("fix")) {
    return "CODE_FIX";
} else {
    return "QUESTION";
}
```

---

## 3. 🎯 NIGHT ORDERS EXECUTOR

### Dosya Konumu
- `src/renderer/app.js` (executeOrderStep method)

### Görev
**"Çalıştırıcı"** - Night Orders JSON'daki her step'i sırayla execute eder.

### Sorumluluklar
```javascript
✅ Step Execution
   - step.tool → Tool Bridge'e gönder
   - Sonucu bekle
   - Hata varsa yakala

✅ Event Emission
   - NARRATION_BEFORE (Adım başlamadan önce)
   - NARRATION_AFTER (Adım bittikten sonra)
   - NARRATION_VERIFY (Doğrulama sonucu)

✅ Error Handling
   - Tool başarısız → Reflexion'a gönder
   - 3 deneme → Circuit breaker devreye
```

### Execution Flow
```javascript
for (const step of nightOrders.steps) {
    // 1. Usta Modu'na bildir
    eventBus.emit('NARRATION_BEFORE', step);
    
    // 2. Tool Bridge ile execute et
    const result = await toolBridge.executeTool(step.tool, step.args);
    
    // 3. Sonucu narrate et
    eventBus.emit('NARRATION_AFTER', {step, result});
    
    // 4. Verify yap
    const verifyResult = await this.verify(step.verify);
    eventBus.emit('NARRATION_VERIFY', verifyResult);
}
```

---

## 4. 🔧 TOOL BRIDGE

### Dosya Konumu
- `src/agents/tool-bridge.js`

### Görev
**"Eller"** - Agent kararlarını fiziksel dosya/terminal işlemlerine çevirir.

### Sorumluluklar
```javascript
✅ Tool Execution (12 tool destekli)
   fs.read, fs.write, fs.exists, fs.delete
   terminal.exec, http.get
   fs.multiEdit (multi-file edit)

✅ Tool Aliasing
   fs.readFile → fs.read
   fs.writeFile → fs.write
   terminal.run → terminal.exec

✅ Path Resolution
   Relative path → Absolute path
   CWD preservation

✅ Execution Logging
   Her işlemi kaydet
   Debugging için getLog()
```

### Supported Tools
| Tool | Açıklama | Örnek |
|------|----------|-------|
| `fs.read` | Dosya oku | `{path: "package.json"}` |
| `fs.write` | Dosya yaz | `{path: "index.js", content: "..."}` |
| `fs.exists` | Dosya var mı? | `{path: "src/app.js"}` |
| `fs.delete` | Dosya sil | `{path: "old.txt"}` |
| `terminal.exec` | Komut çalıştır | `{cmd: "npm install"}` |
| `http.get` | HTTP isteği | `{url: "https://api.github.com"}` |
| `fs.multiEdit` | Çoklu dosya edit | `{edits: [{path, content}]}` |

### Kullanım
```javascript
// Console'dan test
await window.toolBridge.executeTool('fs.write', {
    path: 'test.txt',
    content: 'Hello World'
});

// Desteklenen tool'ları gör
window.toolBridge.getSupportedTools();

// Execution history
window.toolBridge.getLog();
```

---

## 5. 🔄 REFLEXION SYSTEM

### Dosya Konumu
- `src/agents/reflexion-agent.js`

### Görev
**"İç Eleştirmen"** - Oluşturulan kodu analiz eder ve hata bulur.

### Sorumluluklar
```javascript
✅ Code Analysis
   - Placeholder detection
   - README quality check
   - Build errors analysis
   - Logic completeness

✅ Issue Detection
   CRITICAL: Placeholder content in files
   MAJOR: README < 500 chars
   MINOR: Missing comments

✅ Fix Suggestions
   {
     "type": "UPDATE_FILE",
     "path": "src/app.js",
     "reason": "Contains placeholder // TODO",
     "suggestedContent": "// Real implementation"
   }
```

### Detection Rules
```javascript
// Placeholder Patterns (STRICT)
const placeholders = [
    /\/\/\s*\.\.\..*mantık/i,        // // ... mantığı
    /\/\/\s*buraya\s+gelecek/i,      // // buraya gelecek
    /<GÜNCELLE>/,                     // <GÜNCELLE>
    /TODO/i,                          // TODO
    /PLACEHOLDER/i                    // PLACEHOLDER
];

// README Quality
if (readme.length < 500) {
    issues.push({
        severity: "MAJOR",
        message: "README too short, needs examples"
    });
}
```

### Output Format
```json
{
  "analysis": "Code has 2 placeholders and weak README",
  "issues": [
    {
      "severity": "CRITICAL",
      "file": "src/utils.js",
      "line": 42,
      "message": "Contains placeholder comment"
    }
  ],
  "suggestedFixes": [
    {
      "type": "UPDATE_FILE",
      "path": "src/utils.js",
      "reason": "Replace placeholder with real logic",
      "suggestedContent": "function calculate() { return x + y; }"
    }
  ]
}
```

---

## 6. 🩹 REFLEXION APPLIER

### Dosya Konumu
- `src/agents/reflexion-applier.js`

### Görev
**"Oto-Tamirci"** - Reflexion System'in önerdiği fix'leri otomatik uygular.

### Sorumluluklar
```javascript
✅ Fix Execution (9 fix type)
   UPDATE_FILE, CREATE_FILE, DELETE_FILE
   DELETE_FOLDER, CREATE_FOLDER, MKDIR
   RUN_COMMAND, EXEC
   RENAME_FILE, MOVE_FILE

✅ Circuit Breaker
   - Aynı fix 3 kez denenirse → STOP
   - Infinite loop prevention

✅ Tool Bridge Integration
   - Her fix'i Tool Bridge ile execute eder
   - Sonuçları track eder
```

### Fix Types
```javascript
switch (fix.type) {
    case 'UPDATE_FILE':
        await toolBridge.executeTool('fs.write', {
            path: fix.path,
            content: fix.suggestedContent
        });
        break;
        
    case 'DELETE_FOLDER':
        await toolBridge.executeTool('fs.delete', {
            path: fix.path,
            recursive: true
        });
        break;
        
    case 'RUN_COMMAND':
        await toolBridge.executeTool('terminal.exec', {
            cmd: fix.command
        });
        break;
}
```

### Circuit Breaker Logic
```javascript
// Fix key: "UPDATE_FILE:/src/app.js"
const fixKey = `${fix.type}:${fix.path || fix.command}`;

if (this.circuitBreaker[fixKey] >= 3) {
    console.warn(`🚫 Circuit breaker! Fix attempted 3 times: ${fixKey}`);
    return {success: false, reason: 'Circuit breaker triggered'};
}

this.circuitBreaker[fixKey]++;
```

---

## 7. 👨‍🏫 NARRATOR AGENT (Usta Modu)

### Dosya Konumu
- `src/agents/narrator-agent.js`

### Görev
**"AI Öğretmen"** - Her adımı Türkçe açıklar, gerçek zamanlı eğitim verir.

### Sorumluluklar
```javascript
✅ Step Explanation
   "Şimdi package.json dosyası oluşturuyoruz..."
   "Bu adımda React bileşenlerini tanımlıyoruz..."

✅ Rationale Teaching
   "Neden Vite kullanıyoruz? Çünkü webpack'ten 10x hızlı..."

✅ Verification Narration
   "✅ Lint kontrolü başarılı - Kod temiz!"
   "⚠️ Build hatası - Şimdi düzeltelim..."

✅ Real-time UI Updates
   Usta Modu panel'inde canlı mesajlar
```

### Event Listeners
```javascript
eventBus.on('NARRATION_BEFORE', (step) => {
    const message = `📝 **Adım ${step.id}**: ${step.explain.goal}`;
    this.addNarration(message);
});

eventBus.on('NARRATION_AFTER', ({step, result}) => {
    const message = `✅ **Tamamlandı**: ${step.explain.goal}`;
    this.addNarration(message);
});

eventBus.on('NARRATION_VERIFY', (verifyResult) => {
    if (verifyResult.success) {
        this.addNarration('✅ Doğrulama başarılı!');
    } else {
        this.addNarration(`⚠️ Sorun: ${verifyResult.error}`);
    }
});
```

---

## 8. 🛡️ APPROVAL SYSTEM (Elysion Chamber)

### Dosya Konumu
- `src/agents/approval-system.js`

### Görev
**"Güvenlik Kapısı"** - Kritik işlemler için kullanıcı onayı alır.

### Sorumluluklar
```javascript
✅ Permission Gating
   File deletion → Approval required
   npm install → Approval required
   Critical file edit → Approval required

✅ Developer Mode Bypass
   if (developerMode) → Auto-approve

✅ UI Integration
   Elysion Chamber modal göster
   User click → Continue / Abort
```

### Approval Flow
```javascript
async function requestApproval(operation) {
    if (this.developerMode) {
        return {approved: true, reason: 'Developer mode'};
    }
    
    // Show modal
    const modal = document.getElementById('elysion-chamber');
    modal.classList.add('visible');
    
    // Wait for user
    return new Promise((resolve) => {
        modal.addEventListener('approve', () => resolve({approved: true}));
        modal.addEventListener('reject', () => resolve({approved: false}));
    });
}
```

---

## 9. 📚 LEARNING STORE AGENT

### Dosya Konumu
- `src/ai/learning-store.js`

### Görev
**"Hafıza"** - Başarılı projeleri kaydeder ve pattern öğrenir.

### Sorumluluklar
```javascript
✅ Pattern Storage
   - Successful Night Orders kaydedilir
   - Project type ile tag'lenir

✅ Pattern Retrieval
   - Similar project var mı?
   - Past fixes kullanılabilir mi?

✅ Success Tracking
   - Build successful → Pattern +1 success
   - Build failed → Pattern +1 failure
```

### Storage Format
```json
{
  "projectType": "blog-platform",
  "nightOrders": { ... },
  "successCount": 5,
  "failureCount": 0,
  "lastUsed": "2025-10-19T10:30:00Z",
  "tags": ["react", "firebase", "authentication"]
}
```

---

## 10. 🎮 MULTI-AGENT COORDINATOR

### Dosya Konumu
- `src/agents/multi-agent-coordinator.js`

### Görev
**"Orkestra Şefi"** - Birden fazla agent'ı koordine eder.

### Sorumluluklar
```javascript
✅ Agent Orchestration
   Router → Luma → Tool Bridge → Reflexion

✅ State Management
   - currentPhase tracking
   - completedFiles tracking
   - Agent states

✅ Phase Transitions
   Phase 1 → Skeleton files
   Phase 2 → Backend implementation
   Phase 3 → Frontend implementation
```

### Coordination Logic
```javascript
async function coordinateProject(userRequest) {
    // 1. Route intent
    const intent = await routerAgent.analyze(userRequest);
    
    // 2. Generate plan
    const nightOrders = await lumaAgent.createPlan(intent);
    
    // 3. Execute steps
    for (const step of nightOrders.steps) {
        await executor.executeStep(step);
    }
    
    // 4. Analyze results
    const analysis = await reflexionAgent.analyze();
    
    // 5. Apply fixes
    if (analysis.suggestedFixes.length > 0) {
        await reflexionApplier.applyFixes(analysis.suggestedFixes);
    }
}
```

---

## 🚀 v2.1 YENI AGENT'LAR (Planned)

### 11. 🧠 ADAPTIVE REFLEXION MEMORY AGENT
```javascript
// Weighted pattern learning
score = pattern.count + fix.successRate + context.similarity
```

### 12. 🔁 CONTEXT REPLAY ENGINE AGENT
```javascript
// Smart project matching
if (similarity > 0.75) recallPreviousFixes()
```

### 13. 🎨 COGNITIVE DIVERGENCE AGENT
```javascript
// Balance stability vs novelty
if (similarity > 0.8 && known) reusePattern()
else exploreNewWithGuidance()
```

### 14. 🤔 SELF-DIVERGENCE PROTOCOL AGENT
```javascript
// Internal questioning
"Bu proje geçmişe ne kadar benziyor?"
"Benzerlik amaca hizmet ediyor mu?"
```

---

## 📊 Agent Communication Flow

```
USER REQUEST
    │
    ▼
ROUTER AGENT (Classify)
    │
    ▼
LUMA SUPREME AGENT (Plan)
    │
    ▼
NIGHT ORDERS JSON
    │
    ├──→ NARRATOR AGENT (Explain to user)
    │
    ▼
NIGHT ORDERS EXECUTOR
    │
    ▼
TOOL BRIDGE (Physical execution)
    │
    ├──→ APPROVAL SYSTEM (Ask permission)
    │
    ▼
REFLEXION SYSTEM (Analyze)
    │
    ▼
REFLEXION APPLIER (Auto-fix)
    │
    ▼
LEARNING STORE (Save pattern)
    │
    ▼
PROJECT COMPLETE ✅
```

---

## 🎯 Agent Sorumluluklarının Özeti

| Agent | Rol | Temel Görev | Çıktı |
|-------|-----|-------------|-------|
| **Router** | Classifier | İstek kategorize | Intent type |
| **Luma Supreme** | Architect | Proje planla | Night Orders JSON |
| **Executor** | Runner | Adımları çalıştır | Execution results |
| **Tool Bridge** | Hands | Fiziksel işlemler | File/terminal operations |
| **Reflexion** | Critic | Kod analiz et | Issues + Fix suggestions |
| **Reflexion Applier** | Fixer | Fix'leri uygula | Applied fixes |
| **Narrator** | Teacher | Türkçe açıkla | Real-time narration |
| **Approval** | Gatekeeper | Onay al | User permission |
| **Learning Store** | Memory | Pattern kaydet | Stored patterns |
| **Multi-Agent Coordinator** | Conductor | Agent'ları yönet | Orchestration state |

---

## 🔍 Debugging Agent'lar

### Console Commands
```javascript
// Tool Bridge
window.toolBridge.getSupportedTools()
window.toolBridge.getLog()

// Reflexion Applier
window.reflexionApplier.getHistory()
window.reflexionApplier.getCircuitBreakerStatus()

// Learning Store
window.learningStore.getPatterns()
window.learningStore.findSimilar('blog-platform')

// Kod Canavarı (Main)
window.kodCanavari.getDeveloperMode()
window.kodCanavari.getPhaseContext()
```

---

## 📚 Daha Fazla Bilgi

- **Full Architecture**: `MASTER_ARCHITECTURE_GUIDE.md`
- **v2.1 Evolution**: `LUMA_V2_1_ADAPTIVE_EVOLUTION_PLAN.md`
- **Tool Bridge**: `TOOL_BRIDGE_IMPLEMENTATION.md`
- **Code Style**: `agent-style-guide.md`

---

**Son Güncelleme:** 19 Ekim 2025  
**Durum:** ✅ 10 Agent Production Ready | 🚧 4 Agent v2.1 Planning
