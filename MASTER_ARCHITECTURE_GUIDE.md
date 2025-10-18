# 🏗️ KAYRADENIZ KOD CANAVARI - MASTER ARCHITECTURE GUIDE

> **Son Güncelleme:** 18 Ocak 2025  
> **Versiyon:** 2.0.0  
> **Durum:** Production Ready with Tool Bridge System

---

## 📋 İçindekiler

1. [Proje Genel Bakış](#proje-genel-bakış)
2. [Sistem Mimarisi](#sistem-mimarisi)
3. [Agent Sistemleri](#agent-sistemleri)
4. [Tool Katmanları](#tool-katmanları)
5. [AI Provider'lar](#ai-providerlar)
6. [Event & Messaging Sistemi](#event--messaging-sistemi)
7. [Learning & Context Sistemi](#learning--context-sistemi)
8. [UI/UX Katmanları](#uiux-katmanları)
9. [Workflow Diagramları](#workflow-diagramları)
10. [Kurulum Rehberi](#kurulum-rehberi)
11. [Geliştirici Notları](#geliştirici-notları)

---

## 🎯 Proje Genel Bakış

### Ne İşe Yarar?

**KayraDeniz Kod Canavarı**, geliştiricilerin doğal dilde verdiği komutları tam işlevsel kod projelerine dönüştüren AI-powered Electron uygulamasıdır.

### Temel Özellikler

```
┌─────────────────────────────────────────────────────────┐
│                  KAYRADENIZ FEATURES                     │
├─────────────────────────────────────────────────────────┤
│ ✅ Multi-Agent System (Luma Supreme Agent)              │
│ ✅ Night Orders Protocol (Mission-based execution)      │
│ ✅ Tool Bridge Layer (Physical file operations)         │
│ ✅ Reflexion System (Self-analysis & auto-fix)          │
│ ✅ Learning Store (Pattern recognition & replay)        │
│ ✅ Usta Modu (AI Teacher - Real-time narration)         │
│ ✅ Elysion Chamber (Approval gating system)             │
│ ✅ Multi-Phase Projects (Complex project scaffolding)   │
│ ✅ MCP Integration (Model Context Protocol)             │
│ ✅ Multi-Provider AI (OpenAI, Claude, Gemini)           │
└─────────────────────────────────────────────────────────┘
```

### Desteklenen Teknolojiler

- **Frontend:** Electron, Vanilla JS, CSS3, Prism.js
- **Backend:** Node.js, MCP Server (port 7777)
- **AI Providers:** OpenAI GPT-4o/o1, Claude 3.5 Sonnet, Google Gemini 2.0
- **Protocols:** MCP, Night Orders, ReAct+Verify
- **Build Systems:** npm, webpack, vite (auto-detected)

---

## 🏛️ Sistem Mimarisi

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        KAYRADENIZ ARCHITECTURE                       │
└─────────────────────────────────────────────────────────────────────┘

    ┌──────────────┐
    │   USER UI    │  (Electron Renderer Process)
    └──────┬───────┘
           │
           ▼
    ┌──────────────────────────────────────────────────────────┐
    │              LUMA SUPREME AGENT LAYER                     │
    │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
    │  │ Router Agent │  │ Generator    │  │ Executor     │   │
    │  │ (Intent)     │─▶│ Agent        │─▶│ Agent        │   │
    │  │              │  │ (Planning)   │  │ (Execution)  │   │
    │  └──────────────┘  └──────────────┘  └──────────────┘   │
    │         │                  │                  │           │
    │         ▼                  ▼                  ▼           │
    │  ┌──────────────────────────────────────────────────┐   │
    │  │        REFLEXION SYSTEM (Self-Analysis)          │   │
    │  │  - Pattern Detection  - Auto-Fix Suggestions     │   │
    │  │  - Error Analysis     - Circuit Breaker          │   │
    │  └──────────────────────────────────────────────────┘   │
    └───────────────────────────┬──────────────────────────────┘
                                │
                                ▼
    ┌──────────────────────────────────────────────────────────┐
    │                 TOOL BRIDGE LAYER (NEW!)                  │
    │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
    │  │ File Tools   │  │ Terminal     │  │ Reflexion    │   │
    │  │ fs.read      │  │ Tools        │  │ Applier      │   │
    │  │ fs.write     │  │ terminal.exec│  │ Auto-fixes   │   │
    │  │ fs.exists    │  │ CWD tracking │  │ Circuit      │   │
    │  │ fs.delete    │  │              │  │ Breaker      │   │
    │  └──────────────┘  └──────────────┘  └──────────────┘   │
    └───────────────────────────┬──────────────────────────────┘
                                │
                                ▼
    ┌──────────────────────────────────────────────────────────┐
    │              ELECTRON API BRIDGE (IPC)                    │
    │  - File System Operations   - Terminal Commands          │
    │  - Process Management       - MCP Proxy Restart          │
    └───────────────────────────┬──────────────────────────────┘
                                │
                                ▼
    ┌──────────────────────────────────────────────────────────┐
    │                   NODE.JS MAIN PROCESS                    │
    │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
    │  │ fs/promises  │  │ child_process│  │ MCP Proxy    │   │
    │  │ File I/O     │  │ Terminal     │  │ Manager      │   │
    │  └──────────────┘  └──────────────┘  └──────────────┘   │
    └───────────────────────────┬──────────────────────────────┘
                                │
                                ▼
    ┌──────────────────────────────────────────────────────────┐
    │                  EXTERNAL SERVICES                        │
    │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
    │  │ OpenAI API   │  │ Claude API   │  │ Gemini API   │   │
    │  │ GPT-4o/o1    │  │ Sonnet 3.5   │  │ 2.0 Flash    │   │
    │  └──────────────┘  └──────────────┘  └──────────────┘   │
    │                                                           │
    │  ┌──────────────┐                                        │
    │  │ MCP Server   │  (localhost:7777)                      │
    │  │ proxy/       │  Health: /health                       │
    │  └──────────────┘  Auto-restart enabled                  │
    └──────────────────────────────────────────────────────────┘
```

---

## 🤖 Agent Sistemleri

### 1. Luma Supreme Agent (Multi-Agent Coordinator)

**Dosya:** `src/renderer/app.js` (9000+ lines)

**Görevler:**
1. **Intent Detection** → Kullanıcı niyetini analiz et (command/idea/reflection/exploration)
2. **Agent Selection** → En uygun agent'ı seç (Router/Generator/Executor/Analyzer)
3. **Priority Calculation** → İşlem önceliği belirle (0-10 scale)
4. **Execution Flow** → Agent'lar arası koordinasyon

**Agent Types:**

```javascript
const AGENT_TYPES = {
    RouterAgent: {
        purpose: 'Intent analysis & routing',
        triggers: ['command', 'question', 'help'],
        priority: 'high',
        examples: ['projeyi çalıştır', 'dosyayı oku', 'hata nedir']
    },
    
    GeneratorAgent: {
        purpose: 'Night Orders generation & planning',
        triggers: ['idea', 'new project', 'feature request'],
        priority: 'medium',
        examples: ['blog sitesi yap', 'React app kur', 'API ekle']
    },
    
    ExecutorAgent: {
        purpose: 'File operations & command execution',
        triggers: ['Night Orders JSON', 'multi-step tasks'],
        priority: 'high',
        examples: ['fs.write', 'terminal.exec', 'multi-edit']
    },
    
    AnalyzerAgent: {
        purpose: 'Error analysis & reflection',
        triggers: ['reflection', 'error', 'fix request'],
        priority: 'critical',
        examples: ['hatayı analiz et', 'neden çalışmıyor', 'düzelt']
    }
};
```

**Decision Flow:**

```
User Input → Luma Supreme Agent
    │
    ├─▶ Intent: "command" → RouterAgent (priority: 7-10)
    │   └─▶ Execute existing functionality
    │
    ├─▶ Intent: "idea" → GeneratorAgent (priority: 5-8)
    │   └─▶ Create Night Orders → ExecutorAgent
    │
    ├─▶ Intent: "reflection" → AnalyzerAgent (priority: 8-10)
    │   └─▶ Self-analysis → Reflexion System
    │
    └─▶ Intent: "exploration" → RouterAgent (priority: 3-6)
        └─▶ Information gathering
```

---

### 2. Night Orders Protocol

**Dosya:** `src/renderer/app.js` (Night Orders validation & execution)

**JSON Schema:**

```json
{
  "mission": "Tek cümle görev tanımı",
  "acceptance": [
    "build: exit 0",
    "probe: #elementId exists",
    "lint: no errors"
  ],
  "steps": [
    {
      "id": "S1",
      "tool": "fs.write",
      "args": {
        "path": "src/index.js",
        "content": "console.log('Hello World');"
      },
      "explain": {
        "goal": "Ana JavaScript dosyasını oluştur (30+ chars)",
        "rationale": "Projenin giriş noktası olarak gerekli (50+ chars)"
      },
      "verify": ["lint", "build"]
    }
  ]
}
```

**Supported Tools:**

| Tool | Purpose | Args | Example |
|------|---------|------|---------|
| `fs.write` | Dosya yaz | path, content | Create new file |
| `fs.read` | Dosya oku | path | Read existing file |
| `fs.exists` | Dosya kontrol | path | Check if file exists |
| `fs.delete` | Dosya/klasör sil | path | Delete file or folder |
| `fs.multiEdit` | Çoklu düzenleme | filepath, edits[] | Multiple edits in one file |
| `terminal.exec` | Komut çalıştır | cmd, cwd | npm install, git commit |
| `http.get` | HTTP request | url | Fetch external data |

**Verification Matrix:**

```javascript
const VERIFICATION_TYPES = {
    build: {
        command: 'npm run build',
        success: 'exitCode === 0',
        skip: 'package.json not found'
    },
    
    lint: {
        command: 'npm run lint || eslint .',
        success: 'no errors found',
        skip: 'no lint config'
    },
    
    probe: {
        command: 'check DOM element or file',
        success: 'element/file exists',
        skip: 'N/A'
    },
    
    test: {
        command: 'npm test',
        success: 'all tests pass',
        skip: 'no test scripts'
    }
};
```

---

### 3. Reflexion System (Self-Analysis)

**Dosya:** `src/renderer/app.js` (Reflexion logic)

**Purpose:** Agent'ın kendi hatalarını tespit edip otomatik düzeltme önerileri sunması.

**Workflow:**

```
Step Execution Failed
    │
    ▼
┌─────────────────────────────────┐
│    REFLEXION TRIGGER            │
│  - Build failed?                │
│  - Verification failed?         │
│  - Tool error?                  │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│    SELF-ANALYSIS                │
│  1. Pattern matching            │
│  2. Error categorization        │
│  3. Root cause detection        │
│  4. Learning Store lookup       │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│    SUGGESTED FIXES              │
│  [                              │
│    {                            │
│      type: "UPDATE_FILE",       │
│      path: "package.json",      │
│      content: "...",            │
│      severity: "CRITICAL"       │
│    }                            │
│  ]                              │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│    REFLEXION APPLIER (NEW!)     │
│  - Execute fixes physically     │
│  - Circuit breaker (3x limit)   │
│  - Track fix history            │
└─────────────────────────────────┘
```

**Pattern Detection:**

```javascript
const REFLEXION_PATTERNS = {
    WRONG_MONOREPO_STRUCTURE: {
        trigger: 'Root src/ folder in monorepo',
        severity: 'CRITICAL',
        fix: 'Move to workspace folder or remove workspaces config'
    },
    
    MISSING_DEPENDENCIES: {
        trigger: 'Module not found error',
        severity: 'CRITICAL',
        fix: 'npm install <package>'
    },
    
    BUILD_SCRIPT_ERROR: {
        trigger: 'npm run build fails',
        severity: 'HIGH',
        fix: 'Check webpack/vite config'
    },
    
    PORT_CONFLICT: {
        trigger: 'Port already in use',
        severity: 'MEDIUM',
        fix: 'Change port in config or kill process'
    }
};
```

---

## 🔧 Tool Katmanları

### 1. Tool Bridge System (NEW!)

**Dosya:** `src/agents/tool-bridge.js`

**Purpose:** Agent'ların tool çağrılarını fiziksel işlemlere çevirir.

**Architecture:**

```
Agent Decision (tool: "fs.readFile")
    │
    ▼
┌─────────────────────────────────┐
│    TOOL BRIDGE                  │
│  - Tool name validation         │
│  - Alias resolution             │
│    fs.readFile → fs.read        │
│  - Path resolution              │
│    "./file.txt" → absolute path │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│    ELECTRON API BRIDGE          │
│  - ipcRenderer.invoke()         │
│  - Security checks              │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│    NODE.JS MAIN PROCESS         │
│  - fs.readFile() actual call    │
│  - Return result                │
└─────────────────────────────────┘
```

**Tool Mapping:**

```javascript
const TOOL_ALIASES = {
    // File System
    'fs.readFile': 'fs.read',
    'fs.readFileSync': 'fs.read',
    'fs.writeFile': 'fs.write',
    
    // Terminal
    'terminal.run': 'terminal.exec',
    'run_cmd': 'terminal.exec',
    
    // Legacy support
    'write_file': 'fs.write',
    'read_file': 'fs.read'
};
```

**Key Features:**

1. **Path Resolution:** Relative → Absolute
   ```javascript
   resolveAbsolutePath('./src/index.js')
   // → C:/workspace/project/src/index.js
   ```

2. **CWD Preservation:** Terminal komutları doğru dizinde çalışır
   ```javascript
   executeTool('terminal.exec', { 
       cmd: 'npm install', 
       cwd: './server' 
   })
   // → cd C:/workspace/project/server && npm install
   ```

3. **Execution Logging:** Debug için tüm tool çağrıları kaydedilir
   ```javascript
   window.toolBridge.getLog()
   // → [{ tool: 'fs.write', status: 'SUCCESS', ... }]
   ```

---

### 2. Reflexion Applier System (NEW!)

**Dosya:** `src/agents/reflexion-applier.js`

**Purpose:** Reflexion System'in "SUGGESTED FIXES"'lerini gerçek dosya işlemlerine çevirir.

**Fix Types:**

```javascript
const FIX_TYPES = {
    UPDATE_FILE: async (fix) => {
        await toolBridge.executeTool('fs.write', {
            path: fix.path,
            content: fix.content
        });
    },
    
    DELETE_FOLDER: async (fix) => {
        await toolBridge.executeTool('fs.delete', {
            path: fix.path
        });
    },
    
    CREATE_FOLDER: async (fix) => {
        await toolBridge.executeTool('terminal.exec', {
            cmd: `mkdir -p "${fix.path}"`
        });
    },
    
    RUN_COMMAND: async (fix) => {
        await toolBridge.executeTool('terminal.exec', {
            cmd: fix.command,
            cwd: fix.cwd
        });
    }
};
```

**Circuit Breaker:**

```javascript
// Aynı fix 3 kez uygulanırsa dur
checkCircuitBreaker(fix) {
    const fixSignature = `${fix.type}:${fix.path}`;
    const recentFixes = this.fixHistory.slice(-10);
    const identicalCount = recentFixes.filter(
        h => h.signature === fixSignature
    ).length;
    
    if (identicalCount >= 3) {
        return {
            shouldStop: true,
            reason: 'Circuit breaker: Fix attempted 3 times'
        };
    }
    
    return { shouldStop: false };
}
```

---

### 3. MCP (Model Context Protocol) Integration

**Dosya:** `proxy/server.js`, `src/mcp-tools/`

**Purpose:** AI model'lere structured tool execution sağlar.

**Architecture:**

```
AI Model (OpenAI/Claude)
    │
    ▼
┌─────────────────────────────────┐
│    MCP CLIENT                   │
│  (KayraDeniz Renderer)          │
└──────────┬──────────────────────┘
           │ HTTP POST
           ▼
┌─────────────────────────────────┐
│    MCP PROXY SERVER             │
│  localhost:7777                 │
│  - Tool routing                 │
│  - Request validation           │
│  - Auto-restart enabled         │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│    MCP TOOL HANDLERS            │
│  - readFile                     │
│  - writeFile                    │
│  - executeCommand               │
│  - searchWorkspace              │
└─────────────────────────────────┘
```

**Available MCP Tools:**

| Tool | Method | Args | Purpose |
|------|--------|------|---------|
| `readFile` | POST /tools/readFile | path | Read file content |
| `writeFile` | POST /tools/writeFile | path, content | Write to file |
| `executeCommand` | POST /tools/executeCommand | command, cwd | Run shell command |
| `searchWorkspace` | POST /tools/searchWorkspace | query | Search files |
| `listDirectory` | POST /tools/listDirectory | path | List dir contents |

**Health Monitoring:**

```javascript
// Auto-restart system (NEW!)
const MCPProxyMonitor = {
    checkInterval: 30000,      // 30s
    timeout: 5000,             // 5s
    failureThreshold: 2,       // 2 consecutive failures
    
    async checkHealth() {
        const response = await fetch('http://127.0.0.1:7777/health', {
            method: 'GET',
            signal: AbortSignal.timeout(5000)
        });
        return response.ok;
    },
    
    async attemptRestart() {
        await window.electronAPI.invoke('restart-mcp-proxy');
    }
};
```

---

## 🧠 AI Provider'lar

### Supported Providers

```
┌──────────────────────────────────────────────────────────┐
│                    AI PROVIDERS                          │
├──────────────────────────────────────────────────────────┤
│  1. OpenAI                                               │
│     - Models: gpt-4o, gpt-4o-mini, o1-preview, o1-mini   │
│     - Endpoint: https://api.openai.com/v1                │
│     - Features: Function calling, streaming, vision      │
│                                                           │
│  2. Claude (Anthropic)                                   │
│     - Models: claude-3-5-sonnet-20241022                 │
│     - Endpoint: https://api.anthropic.com/v1             │
│     - Features: Long context (200K), tool use            │
│                                                           │
│  3. Google Gemini                                        │
│     - Models: gemini-2.0-flash-exp                       │
│     - Endpoint: https://generativelanguage.googleapis... │
│     - Features: Multimodal, fast inference               │
└──────────────────────────────────────────────────────────┘
```

### Provider Selection Logic

**Dosya:** `src/renderer/app.js`

```javascript
async selectBestProvider(task) {
    const taskComplexity = this.calculateComplexity(task);
    
    if (taskComplexity > 8) {
        // Complex reasoning → o1-preview
        return { provider: 'openai', model: 'o1-preview' };
    } else if (taskComplexity > 5) {
        // Medium complexity → gpt-4o
        return { provider: 'openai', model: 'gpt-4o' };
    } else if (task.requiresLongContext) {
        // Long context → claude-3-5-sonnet
        return { provider: 'claude', model: 'claude-3-5-sonnet-20241022' };
    } else {
        // Simple tasks → gpt-4o-mini (fast & cheap)
        return { provider: 'openai', model: 'gpt-4o-mini' };
    }
}
```

---

## 🔄 Event & Messaging Sistemi

### Event Bus Architecture

**Dosya:** `src/renderer/app.js`

```
┌─────────────────────────────────────────────────────────┐
│                      EVENT BUS                           │
│  Central message broker for system-wide communication   │
└─────────────────────────────────────────────────────────┘

    ┌──────────────────────────────────────────────┐
    │              EVENT TYPES                     │
    ├──────────────────────────────────────────────┤
    │  NARRATION_BEFORE    → Step başlamadan önce  │
    │  NARRATION_AFTER     → Step tamamlandıktan   │
    │  NARRATION_VERIFY    → Verification sonucu   │
    │  EXECUTION_START     → Execution başladı     │
    │  EXECUTION_COMPLETE  → Execution tamamlandı  │
    │  EXECUTION_ERROR     → Execution hatası      │
    │  PHASE_CHANGE        → Phase geçişi          │
    │  FILE_CREATED        → Dosya oluşturuldu     │
    │  APPROVAL_REQUIRED   → Kullanıcı onayı       │
    └──────────────────────────────────────────────┘

LISTENERS:
    - Usta Modu UI (Narration display)
    - Elysion Chamber (Approval gating)
    - Learning Store (Pattern recording)
    - Session Context (State tracking)
    - Progress UI (Status updates)
```

**Event Flow Example:**

```javascript
// Step execution starts
eventBus.emit({
    type: 'NARRATION_BEFORE',
    data: {
        stepId: 'S1',
        explain: {
            goal: 'package.json dosyasını oluştur',
            rationale: 'npm dependencies için gerekli'
        }
    }
});

// Tool Bridge executes
await toolBridge.executeTool('fs.write', {...});

// Step completes
eventBus.emit({
    type: 'NARRATION_AFTER',
    data: {
        stepId: 'S1',
        result: { success: true, path: 'package.json' }
    }
});

// Verification runs
eventBus.emit({
    type: 'NARRATION_VERIFY',
    data: {
        stepId: 'S1',
        checks: {
            lint: 'PASS',
            build: 'SKIP',
            probe: 'PASS'
        }
    }
});
```

---

## 📚 Learning & Context Sistemi

### 1. Learning Store

**Dosya:** `src/renderer/learning-store.js`

**Purpose:** Agent'ın başarılı pattern'leri kaydedip tekrar kullanması.

**Data Structure:**

```javascript
{
    patterns: [
        {
            id: 'pattern_001',
            name: 'React App Initialization',
            trigger: 'react app, component based',
            context: {
                projectType: 'frontend',
                framework: 'react',
                buildTool: 'vite'
            },
            nightOrders: {...},  // Full Night Orders JSON
            successRate: 0.95,
            usageCount: 42,
            lastUsed: '2025-01-18T10:30:00Z'
        }
    ],
    
    errors: [
        {
            id: 'error_001',
            pattern: 'MISSING_DEPENDENCIES',
            solution: 'npm install <package>',
            frequency: 15,
            lastSeen: '2025-01-18T09:00:00Z'
        }
    ]
}
```

**Operations:**

```javascript
// Record successful execution
learningStore.recordSuccess({
    pattern: nightOrders,
    context: sessionContext,
    result: executionResult
});

// Find similar patterns
const similar = learningStore.findSimilar({
    intent: 'blog platform',
    framework: 'express',
    database: 'mongodb'
});

// Learn from error
learningStore.recordError({
    error: 'MISSING_DEPENDENCIES',
    fix: 'npm install express',
    context: {...}
});
```

---

### 2. Session Context

**Dosya:** `src/renderer/session-context.js`

**Purpose:** Current session state tracking.

```javascript
class SessionContext {
    constructor() {
        this.context = {
            currentProject: {
                name: null,
                path: null,
                type: 'single',  // or 'monorepo'
                fileCount: 0,
                dependencies: []
            },
            
            executionHistory: [],
            
            phaseContext: {
                currentPhase: 1,
                completedFiles: new Set(),
                lastMission: null,
                phaseHistory: []
            },
            
            aiContext: {
                provider: 'openai',
                model: 'gpt-4o',
                temperature: 0.7,
                totalTokens: 0,
                totalCost: 0
            },
            
            userPreferences: {
                developerMode: false,
                autoApprove: false,
                language: 'tr'
            }
        };
    }
    
    // Track file creation (prevent duplicates)
    markFileCreated(path) {
        this.context.phaseContext.completedFiles.add(path);
    }
    
    // Check if file already created
    isFileCreated(path) {
        return this.context.phaseContext.completedFiles.has(path);
    }
    
    // Move to next phase
    nextPhase(mission) {
        this.context.phaseContext.currentPhase++;
        this.context.phaseContext.lastMission = mission;
    }
}
```

---

## 🎨 UI/UX Katmanları

### 1. Usta Modu (AI Teacher)

**Dosyalar:** 
- `src/renderer/usta-modu-react.js` (React component)
- `src/renderer/usta-modu-react.css` (Styling)

**Purpose:** Real-time AI narration & teaching interface.

**Features:**

```
┌─────────────────────────────────────────────────────────┐
│                     USTA MODU UI                         │
├─────────────────────────────────────────────────────────┤
│  📝 Step-by-step narration                              │
│  🎯 Goal & rationale explanations                       │
│  ✅ Verification results (lint/build/probe)             │
│  🔄 Real-time progress tracking                         │
│  🎓 Educational tooltips                                │
│  📊 Phase transition notifications                      │
│  💡 Debugging tips                                      │
└─────────────────────────────────────────────────────────┘
```

**Event Handling:**

```javascript
// Listen for narration events
eventBus.on('NARRATION_BEFORE', (event) => {
    const { stepId, explain } = event.data;
    
    displayNarration({
        type: 'before',
        icon: '🔧',
        title: `Step ${stepId} Starting`,
        content: `
            🎯 Goal: ${explain.goal}
            💡 Why: ${explain.rationale}
        `
    });
});

eventBus.on('NARRATION_VERIFY', (event) => {
    const { checks } = event.data;
    
    displayVerification({
        lint: checks.lint,    // PASS/FAIL/SKIP
        build: checks.build,
        probe: checks.probe
    });
});
```

---

### 2. Elysion Chamber (Approval System)

**Dosyalar:**
- `src/renderer/elysion-chamber-ui.js`
- `src/renderer/elysion-chamber-ui.css`

**Purpose:** Kullanıcı onay sistemi (tehlikeli işlemler için).

**Approval Flow:**

```
Agent wants to execute: "rm -rf node_modules"
    │
    ▼
┌─────────────────────────────────┐
│  DANGER DETECTION               │
│  - File deletion?               │
│  - System commands?             │
│  - npm uninstall?               │
└──────────┬──────────────────────┘
           │
           ▼  YES → Dangerous
┌─────────────────────────────────┐
│  ELYSION CHAMBER MODAL          │
│  ⚠️  Tehlikeli Komut!           │
│                                 │
│  Komut: rm -rf node_modules     │
│  Tehlike: Mass file deletion    │
│                                 │
│  [Onayla]  [Reddet]             │
└─────────────────────────────────┘
           │
           ├─▶ Approve → Execute
           └─▶ Reject  → Cancel
```

**Developer Mode:**

```javascript
// Developer Mode aktifse tüm approval'lar otomatik
if (this.developerMode) {
    console.log('🔓 Developer Mode: Auto-approving command');
    return true;  // No modal shown
}
```

---

### 3. Main UI Components

**Dosya:** `src/renderer/index.html`, `src/renderer/styles.css`

**Layout:**

```
┌────────────────────────────────────────────────────────┐
│  HEADER                                                 │
│  🐉 KayraDeniz Kod Canavarı                            │
│  [API Keys] [Model Selection] [Settings]               │
└────────────────────────────────────────────────────────┘
│                                                         │
│  LEFT SIDEBAR (File Tree)                              │
│  📁 workspace/                                         │
│    📁 src/                                             │
│      📄 index.js                                       │
│      📄 app.js                                         │
│    📄 package.json                                     │
│                                                         │
├────────────────────────────────────────────────────────┤
│                                                         │
│  CENTER (Code Editor / Preview)                        │
│  [Tab: index.js] [Tab: package.json] [+]              │
│  ┌──────────────────────────────────────────────────┐ │
│  │  1  import React from 'react';                   │ │
│  │  2  import ReactDOM from 'react-dom';            │ │
│  │  3                                               │ │
│  │  4  function App() {                             │ │
│  │  5    return <h1>Hello World</h1>;               │ │
│  │  6  }                                            │ │
│  └──────────────────────────────────────────────────┘ │
│                                                         │
├────────────────────────────────────────────────────────┤
│                                                         │
│  BOTTOM (Chat Interface)                               │
│  💬 "Blog platformu yap React ve Express ile"          │
│  🤖 "Anladım! Night Orders oluşturuyorum..."           │
│  [Message Input]                              [Send]   │
│                                                         │
└────────────────────────────────────────────────────────┘
│                                                         │
│  RIGHT SIDEBAR (Usta Modu / Learning Dashboard)        │
│  🎓 USTA MODU                                          │
│  📝 Step S1: package.json oluşturuluyor                │
│  🎯 Goal: npm dependencies için gerekli                │
│  ✅ Verification: LINT ✅ BUILD ⏭️                      │
│                                                         │
└────────────────────────────────────────────────────────┘
```

---

## 📊 Workflow Diagramları

### 1. End-to-End User Flow

```
USER: "Blog platformu yap"
    │
    ▼
┌─────────────────────────────────┐
│  LUMA SUPREME AGENT             │
│  Intent: "idea"                 │
│  Selected: GeneratorAgent       │
│  Priority: 7/10                 │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│  GENERATOR AGENT                │
│  - Analyze requirements         │
│  - Choose tech stack            │
│  - Create Night Orders JSON     │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│  NIGHT ORDERS VALIDATION        │
│  - Schema check                 │
│  - Tool availability            │
│  - Acceptance criteria          │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│  ELYSION CHAMBER                │
│  User approval required?        │
│  [Approve] / [Reject]           │
└──────────┬──────────────────────┘
           │  Approved
           ▼
┌─────────────────────────────────┐
│  EXECUTOR AGENT                 │
│  For each step in Night Orders: │
│    1. Emit NARRATION_BEFORE     │
│    2. Execute via Tool Bridge   │
│    3. Verify results            │
│    4. Emit NARRATION_AFTER      │
└──────────┬──────────────────────┘
           │
           ├─▶ Success → Continue
           │
           └─▶ Failure → REFLEXION
                    │
                    ▼
           ┌─────────────────────────────────┐
           │  REFLEXION SYSTEM               │
           │  - Analyze error                │
           │  - Pattern matching             │
           │  - Generate fixes               │
           └──────────┬──────────────────────┘
                      │
                      ▼
           ┌─────────────────────────────────┐
           │  REFLEXION APPLIER              │
           │  - Apply fixes physically       │
           │  - Check circuit breaker        │
           │  - Retry execution              │
           └──────────┬──────────────────────┘
                      │
                      ├─▶ Fixed → Continue
                      └─▶ Still failing → User intervention
```

---

### 2. Tool Execution Flow

```
executeOrderStep(step)
    │
    ▼
┌─────────────────────────────────┐
│  CHECK: Tool Bridge Available?  │
└──────────┬──────────────────────┘
           │
           ├─▶ YES → Tool Bridge Path
           │         │
           │         ▼
           │   ┌─────────────────────────────────┐
           │   │  TOOL BRIDGE                    │
           │   │  1. Validate tool name          │
           │   │  2. Resolve aliases             │
           │   │     fs.readFile → fs.read       │
           │   │  3. Resolve path                │
           │   │     ./file → /abs/path/file     │
           │   │  4. Execute via electronAPI     │
           │   └──────────┬──────────────────────┘
           │              │
           │              ▼
           │         [SUCCESS] → Return result
           │              │
           │              └─▶ Log execution
           │
           └─▶ NO → Legacy Handler Path
                   │
                   ▼
             ┌─────────────────────────────────┐
             │  LEGACY SWITCH STATEMENT        │
             │  case 'write_file': ...         │
             │  case 'fs.write': ...           │
             │  case 'terminal.exec': ...      │
             └──────────┬──────────────────────┘
                        │
                        ▼
                   Execute directly
```

---

### 3. Multi-Phase Project Flow

```
USER: "Blog platformu yap (complex project)"
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│  GENERATOR AGENT DECISION                                │
│  File count estimate: 15+ files                          │
│  Decision: MULTI-PHASE execution required                │
└──────────┬──────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────┐
│  PHASE 1: SKELETON                                       │
│  - package.json                                          │
│  - README.md                                             │
│  - .gitignore                                            │
│  - Directory structure                                   │
│  Verification: Files exist ✅                            │
└──────────┬──────────────────────────────────────────────┘
           │
           ▼  Emit: PHASE_CHANGE event
┌─────────────────────────────────────────────────────────┐
│  PHASE 2: BACKEND                                        │
│  - server/index.js                                       │
│  - server/routes/                                        │
│  - server/models/                                        │
│  - server/config/                                        │
│  Verification: npm install ✅, server starts ✅          │
└──────────┬──────────────────────────────────────────────┘
           │
           ▼  Emit: PHASE_CHANGE event
┌─────────────────────────────────────────────────────────┐
│  PHASE 3: FRONTEND                                       │
│  - client/src/App.jsx                                    │
│  - client/src/components/                                │
│  - client/src/pages/                                     │
│  Verification: npm run build ✅, UI renders ✅           │
└──────────┬──────────────────────────────────────────────┘
           │
           ▼
     PROJECT COMPLETE! 🎉
```

---

## 🚀 Kurulum Rehberi

### Prerequisites

```bash
# 1. Node.js (v18+)
node --version  # v18.0.0 or higher

# 2. npm (v9+)
npm --version   # v9.0.0 or higher

# 3. Git
git --version   # Any recent version
```

---

### Installation Steps

#### 1. Clone Repository

```bash
git clone https://github.com/emrahbadas/electron.git
cd electron
```

#### 2. Install Dependencies

```bash
# Main dependencies
npm install

# Proxy server dependencies
cd proxy
npm install
cd ..
```

#### 3. Configure API Keys

**Option A: UI'dan (Recommended)**
1. Uygulamayı başlat
2. Header'da API key inputlarına keylerini yapıştır
3. Save butonuna tıkla

**Option B: Environment Variables**

```bash
# Windows PowerShell
$env:OPENAI_API_KEY="sk-your-key-here"
$env:ANTHROPIC_API_KEY="sk-ant-your-key-here"
$env:GOOGLE_API_KEY="your-google-key-here"

# Linux/Mac
export OPENAI_API_KEY="sk-your-key-here"
export ANTHROPIC_API_KEY="sk-ant-your-key-here"
export GOOGLE_API_KEY="your-google-key-here"
```

#### 4. Start MCP Proxy Server

```bash
# Terminal 1: Start MCP proxy
cd proxy
node server.js

# Should see:
# 🚀 MCP Proxy Server started on http://127.0.0.1:7777
# ✅ Health check available at /health
```

#### 5. Start Application

```bash
# Terminal 2: Start Electron app
npm start

# Should see Electron window open
```

---

### Verification

```bash
# 1. Check MCP Proxy
curl http://127.0.0.1:7777/health
# Expected: {"status":"ok","uptime":123.456}

# 2. Check Tool Bridge (in app console)
window.toolBridge.getSupportedTools()
# Expected: ['fs.read', 'fs.write', 'fs.exists', ...]

# 3. Check Reflexion Applier (in app console)
window.reflexionApplier.getCircuitBreakerStatus()
# Expected: { threshold: 3, recentFixes: 0, ... }
```

---

### Troubleshooting

**Problem: MCP Proxy fails to start**
```bash
# Check if port 7777 is in use
netstat -ano | findstr :7777  # Windows
lsof -i :7777                 # Linux/Mac

# Kill process and retry
```

**Problem: Tool Bridge not initialized**
```javascript
// Check console for errors
// Expected: "🔧 [ToolBridge Init] Successfully initialized with 12 tools"

// Manual initialization (if needed)
import { initializeToolBridge } from './src/agents/tool-bridge.js';
const tb = initializeToolBridge('C:/your/workspace/path');
```

**Problem: Agent not responding**
```javascript
// Check if workspace root is set
window.kodCanavari.workspaceRoot
// Should return: "C:/Users/..."

// If null, set it:
window.kodCanavari.setWorkspaceRoot('C:/path/to/workspace');
```

---

## 👨‍💻 Geliştirici Notları

### Code Style Guide

```javascript
// ✅ GOOD: Turkish comments for business logic
// 🎯 PHASE 1: Skeleton dosyalarını oluştur
const skeletonFiles = ['package.json', 'README.md'];

// ✅ GOOD: English for technical terms
const executeTool = async (toolName, args) => {
    // Implementation
};

// ❌ BAD: Mixed language in same comment
// Create dosyayı oluştur burada

// ✅ GOOD: Emoji markers for categories
// 🔧 FIX: ...
// ✅ FEATURE: ...
// ⚠️ WARNING: ...
// 📝 TODO: ...
```

---

### Key Architecture Patterns

**1. Event-Driven Communication**
```javascript
// Never call UI methods directly from agents
// ❌ BAD
ustaModu.showNarration(...);

// ✅ GOOD
eventBus.emit({
    type: 'NARRATION_BEFORE',
    data: { ... }
});
```

**2. Tool Execution via Bridge**
```javascript
// Never call electronAPI directly from agents
// ❌ BAD
await window.electronAPI.writeFile(path, content);

// ✅ GOOD
await toolBridge.executeTool('fs.write', { path, content });
```

**3. Phase Context Tracking**
```javascript
// Always check if file already created
// ✅ GOOD
if (!this.phaseContext.completedFiles.has(path)) {
    await this.createFileWithAgent(path, content);
    this.phaseContext.completedFiles.add(path);
}
```

**4. Circuit Breaker Pattern**
```javascript
// Always implement retry limits
// ✅ GOOD
if (this.retryCount >= 3) {
    throw new Error('Circuit breaker: Max retries exceeded');
}
```

---

### Performance Considerations

**1. Token Usage Optimization**
```javascript
// Chunk large files before sending to AI
const chunks = chunkByTokens(fileContent, maxTokens=1200, overlap=80);

// Use cheaper models for simple tasks
if (taskComplexity < 5) {
    model = 'gpt-4o-mini';  // Faster & cheaper
}
```

**2. Caching Strategy**
```javascript
// Cache Learning Store patterns
const cachedPattern = learningStore.findInCache(intent);
if (cachedPattern) {
    return cachedPattern.nightOrders;  // Skip AI call
}
```

**3. Lazy Loading**
```javascript
// Load heavy modules only when needed
const loadHeavyModule = async () => {
    return await import('./heavy-module.js');
};
```

---

### Testing Strategy

**Unit Tests:**
```bash
# Test Tool Bridge
npm run test:toolbridge

# Test Reflexion Applier
npm run test:reflexion

# Test Night Orders Validation
npm run test:nightorders
```

**Integration Tests:**
```bash
# Test full agent flow
npm run test:agent

# Test MCP integration
npm run test:mcp
```

**E2E Tests:**
```bash
# Test complete user workflow
npm run test:e2e
```

---

### Debugging Tools

**Console Commands:**

```javascript
// Tool Bridge
window.toolBridge.getSupportedTools()
window.toolBridge.getLog()
window.toolBridge.executeTool('fs.read', { path: 'test.txt' })

// Reflexion Applier
window.reflexionApplier.getHistory()
window.reflexionApplier.getCircuitBreakerStatus()
window.reflexionApplier.clearHistory()

// Session Context
window.kodCanavari.sessionContext.getContext()
window.kodCanavari.sessionContext.markFileCreated('src/index.js')

// MCP Proxy Monitor
window.mcpProxyMonitor.getStatus()
window.mcpProxyMonitor.forceRestart()

// Learning Store
window.kodCanavari.learningStore.getPatterns()
window.kodCanavari.learningStore.findSimilar({ intent: 'blog platform' })
```

---

### Extension Points

**Adding New Tools:**

1. Register in Tool Bridge
```javascript
// src/agents/tool-bridge.js
registerCustomTools() {
    this.supportedTools.set('my.custom.tool', async (args) => {
        // Implementation
        return { success: true, result: '...' };
    });
}
```

2. Add to Night Orders schema
```javascript
// Validation
const ALLOWED_TOOLS = [
    'fs.read', 'fs.write', 'terminal.exec',
    'my.custom.tool'  // Add here
];
```

**Adding New Agent Types:**

```javascript
// src/renderer/app.js
const MyCustomAgent = {
    type: 'CustomAgent',
    purpose: 'Special task handling',
    
    async execute(task) {
        // Agent logic
    }
};

// Register in Luma Supreme Agent
this.agents.set('CustomAgent', MyCustomAgent);
```

**Adding New Reflexion Patterns:**

```javascript
// src/renderer/app.js
const NEW_PATTERN = {
    name: 'MY_CUSTOM_PATTERN',
    trigger: 'specific error message',
    severity: 'CRITICAL',
    suggestedFixes: [
        {
            type: 'UPDATE_FILE',
            path: 'config.js',
            content: '...'
        }
    ]
};

// Add to pattern detection
this.reflexionPatterns.push(NEW_PATTERN);
```

---

## 📝 Version History

### v2.0.0 (2025-01-18) - Tool Bridge System
- ✅ Tool Bridge Layer (12 tools)
- ✅ Reflexion Applier (9 fix types)
- ✅ Circuit Breaker (3x retry limit)
- ✅ CWD Preservation
- ✅ Tool name aliasing
- ✅ MCP Proxy auto-restart

### v1.9.0 (2025-01-17) - MCP Auto-Restart
- ✅ Health monitoring (30s interval)
- ✅ Auto-restart trigger (2 failures)
- ✅ IPC restart handler
- ✅ Process lifecycle management

### v1.8.0 (2025-01-15) - Usta Modu React
- ✅ React-based narration UI
- ✅ Real-time progress tracking
- ✅ Verification display
- ✅ Draggable & collapsible

### v1.7.0 (2025-01-10) - Multi-Phase Projects
- ✅ Phase context tracking
- ✅ File deduplication
- ✅ Phase transitions
- ✅ Complex project scaffolding

### v1.6.0 (2025-01-05) - Reflexion System
- ✅ Self-analysis
- ✅ Pattern detection
- ✅ Auto-fix suggestions
- ✅ Learning Store integration

### v1.5.0 (2025-01-01) - Luma Supreme Agent
- ✅ Multi-agent coordinator
- ✅ Intent detection
- ✅ Priority calculation
- ✅ Agent selection logic

---

## 🎯 Future Roadmap

### Short-term (Q1 2025)
- [ ] Monorepo detection fix (folder existence check)
- [ ] Build script validation (infinite recursion detection)
- [ ] Enhanced error messages
- [ ] Performance profiling dashboard

### Mid-term (Q2 2025)
- [ ] Plugin system
- [ ] Custom agent marketplace
- [ ] Visual workflow editor
- [ ] Team collaboration features

### Long-term (Q3-Q4 2025)
- [ ] Cloud deployment
- [ ] Mobile companion app
- [ ] Voice command support
- [ ] AI model fine-tuning

---

## 📞 İletişim & Destek

**Repository:** https://github.com/emrahbadas/electron  
**Issues:** https://github.com/emrahbadas/electron/issues  
**Wiki:** https://github.com/emrahbadas/electron/wiki  

**Developer:** Emrah Badaş  
**License:** MIT  

---

## 🙏 Teşekkürler

Bu proje aşağıdaki teknolojileri kullanmaktadır:

- **Electron** - Cross-platform desktop apps
- **OpenAI API** - GPT-4o, o1 models
- **Anthropic Claude** - Claude 3.5 Sonnet
- **Google Gemini** - Gemini 2.0 Flash
- **MCP (Model Context Protocol)** - Structured tool execution
- **Prism.js** - Syntax highlighting
- **Font Awesome** - Icon library

---

**Last Updated:** 2025-01-18  
**Document Version:** 2.0.0  
**Status:** ✅ Complete & Production Ready
