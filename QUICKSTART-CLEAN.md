# 🚀 KayraDeniz Kod Canavarı - Çalıştırma Rehberi

## Windows PowerShell

### 1) Bağımlılıkları Yükleyin

```powershell
npm install
```

### 2) Geliştirme Modunda Başlatın

```powershell
npm run dev
```

### 3) Üretim Build

```powershell
npm run build
```

### 4) Electron Uygulamasını Başlatın

```powershell
npm start
```

## macOS/Linux

### 1) Bağımlılıkları Yükleyin

```bash
npm install
```

### 2) Geliştirme Modunda Başlatın

```bash
npm run dev
```

### 3) Üretim Build

```bash
npm run build
```

### 4) Electron Uygulamasını Başlatın

```bash
npm start
```

## 🔧 Tool Server (Opsiyonel)

Agent mode için HTTP tool server:

```powershell
# Windows
$env:AGENT_ROOT="C:\path\to\project" ; node tools-server.js
```

```bash
# Unix
AGENT_ROOT="/path/to/project" node tools-server.js
```

## 📁 Portlar

- **Electron App**: Ana uygulama
- **Tool Server**: `http://localhost:7777` (agent mode için)

## 🎯 Notlar

- Agent mode için OpenAI API anahtarı gerekli
- Tool server otomatik IPC fallback yapar
- CSP ayarları geliştirme için optimize edilmiş
