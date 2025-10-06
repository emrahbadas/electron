# Masaüstü Uygulaması İçin Tool Server Optimizasyonları

## 🔧 Mevcut Durum vs. Optimizasyon

### Şu Anki Yapı

- **2 ayrı process**: Electron + Tool Server
- **Manuel başlatma**: Tool server'ı elle başlatmak gerekiyor
- **Port conflict riski**: 7777 portu başka uygulama tarafından kullanılabilir

### Optimize Edilmiş Yapı

#### 1. **Otomatik Tool Server Başlatma**

```javascript
// main.js'de otomatik başlatma
const { spawn } = require('child_process');

let toolServerProcess = null;

function startToolServer() {
    toolServerProcess = spawn('node', ['tools-server.js'], {
        cwd: __dirname,
        stdio: 'pipe'
    });
    
    toolServerProcess.on('error', (err) => {
        console.error('Tool server hatası:', err);
    });
}

// App kapatılırken server'ı kapat
app.on('before-quit', () => {
    if (toolServerProcess) {
        toolServerProcess.kill();
    }
});
```

#### 2. **Dinamik Port Bulma**

```javascript
const net = require('net');

function findAvailablePort(startPort = 7777) {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        
        server.listen(startPort, () => {
            const port = server.address().port;
            server.close(() => resolve(port));
        });
        
        server.on('error', () => {
            findAvailablePort(startPort + 1).then(resolve).catch(reject);
        });
    });
}
```

#### 3. **Tek Executable Çözümü**

```javascript
// Package.json'da
{
    "scripts": {
        "build": "electron-builder",
        "dist": "npm run build"
    },
    "build": {
        "files": [
            "src/**/*",
            "tools-server.js",
            "node_modules/**/*"
        ],
        "extraFiles": [
            {
                "from": "tools-server.js",
                "to": "tools-server.js"
            }
        ]
    }
}
```

## 🎯 Önerilen Yaklaşım

### Seçenek 1: **Mevcut Yapıyı Koru (Basit)**

- Manuel tool server başlatma
- Güvenilir ve test edilmiş
- Minimum değişiklik

### Seçenek 2: **Otomatik Başlatma (Önerilen)**

- Electron app açılınca tool server otomatik başlar
- User experience daha iyi
- Orta seviye karmaşıklık

### Seçenek 3: **Tam Entegrasyon**

- Tool server'ı main process'e gömme
- Tek executable
- En karmaşık ama en temiz

## 🚀 Hızlı Uygulama

Şu an için **Seçenek 2**'yi öneririm:

1. **main.js**'ye tool server auto-start ekle
2. **package.json**'a build script'leri ekle  
3. **Portable executable** oluştur

Bu sayede:

- ✅ Tek tıkla çalışır
- ✅ Hiçbir manuel adım yok
- ✅ Güvenlik korunur
- ✅ Maintenance kolay
