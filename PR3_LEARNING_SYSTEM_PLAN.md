# 🟢 PR-3: ÖĞRENME SİSTEMİ (Learning Store)

## 📊 **Hedef**

Sistemin kendi hatalarından öğrenmesi ve pattern'lere dönüştürmesi.

```
FAIL (hata) → Analyze (kök neden) → Fix (düzeltme) → PASS (başarı)
                                                           ↓
                                                    KAYDET (learn/)
```

---

## 🎯 **Görevler (4 saat)**

### ✅ **3.1: Learning Store - JSONL Dosya Sistemi** (1.5 saat)

#### **Dosya:** `learn/reflections.jsonl`

**Format:**
```jsonl
{"timestamp":1729000000,"mission":"Blog platform oluştur","step":"S3","tool":"run_cmd","error":"ENOENT: npm not found","rootCause":"npm package missing","fix":"npm install","result":"PASS","pattern":"MODULE_NOT_FOUND"}
{"timestamp":1729000100,"mission":"React app deploy","step":"S1","tool":"run_cmd","error":"Port 3000 in use","rootCause":"Previous process not killed","fix":"Kill port 3000","result":"PASS","pattern":"PORT_IN_USE"}
```

**Schema (Zod):**
```typescript
import { z } from 'zod';

export const ReflectionSchema = z.object({
  timestamp: z.number(),
  mission: z.string(),
  step: z.string(),
  tool: z.string(),
  error: z.string(),
  rootCause: z.string(),
  fix: z.string(),
  result: z.enum(['PASS', 'FAIL', 'RETRY']),
  pattern: z.string().optional(),
  metadata: z.record(z.unknown()).optional()
});

export type Reflection = z.infer<typeof ReflectionSchema>;
```

#### **Implementation:** `src/renderer/learning-store.js`

```javascript
/**
 * 📚 LEARNING STORE
 * 
 * FAIL → PASS tracking system.
 * Stores reflections in JSONL format.
 */

const fs = require('fs');
const path = require('path');

class LearningStore {
    constructor() {
        this.learningDir = path.join(process.cwd(), 'learn');
        this.reflectionsFile = path.join(this.learningDir, 'reflections.jsonl');
        this.patternsFile = path.join(this.learningDir, 'patterns.json');
        
        this.init();
        
        console.log('✅ Learning Store initialized');
    }
    
    /**
     * Initialize learning directory and files
     */
    init() {
        // Create learn/ directory if not exists
        if (!fs.existsSync(this.learningDir)) {
            fs.mkdirSync(this.learningDir, { recursive: true });
            console.log('📁 Created learn/ directory');
        }
        
        // Create reflections.jsonl if not exists
        if (!fs.existsSync(this.reflectionsFile)) {
            fs.writeFileSync(this.reflectionsFile, '', 'utf8');
            console.log('📝 Created reflections.jsonl');
        }
        
        // Create patterns.json if not exists
        if (!fs.existsSync(this.patternsFile)) {
            const initialPatterns = {
                lastUpdated: Date.now(),
                patterns: []
            };
            fs.writeFileSync(this.patternsFile, JSON.stringify(initialPatterns, null, 2), 'utf8');
            console.log('📝 Created patterns.json');
        }
    }
    
    /**
     * Save a reflection (FAIL → PASS event)
     * @param {Object} reflection - Reflection data
     */
    saveReflection(reflection) {
        const entry = {
            timestamp: Date.now(),
            mission: reflection.mission || 'Unknown',
            step: reflection.step || 'Unknown',
            tool: reflection.tool || 'Unknown',
            error: reflection.error || '',
            rootCause: reflection.rootCause || '',
            fix: reflection.fix || '',
            result: reflection.result || 'FAIL',
            pattern: reflection.pattern || null,
            metadata: reflection.metadata || {}
        };
        
        // Append to JSONL file
        const line = JSON.stringify(entry) + '\n';
        fs.appendFileSync(this.reflectionsFile, line, 'utf8');
        
        console.log('📚 Reflection saved:', entry.pattern || entry.error);
        
        // Update patterns if successful fix
        if (entry.result === 'PASS' && entry.pattern) {
            this.updatePattern(entry);
        }
        
        return entry;
    }
    
    /**
     * Update pattern database
     * @param {Object} reflection - Successful reflection
     */
    updatePattern(reflection) {
        const patterns = this.loadPatterns();
        
        // Find existing pattern or create new
        let pattern = patterns.patterns.find(p => p.id === reflection.pattern);
        
        if (pattern) {
            // Update existing pattern
            pattern.count += 1;
            pattern.lastSeen = Date.now();
            pattern.fixes.push({
                timestamp: reflection.timestamp,
                fix: reflection.fix,
                mission: reflection.mission
            });
        } else {
            // Create new pattern
            pattern = {
                id: reflection.pattern,
                count: 1,
                firstSeen: Date.now(),
                lastSeen: Date.now(),
                rootCause: reflection.rootCause,
                fixes: [{
                    timestamp: reflection.timestamp,
                    fix: reflection.fix,
                    mission: reflection.mission
                }]
            };
            patterns.patterns.push(pattern);
        }
        
        patterns.lastUpdated = Date.now();
        
        // Save patterns
        fs.writeFileSync(this.patternsFile, JSON.stringify(patterns, null, 2), 'utf8');
        
        console.log(`📈 Pattern updated: ${reflection.pattern} (count: ${pattern.count})`);
    }
    
    /**
     * Load all patterns
     * @returns {Object} Patterns object
     */
    loadPatterns() {
        try {
            const data = fs.readFileSync(this.patternsFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('❌ Error loading patterns:', error.message);
            return { lastUpdated: Date.now(), patterns: [] };
        }
    }
    
    /**
     * Get pattern by ID
     * @param {string} patternId - Pattern identifier
     * @returns {Object|null} Pattern or null
     */
    getPattern(patternId) {
        const patterns = this.loadPatterns();
        return patterns.patterns.find(p => p.id === patternId) || null;
    }
    
    /**
     * Get top N most common patterns
     * @param {number} limit - Number of patterns
     * @returns {Array} Top patterns
     */
    getTopPatterns(limit = 10) {
        const patterns = this.loadPatterns();
        return patterns.patterns
            .sort((a, b) => b.count - a.count)
            .slice(0, limit);
    }
    
    /**
     * Load all reflections
     * @param {number} limit - Max number of reflections (0 = all)
     * @returns {Array} Reflections
     */
    loadReflections(limit = 0) {
        try {
            const data = fs.readFileSync(this.reflectionsFile, 'utf8');
            const lines = data.trim().split('\n').filter(line => line.length > 0);
            
            const reflections = lines.map(line => {
                try {
                    return JSON.parse(line);
                } catch (e) {
                    console.error('❌ Invalid JSONL line:', line);
                    return null;
                }
            }).filter(r => r !== null);
            
            // Return limited or all
            if (limit > 0) {
                return reflections.slice(-limit); // Last N reflections
            }
            return reflections;
        } catch (error) {
            console.error('❌ Error loading reflections:', error.message);
            return [];
        }
    }
    
    /**
     * Get statistics
     * @returns {Object} Stats
     */
    getStats() {
        const reflections = this.loadReflections();
        const patterns = this.loadPatterns();
        
        const totalReflections = reflections.length;
        const successfulFixes = reflections.filter(r => r.result === 'PASS').length;
        const failedFixes = reflections.filter(r => r.result === 'FAIL').length;
        const totalPatterns = patterns.patterns.length;
        
        return {
            totalReflections,
            successfulFixes,
            failedFixes,
            totalPatterns,
            successRate: totalReflections > 0 ? (successfulFixes / totalReflections * 100).toFixed(1) : 0,
            topPatterns: this.getTopPatterns(5)
        };
    }
    
    /**
     * Search reflections by error or pattern
     * @param {string} query - Search query
     * @returns {Array} Matching reflections
     */
    search(query) {
        const reflections = this.loadReflections();
        const lowerQuery = query.toLowerCase();
        
        return reflections.filter(r => 
            r.error.toLowerCase().includes(lowerQuery) ||
            r.rootCause.toLowerCase().includes(lowerQuery) ||
            (r.pattern && r.pattern.toLowerCase().includes(lowerQuery))
        );
    }
    
    /**
     * Clear all reflections (dangerous!)
     */
    clear() {
        fs.writeFileSync(this.reflectionsFile, '', 'utf8');
        console.log('🗑️ All reflections cleared');
    }
}

// Singleton export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LearningStore;
}
```

---

### ✅ **3.2: CriticAgent Integration** (1 saat)

**Konum:** `src/renderer/critic-agent.js` → Mevcut kodu genişlet

```javascript
// critic-agent.js içine ekle:

/**
 * Save successful fix to learning store
 * @param {Object} analysisResult - Analysis result with fix plan
 * @param {Object} fixResult - Fix execution result
 */
saveLearning(analysisResult, fixResult) {
    if (!window.kodCanavari?.learningStore) {
        console.warn('⚠️ Learning store not available');
        return;
    }
    
    const reflection = {
        mission: window.kodCanavari.currentMission || 'Unknown',
        step: analysisResult.failedStep || 'Unknown',
        tool: analysisResult.tool || 'Unknown',
        error: analysisResult.stderr || analysisResult.error || 'Unknown error',
        rootCause: analysisResult.rootCause || 'Unknown',
        fix: analysisResult.fixPlan.map(f => f.description).join(' → '),
        result: fixResult.success ? 'PASS' : 'FAIL',
        pattern: analysisResult.pattern || null,
        metadata: {
            attempts: fixResult.attempts || 1,
            duration: fixResult.duration || 0
        }
    };
    
    window.kodCanavari.learningStore.saveReflection(reflection);
}
```

**Konum:** `src/renderer/app.js` → `executeWithLiveUpdates()` içinde

```javascript
// Line ~9060 civarı, CriticAgent'ın executeFix'inden sonra:

const fixResult = await this.criticAgent.executeFix(analysisResult.fixPlan);

if (fixResult.success) {
    console.log('✅ CriticAgent fixed the issue!');
    
    // 📚 LEARNING: Save successful fix
    this.criticAgent.saveLearning(analysisResult, fixResult);
    
    // Retry original operation
    continue; // Retry loop
}
```

---

### ✅ **3.3: Pattern Injection (Pre-Planning)** (45 dk)

**Hedef:** AI'ya plan oluştururken geçmiş pattern'leri göster.

**Konum:** `src/renderer/app.js` → `callAI()` fonksiyonu

```javascript
async callAI(prompt, options = {}) {
    const { systemPrompt = '', temperature = 0.7 } = options;
    
    // 📚 PATTERN INJECTION: Load learning patterns
    let learningContext = '';
    if (this.learningStore) {
        const stats = this.learningStore.getStats();
        const topPatterns = stats.topPatterns;
        
        if (topPatterns.length > 0) {
            learningContext = `\n\n📚 LEARNED PATTERNS (from past failures):\n`;
            learningContext += topPatterns.map(p => {
                const lastFix = p.fixes[p.fixes.length - 1];
                return `- ${p.id}: ${p.rootCause} → Fix: ${lastFix.fix} (seen ${p.count}x)`;
            }).join('\n');
            learningContext += `\n\nUse these patterns to avoid repeating mistakes.\n`;
        }
    }
    
    const fullPrompt = systemPrompt + learningContext + '\n\n' + prompt;
    
    // ... mevcut AI call kodu
}
```

---

### ✅ **3.4: Quality Gates** (45 dk)

#### **A) ESLint Configuration**

**Dosya:** `.eslintrc.json`

```json
{
  "env": {
    "browser": true,
    "node": true,
    "es2021": true
  },
  "extends": [
    "eslint:recommended"
  ],
  "parserOptions": {
    "ecmaVersion": 12,
    "sourceType": "module"
  },
  "rules": {
    "no-unused-vars": "warn",
    "no-console": "off",
    "no-undef": "error",
    "no-constant-condition": "warn",
    "prefer-const": "warn",
    "no-var": "warn"
  }
}
```

#### **B) Zod Schema Validation**

**Install:**
```bash
npm install zod
```

**Dosya:** `src/renderer/schemas.js`

```javascript
const { z } = require('zod');

// Night Orders Schema
const NightOrdersSchema = z.object({
    mission: z.string().min(10, 'Mission must be at least 10 characters'),
    acceptance: z.array(z.string()).min(1, 'At least one acceptance criteria required'),
    steps: z.array(z.object({
        id: z.string().regex(/^S\d+$/, 'Step ID must be S1, S2, etc.'),
        tool: z.enum(['fs.write', 'run_cmd', 'fs.read', 'fs.delete']),
        args: z.record(z.unknown()),
        explain: z.object({
            goal: z.string().min(30, 'Goal must be at least 30 characters'),
            rationale: z.string().min(50, 'Rationale must be at least 50 characters'),
            tradeoffs: z.string().optional(),
            showDiff: z.boolean().optional()
        }).optional(),
        verify: z.array(z.string()).optional()
    })).min(1, 'At least one step required')
});

// Validate function
function validateNightOrders(orders) {
    try {
        NightOrdersSchema.parse(orders);
        return { valid: true };
    } catch (error) {
        return {
            valid: false,
            errors: error.errors.map(e => ({
                path: e.path.join('.'),
                message: e.message
            }))
        };
    }
}

module.exports = { NightOrdersSchema, validateNightOrders };
```

**Integration:** `src/renderer/app.js` → `executeNightOrders()`

```javascript
async executeNightOrders(orders, approvalToken = null) {
    console.log('🎯 Executing Night Orders:', orders.mission);
    
    // 🔍 VALIDATE: Zod schema check
    const { validateNightOrders } = require('./schemas');
    const validation = validateNightOrders(orders);
    
    if (!validation.valid) {
        console.error('❌ Invalid Night Orders:', validation.errors);
        throw new Error(`Schema validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }
    
    // ... rest of execution
}
```

---

## 📊 **PR-3 Özet**

**Tamamlanan:**
- ✅ Learning Store (JSONL tracking)
- ✅ CriticAgent integration (auto-save fixes)
- ✅ Pattern injection (AI learns from past)
- ✅ Quality gates (ESLint + Zod)

**Sonuç:**
```
ÖNCESİ: Aynı hatalar tekrar ediliyor
SONRASI: Her hata → pattern → AI öğreniyor → tekrar etmiyor
```

---

## 🚀 **Test Senaryosu**

```bash
# 1. Sistem bir hata yapsın (npm bulunamadı)
AI: "npm run dev" komutu çalıştır
RESULT: FAIL (npm not found)

# 2. CriticAgent düzeltsin
CriticAgent: "npm install" çalıştır
RESULT: PASS

# 3. Learning Store kaydetsin
learn/reflections.jsonl:
{"error":"npm not found","fix":"npm install","result":"PASS","pattern":"MODULE_NOT_FOUND"}

# 4. Bir dahaki sefere AI bilsin
AI (yeni proje): "Önce npm install, sonra npm run dev"
RESULT: Hata yok, direkt başarılı!
```

---

**Şimdi ne yapalım?**

**A)** Bu planı hemen uygulayalım (4 saat, adım adım)
**B)** Önce git commit yapalım (mevcut değişiklikler)
**C)** İkisini de yapalım (commit + PR-3 implementation)

Hangisi? 🚀
