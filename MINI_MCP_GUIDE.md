# 🔧 Mini MCP (Management Control Platform) Entegrasyon Kılavuzu

## 📋 İçindekiler
1. [Genel Bakış](#genel-bakış)
2. [Mimari](#mimari)
3. [Kurulum](#kurulum)
4. [Endpoint'ler](#endpointler)
5. [Kullanım Senaryoları](#kullanım-senaryoları)
6. [Güvenlik](#güvenlik)
7. [Hata Yönetimi](#hata-yönetimi)

---

## 🎯 Genel Bakış

Mini MCP, **KayraDeniz Kod Canavarı**'na şu yetenekleri kazandırır:

### ❌ Eskiden (MCP Olmadan)
- LLM kod üretir → Sen dosyaya yazarsın → **Derlenmedi mi? Bilmiyoruz**
- "BUILD: FAIL" → **Sahte/boş sinyaller** (package.json yoksa bile)
- Next.js projesine `index.html` yaz → **Hata kaçtı, çalışmadı**
- Terminal komutu → **Çıktı kayıp, timeout yok, güvenlik sıfır**

### ✅ Şimdi (MCP İle)
- LLM kod üretir → **MCP derler + test eder + probe yapar** → Gerçek sonuç LLM'e geri döner
- **Context Guard:** Next.js'te `index.html` yazımı engellenir
- **Verification Matrix:** Lint + Build + Test + Probe → Hepsi bir arada
- **Gerçek metrikler:** `exit code=0` ✅ / `HTTP 200` ✅ / `stderr` ❌

---

## 🏗️ Mimari

```
[Electron UI (app.js)]
   │
   ├─ Agent (LLM Router)
   │    ├─ kayra-tools-integration.js (Client)
   │    └─ Feedback Loop (MCP sonuçları → LLM'e)
   │
   └─ Mini MCP Server (http://localhost:3001/mcp/*)
        ├─ /fs/{read,write,exists}    → Dosya işlemleri + placeholder kontrolü
        ├─ /shell/run                 → Güvenli komut (whitelist + timeout)
        ├─ /build                     → npm run build (gerçek exit code)
        ├─ /test                      → npm test (gerçek sonuçlar)
        ├─ /probe                     → HTTP health check (200 kontrolü)
        ├─ /context/guard             → Next.js vs Vite kuralları
        └─ /verify                    → Hepsini birden (Verification Matrix)
```

### Çakışma Yok!
- Mevcut `proxy/server.js` → `http://localhost:3001/ai/*` (AI endpoints)
- Mini MCP → `http://localhost:3001/mcp/*` (Tool endpoints)
- **Tek port (3001), ayrı namespace'ler**

---

## 🚀 Kurulum

### 1. Server'ı Başlat

```powershell
cd proxy
node server.js
```

**Çıktı:**
```
🚀 AI Proxy Server running on http://127.0.0.1:3001
🔧 Mini MCP mounted at /mcp/*

🔧 Mini MCP Endpoints:
   - FS: /mcp/fs/{read,write,exists}
   - Shell: /mcp/shell/run
   - Build: /mcp/build
   - Test: /mcp/test
   - Probe: /mcp/probe
   - Guard: /mcp/context/guard
   - Verify: /mcp/verify
   - Health: /mcp/health
```

### 2. Health Check

**Browser'da:** http://127.0.0.1:3001/mcp/health

**PowerShell:**
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:3001/mcp/health" -Method Get
```

**Beklenen Çıktı:**
```json
{
  "ok": true,
  "name": "KayraDeniz Mini MCP",
  "version": "1.0.0",
  "uptime": 123.456,
  "workdir": "C:\\Users\\...",
  "allowedCommands": ["npm", "npx", "node", "pnpm", "yarn", "git"]
}
```

---

## 📡 Endpoint'ler

### 1. **FS: Read** → `/mcp/fs/read`

**İstek:**
```json
POST /mcp/fs/read
{
  "path": "src/app/page.tsx"
}
```

**Cevap:**
```json
{
  "ok": true,
  "path": "src/app/page.tsx",
  "data": "export default function Home() {...}",
  "size": 1234,
  "modified": "2025-10-09T12:34:56.789Z"
}
```

---

### 2. **FS: Write** → `/mcp/fs/write`

**İstek:**
```json
POST /mcp/fs/write
{
  "path": "src/components/Card.tsx",
  "data": "export const Card = () => { return <div>...</div>; };"
}
```

**✅ Başarılı:**
```json
{
  "ok": true,
  "path": "src/components/Card.tsx",
  "size": 456,
  "written": "2025-10-09T12:35:00.123Z"
}
```

**❌ Placeholder Hatası:**
```json
{
  "ok": false,
  "error": "❌ Placeholder tespit edildi! Gerçek kod yazın.",
  "detected": "TODO"
}
```

**Engellenen Pattern'ler:**
- `TODO`
- `PLACEHOLDER`
- `<GÜNCELLE>`
- `lorem ipsum`
- `...existing code...`

---

### 3. **Shell: Run** → `/mcp/shell/run`

**İstek:**
```json
POST /mcp/shell/run
{
  "cmd": "npm",
  "args": ["install", "axios"],
  "cwd": ".",
  "timeout": 120000
}
```

**✅ Başarılı:**
```json
{
  "ok": true,
  "code": 0,
  "stdout": "added 5 packages...",
  "stderr": "",
  "command": "npm install axios"
}
```

**❌ Whitelist Hatası:**
```json
{
  "ok": false,
  "error": "❌ Komut izin listesinde değil: rm",
  "allowed": ["npm", "npx", "node", "pnpm", "yarn", "git"]
}
```

---

### 4. **Build** → `/mcp/build`

**İstek:**
```json
POST /mcp/build
{
  "cwd": "."
}
```

**✅ Başarılı (Next.js):**
```json
{
  "ok": true,
  "code": 0,
  "stdout": "Route (app) compiled successfully in 2.3s...",
  "context": {
    "hasNext": true,
    "hasVite": false,
    "framework": "Next.js"
  }
}
```

**❌ Build Hatası:**
```json
{
  "ok": false,
  "code": 1,
  "stderr": "Module not found: Can't resolve 'tailwindcss'",
  "context": {
    "hasNext": true,
    "hasVite": false,
    "framework": "Next.js"
  }
}
```

**⚠️ Atlandı:**
```json
{
  "ok": false,
  "skip": true,
  "reason": "package.json bulunamadı",
  "suggestion": "Önce npm init veya proje oluşturma"
}
```

---

### 5. **Test** → `/mcp/test`

**İstek:**
```json
POST /mcp/test
{
  "cwd": ".",
  "testFile": "src/__tests__/Card.test.tsx"
}
```

**Cevap:**
```json
{
  "ok": true,
  "code": 0,
  "stdout": "PASS src/__tests__/Card.test.tsx\n  Card component\n    ✓ renders correctly (23 ms)"
}
```

---

### 6. **Probe** → `/mcp/probe`

**İstek:**
```json
POST /mcp/probe
{
  "url": "http://localhost:3000",
  "timeout": 5000
}
```

**✅ Başarılı (200 OK):**
```json
{
  "ok": true,
  "status": 200,
  "statusText": "OK",
  "bodyLength": 4567,
  "bodyPreview": "<!DOCTYPE html><html>...",
  "url": "http://localhost:3000",
  "timestamp": "2025-10-09T12:40:00.000Z"
}
```

**❌ Başarısız (Bağlanamadı):**
```json
{
  "ok": false,
  "error": "connect ECONNREFUSED 127.0.0.1:3000",
  "code": "ECONNREFUSED"
}
```

---

### 7. **Context Guard** → `/mcp/context/guard`

**İstek:**
```json
POST /mcp/context/guard
{
  "cwd": "."
}
```

**Cevap (Next.js):**
```json
{
  "ok": true,
  "framework": "Next.js",
  "rules": [
    {
      "type": "block",
      "pattern": "index.html",
      "reason": "Next.js projelerinde index.html yazılamaz (pages/ veya app/ kullanın)"
    }
  ],
  "dependencies": {
    "next": true,
    "vite": false,
    "react": true
  }
}
```

**Cevap (Vite):**
```json
{
  "ok": true,
  "framework": "Vite",
  "rules": [
    {
      "type": "require",
      "pattern": "index.html",
      "reason": "Vite projelerinde kök dizinde index.html gerekli"
    }
  ],
  "dependencies": {
    "next": false,
    "vite": true,
    "react": true
  }
}
```

---

### 8. **Verification Matrix** → `/mcp/verify`

**İstek:**
```json
POST /mcp/verify
{
  "cwd": ".",
  "checkLint": true,
  "checkBuild": true,
  "checkProbe": true,
  "probeUrl": "http://localhost:3000"
}
```

**✅ Tüm Kontroller Başarılı:**
```json
{
  "ok": true,
  "timestamp": "2025-10-09T12:45:00.000Z",
  "cwd": "C:\\Users\\...",
  "checks": {
    "guard": {
      "ok": true,
      "framework": "Next.js",
      "rules": [...]
    },
    "lint": {
      "ok": true,
      "warnings": 0,
      "errors": 0
    },
    "build": {
      "ok": true,
      "output": "Route (app) compiled successfully..."
    },
    "probe": {
      "ok": true,
      "status": 200
    }
  }
}
```

**❌ Build Başarısız:**
```json
{
  "ok": false,
  "checks": {
    "build": {
      "ok": false,
      "output": "Module not found: 'tailwindcss'"
    }
  }
}
```

---

## 💡 Kullanım Senaryoları

### Senaryo 1: "Next.js blog projesi oluştur"

**Prompt:** "Next.js + Tailwind blog iskeleti kur, ana sayfada kart hover var."

**Agent Akışı:**

1. **Context Guard:**
   ```javascript
   const guard = await kayraTools.checkContextGuard('.');
   // Result: framework="Next.js", rules=[{block: "index.html"}]
   ```

2. **FS Write (package.json, app/, etc.):**
   ```javascript
   await kayraTools.callMcp('/fs/write', {
     path: 'package.json',
     data: JSON.stringify({ dependencies: { next: "14.0.0", ... } })
   });
   ```

3. **Shell Install:**
   ```javascript
   await kayraTools.callMcp('/shell/run', {
     cmd: 'npm',
     args: ['install']
   });
   ```

4. **Build:**
   ```javascript
   const buildResult = await kayraTools.buildProject('.');
   // Result: { ok: false, stderr: "Cannot find module 'tailwindcss'" }
   ```

5. **Geri Besleme → LLM:**
   ```
   Build FAIL:
   - stderr: "Cannot find module 'tailwindcss'"
   - Eksik bağımlılık tespit edildi
   - Öneri: devDependencies'e tailwindcss ekle
   ```

6. **Düzeltme (package.json güncelleme):**
   ```javascript
   await kayraTools.callMcp('/fs/write', {
     path: 'package.json',
     data: '... + tailwindcss, postcss, autoprefixer ...'
   });
   ```

7. **Tekrar Build:**
   ```javascript
   const retry = await kayraTools.buildProject('.');
   // Result: { ok: true, code: 0 }
   ```

8. **Probe:**
   ```javascript
   await kayraTools.probeUrl('http://localhost:3000');
   // Result: { ok: true, status: 200 }
   ```

**Kazanç:** Tek prompt → Otomatik kur + derle + test + düzelt.

---

### Senaryo 2: "Card.tsx'e bakır underline animasyonu ekle"

**Prompt:** "Card.tsx'e hover'da bakır renk underline animasyonu ekle."

**Agent Akışı:**

1. **FS Read:**
   ```javascript
   const file = await kayraTools.callMcp('/fs/read', {
     path: 'src/components/Card.tsx'
   });
   // Mevcut kodu al
   ```

2. **LLM Patch Üret → FS Write:**
   ```javascript
   await kayraTools.callMcp('/fs/write', {
     path: 'src/components/Card.tsx',
     data: '...updated code with hover effect...'
   });
   ```

3. **Verification Matrix:**
   ```javascript
   const verify = await kayraTools.runVerification({
     checkLint: true,
     checkBuild: true,
     checkProbe: false
   });
   // Result: { ok: false, checks: { lint: { ok: true }, build: { ok: false, output: "syntax error" } } }
   ```

4. **Geri Besleme → LLM:**
   ```
   Build FAIL:
   - Syntax error on line 12: "missing closing bracket"
   ```

5. **Düzeltme:**
   ```javascript
   await kayraTools.callMcp('/fs/write', {
     path: 'src/components/Card.tsx',
     data: '...fixed code...'
   });
   ```

6. **Tekrar Verify:**
   ```javascript
   const retry = await kayraTools.runVerification();
   // Result: { ok: true }
   ```

**Kazanç:** Hatalı kod anında yakalanır, LLM düzeltir.

---

### Senaryo 3: "Vite projesini dev modda başlat ve probe yap"

**Prompt:** "npm run dev ile başlat, sonra sağlık kontrolü yap."

**Agent Akışı:**

1. **Context Guard:**
   ```javascript
   const guard = await kayraTools.checkContextGuard('.');
   // Result: framework="Vite"
   ```

2. **Shell Run (background):**
   ```javascript
   await kayraTools.callMcp('/shell/run', {
     cmd: 'npm',
     args: ['run', 'dev']
   });
   // Dev server başlatılır (5173 portu)
   ```

3. **Probe:**
   ```javascript
   const probe = await kayraTools.probeUrl('http://localhost:5173');
   // Result: { ok: true, status: 200 }
   ```

4. **Başarı:**
   ```
   ✅ Vite dev server çalışıyor (http://localhost:5173)
   ```

**Kazanç:** "Çalıştırıldı" değil, **gerçek HTTP 200 kontrolü**.

---

## 🔒 Güvenlik

### 1. Komut Whitelist
**İzin Verilen:**
- `npm`, `npx`, `node`, `pnpm`, `yarn`, `git`

**Engellenen:**
- `rm`, `del`, `format`, `shutdown`, vb.

### 2. Sandbox Kök Klasör
```javascript
const ROOT = process.env.WORKDIR || process.cwd();
const safe = (p) => path.resolve(ROOT, p);
```
- Tüm dosya işlemleri `ROOT` içine kısıtlı
- Path traversal (`../../../`) engelli

### 3. Timeout
- Shell: 60 saniye (default)
- Build: 300 saniye (5 dakika)
- Test: 180 saniye (3 dakika)
- Probe: 5 saniye

### 4. Placeholder Kontrolü
**Engellenen Pattern'ler:**
```regex
/TODO|PLACEHOLDER|<GÜNCELLE>|lorem ipsum|\.\.\..*code.*\.\.\./i
```

---

## ⚠️ Hata Yönetimi

### Hata Türleri

1. **MCP Kullanılamıyor:**
   ```javascript
   if (!kayraTools.mcpHealthy) {
       throw new Error('Mini MCP kullanılamıyor - fallback mode aktif');
   }
   ```

2. **Schema Hatası:**
   ```json
   {
     "ok": false,
     "error": "❌ fs/write schema hatası: Eksik parametreler [path, data]"
   }
   ```

3. **Build/Test Hatası:**
   ```json
   {
     "ok": false,
     "code": 1,
     "stderr": "Module not found: ...",
     "context": { "framework": "Next.js" }
   }
   ```

4. **Probe Hatası:**
   ```json
   {
     "ok": false,
     "error": "connect ECONNREFUSED",
     "code": "ECONNREFUSED"
   }
   ```

### Geri Besleme Formatı (LLM'e)

```markdown
## Verification Results

**Timestamp:** 2025-10-09T12:45:00.000Z
**Framework:** Next.js

### Context Guard
✅ Framework tespit edildi: Next.js
⚠️ Kural: index.html yazılamaz

### Lint
✅ Uyarı: 0, Hata: 0

### Build
❌ FAIL (exit code: 1)
**Stderr:**
```
Module not found: Can't resolve 'tailwindcss'
  at resolveModule (internal)
```

**Öneri:** devDependencies'e ekle:
- tailwindcss
- postcss
- autoprefixer

### Probe
⏭️ Atlandı (build başarısız)

---

**Sonraki Adım:** package.json'a eksik bağımlılıkları ekle ve tekrar build.
```

---

## 🧪 Test Komutları

### PowerShell

**Health Check:**
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:3001/mcp/health" -Method Get
```

**FS Read:**
```powershell
$body = @{ path = "package.json" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://127.0.0.1:3001/mcp/fs/read" -Method Post -ContentType "application/json" -Body $body
```

**Build:**
```powershell
$body = @{ cwd = "." } | ConvertTo-Json
Invoke-RestMethod -Uri "http://127.0.0.1:3001/mcp/build" -Method Post -ContentType "application/json" -Body $body
```

**Verification Matrix:**
```powershell
$body = @{ 
    cwd = "."; 
    checkLint = $true; 
    checkBuild = $true; 
    checkProbe = $false 
} | ConvertTo-Json
Invoke-RestMethod -Uri "http://127.0.0.1:3001/mcp/verify" -Method Post -ContentType "application/json" -Body $body
```

---

## 📊 Performans

| Endpoint       | Ortalama Süre | Timeout     |
|----------------|---------------|-------------|
| `/fs/read`     | ~5ms          | -           |
| `/fs/write`    | ~10ms         | -           |
| `/shell/run`   | 1-10s         | 60s         |
| `/build`       | 30-120s       | 300s (5dk)  |
| `/test`        | 10-60s        | 180s (3dk)  |
| `/probe`       | 100-500ms     | 5s          |
| `/verify`      | 60-180s       | 360s (6dk)  |

---

## 🎯 Kabul Kriterleri (Hemen Ölç)

✅ **Sıfır JSON Hatası:** Schema doğrulama geçerse PASS  
✅ **MCP Up Kontrolü:** Health check 200 dönmüyorsa UI banner  
✅ **Gerçek Build:** `npm run build` exit code=0 → PASS  
✅ **Gerçek Probe:** HTTP 200 → PASS, diğer → FAIL  
✅ **Placeholder Yok:** `fs/write` içinde TODO/... varsa RED  

---

## 🚀 Hızlı Başlangıç

1. **Server'ı başlat:**
   ```powershell
   cd proxy
   node server.js
   ```

2. **Electron uygulamasını aç:**
   ```powershell
   npm start
   ```

3. **Prompt ver:**
   ```
   "Next.js + Tailwind blog projesi oluştur, build et, probe yap"
   ```

4. **Arka planda MCP çalışır:**
   - FS write (package.json, app/, etc.)
   - Shell run (npm install)
   - Build (npm run build)
   - Context guard (Next.js tespit)
   - Probe (http://localhost:3000)

5. **Sonuç:**
   ```
   ✅ Proje oluşturuldu
   ✅ Build başarılı
   ✅ Server çalışıyor (http://localhost:3000)
   ```

---

## 📚 Ek Kaynaklar

- **MCP Kodu:** `proxy/mcp-mini.js`
- **Client Entegrasyonu:** `src/renderer/kayra-tools-integration.js`
- **Server Mount:** `proxy/server.js`
- **Loglama:** Console'da `🔧`, `🏗️`, `🧪`, `🔍` ikonları

---

**Son Güncelleme:** 2025-10-09  
**Versiyon:** 1.0.0  
**Yazar:** KayraDeniz Takımı
