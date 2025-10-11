# Blog Platform - Agent Test V2 (Compact - JSON-Safe)

## 🎯 Misyon
Blog platformunu TAM OLARAK kur: 20 dosya oluştur, çalıştır, test et.

---

## 📋 Agent'a Verilecek Prompt (COPY-PASTE)

```
Blog platformu kur - 20 dosya oluştur:

WORKSPACE: C:\Users\emrah badas\OneDrive\Desktop\kodlama\Yeni klasör (5)\blog-platform

ADIM 1: ROOT DOSYALARI (fs.write ile)
1. package.json → workspaces:["server","client"] + scripts:{dev,build}
2. README.md → Kurulum talimatları
3. .gitignore → node_modules, dist

ADIM 2: SERVER DOSYALARI (fs.write ile)
4. server/package.json → type:module + scripts:{dev,build}
5. server/tsconfig.json → ES2020, NodeNext
6. server/src/index.ts → Express app, PORT 5174, health endpoint
7. server/src/routes.ts → GET/POST /api/posts endpoints
8. server/src/db.ts → JSON file read/write helpers
9. server/data/posts.json → Initial "Hello Blog" post

ADIM 3: CLIENT SCAFFOLD (terminal.exec ile)
10. npm create vite@latest client -- --template react-ts

ADIM 4: CLIENT DOSYALARI (fs.write ile)
11. client/vite.config.ts → proxy /api to 5174
12. client/src/main.tsx → ReactDOM.render
13. client/src/App.tsx → BrowserRouter + Routes
14. client/src/components/Layout.tsx → Header + Nav
15. client/src/components/PostCard.tsx → Blog card component
16. client/src/pages/Home.tsx → Fetch and display posts
17. client/src/pages/PostDetail.tsx → Single post + markdown
18. client/src/pages/Admin.tsx → Create post form
19. client/src/lib/api.ts → fetch wrappers
20. client/src/lib/markdown.ts → Simple markdown renderer
21. client/src/styles/index.css → Tailwind imports

ADIM 5: DEPENDENCIES (terminal.exec ile)
- npm install -D concurrently
- npm --workspace server install
- npm --workspace client install
- npm --workspace client install react-router-dom
- npm --workspace client install -D tailwindcss postcss autoprefixer

ADIM 6: VERIFY
- npm run dev:server → http://localhost:5174/api/health
- npm run dev:client → http://localhost:5173

KRİTİK:
- Root package.json MUTLAKA workspaces ve scripts içermeli
- Server klasörü MUTLAKA oluşturulmalı
- Dosya içerikleri MUTLAKA tam yazılmalı (boş bırakma!)

DOSYA İÇERİKLERİ: Aşağıya bak ↓
```

---

## 📝 DOSYA İÇERİKLERİ (Agent için referans)

### 1. Root package.json
```json
{
  "name": "blog-platform",
  "version": "1.0.0",
  "private": true,
  "workspaces": ["server", "client"],
  "scripts": {
    "dev": "concurrently \"npm:dev:server\" \"npm:dev:client\"",
    "dev:server": "npm --workspace server run dev",
    "dev:client": "npm --workspace client run dev",
    "build": "npm --workspace server run build && npm --workspace client run build"
  },
  "devDependencies": {
    "concurrently": "^9.2.1"
  }
}
```

### 2. README.md
```
# Blog Platform
Full-stack blog: Express + Vite React TS

## Setup
npm install

## Run
npm run dev

- Server: http://localhost:5174/api/health
- Client: http://localhost:5173
```

### 3. .gitignore
```
node_modules/
dist/
.env
*.log
```

### 4. server/package.json
```json
{
  "name": "blog-server",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "express": "^5.1.0"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/node": "^20.11.30",
    "tsx": "^4.20.6",
    "typescript": "^5.9.3"
  }
}
```

### 5. server/tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "strict": true,
    "outDir": "./dist",
    "rootDir": "./src"
  }
}
```

### 6. server/src/index.ts
**İçerik:** Express app, cors, json middleware, health endpoint GET /api/health → {ok:true}, router mount, listen PORT 5174

### 7. server/src/routes.ts
**İçerik:** Router, GET /api/posts (tüm yazılar), GET /api/posts/:id (tek yazı), POST /api/posts (validation + slug check)

### 8. server/src/db.ts
**İçerik:** fs/promises, getAllPosts, getPostById, getPostBySlug, createPost, ensureDB helper

### 9. server/data/posts.json
```json
[{"id":"1","title":"Hello Blog","slug":"hello-blog","content":"# Merhaba\n\nBu ilk yazı.","tags":["intro"],"createdAt":"2025-01-10T12:00:00Z"}]
```

### 11. client/vite.config.ts
**İçerik:** defineConfig, react plugin, server.port:5173, proxy /api → http://localhost:5174

### 12-21. Client Dosyaları
- main.tsx → ReactDOM + StrictMode
- App.tsx → BrowserRouter + Routes (/, /post/:slug, /admin)
- Layout.tsx → Header + Nav links
- PostCard.tsx → Blog card with title, excerpt, tags, date
- Home.tsx → useEffect fetch posts, map to PostCard
- PostDetail.tsx → useParams, fetch single post, markdown render
- Admin.tsx → Form (title, slug, content, tags), POST to API
- api.ts → getAllPosts, getPostById, createPost wrappers
- markdown.ts → Simple regex replacer (# → h1, ** → strong)
- index.css → @tailwind base/components/utilities

---

## ✅ Expected Output

```
✅ 20/20 dosya oluşturuldu
✅ Root package.json - workspaces: ["server", "client"]
✅ Root package.json - scripts: {dev, build}
✅ Server klasörü - 6 dosya
✅ Client klasörü - 11 dosya özelleştirildi
✅ npm run dev:server - PASS
✅ npm run dev:client - PASS
✅ http://localhost:5174/api/health - {"ok":true}
✅ http://localhost:5173 - "Hello Blog" görünür

SUCCESS RATE: 100%
```
