# Blog Platformu – Uçtan Uca Smoke Test (Agent Test Senaryosu)

## 🎯 Misyon
Minimal fakat üretim kurallarına uygun bir full-stack blog platformu kur, çalıştır, kendi kendini doğrula.

**Teknolojiler:** Node 20+, Express, Vite + React + TypeScript, TailwindCSS, Markdown render (remark/rehype), JSON dosya tabanı.

**Hedef:** npm install → npm run dev → tarayıcıda blog liste/okuma/yazma akışının çalıştığını kanıtla.

---

## 🔥 Altın Kurallar

1. ✅ **Önce dosya ağacını TAM kur, sonra içerik yaz** (Boş bırakma, hepsini doldur)
2. ✅ **Her adımda probe ve acceptance doğrulaması yap**; hata varsa düzelt, tekrar dene
3. ✅ **Terminal komutlarını MCP üzerinden çalıştır** (run_cmd tool'unu kullan)
4. ✅ **CWD her zaman mutlak path** (boşluk/parantez içeriyorsa çift tırnak kullan)

---

## 📁 Dizin Yapısı (ilk adımda hepsini yarat)

```
blog-platform/
  package.json
  README.md
  .gitignore
  server/
    package.json
    tsconfig.json
    src/
      index.ts
      routes.ts
      db.ts
    data/
      posts.json
  client/
    package.json
    index.html
    tsconfig.json
    vite.config.ts
    postcss.config.js
    tailwind.config.js
    src/
      main.tsx
      App.tsx
      pages/
        Home.tsx
        PostDetail.tsx
        Admin.tsx
      components/
        Layout.tsx
        PostCard.tsx
      lib/
        api.ts
        markdown.ts
      styles/
        index.css
```

---

## 🎯 Plan (Yüksek Seviye)

### ⚠️ ÖNEMLİ: Önce Workspace Root Seçin!
**KRITIK:** Agent çalıştırmadan önce:
1. Sol panelde "📁 Klasör Seç" butonuna tıklayın
2. Bu klasöre gidin: `C:\Users\emrah badas\OneDrive\Desktop\kodlama\Yeni klasör (5)\blog-platform`
3. **Eğer `blog-platform` klasörü yoksa önce oluşturun:**
   ```powershell
   mkdir "C:\Users\emrah badas\OneDrive\Desktop\kodlama\Yeni klasör (5)\blog-platform"
   ```

### 1. Proje İskeleti
- **Konum:** `C:\Users\emrah badas\OneDrive\Desktop\kodlama\Yeni klasör (5)\blog-platform`
- **Root:** Workspace package.json + concurrently
- **Server:** Express REST API (PORT=5174)
- **Client:** Vite React TS (PORT=5173)

### 2. Server (Express)
**REST Endpoints:**
- `GET /api/health` → `{"ok":true}`
- `GET /api/posts` → Tüm yazılar
- `GET /api/posts/:id` → Tek yazı
- `POST /api/posts` → Yeni yazı (body: `{title, slug, content, tags}`)

**Kalıcı Depolama:** `data/posts.json`

### 3. Client (Vite React TS)
**Sayfalar:**
- **Home:** Son yazılar listesi
- **PostDetail:** Markdown render
- **Admin:** Yeni yazı oluşturma formu (POST)

**UI:** Tailwind + basit layout (Header, Container, Footer)

### 4. Scriptler
Root'tan `concurrently` ile server+client aynı anda:
```bash
npm run dev
```

### 5. Doğrulama
- Health check: `http://localhost:5174/api/health`
- Liste: `http://localhost:5174/api/posts` → "Hello Blog" örnek yazı
- POST: Admin'den yeni yazı → liste güncellenmesi

---

## 📦 Paket Yapılandırmaları

### Root `package.json`
```json
{
  "name": "blog-platform",
  "private": true,
  "workspaces": ["server", "client"],
  "scripts": {
    "dev": "concurrently \"npm:dev:server\" \"npm:dev:client\"",
    "dev:server": "npm --workspace server run dev",
    "dev:client": "npm --workspace client run dev",
    "build": "npm --workspace server run build && npm --workspace client run build"
  },
  "devDependencies": {
    "concurrently": "^9.0.0"
  }
}
```

### Server `package.json`
```json
{
  "name": "blog-server",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "express": "^4.19.2"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.11.30",
    "tsx": "^4.7.0",
    "typescript": "^5.5.0"
  }
}
```

### Client `package.json`
```json
{
  "name": "blog-client",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview --port 5175"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.1",
    "remark": "^15.0.1",
    "remark-parse": "^11.0.0",
    "rehype-raw": "^7.0.0",
    "remark-rehype": "^11.1.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.41",
    "tailwindcss": "^3.4.10",
    "typescript": "^5.5.0",
    "vite": "^5.4.0"
  }
}
```

---

## 🔧 İçerik Gereksinimleri

### `server/src/index.ts`
- Express app, CORS, JSON body
- `GET /api/health` → `200, {ok:true}`
- Router mount
- `PORT=5174`

### `server/src/routes.ts`
- `GET /api/posts` → Tüm yazılar
- `GET /api/posts/:id` → Tek yazı
- `POST /api/posts` → slug unique; boş title/content reddet

### `server/src/db.ts`
- `data/posts.json` okuma/yazma helper
- Dosya yoksa oluştur

### `server/data/posts.json`
```json
[
  {
    "id": "1",
    "title": "Hello Blog",
    "slug": "hello-blog",
    "content": "# Merhaba\n\nBu ilk yazı.",
    "tags": ["intro"],
    "createdAt": "2025-01-10T12:00:00Z"
  }
]
```

### Client
- **main.tsx/App.tsx:** Router: `/` (Home), `/post/:slug` (Detail), `/admin` (Yeni yazı)
- **pages/Home.tsx:** `/api/posts`'tan liste (title, excerpt)
- **pages/PostDetail.tsx:** slug ile fetch, Markdown render
- **pages/Admin.tsx:** Form → POST `/api/posts`, başarılıysa `/`'a dön
- **lib/api.ts:** BaseURL env ile veya relative (proxy)
- **lib/markdown.ts:** Markdown render helper
- **styles/index.css:** Tailwind imports

### Vite Proxy
`vite.config.ts` içinde:
```ts
export default {
  server: {
    proxy: {
      '/api': 'http://localhost:5174'
    }
  }
}
```

---

## ⚙️ Kurulum Komutları (Agent için)

**Not:** Tüm komutlar `run_cmd` tool ile çalıştırılmalı!

**⚠️ KRITIK:** Workspace root zaten seçilmiş olmalı! Tüm komutlar **mevcut workspace root içinde** çalışır.

### 1. Proje Oluşturma
```bash
# NOT: cd komutu KULLANMA! Tüm komutlar workspace root'tan çalışacak.
# Sadece npm/npx komutlarını çalıştır.

# Root workspace klasöründe (agent otomatik CWD kullanır)
npm init -y
npm install -D concurrently

# Server alt klasörü oluştur
npm init -y --workspace server
cd server && npm install express cors
cd server && npm install -D typescript tsx @types/node @types/express
cd server && npx tsc --init

# Client alt klasörü oluştur
npm create vite@latest client -- --template react-ts
cd client && npm install
cd client && npm install react-router-dom remark remark-parse rehype-raw remark-rehype
cd client && npm install -D tailwindcss postcss autoprefixer @vitejs/plugin-react
cd client && npx tailwindcss init -p
```

### 2. Çalıştırma
```bash
# Root'tan
npm run dev
```

### 3. Build
```bash
npm run build
```

---

## ✅ Acceptance & Probe'lar

### Sürüm Probeleri
```bash
node -v          # → exit 0, v20.x+
npm -v           # → exit 0, 10.x+
```

### Server Health
```bash
curl http://localhost:5174/api/health
# → {"ok":true}
```

### İlk Veri
```bash
curl http://localhost:5174/api/posts
# → [{...,"slug":"hello-blog"}]
```

### Client Dev
- `http://localhost:5173/` → Home listede "Hello Blog" görünür
- `http://localhost:5173/post/hello-blog` → Markdown render olur

### Admin POST
- Formdan yeni yazı oluştur → liste güncellenir

### Exit Codes
Tüm kurulum/çalıştırma adımlarında `0`.

---

## 🔧 Hata Durumunda Otomatik Onarım

1. **Port çakışması** → server PORT +1 (5174→5175), client preview 5176
2. **JSON yazma hatası** → `data/` yoksa oluştur, izin kontrolü, tekrar dene
3. **npm ENOENT** → Komutları `shell: true` ile çalıştır (Windows için)

---

## 📊 Çıktı Raporu (İstenen)

✅ Kullanılan Node/npm sürümleri  
✅ Server ve client portları  
✅ Probe sonuç tablosu (PASS/FAIL)  
✅ Oluşturulan slug'lar listesi  
✅ Kısa "next steps" (auth, pagination, SEO)

---

## 🚀 Agent'a Verme Şekli

### ⚠️ ADIM 1: Workspace Root Ayarla (MANUEL)
1. Uygulamada **"📁 Klasör Seç"** butonuna tıkla
2. Bu klasöre git: `C:\Users\emrah badas\OneDrive\Desktop\kodlama\Yeni klasör (5)`
3. Eğer yoksa önce Terminal'de oluştur:
   ```powershell
   mkdir "C:\Users\emrah badas\OneDrive\Desktop\kodlama\Yeni klasör (5)\blog-platform"
   ```
4. Folder picker'da `blog-platform` klasörünü seç

### ADIM 2: Basitleştirilmiş Prompt (CHAT BOX'A YAPIŞTIR)

```
Minimal blog platformu kur ve test et:

WORKSPACE: Zaten seçilmiş (blog-platform klasörü)

SERVER:
- Express REST API (PORT=5174)
- Endpoints: GET /api/health, GET /api/posts, GET /api/posts/:id, POST /api/posts
- JSON dosya: data/posts.json (1 örnek post: "Hello Blog")

CLIENT:
- Vite React TS (PORT=5173)
- Sayfalar: Home (liste), PostDetail (markdown), Admin (yeni yazı)
- Vite proxy: /api → http://localhost:5174

KOMUTLAR (workspace root'tan):
1. npm init -y
2. npm install -D concurrently
3. Server: npm install express cors tsx typescript
4. Client: npm create vite@latest client -- --template react-ts
5. npm run dev (concurrently ile)

TEST:
- http://localhost:5174/api/health → {"ok":true}
- http://localhost:5173/ → "Hello Blog" görünsün
- Admin'den POST → liste güncellensin

Her adımda probe yap, hata varsa düzelt. Bitince rapor ver.
```
