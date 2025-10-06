# 🤖 GitHub Models API - Proxy Server

Bu dizin, Electron uygulaması için **GitHub Models API** entegrasyonunu sağlayan proxy sunucusunu içerir.

## 📁 Dosyalar

```
proxy/
├── simple-server.js     # Ana proxy sunucusu (dependencies gerekmez)
├── start-server.bat     # Windows başlatma scripti
├── test-client.js       # Test istemcisi
└── README.md           # Bu dosya
```

## ⚡ Hızlı Kurulum

### 1. GitHub Token Oluşturun
1. https://github.com/settings/tokens adresine gidin
2. **"Generate new token"** → **"Fine-grained personal access token"**
3. **Repository access**: "All repositories" veya specific repo seçin
4. **Permissions** → **"Model endpoints"** → **"Read"** seçin
5. Token'ı kopyalayın

### 2. Sunucuyu Başlatın
```bash
# Proxy klasörüne gidin
cd proxy

# Token ile sunucuyu başlatın (Windows)
set GITHUB_TOKEN=your_token_here && node simple-server.js

# Veya bat dosyası ile
start-server.bat
```

### 3. Test Edin
```bash
# Ayrı terminal'de test çalıştırın
node test-client.js

# Veya browser'da test edin
# http://127.0.0.1:3001/health
```

## 🔧 API Endpoints

| Endpoint | Method | Açıklama |
|----------|--------|----------|
| `/health` | GET | Sunucu durumu |
| `/ai/chat` | POST | Chat completions |
| `/ai/models` | GET | Kullanılabilir modeller |

## 📝 Chat Request Örneği

```javascript
fetch('http://127.0.0.1:3001/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        messages: [
            { role: 'user', content: 'Merhaba!' }
        ],
        model: 'gpt-4o-mini',
        max_tokens: 1000
    })
})
.then(res => res.json())
.then(data => console.log(data.choices[0].message.content));
```

## 🚀 Modeller

- **gpt-4o-mini** (Önerilen - hızlı)
- **gpt-4o** (Daha güçlü)
- **claude-3.5-sonnet** (Anthropic)
- **llama-3-70b** (Meta)

## ⚠️ Notlar

- Sunucu **127.0.0.1:3001** adresinde çalışır
- CORS tüm originler için aktif
- GitHub token olmadan çalışmaz
- Node.js native fetch API kullanır (v18+)

## 🔍 Sorun Giderme

### "GITHUB_TOKEN bulunamadı"
```bash
# Windows'da token ayarlayın
set GITHUB_TOKEN=ghp_your_token_here
node simple-server.js
```

### "Server yanıt vermiyor"
```bash
# Port 3001 kontrol edin
netstat -an | findstr 3001

# Başka port kullanın
set PORT=3002 && node simple-server.js
```

### "API Error 401"
- GitHub token geçerli mi kontrol edin
- Fine-grained token "Model endpoints" permission var mı?

## ✅ Sistem Hazır!

Proxy sunucusu çalıştığında Electron uygulamasındaki AI chat sistemi aktif hale gelir.

**Test için**: Electron uygulamasını çalıştırın ve AI chat butonuna tıklayın!