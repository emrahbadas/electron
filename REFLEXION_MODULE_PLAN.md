# 🧠 Reflexion Module Implementation Plan

## 📋 Genel Bakış

Mevcut "Night Orders Protocol" sistemimize **Reflexion (Self-Healing)** katmanı ekliyoruz.

**Hedef:** Hata → Kök Neden Analizi → Minimal Patch → Retry

---

## 🎯 Eklenecek Özellikler

### 1. Reflexion Engine (Core)

**Dosya:** `src/renderer/reflexion-engine.js`

**Sorumluluklar:**
- Hata analizi (root cause detection)
- Düzeltme stratejisi belirleme
- Minimal patch üretimi
- Retry decision logic

**API:**
```javascript
class ReflexionEngine {
  async analyze(step, observation, verification) {
    // Hata → Kök neden → Strateji
    return {
      rootCause: "...",
      fixStrategy: "apply_patch|retry_with_args|skip",
      patch: { file: "...", diff: "..." },
      confidence: 0.85
    };
  }
}
```

---

### 2. Patch System (Tool)

**Dosya:** `src/renderer/patch-tool.js`

**Sorumluluklar:**
- Context-aware diff uygulama
- Minimal değişiklik garantisi
- Backup & rollback sistemi

**API:**
```javascript
async function applyPatch(file, diff, cwd) {
  // diff format: "+6-5" → 6 satır ekle, 5 satır sil
  // Context-aware: Etkilenen satırların bağlamını oku
  return { success: true, changedLines: [...] };
}
```

---

### 3. Probe System (Verification)

**Dosya:** `src/renderer/probe-tool.js`

**Sorumluluklar:**
- Port check (server alive?)
- File check (exists? valid?)
- HTTP check (endpoint returns 200?)
- Regex check (output contains expected?)

**API:**
```javascript
async function runProbe(probeConfig) {
  // probeConfig: { type: "port|file|http|regex", target: "..." }
  return { passed: true, evidence: "..." };
}
```

---

### 4. State Machine Enhancement (app.js)

**Mevcut Durum:**
```
PLANNING → APPLYING → VERIFYING → (FAIL → retry 2x) → REPORT
```

**Yeni Durum:**
```
PLANNING → APPLYING → VERIFYING
    ↓ (if fail)
  REFLECTING → FIXING → (retry 3x)
    ↓ (if still fail)
  HARD_FAIL → Detailed Report
```

**Değişiklik:**
- `maxRetries: 2 → 3`
- `verifyStep()` fail → `reflect()` çağır
- `reflect()` output → `applyFix()` → retry

---

## 📂 Dosya Yapısı (Yeni)

```
src/
  renderer/
    app.js (GÜNCELLE)
    reflexion-engine.js (YENİ)
    patch-tool.js (YENİ)
    probe-tool.js (YENİ)
    reflexion-prompts.js (YENİ - LLM prompts)
```

---

## 🔧 Implementation Steps

### Phase 1: Probe Tool (En Basit)

**Amaç:** Verification matrisini daha güçlü yap

**Adımlar:**
1. `probe-tool.js` oluştur
2. Port/File/HTTP/Regex probe fonksiyonları ekle
3. `app.js` içinde `verifyStep()` fonksiyonunu güncelle
4. Test: Blog platform senaryosunda probe'ları kullan

**Kabul Kriteri:**
- Port 5174 açık mı? → PASS/FAIL
- `package.json` var mı? → PASS/FAIL
- `/api/health` 200 dönüyor mu? → PASS/FAIL

---

### Phase 2: Patch Tool (Orta)

**Amaç:** Dosya değişikliklerini minimal tutma

**Adımlar:**
1. `patch-tool.js` oluştur
2. Context-aware diff parser ekle ("+6-5" formatı)
3. Backup sistemi ekle (patch uygulamadan önce)
4. Rollback fonksiyonu ekle (hata durumunda geri al)
5. Test: Basit dosya patch testi

**Kabul Kriteri:**
- `app.js` line 1240-1250 arası değiştir → sadece o satırlar değişsin
- Hata olursa → otomatik rollback
- Patch history log tut

---

### Phase 3: Reflexion Engine (Karmaşık)

**Amaç:** Hata → Kök neden → Strateji

**Adımlar:**
1. `reflexion-engine.js` oluştur
2. `reflexion-prompts.js` oluştur (LLM prompts)
3. `analyze()` fonksiyonu ekle (hata analizi)
4. Common error patterns ekle (ENOENT, port conflict, JSON parse, etc.)
5. Fix strategy logic ekle (retry/patch/skip)
6. Test: Kasıtlı hata senaryoları

**Kabul Kriteri:**
- Port 5174 meşgul → "5175 kullan" stratejisi
- `package.json` yok → "create file" stratejisi
- JSON truncation → "reduce content" stratejisi

---

### Phase 4: State Machine Integration (Final)

**Amaç:** Tüm parçaları birleştir

**Adımlar:**
1. `app.js` içinde `executeOrders()` fonksiyonunu güncelle
2. `REFLECTING` state ekle
3. `reflect()` fonksiyonu ekle (ReflexionEngine kullan)
4. `applyFix()` fonksiyonu ekle (PatchTool kullan)
5. `maxRetries: 2 → 3` değiştir
6. Retry loop'u güncelle (reflect → fix → retry)
7. Test: Blog platform senaryosunu baştan sona çalıştır

**Kabul Kriteri:**
- Hata olunca otomatik root cause analizi
- Minimal patch ile düzeltme
- 3 retry'dan sonra detailed failure report

---

## 🧪 Test Senaryoları

### Scenario 1: Port Conflict
```
1. Server 5174'ü başlat
2. Agent tekrar 5174'ü başlatmaya çalışsın
3. Reflexion: "Port busy" → "Try 5175"
4. Patch: package.json PORT değiştir
5. Retry: Server 5175'te başlasın
```

### Scenario 2: Missing Dependency
```
1. package.json'da "express" yok
2. Server başlatma hatası
3. Reflexion: "Cannot find module 'express'" → "npm install"
4. Fix: npm install express
5. Retry: Server başlasın
```

### Scenario 3: JSON Truncation
```
1. LLM response 8000+ chars
2. JSON parse hatası
3. Reflexion: "Incomplete JSON" → "Reduce file content"
4. Patch: Placeholder comments kullan
5. Retry: Valid JSON üret
```

---

## 📊 Metrikler (Takip Edilecek)

### Before Reflexion (Şu Anki Durum)
- **Success Rate**: %?
- **Avg Retry Count**: ?
- **Hard Fail Rate**: %?
- **Manual Intervention**: %?

### After Reflexion (Hedef)
- **Success Rate**: >%90
- **Avg Retry Count**: <1.5
- **Hard Fail Rate**: <%5
- **Manual Intervention**: <%10

---

## 🔄 Rollout Plan

### Week 1: Probe Tool
- Mon-Tue: Implementation
- Wed: Testing
- Thu-Fri: Integration + Blog test

### Week 2: Patch Tool
- Mon-Tue: Implementation
- Wed: Testing
- Thu-Fri: Integration + Blog test

### Week 3: Reflexion Engine
- Mon-Wed: Implementation
- Thu: Testing
- Fri: Integration

### Week 4: Final Integration
- Mon-Tue: State machine update
- Wed-Thu: End-to-end testing
- Fri: Production release + documentation

---

## 🚨 Risk Assessment

### High Risk
- **Patch System Bugs**: Yanlış dosya değişiklikleri → data loss
  - Mitigation: Her patch öncesi backup, rollback sistemi

### Medium Risk
- **Reflexion Infinite Loop**: Hatalı fix → aynı hata → sonsuz döngü
  - Mitigation: Max 3 retry hard limit

### Low Risk
- **Performance**: Her hata için LLM çağrısı → yavaşlama
  - Mitigation: Common error patterns cache, LLM sadece unknown errors için

---

## 📝 Documentation Updates

### User-Facing
- **README.md**: Reflexion özelliği açıklaması
- **TROUBLESHOOTING.md**: Common errors + auto-fix örnekleri

### Developer-Facing
- **REFLEXION_API.md**: API documentation
- **PATCH_FORMAT.md**: Diff format specification
- **PROBE_TYPES.md**: Probe types + usage examples

---

## ✅ Definition of Done

- [ ] Probe tool implemented + tested
- [ ] Patch tool implemented + tested
- [ ] Reflexion engine implemented + tested
- [ ] State machine integrated
- [ ] Blog platform test passes with auto-fix
- [ ] Documentation updated
- [ ] Metrics dashboard ready
- [ ] Code reviewed + merged to main

---

**Planned Start Date:** 2025-01-11  
**Target Completion:** 2025-02-08 (4 weeks)  
**Owner:** Emrah Badas  
**Status:** 📋 PLANNING

---

## 🔗 Related Documents

- BLOG_PLATFORM_TEST.md - Test scenario
- WORKSPACE_ROOT_FIX_COMPLETE.md - Breaking change details
- FIX_WORKSPACE_ROOT.md - Troubleshooting guide
