# 🧪 TEST SCENARIO: Learning Store + Night Orders Validation

## Test 1: Simple Project with Intentional Error

Bu test senaryosunda:
1. ✅ Learning Store initialize olacak
2. ✅ Night Orders validation geçecek  
3. ❌ İlk denemede hata yapacak (eksik directory)
4. ✅ CriticAgent düzeltecek
5. ✅ Pattern learning store'a kaydedilecek
6. ✅ Sonraki AI request'lerde pattern inject edilecek

### Kullanıcı Mesajı:
```
Basit bir "Hello World" Node.js projesi oluştur. Package.json ve index.js dosyaları olsun.
```

### Beklenen Night Orders:
```json
{
  "mission": "Create a simple Hello World Node.js project",
  "acceptance": [
    "build: exit 0",
    "files: package.json exists",
    "files: index.js exists"
  ],
  "steps": [
    {
      "id": "S1",
      "tool": "fs.write",
      "args": {
        "path": "hello-world/package.json",
        "content": "{\"name\": \"hello-world\", \"version\": \"1.0.0\", \"main\": \"index.js\"}"
      },
      "explain": {
        "goal": "Create package.json file for Node.js project initialization",
        "rationale": "Every Node.js project needs a package.json to manage dependencies and metadata"
      },
      "verify": ["lint", "build"]
    },
    {
      "id": "S2", 
      "tool": "fs.write",
      "args": {
        "path": "hello-world/index.js",
        "content": "console.log('Hello World');"
      },
      "explain": {
        "goal": "Create main entry point file that prints Hello World message",
        "rationale": "The index.js file is the entry point specified in package.json main field"
      },
      "verify": ["lint"]
    }
  ]
}
```

### Beklenen Senaryo:

#### Phase 1: Initial Attempt (FAIL)
```
🔧 S1: fs.write → hello-world/package.json
❌ ENOENT: no such file or directory 'hello-world'
```

#### Phase 2: CriticAgent Fix (PASS)
```
🧠 CriticAgent analyzing...
💡 Root Cause: Directory not created before file write
🔧 Fix: Add fs.mkdir step before fs.write
✅ S1: fs.write → hello-world/package.json [SUCCESS]
✅ S2: fs.write → hello-world/index.js [SUCCESS]
```

#### Phase 3: Learning Store Update
```
📚 Reflection saved: missing-directory
📈 Pattern updated: missing-directory (count: 1)
```

#### Phase 4: Next AI Request (Pattern Injection)
```
🧠 LEARNED PATTERNS:
- missing-directory: Directory not created before file write → Add fs.mkdir before fs.write (1x)
```

---

## Test 2: Multi-Edit Tool

### Kullanıcı Mesajı:
```
index.js dosyasında oldMessage değişkenini newMessage olarak değiştir ve tüm console.log'ları console.error'a çevir
```

### Beklenen Night Orders:
```json
{
  "mission": "Update variable name and change logging method",
  "acceptance": ["build: exit 0"],
  "steps": [
    {
      "id": "S1",
      "tool": "fs.multiEdit",
      "args": {
        "filepath": "hello-world/index.js",
        "edits": [
          {
            "old_string": "const oldMessage = 'Hello'",
            "new_string": "const newMessage = 'Hello'"
          },
          {
            "old_string": "console.log",
            "new_string": "console.error",
            "replace_all": true
          }
        ]
      },
      "explain": {
        "goal": "Rename variable and change all logging statements atomically",
        "rationale": "Multi-edit ensures all changes apply together or none at all, preventing inconsistent state"
      },
      "verify": ["lint"]
    }
  ]
}
```

---

## Expected Console Output

### App Startup:
```
✅ Learning Store initialized
📁 Created learn/ directory
📝 Created reflections.jsonl
📝 Created patterns.json
```

### Night Orders Execution:
```
🧭 NIGHT ORDERS PROTOCOL ACTIVATED!
📋 Mission: Create a simple Hello World Node.js project
🎯 Acceptance Criteria: ['build: exit 0', 'files: package.json exists', 'files: index.js exists']
✅ Night Orders schema validated (Zod)
✅ Night Orders arguments validated (parseArgs)
🎯 PHASE 1 STARTED: Create a simple Hello World Node.js project
```

### Step Execution:
```
📝 NARRATION_BEFORE: Create package.json file for Node.js project initialization
🔧 Executing S1: fs.write
❌ ENOENT: no such file or directory
🧠 CriticAgent analyzing...
💡 Root cause: Directory not created before file write
🔧 Applying fix: Add fs.mkdir step
✅ Step S1 completed successfully
📊 NARRATION_AFTER: Successfully created package.json
```

### Learning Store:
```
📚 Reflection saved: missing-directory
📈 Pattern updated: missing-directory (count: 1)
```

---

## Checklist

### Phase 1 - Test (Current)
- [ ] Electron app açıldı
- [ ] DevTools console açık
- [ ] Learning Store initialize mesajı görüldü
- [ ] Basit proje için Night Orders gönderildi
- [ ] Validation PASS
- [ ] İlk hata CriticAgent tarafından düzeltildi
- [ ] Pattern learning store'a kaydedildi
- [ ] İkinci AI request'de pattern inject edildi

### Phase 2 - Multi-Edit Implementation
- [ ] `executeMultiEdit()` method oluşturuldu
- [ ] Atomic edit logic (all-or-nothing)
- [ ] Sequential processing
- [ ] replace_all support
- [ ] Error handling

### Phase 3 - Learning Dashboard
- [ ] React component oluşturuldu
- [ ] Pattern list görselleştirmesi
- [ ] Success rate chart
- [ ] Reflection timeline
- [ ] UstaModu entegrasyonu

---

## Next Steps

1. **ŞİMDİ**: Electron app'te chat'e "Basit bir Hello World Node.js projesi oluştur" yaz
2. **İZLE**: Console'da validation + learning store loglarını
3. **DOĞRULA**: learn/ dizininde reflections.jsonl ve patterns.json güncellenmiş mi?
4. **SONRA**: Multi-Edit implementation
5. **EN SON**: Learning Dashboard
