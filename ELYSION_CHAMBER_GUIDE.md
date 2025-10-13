# 🐉 Elysion Chamber Light - Complete Guide

> **Autonomous Agent Safety System with Token-Gated Execution**

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Components](#components)
4. [Workflow](#workflow)
5. [Security Model](#security-model)
6. [Usage Examples](#usage-examples)
7. [Configuration](#configuration)
8. [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

**Elysion Chamber Light** is a comprehensive safety system for autonomous AI agents that:

- ✅ **Prevents unauthorized operations** via token-gated execution
- ✅ **Validates commands** with policy engine before execution
- ✅ **Requires user approval** for all critical operations
- ✅ **Provides live commentary** in Turkish (Usta Anlatımı)
- ✅ **Auto-fixes failures** using CriticAgent with 7 failure patterns
- ✅ **Validates results** with ProbeMatrix after execution

### 🔑 Key Features

| Feature | Description | Phase |
|---------|-------------|-------|
| **Approval System** | Modal-based user approval with 60s timeout | Phase 1 |
| **Policy Engine** | Rule-based validation (8 rules, 4 critical) | Phase 1 |
| **Event Bus** | Centralized event emission for audit trail | Phase 1 |
| **Probe Matrix** | Post-execution validation system | Phase 2 |
| **Elysion UI** | Beautiful approval modal + probe results + narrator panel | Phase 3 |
| **Narrator Agent** | Real-time Turkish commentary (2s polling) | Phase 4 |
| **Critic Agent** | Automatic failure analysis + fix generation | Phase 5 |
| **Token-Gated Execution** | No execution without valid approval token | Phase 6 |

---

## 🏗️ Architecture

> **📌 NOT:** Aşağıdaki diyagram "Python hesap makinesi yap" örneğini kullanıyor, ancak sistem **HER TÜRLÜ İSTEK** için aynı şekilde çalışır (blog platformu, todo app, API, oyun, vs.). "Hesap makinesi" sadece akışı göstermek için örnek bir senaryodur.

```
┌─────────────────────────────────────────────────────────────┐
│                    USER REQUEST                              │
│          "Python hesap makinesi yap" (ÖRNEK)                 │
│     (Herhangi bir istek olabilir: blog, todo, API, vs.)     │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────────┐
│                   ROUTER AGENT                                │
│              Intent Analysis + Role Selection                 │
└───────────────────────────┬───────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────────┐
│                   ANALYZER AGENT                              │
│              Generate execution plan (orders.json)            │
└───────────────────────────┬───────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────────┐
│   🔐 POLICY ENGINE                                            │
│   ├─ Command validation                                       │
│   ├─ Risk assessment                                          │
│   └─ Violation detection → BLOCK if critical                  │
└───────────────────────────┬───────────────────────────────────┘
                            │
                   ┌────────┴────────┐
                   │   BLOCKED?      │
                   └────┬───────┬────┘
                        │       │
                   YES  │       │ NO
                        │       │
                        ▼       ▼
                    ❌ STOP   Continue
                                │
                                ▼
┌───────────────────────────────────────────────────────────────┐
│   🔐 APPROVAL SYSTEM                                          │
│   ├─ Show proposal modal                                      │
│   ├─ User clicks "Approve" or "Deny"                          │
│   ├─ 60-second timeout                                        │
│   └─ Generate single-use token                                │
└───────────────────────────┬───────────────────────────────────┘
                            │
                   ┌────────┴────────┐
                   │   APPROVED?     │
                   └────┬───────┬────┘
                        │       │
                   NO   │       │ YES
                        │       │
                        ▼       ▼
                    ❌ STOP   🔑 TOKEN
                                │
                                ▼
┌───────────────────────────────────────────────────────────────┐
│   ⚙️ EXECUTION ENGINE                                         │
│   ├─ Validate token                                           │
│   ├─ Consume token (single-use)                               │
│   ├─ Execute steps with event emission                        │
│   │   └─ START_STEP, WRITE_FILE, RUN_CMD, STEP_RESULT        │
│   └─ On failure → CriticAgent                                 │
└───────────────────────────┬───────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────────┐
│   📡 NARRATOR AGENT (Parallel)                                │
│   ├─ Poll EventBus every 2 seconds                            │
│   ├─ Convert events → Turkish commentary                      │
│   └─ Display in Narrator Panel                                │
└───────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────────┐
│   🔍 PROBE MATRIX                                             │
│   ├─ Run validation probes                                    │
│   ├─ FILE_EXISTS, PROCESS_SUCCESS checks                      │
│   └─ Show results in modal                                    │
└───────────────────────────┬───────────────────────────────────┘
                            │
                   ┌────────┴────────┐
                   │   PROBES PASS?  │
                   └────┬───────┬────┘
                        │       │
                   NO   │       │ YES
                        │       │
                        ▼       ▼
                 🔬 CRITIC   ✅ SUCCESS
                    AGENT
                    AUTO-FIX
```

---

## 🧩 Components

### 1️⃣ Approval System (`approval-system.js`)

**Purpose:** Gate-keeper that blocks all operations until user approval.

**Key Methods:**
- `requestApproval(proposal)` → Shows modal, returns `{ approved, token, reason }`
- `approveProposal(id)` → User clicked "Approve", generates token
- `denyProposal(id, reason)` → User clicked "Deny", rejects promise
- `validateToken(token)` → Checks if token is valid
- `useToken(token)` → Marks token as used (single-use)

**Token Format:**
```javascript
{
  id: 'approval_1697123456789',
  token: 'tok_abc123xyz789',
  createdAt: 1697123456789,
  expiresAt: 1697123516789, // +60 seconds
  used: false
}
```

**Timeout:** 60 seconds (auto-deny if no response)

---

### 2️⃣ Policy Engine (`policy-engine.js`)

**Purpose:** Pre-execution validation with 8 rules (4 critical).

**Rules:**

| Rule | Type | Description | Action |
|------|------|-------------|--------|
| `NO_RM_RF` | CRITICAL | Blocks `rm -rf` commands | BLOCK |
| `NO_SYSTEM_DELETE` | CRITICAL | Blocks system folder deletion | BLOCK |
| `NO_SUDO` | CRITICAL | Blocks sudo commands | BLOCK |
| `CONFIRM_LARGE_DELETE` | CRITICAL | Warns for bulk deletions | REQUIRE_APPROVAL |
| `WARN_GIT_FORCE` | WARNING | Warns for `git push --force` | WARN |
| `SAFE_NPM_INSTALL` | INFO | Info on `npm install` | INFO |
| `WARN_ENV_FILE` | WARNING | Warns on `.env` modifications | WARN |
| `LIMIT_FILE_SIZE` | WARNING | Warns for files >10MB | WARN |

**Validation Result:**
```javascript
{
  canProceed: true/false,
  violations: [
    {
      rule: 'NO_RM_RF',
      severity: 'critical',
      message: 'Dangerous command detected: rm -rf',
      blocksExecution: true
    }
  ],
  warnings: [ /* non-blocking issues */ ]
}
```

---

### 3️⃣ Event Bus (`event-bus.js`)

**Purpose:** Centralized event system for audit trail and narrator.

**Event Types:**

| Event | When Emitted | Data |
|-------|--------------|------|
| `TASK_START` | User request received | `{ task }` |
| `POLICY_CHECK_PASS` | Policy validation passed | `{ policy, command }` |
| `POLICY_VIOLATION` | Policy blocked operation | `{ policy, command }` |
| `APPROVAL_REQUEST` | Approval modal shown | `{ proposal }` |
| `APPROVAL_GRANTED` | User approved | `{ token, proposal }` |
| `APPROVAL_DENIED` | User denied | `{ reason }` |
| `EXECUTION_START` | Execution started | `{ totalSteps }` |
| `START_STEP` | Step started | `{ step }` |
| `WRITE_FILE` | File write operation | `{ file, content }` |
| `RUN_CMD` | Command execution | `{ cmd, cwd }` |
| `STEP_RESULT` | Step completed | `{ step, result }` |
| `ERROR` | Step failed | `{ step, error }` |
| `PROBE_RESULTS` | Validation complete | `{ results }` |
| `EXECUTION_COMPLETE` | All steps done | `{ success }` |

**Methods:**
- `emit(event)` → Emit event to all listeners
- `on(eventType, handler)` → Subscribe to event type
- `readSince(timestamp)` → Get events since timestamp (for narrator)
- `getAllEvents()` → Get all events (for debugging)

---

### 4️⃣ Probe Matrix (`probe-matrix.js`)

**Purpose:** Post-execution validation system.

**Probe Types:**

| Type | Description | Implementation |
|------|-------------|----------------|
| `FILE_EXISTS` | Check if file was created | `fs.existsSync(target)` |
| `PROCESS_SUCCESS` | Check last command exit code | `exitCode === 0` |
| `HTTP_ENDPOINT` | Check if server is running | `fetch(url).status === 200` |
| `PORT_LISTENING` | Check if port is open | `net.connect(port)` |

**Result Format:**
```javascript
{
  total: 3,
  passed: 2,
  failed: 1,
  results: [
    {
      type: 'FILE_EXISTS',
      target: 'calculator.py',
      description: 'Verify calculator.py was created',
      passed: true,
      message: 'File exists'
    },
    {
      type: 'FILE_EXISTS',
      target: 'main.py',
      description: 'Verify main.py was created',
      passed: false,
      message: 'File not found'
    }
  ]
}
```

---

### 5️⃣ Narrator Agent (`narrator-agent.js`)

**Purpose:** Convert technical events → Turkish educational commentary.

**Polling Interval:** 2 seconds

**Event → Message Mapping:**

| Event Type | Turkish Message | Icon |
|------------|-----------------|------|
| `START_STEP` | "🎯 Şimdi '{title}' adımına başlıyorum. Amacım: {intent}" | 🎯 |
| `WRITE_FILE` | "📝 `{filename}` dosyasını yazıyorum." | 📝 |
| `RUN_CMD` | "⚙️ Komutu çalıştırıyorum: `{cmd}`" | ⚙️ |
| `PROBE_FILE` | "✅ Dosya kontrolü başarılı: `{file}`" | ✅ |
| `STEP_RESULT` | "🎉 '{title}' başarıyla tamamlandı!" | 🎉 |
| `APPROVAL_REQUEST` | "🔐 Onay bekliyorum..." | 🔐 |
| `POLICY_VIOLATION` | "🔴 Politika uyarısı: {message}" | 🔴 |
| `ERROR` | "❌ Hata oluştu: {message}. Çözüm arıyorum..." | ❌ |

**Example Output:**
```
[12:34:56] 🎯 Şimdi 'Create calculator files' adımına başlıyorum. Amacım: Build Python calculator with GUI

[12:34:57] 📝 calculator.py dosyasını yazıyorum.

[12:34:58] 📝 main.py dosyasını yazıyorum.

[12:35:00] ✅ Dosya kontrolü başarılı: calculator.py

[12:35:01] 🎉 'Create calculator files' başarıyla tamamlandı!
```

---

### 6️⃣ Critic Agent (`critic-agent.js`)

**Purpose:** Automatic failure analysis + minimal fix generation.

**7 Failure Patterns:**

| Pattern | Regex | Fix Action |
|---------|-------|------------|
| `MODULE_NOT_FOUND` | `/ModuleNotFoundError\|cannot find module/i` | `npm install {module}` → retry |
| `FILE_NOT_FOUND` | `/ENOENT/` | `fs.writeFile({path})` → retry |
| `PORT_IN_USE` | `/EADDRINUSE/` | `kill process` → retry |
| `PERMISSION_DENIED` | `/EPERM/` | `chmod +x` → retry |
| `SYNTAX_ERROR` | `/SyntaxError/` | `lint check` → fix → retry |
| `VITE_ENTRY_ERROR` | `/could not resolve entry/` | `create index.html` → retry |
| `NETWORK_TIMEOUT` | `/ETIMEDOUT/` | `retry with backoff` |

**Analysis Flow:**

1. **Rule-Based (Fast):** Match stderr against 7 patterns
2. **LLM-Based (Fallback):** Send failure context to LLM for complex issues
3. **Fix Plan:** Generate step-by-step fix actions
4. **Execute Fix:** Apply fixes automatically
5. **Retry:** Re-run failed operation

**Fix Plan Example:**
```javascript
{
  rootCause: "Missing dependency: tkinter",
  fixPlan: [
    {
      tool: 'npm.install',
      args: { package: 'tkinter' },
      reason: 'Install missing Python tkinter module'
    },
    {
      tool: 'retry',
      args: { delay: 1000 },
      reason: 'Re-run command after installing dependency'
    }
  ]
}
```

**Statistics:**
```javascript
{
  totalAnalyses: 12,
  successfulFixes: 9,
  failedFixes: 3,
  successRate: 0.75, // 75%
  patternMatches: {
    MODULE_NOT_FOUND: 5,
    FILE_NOT_FOUND: 2,
    PORT_IN_USE: 1,
    SYNTAX_ERROR: 1
  },
  llmAnalyses: 3
}
```

---

## 🔄 Workflow

### Complete Request Flow

```javascript
// User sends request
kodCanavari.sendMessage("Python hesap makinesi yap GUI ile");

// 1️⃣ ROUTER AGENT: Analyze intent
const route = await routeUserIntent(userRequest);
// → { role: 'generator', confidence: 0.8 }

// 2️⃣ ANALYZER AGENT: Generate plan
const analysis = await analyzeUserRequest(userRequest, route);
// → { plannedActions: [...], orders: {...} }

// 3️⃣ POLICY ENGINE: Validate command
const policyResult = policyEngine.validate({
  command: analysis.plannedActions[0].command,
  cwd: process.cwd()
});

if (!policyResult.canProceed) {
  // ❌ BLOCKED BY POLICY
  console.error('BLOCKED:', policyResult.violations[0].message);
  return;
}

// 4️⃣ APPROVAL SYSTEM: Request user approval
const proposal = {
  step: { id: 1, title: 'Create calculator', intent: userRequest },
  commands: ['python main.py'],
  files: ['calculator.py', 'main.py'],
  risks: [{ level: 'LOW', message: 'Standard operations' }],
  probes: [{ type: 'FILE_EXISTS', target: 'calculator.py' }]
};

const approval = await approvalSystem.requestApproval(proposal);
// → Shows modal, user clicks "Approve"
// → { approved: true, token: 'tok_abc123' }

if (!approval.approved) {
  // ❌ USER DENIED
  console.log('User denied:', approval.reason);
  return;
}

// 5️⃣ EXECUTION: Run with token
const approvalToken = approval.token;

// Validate token
if (!approvalSystem.validateToken(approvalToken)) {
  console.error('Invalid token!');
  return;
}

// Execute steps
for (const action of analysis.plannedActions) {
  // Emit event
  eventBus.emit({ type: 'START_STEP', step: action });
  
  // Use token (first step only, single-use)
  if (i === 0) {
    approvalSystem.useToken(approvalToken);
  }
  
  try {
    await executeAction(action);
    eventBus.emit({ type: 'STEP_RESULT', step: action, result: 'PASS' });
  } catch (error) {
    // ❌ FAILURE → CriticAgent
    const analysis = await criticAgent.analyze({ step: action, stderr: error.message });
    const fixResult = await criticAgent.executeFix(analysis.fixPlan);
    
    if (fixResult.success) {
      // Retry after fix
      await executeAction(action);
    }
  }
}

// 6️⃣ PROBE MATRIX: Validate results
const probeResults = await probeMatrix.runProbes(proposal.probes);
elysionUI.showProbeResults(probeResults);
// → { total: 2, passed: 2, failed: 0 }

// ✅ SUCCESS
console.log('Mission complete!');
```

---

## 🔐 Security Model

### Token-Gated Execution

**Key Principles:**

1. **No Token = No Execution**
   - All operations require valid approval token
   - Token generated only after user clicks "Approve"

2. **Single-Use Tokens**
   - Token consumed on first execution step
   - Marked as `used: true` → Cannot be reused

3. **60-Second Timeout**
   - Approval modal auto-denies after 60 seconds
   - Token expires after 60 seconds

4. **Validation Chain**
   - Policy Engine validates BEFORE approval
   - Approval System generates token AFTER user approval
   - Execution Engine validates token BEFORE execution

**Token Lifecycle:**

```
┌──────────────┐
│ TOKEN_CREATED│ (approval granted)
│ used: false  │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ TOKEN_VALID  │ (within 60s, not used)
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ TOKEN_USED   │ (first execution step)
│ used: true   │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ TOKEN_INVALID│ (cannot reuse)
└──────────────┘
```

**Security Guarantees:**

✅ **Prevent Replay Attacks:** Single-use tokens cannot be replayed
✅ **Prevent Unauthorized Execution:** No token = immediate block
✅ **Audit Trail:** All events logged in EventBus
✅ **User Control:** User must explicitly approve each operation
✅ **Policy Enforcement:** Dangerous commands blocked before approval

---

## 📚 Usage Examples

> **🌟 ÖNEMLI:** Elysion Chamber sistemi **tüm istekler** için çalışır! Aşağıdaki örnekler farklı senaryoları göstermektedir.

### Example 1: Safe File Creation

```javascript
// User request
"Bir README.md dosyası oluştur"

// Flow:
// 1. Policy check → PASS (safe operation)
// 2. Approval modal shown
// 3. User approves → Token generated
// 4. File created with token
// 5. Probe checks file exists
// 6. Success! ✅
```

**Narrator Output:**
```
[12:00:00] 🎯 Şimdi 'Create README' adımına başlıyorum.
[12:00:01] 📝 README.md dosyasını yazıyorum.
[12:00:02] ✅ Dosya kontrolü başarılı: README.md
[12:00:03] 🎉 'Create README' başarıyla tamamlandı!
```

---

### Example 2: Blocked Dangerous Command

```javascript
// User request
"Tüm dosyaları sil: rm -rf /"

// Flow:
// 1. Policy check → BLOCK (critical violation: NO_RM_RF)
// 2. Approval modal NOT shown
// 3. Immediate block message
// 4. No execution ❌
```

**Output:**
```
🔴 POLİTİKA ENGELLEDİ!

❌ Dangerous command detected: rm -rf
This operation is blocked by security policy.
```

---

### Example 3: Auto-Fix on Failure

```javascript
// User request
"Python calculator yap"

// Flow:
// 1. Policy check → PASS
// 2. Approval granted → Token generated
// 3. Execute: Create calculator.py ✅
// 4. Execute: Run python calculator.py ❌ (ModuleNotFoundError: tkinter)
// 5. CriticAgent analyzes → Pattern match: MODULE_NOT_FOUND
// 6. Fix plan: pip install python-tk → Retry
// 7. Auto-fix applied ✅
// 8. Retry: Run python calculator.py ✅
// 9. Probes pass ✅
// 10. Success! 🎉
```

**Narrator Output:**
```
[12:00:00] 🎯 Şimdi 'Create calculator' adımına başlıyorum.
[12:00:01] 📝 calculator.py dosyasını yazıyorum.
[12:00:02] ⚙️ Komutu çalıştırıyorum: python calculator.py
[12:00:03] ❌ Hata oluştu: ModuleNotFoundError: tkinter. Çözüm arıyorum...
[12:00:04] 🔧 Critic Agent: pip install python-tk uygulanıyor...
[12:00:08] ✅ Otomatik düzeltme başarılı!
[12:00:09] ⚙️ Komutu çalıştırıyorum: python calculator.py (retry)
[12:00:10] 🎉 'Create calculator' başarıyla tamamlandı!
```

---

### Example 4: Blog Platform with React

```javascript
// User request
"React ile blog platformu yap, admin panelli"

// Flow:
// 1. Policy check → PASS (safe operation)
// 2. Approval granted → Token generated
// 3. Execute: Create React components ✅
// 4. Execute: Setup routing ✅
// 5. Execute: Create admin panel ✅
// 6. Execute: npm install dependencies ✅
// 7. Probes: FILE_EXISTS checks for all components ✅
// 8. Probes: HTTP_ENDPOINT check for dev server ✅
// 9. Success! 🎉
```

**Narrator Output:**
```
[13:00:00] 🎯 Şimdi 'Setup React blog platform' adımına başlıyorum.
[13:00:01] 📝 src/App.jsx dosyasını yazıyorum.
[13:00:02] 📝 src/components/BlogPost.jsx dosyasını yazıyorum.
[13:00:03] 📝 src/components/AdminPanel.jsx dosyasını yazıyorum.
[13:00:05] ⚙️ Komutu çalıştırıyorum: npm install react-router-dom
[13:00:12] ✅ Bağımlılıklar başarıyla yüklendi!
[13:00:13] ⚙️ Komutu çalıştırıyorum: npm run dev
[13:00:15] ✅ Dev server başlatıldı: http://localhost:5173
[13:00:16] 🎉 'Setup React blog platform' başarıyla tamamlandı!
```

---

### Example 5: Todo App with Database

```javascript
// User request
"Node.js Todo API yap, MongoDB ile"

// Flow:
// 1. Policy check → PASS
// 2. Approval granted → Token generated
// 3. Execute: Create server.js ✅
// 4. Execute: Create Todo model ✅
// 5. Execute: Create API routes ✅
// 6. Execute: npm install express mongoose ✅
// 7. Execute: Start server ❌ (Port 3000 already in use)
// 8. CriticAgent analyzes → Pattern: PORT_IN_USE
// 9. Fix plan: Kill process on port 3000 → Retry
// 10. Auto-fix applied ✅
// 11. Retry: Start server ✅
// 12. Probes: PORT_LISTENING check ✅
// 13. Success! 🎉
```

**Narrator Output:**
```
[14:00:00] 🎯 Şimdi 'Create Todo API' adımına başlıyorum.
[14:00:01] 📝 server.js dosyasını yazıyorum.
[14:00:02] 📝 models/Todo.js dosyasını yazıyorum.
[14:00:03] 📝 routes/todos.js dosyasını yazıyorum.
[14:00:05] ⚙️ Komutu çalıştırıyorum: npm install express mongoose
[14:00:12] ✅ Bağımlılıklar yüklendi!
[14:00:13] ⚙️ Komutu çalıştırıyorum: node server.js
[14:00:14] ❌ Hata: Port 3000 already in use. Çözüm arıyorum...
[14:00:15] 🔧 Critic Agent: Port 3000'deki process sonlandırılıyor...
[14:00:16] ✅ Otomatik düzeltme başarılı!
[14:00:17] ⚙️ Komutu çalıştırıyorum: node server.js (retry)
[14:00:18] ✅ Server started on port 3000
[14:00:19] 🎉 'Create Todo API' başarıyla tamamlandı!
```

---

### Example 6: E-Commerce Dashboard (Complex Multi-Step)

```javascript
// User request
"Full-stack e-commerce dashboard: Next.js frontend + Express backend + PostgreSQL"

// Flow:
// 1. Policy check → PASS
// 2. Approval granted → Token generated
// 3. Execute: Setup monorepo structure ✅
// 4. Execute: Create Next.js frontend (20 files) ✅
// 5. Execute: Create Express backend (15 files) ✅
// 6. Execute: Create PostgreSQL schema ✅
// 7. Execute: npm install all dependencies ✅
// 8. Execute: Start frontend dev server ✅
// 9. Execute: Start backend server ✅
// 10. Probes: HTTP_ENDPOINT checks (frontend + backend) ✅
// 11. Probes: FILE_EXISTS checks for critical files ✅
// 12. Success! 🎉
```

**Narrator Output:**
```
[15:00:00] 🎯 Şimdi 'Setup E-Commerce Dashboard' adımına başlıyorum.
[15:00:01] 📁 Monorepo klasör yapısı oluşturuluyor...
[15:00:03] 📝 frontend/pages/index.js dosyasını yazıyorum.
[15:00:04] 📝 frontend/components/ProductCard.js dosyasını yazıyorum.
[15:00:05] 📝 backend/server.js dosyasını yazıyorum.
[15:00:06] 📝 backend/models/Product.js dosyasını yazıyorum.
[15:00:08] ⚙️ Komutu çalıştırıyorum: npm install (frontend)
[15:00:18] ✅ Frontend dependencies yüklendi!
[15:00:19] ⚙️ Komutu çalıştırıyorum: npm install (backend)
[15:00:28] ✅ Backend dependencies yüklendi!
[15:00:29] ⚙️ Frontend dev server başlatılıyor: npm run dev
[15:00:35] ✅ Frontend ready: http://localhost:3000
[15:00:36] ⚙️ Backend server başlatılıyor: node server.js
[15:00:38] ✅ Backend ready: http://localhost:5000/api
[15:00:40] ✅ HTTP endpoint kontrolü: Frontend PASS
[15:00:41] ✅ HTTP endpoint kontrolü: Backend PASS
[15:00:42] 🎉 'Setup E-Commerce Dashboard' başarıyla tamamlandı!
```

---

## ⚙️ Configuration

### Enable/Disable Systems

```javascript
// In app.js constructor

// Disable approval system (NOT RECOMMENDED)
this.approvalSystem = null;

// Disable policy engine (NOT RECOMMENDED)
this.policyEngine = null;

// Disable narrator (optional, for less noise)
this.narratorAgent = null;

// Disable critic (optional, for manual fixes only)
this.criticAgent = null;
```

### Customize Timeout

```javascript
// In approval-system.js

// Change 60-second timeout to 2 minutes
const APPROVAL_TIMEOUT = 120000; // 120 seconds
```

### Customize Narrator Polling

```javascript
// In narrator-agent.js

// Change 2-second polling to 5 seconds
this.config = {
  pollInterval: 5000 // 5 seconds
};
```

### Add Custom Policy Rules

```javascript
// In policy-engine.js

this.rules.push({
  name: 'NO_DATABASE_DROP',
  pattern: /DROP\s+DATABASE/i,
  severity: 'critical',
  message: 'Database DROP commands are not allowed',
  action: 'block'
});
```

---

## 🐛 Troubleshooting

### Issue: Approval Modal Not Showing

**Symptoms:** Request executes without showing modal

**Causes:**
1. Approval system not initialized
2. Policy engine blocked operation before approval
3. UI not loaded (window.elysionUI missing)

**Solutions:**
```javascript
// Check systems
console.log('Approval System:', kodCanavari.approvalSystem ? 'OK' : 'MISSING');
console.log('Elysion UI:', window.elysionUI ? 'OK' : 'MISSING');

// Restart Electron
npm start
```

---

### Issue: Narrator Panel Empty

**Symptoms:** Panel shows "Waiting for operations..." but events are happening

**Causes:**
1. Narrator agent not initialized
2. Event bus not emitting events
3. UI panel hidden

**Solutions:**
```javascript
// Check narrator
console.log('Narrator Agent:', kodCanavari.narratorAgent ? 'OK' : 'MISSING');

// Check event bus
console.log('Recent Events:', kodCanavari.eventBus.getAllEvents().slice(-5));

// Show narrator panel manually
document.getElementById('narratorPanel').classList.remove('hidden');
```

---

### Issue: Critic Agent Not Fixing Failures

**Symptoms:** Steps fail but no auto-fix attempted

**Causes:**
1. Critic agent not initialized
2. Error pattern not recognized
3. Fix plan failed to execute

**Solutions:**
```javascript
// Check critic
console.log('Critic Agent:', kodCanavari.criticAgent ? 'OK' : 'MISSING');

// Get statistics
const stats = kodCanavari.criticAgent.getStats();
console.log('Critic Stats:', stats);

// Test pattern matching
const testError = "ModuleNotFoundError: No module named 'tkinter'";
const pattern = kodCanavari.criticAgent.patterns.MODULE_NOT_FOUND;
console.log('Pattern match:', pattern.regex.test(testError));
```

---

## 📝 API Reference

### ApprovalSystem

```typescript
class ApprovalSystem {
  requestApproval(proposal: Proposal): Promise<ApprovalResult>
  approveProposal(approvalId: string): void
  denyProposal(approvalId: string, reason: string): void
  validateToken(token: string): boolean
  useToken(token: string): void
  clearPendingApprovals(): void
}

interface Proposal {
  step: { id: number; title: string; intent: string }
  commands: string[]
  files: { path: string; operation: string }[]
  risks: Risk[]
  probes: Probe[]
  policyViolations: PolicyViolation[]
}

interface ApprovalResult {
  approved: boolean
  token?: string
  reason?: string
}
```

### PolicyEngine

```typescript
class PolicyEngine {
  validate(request: PolicyRequest): PolicyResult
  addRule(rule: PolicyRule): void
  removeRule(ruleName: string): void
  getRules(): PolicyRule[]
}

interface PolicyRequest {
  command: string
  cwd: string
  context: any
}

interface PolicyResult {
  canProceed: boolean
  violations: PolicyViolation[]
  warnings: PolicyWarning[]
}
```

### EventBus

```typescript
class EventBus {
  emit(event: Event): void
  on(eventType: string, handler: Function): void
  off(eventType: string, handler: Function): void
  readSince(timestamp: number): Event[]
  getAllEvents(): Event[]
  clear(): void
}

interface Event {
  type: string
  timestamp: number
  data: any
}
```

### ProbeMatrix

```typescript
class ProbeMatrix {
  runProbes(probes: Probe[]): Promise<ProbeResults>
  addProbe(probe: Probe): void
  clearProbes(): void
}

interface Probe {
  type: 'FILE_EXISTS' | 'PROCESS_SUCCESS' | 'HTTP_ENDPOINT' | 'PORT_LISTENING'
  target: string
  description: string
}

interface ProbeResults {
  total: number
  passed: number
  failed: number
  results: ProbeResult[]
}
```

### NarratorAgent

```typescript
class NarratorAgent {
  constructor(eventBus: EventBus, ui: ElysionChamberUI)
  narrate(): void
  startMonitoring(): void
  stopMonitoring(): void
}
```

### CriticAgent

```typescript
class CriticAgent {
  analyze(failureData: FailureData): Promise<AnalysisResult>
  executeFix(fixPlan: FixStep[]): Promise<FixResult>
  getStats(): CriticStats
}

interface FailureData {
  step: any
  observations: string[]
  stderr: string
  exitCode: number
}

interface AnalysisResult {
  pattern?: string
  rootCause: string
  fixPlan: FixStep[]
}

interface FixStep {
  tool: string
  args: any
  reason: string
}
```

---

## 🎓 Best Practices

### 1. Always Use Approval System

```javascript
// ❌ BAD: Bypass approval
await executeAction(action);

// ✅ GOOD: Request approval first
const approval = await approvalSystem.requestApproval(proposal);
if (approval.approved) {
  await executeWithLiveUpdates(analysis, route, approval.token);
}
```

### 2. Validate Tokens Before Execution

```javascript
// ❌ BAD: Trust token without validation
await executeAction(action);

// ✅ GOOD: Validate token
if (!approvalSystem.validateToken(token)) {
  throw new Error('Invalid approval token');
}
approvalSystem.useToken(token);
await executeAction(action);
```

### 3. Emit Events for Audit Trail

```javascript
// ❌ BAD: Execute silently
await fs.writeFile(path, content);

// ✅ GOOD: Emit event
eventBus.emit({ type: 'WRITE_FILE', file: path, size: content.length });
await fs.writeFile(path, content);
```

### 4. Build Probes for Validation

```javascript
// ❌ BAD: Assume success
console.log('Files created!');

// ✅ GOOD: Validate with probes
const probes = buildProbesForActions(actions);
const results = await probeMatrix.runProbes(probes);
if (results.passed < results.total) {
  console.error('Validation failed:', results);
}
```

### 5. Let Critic Auto-Fix

```javascript
// ❌ BAD: Stop on error
try {
  await executeAction(action);
} catch (error) {
  console.error('Failed:', error);
  return; // Give up
}

// ✅ GOOD: Try auto-fix
try {
  await executeAction(action);
} catch (error) {
  const analysis = await criticAgent.analyze({ step: action, stderr: error.message });
  const fixResult = await criticAgent.executeFix(analysis.fixPlan);
  if (fixResult.success) {
    await executeAction(action); // Retry
  }
}
```

---

## 📄 License

MIT License - Feel free to use in your projects!

---

## 🤝 Contributing

Found a bug or want to add a feature? Open an issue or PR!

**Key areas for contribution:**
- Add more failure patterns to CriticAgent
- Improve policy engine rules
- Add more probe types to ProbeMatrix
- Enhance narrator messages (make them more educational)
- UI/UX improvements

---

**Built with 🐉 by KayraDeniz Kod Canavarı Team**
