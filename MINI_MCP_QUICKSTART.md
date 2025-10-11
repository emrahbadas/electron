# 🔧 Mini MCP Kurulum ve Kullanım Hızlı Kılavuz

## 🚀 Hızlı Başlangıç

### 1. Mini MCP Server'ı Başlat (Port 7777)

**Windows (Batch):**
```cmd
start-mcp.bat
```

**Manuel:**
```powershell
node "c:\Users\emrah badas\OneDrive\Desktop\KayraDeniz-Kod-Canavari\proxy\mcp-standalone.js"
```

**Çıktı:**
```
🔧 Mini MCP Standalone Server
📡 Running on http://127.0.0.1:7777
✅ Health: http://127.0.0.1:7777/health
```

### 2. Electron Uygulamasını Başlat

**Yeni terminal:**
```powershell
npm start
```

### 3. Test Et

**Prompt ver:**
```
"Next.js + Tailwind blog projesi oluştur, build et, localhost:3000'de çalıştır"
```

**Console'da kontrol:**
```javascript
// MCP bağlantısı başarılı olmalı
✅ MCP tools available
```

---

## 🔍 Sorun Giderme

### Sorun 1: MCP Offline
```
⚠️ MCP tools offline - falling back to chat-only mode
```

**Çözüm:**
```powershell
# Port kontrolü
netstat -ano | findstr :7777

# Eğer boşsa, server'ı başlat
node "c:\Users\emrah badas\OneDrive\Desktop\KayraDeniz-Kod-Canavari\proxy\mcp-standalone.js"

# Health check
curl.exe http://127.0.0.1:7777/health
```

### Sorun 2: Terminal Timeout
```
❌ Command timeout (npx create-next-app)
```

**Sebep:** Electron IPC timeout (uzun işlemler için yetersiz)

**Çözüm:** Mini MCP `/shell/run` endpoint'ini kullan (300s timeout)

**Örnek:**
```javascript
// Eskiden (IPC - 30s timeout)
await electronAPI.runCommand('npx create-next-app my-app');

// Şimdi (MCP - 300s timeout)
await fetch('http://127.0.0.1:7777/shell/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        cmd: 'npx',
        args: ['create-next-app', 'my-app', '--ts'],
        timeout: 300000 // 5 dakika
    })
});
```

### Sorun 3: Port Zaten Kullanımda
```
Error: listen EADDRINUSE: address already in use :::7777
```

**Çözüm:**
```powershell
# Process'i bul
netstat -ano | findstr :7777

# PID'yi kopyala (son sütun) ve durdur
taskkill /F /PID <PID>

# Server'ı tekrar başlat
node proxy\mcp-standalone.js
```

---

## 📊 MCP vs IPC Karşılaştırma

| Özellik | IPC (Electron) | Mini MCP |
|---------|----------------|----------|
| **Timeout** | ~30s | 60s - 300s |
| **Long-running** | ❌ Takılır | ✅ Kuyruk ile |
| **Build/Test** | ❌ Timeout | ✅ Gerçek exit code |
| **Placeholder Check** | ❌ Yok | ✅ Var |
| **Context Guard** | ❌ Yok | ✅ Next.js/Vite |
| **Verification** | ❌ Yok | ✅ Lint+Build+Probe |

---

## 🎯 Önerilen Kullanım

### Proje Oluşturma
```javascript
// 1. Mini MCP ile proje oluştur (timeout=300s)
const result = await fetch('http://127.0.0.1:7777/shell/run', {
    method: 'POST',
    body: JSON.stringify({
        cmd: 'npx',
        args: ['create-next-app@latest', 'my-blog', '--ts'],
        timeout: 300000
    })
});

// 2. Context Guard kontrolü
const guard = await fetch('http://127.0.0.1:7777/context/guard', {
    method: 'POST',
    body: JSON.stringify({ cwd: 'my-blog' })
});

// 3. Build
const build = await fetch('http://127.0.0.1:7777/build', {
    method: 'POST',
    body: JSON.stringify({ cwd: 'my-blog' })
});

// 4. Probe
const probe = await fetch('http://127.0.0.1:7777/probe', {
    method: 'POST',
    body: JSON.stringify({ url: 'http://localhost:3000' })
});
```

---

## 🔄 Otomatik Başlatma (İsteğe Bağlı)

**package.json'a ekle:**
```json
{
  "scripts": {
    "start": "npm run start:mcp & npm run start:electron",
    "start:mcp": "node proxy/mcp-standalone.js",
    "start:electron": "electron ."
  }
}
```

**Windows için:**
```powershell
# start-all.bat oluştur
@echo off
start "Mini MCP" cmd /k node proxy\mcp-standalone.js
timeout /t 3 /nobreak
start "Electron" cmd /k npm start
```

---

## 📝 Son Kontrol Listesi

✅ **Önce MCP'yi başlat** (`node proxy\mcp-standalone.js`)  
✅ **Port 7777'nin açık olduğunu doğrula** (`curl http://127.0.0.1:7777/health`)  
✅ **Electron'u başlat** (`npm start`)  
✅ **Console'da MCP bağlantısını kontrol et** (✅ MCP tools available)  
✅ **Prompt ver ve test et**

---

**Hazırlayan:** GitHub Copilot  
**Tarih:** 2025-10-10  
**Versiyon:** 1.1.0
