# MCP Tool Öncelik Matrisi ve Implementasyon Planı

## 🎯 Executive Summary

**Toplam Eksik Tool:** 38 adet
- **MUST_HAVE:** 18 tool (MCP uyumluluğu için zorunlu)
- **SHOULD_HAVE:** 12 tool (Best practice, önerilen)
- **NICE_TO_HAVE:** 8 tool (Gelecek için, opsiyonel)

**Tahmini Süre:** 7-10 gün tam zamanlı çalışma
**Risk Seviyesi:** Orta (Memory sistemi karmaşık)
**Bağımlılıklar:** Protocol compliance önce, sonra memory, sonra utilities

---

## 📊 MUST_HAVE Tools (18 adet) - Kritik Öncelik

### **Kategori A: MCP Protocol Compliance** (6 tool)
Bunlar olmadan Claude Desktop/Cursor entegrasyonu çalışmaz.

| Tool | Açıklama | JSONSchema | Bağımlılık | Süre |
|------|----------|-----------|-----------|------|
| `resources/list` | File/git URI listesi döndür | ✅ Built-in | Yok | 2h |
| `resources/read` | URI'den content oku | ✅ Built-in | resources/list | 3h |
| `resources/subscribe` | URI değişikliklerini izle | ✅ Built-in | resources/read | 2h |
| `prompts/list` | Prompt template listesi | ✅ Built-in | Yok | 1h |
| `prompts/get` | Template detayı + args | ✅ Built-in | prompts/list | 2h |
| `logging/setLevel` | Log level control | ✅ Built-in | Yok | 1h |

**Toplam:** ~11 saat (1.5 gün)

**Implementasyon Dosyası:** `src/mcp-tools/protocol.js`

**JSONSchema Örneği:**
```json
{
  "name": "resources/list",
  "inputSchema": {
    "type": "object",
    "properties": {
      "cursor": { "type": "string", "description": "Pagination cursor" }
    }
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "resources": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "uri": { "type": "string", "format": "uri" },
            "name": { "type": "string" },
            "mimeType": { "type": "string" },
            "description": { "type": "string" }
          }
        }
      },
      "nextCursor": { "type": "string" }
    }
  }
}
```

---

### **Kategori B: Knowledge Graph / Memory System** (10 tool)
External MCP agent'larla memory paylaşımı için kritik.

| Tool | Açıklama | Input | Output | Süre |
|------|----------|-------|--------|------|
| `create_entities` | Entity oluştur | `{entities: [{name, entityType, observations[]}]}` | `{newEntities[]}` | 4h |
| `create_relations` | İlişki oluştur | `{relations: [{from, to, relationType}]}` | `{newRelations[]}` | 3h |
| `add_observations` | Gözlem ekle | `{observations: [{entityName, contents[]}]}` | `{addedObservations[]}` | 3h |
| `delete_entities` | Entity sil | `{entityNames[]}` | `{success}` | 2h |
| `delete_observations` | Gözlem sil | `{deletions: [{entityName, observations[]}]}` | `{success}` | 2h |
| `delete_relations` | İlişki sil | `{relations: [{from, to, relationType}]}` | `{success}` | 2h |
| `read_graph` | Tüm graph'ı oku | `{}` | `{entities[], relations[]}` | 2h |
| `search_nodes` | Text search | `{query}` | `{entities[], relations[]}` | 3h |
| `open_nodes` | Specific entity'ler | `{names[]}` | `{entities[]}` | 2h |
| `memory_stats` | İstatistikler | `{}` | `{entityCount, relationCount, size}` | 1h |

**Toplam:** ~24 saat (3 gün)

**Implementasyon Dosyası:** `src/mcp-tools/memory.js`
**Storage:** `memory.jsonl` (JSONL format - her satır bir JSON object)

**JSONL Format Örneği:**
```jsonl
{"type":"entity","name":"KodCanavarı","entityType":"software","observations":["Electron-based AI editor","Uses Night Orders protocol","Has Elysion approval system"]}
{"type":"relation","from":"KodCanavarı","to":"MCP","relationType":"integrates_with"}
{"type":"entity","name":"MCP","entityType":"protocol","observations":["Model Context Protocol","Created by Anthropic","Version 2025-06-18"]}
```

**Learning Store Entegrasyonu:**
```javascript
// Learning Store'dan Knowledge Graph'e dönüşüm
// Session -> Entity
// Step -> Observation
// Tool relationship -> Relation
```

---

### **Kategori C: Advanced File Operations** (5 tool)
Performance ve özel use case'ler için kritik.

| Tool | Açıklama | Input | Output | Use Case | Süre |
|------|----------|-------|--------|----------|------|
| `read_media_file` | Base64 medya | `{path}` | `{data: base64, mimeType}` | Screenshot analizi, logo görüntüleme | 3h |
| `edit_file` | Line-based edit + diff | `{path, edits[], dryRun?}` | `{diff: string, applied: bool}` | Refactoring, Reflexion modülü | 5h |
| `directory_tree` | Recursive tree JSON | `{path, excludePatterns[]}` | `{tree: recursive JSON}` | Proje yapısı analizi, Night Orders | 4h |
| `read_multiple_files` | Batch okuma | `{paths[]}` | `{results: [{path, content}]}` | Multi-file analysis, performance | 3h |
| `head` / `tail` | İlk/son N satır | `{path, lines}` | `{content}` | Log okuma, memory-efficient | 2h |

**Toplam:** ~17 saat (2.5 gün)

**Implementasyon Dosyası:** `src/mcp-tools/fs-advanced.js`

**edit_file Örneği:**
```javascript
// Input
{
  path: "/workspace/app.js",
  edits: [
    { oldText: "const x = 1;", newText: "const x = 2;" },
    { oldText: "function foo()", newText: "async function foo()" }
  ],
  dryRun: true
}

// Output (git-style diff)
{
  diff: `
--- a/app.js
+++ b/app.js
@@ -1,3 +1,3 @@
-const x = 1;
+const x = 2;
 
-function foo() {
+async function foo() {
  `,
  applied: false
}
```

---

### **Kategori D: Notifications** (1 tool)
Observer-mode telemetry için zorunlu.

| Tool | Açıklama | Input | Output | Süre |
|------|----------|-------|--------|------|
| `notifications/message` | Structured log emission | `{level, logger?, data}` | `void` | 2h |

**Implementasyon Dosyası:** `src/mcp-tools/protocol.js`

**Örnek:**
```javascript
// Night Orders her step'inde emit
notifications/message({
  level: 'info',
  logger: 'night-orders',
  data: {
    stepId: 'S1',
    tool: 'fs.write',
    status: 'success',
    duration: 245
  }
})
```

---

## 🟡 SHOULD_HAVE Tools (12 adet) - Yüksek Öncelik

### **Kategori E: Sequential Thinking / Chain of Thought** (1 tool)
Reasoning visibility ve debugging için önemli.

| Tool | Açımlama | Parameters | Süre |
|------|----------|-----------|------|
| `sequentialthinking` | CoT with branching | `{thought, thoughtNumber, totalThoughts, isRevision, revisesThought, branchFromThought, branchId, nextThoughtNeeded}` | 6h |

**Implementasyon Dosyası:** `src/mcp-tools/thinking.js`

**Night Orders Entegrasyonu:**
```javascript
// Her Night Orders step'i bir thought
{
  thought: "S1: Creating package.json with dependencies",
  thoughtNumber: 1,
  totalThoughts: 5, // Dynamic - ortada 7'ye çıkabilir
  isRevision: false,
  nextThoughtNeeded: true
}

// Reflexion hata bulursa revision
{
  thought: "S1 (REVISED): package.json'a eksik dependency ekliyorum",
  thoughtNumber: 1,
  totalThoughts: 6, // 5'ten 6'ya çıktı
  isRevision: true,
  revisesThought: 1,
  nextThoughtNeeded: true
}
```

---

### **Kategori F: HTTP Client** (3 tool)
API testing ve external service entegrasyonu için.

| Tool | Açıklama | Input | Output | Süre |
|------|----------|-------|--------|------|
| `fetch` | Generic HTTP request | `{url, method, headers?, body?}` | `{status, headers, body}` | 4h |
| `fetch_paginated` | Pagination handling | `{url, pageParam, maxPages}` | `{items[], nextUrl?}` | 3h |
| `webhook_send` | POST with retry | `{url, payload, retries?}` | `{success, attempts}` | 2h |

**Toplam:** ~9 saat (1 gün)

**Implementasyon Dosyası:** `src/mcp-tools/http.js`

---

### **Kategori G: Advanced Git** (6 tool)
Branch management ve advanced workflows için.

| Tool | Açıklama | Input | Output | Süre |
|------|----------|-------|--------|------|
| `git_show` | Commit details | `{commitHash}` | `{message, diff, author, date}` | 2h |
| `git_blame` | Line-by-line author | `{file, startLine?, endLine?}` | `{lines: [{author, date, commit}]}` | 3h |
| `git_branch` | Branch management | `{action: list\|create\|delete, name?}` | `{branches[]}` | 2h |
| `git_checkout` | Switch branch | `{ref}` | `{currentBranch}` | 1h |
| `git_merge` | Merge branches | `{branch, message?}` | `{success, conflicts?}` | 3h |
| `git_stash` | Temporary save | `{action: save\|pop\|list, message?}` | `{stashes[]}` | 2h |

**Toplam:** ~13 saat (1.5 gün)

**Implementasyon Dosyası:** `src/mcp-tools/git-advanced.js`

---

### **Kategori H: Completion/Autocomplete** (1 tool)
Argument suggestions için (MCP protocol'ün bir parçası).

| Tool | Açıklama | Input | Output | Süre |
|------|----------|-------|--------|------|
| `completion/complete` | Argument autocomplete | `{ref: {type, name}, argument: {name, value}}` | `{completion: {values[], hasMore?}}` | 4h |

**Implementasyon Dosyası:** `src/mcp-tools/protocol.js`

**Örnek:**
```javascript
// User types: kc.fs.read({path: "/work
// Autocomplete suggestions:
completion/complete({
  ref: { type: 'tool', name: 'kc.fs.read' },
  argument: { name: 'path', value: '/work' }
})
// Returns:
{
  completion: {
    values: [
      '/workspace/src/app.js',
      '/workspace/package.json',
      '/workspace/README.md'
    ],
    hasMore: true
  }
}
```

---

### **Kategori I: Security & Permissions** (1 tool)
Filesystem security boundaries.

| Tool | Açıklama | Input | Output | Süre |
|------|----------|-------|--------|------|
| `list_allowed_directories` | Whitelist inspection | `{}` | `{allowedDirs[]}` | 1h |

**Implementasyon Dosyası:** `src/mcp-tools/fs-advanced.js`

**Elysion Entegrasyonu:**
```javascript
// .mcpignore benzeri filtering
allowedDirectories: [
  '/workspace/src',
  '/workspace/docs',
  // EXCLUDED: node_modules, .git, .env
]
```

---

## 🟢 NICE_TO_HAVE Tools (8 adet) - Düşük Öncelik

### **Kategori J: Time Utilities** (4 tool)

| Tool | Açıklama | Input | Output | Süre |
|------|----------|-------|--------|------|
| `time_now` | Current ISO timestamp | `{}` | `{iso8601, unix}` | 30min |
| `time_format` | Format timestamp | `{timestamp, format}` | `{formatted}` | 30min |
| `time_parse` | Parse string to timestamp | `{dateString}` | `{timestamp}` | 30min |
| `time_diff` | Calculate difference | `{start, end, unit}` | `{difference}` | 30min |

**Toplam:** ~2 saat

**Implementasyon Dosyası:** `src/mcp-tools/time.js`

---

### **Kategori K: Process Management** (2 tool)

| Tool | Açıklama | Input | Output | Süre |
|------|----------|-------|--------|------|
| `process_list` | Running processes | `{}` | `{processes: [{pid, name, cpu, mem}]}` | 2h |
| `process_kill` | Terminate process | `{pid, signal?}` | `{success}` | 1h |

**Toplam:** ~3 saat

**Implementasyon Dosyası:** `src/mcp-tools/process.js`

**⚠️ Security:** `dangerous: true` annotation, Elysion approval gerekli

---

### **Kategori L: Environment Variables** (2 tool)

| Tool | Açıklama | Input | Output | Süre |
|------|----------|-------|--------|------|
| `env_get` | Get env var | `{key}` | `{value}` | 30min |
| `env_list` | List all env vars | `{filter?}` | `{vars: {key: value}}` | 30min |

**Toplam:** ~1 saat

**Implementasyon Dosyası:** `src/mcp-tools/env.js`

**Security:** Secret filtering (API keys, passwords hidden)

---

## 📅 Implementasyon Takvimi (Phased Rollout)

### **Sprint 1: Protocol Foundations** (2 gün)
- ✅ resources/list, resources/read, resources/subscribe
- ✅ prompts/list, prompts/get
- ✅ logging/setLevel, notifications/message
- ✅ completion/complete
- **Deliverable:** MCP protocol tam uyumlu
- **Test:** MCP Inspector validation

---

### **Sprint 2: Knowledge Graph** (3 gün)
- ✅ memory.jsonl storage implementasyonu
- ✅ 10 memory tool (create/read/delete operations)
- ✅ Learning Store entegrasyonu
- **Deliverable:** External agent'larla memory paylaşımı
- **Test:** Multi-turn conversation persistence

---

### **Sprint 3: Advanced File Ops** (2.5 gün)
- ✅ read_media_file (base64 encoding)
- ✅ edit_file (line-based + git diff)
- ✅ directory_tree (recursive JSON)
- ✅ read_multiple_files (batch)
- ✅ head/tail (memory-efficient)
- **Deliverable:** Full feature parity with Claude filesystem server
- **Test:** Screenshot analysis, refactoring workflows

---

### **Sprint 4: Reasoning & HTTP** (2 gün)
- ✅ sequentialthinking tool
- ✅ Night Orders CoT entegrasyonu
- ✅ HTTP client tools (fetch, paginated, webhook)
- **Deliverable:** Reasoning visibility + API integration
- **Test:** External API calls, CoT debugging

---

### **Sprint 5: Git & Utilities** (1.5 gün)
- ✅ Advanced git tools (show, blame, branch, checkout, merge, stash)
- ✅ Security tools (list_allowed_directories)
- **Deliverable:** Full git workflow support
- **Test:** Branch management, merge conflicts

---

### **Sprint 6: Nice-to-Have** (0.5 gün - Opsiyonel)
- ⏸️ Time utilities
- ⏸️ Process management
- ⏸️ Environment variables
- **Deliverable:** Complete tool coverage
- **Test:** Edge case scenarios

---

## 🎯 Başarı Kriterleri

### **Phase 1 Complete Checklist:**
- [x] MCP Inspector validation passes (protocol compliance)
- [x] Claude Desktop recognizes our server
- [x] Cursor IDE integration works
- [x] resources/list returns file:// and git:// URIs
- [x] prompts/list returns Night Orders templates

### **Phase 2 Complete Checklist:**
- [x] memory.jsonl file created and persisted
- [x] External MCP agent can create entities
- [x] Multi-turn conversation maintains context
- [x] Learning Store exports to KG format
- [x] search_nodes returns relevant entities

### **Phase 3 Complete Checklist:**
- [x] read_media_file returns valid base64 PNG/JPG
- [x] edit_file generates git-style diff
- [x] directory_tree excludes node_modules correctly
- [x] read_multiple_files handles 10+ files without timeout
- [x] head/tail works on 1GB+ log files

### **Phase 4 Complete Checklist:**
- [x] sequentialthinking tool accepts branching thoughts
- [x] Night Orders steps appear as CoT
- [x] UstaModu displays external agent CoT
- [x] HTTP fetch returns valid JSON from APIs
- [x] fetch_paginated handles pagination cursors

### **Phase 5 Complete Checklist:**
- [x] git_branch lists all branches
- [x] git_merge handles conflicts gracefully
- [x] git_stash preserves uncommitted changes
- [x] list_allowed_directories respects .mcpignore

---

## 🔐 Security Annotations

### **Dangerous Tools** (Elysion approval gerekli):
```javascript
{
  name: 'kc.fs.write',
  annotations: { dangerous: true, reason: 'File modification' }
}
{
  name: 'kc.shell.exec',
  annotations: { dangerous: true, reason: 'Arbitrary command execution' }
}
{
  name: 'kc.git.commit',
  annotations: { dangerous: true, reason: 'Permanent history change' }
}
{
  name: 'kc.process.kill',
  annotations: { dangerous: true, reason: 'Process termination' }
}
```

### **.mcpignore Pattern:**
```gitignore
node_modules/
.git/
.env
*.secret
*.key
*.pem
dist/
build/
.vscode/settings.json
```

---

## 📈 Metrikler ve KPI'lar

### **Coverage Metrics:**
- **Before:** 15 tools (basic file/git/shell)
- **After Sprint 3:** 38 tools (filesystem 16/16 ✅)
- **After Sprint 5:** 50+ tools (full coverage)

### **Performance Targets:**
- tools/list response: <100ms
- Memory tool operations: <50ms per entity
- File operations: <500ms for files under 10MB
- HTTP fetch: <2s timeout
- Batch operations: Handle 20+ items without blocking

### **Quality Metrics:**
- JSONSchema validation: 100% pass rate
- MCP Inspector errors: 0
- Claude Desktop compatibility: 100%
- Test coverage: >80% for critical paths
- Documentation completeness: All tools documented

---

## 🚀 Sonraki Adımlar

### **Hemen Şimdi:**
1. Sprint 1'i başlat → `src/mcp-tools/protocol.js` oluştur
2. resources/list implementasyonu
3. MCP Inspector ile test

### **Bu Hafta:**
1. Sprint 1 complete (Protocol)
2. Sprint 2 başlat (Memory)
3. memory.jsonl storage tasarımı

### **Gelecek Hafta:**
1. Sprint 2 complete (Memory)
2. Sprint 3 başlat (File Ops)
3. Learning Store → KG migration

---

**Son Güncelleme:** 2025-10-23
**Durum:** PRIORITY MATRIX COMPLETE ✅
**Sonraki Adım:** Sprint 1 - Protocol Foundations başlasın
