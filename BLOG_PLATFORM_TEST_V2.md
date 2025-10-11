# Blog Platformu – Agent Test Senaryosu V2 (Düzeltilmiş)

## 🎯 Misyon
Full-stack blog platformu **TAM OLARAK** kur: Tüm dosyaları oluştur, içeriklerini yaz, çalıştır, test et.

**Teknolojiler:** Node 20+, Express, Vite + React + TypeScript, TailwindCSS, Markdown render (remark/rehype), JSON dosya tabanı.

**Hedef:** npm install → npm run dev → tarayıcıda blog liste/okuma/yazma akışının çalıştığını kanıtla.

---

## 🔥 KRİTİK KURALLAR (Agent için)

1. ✅ **ÖNCE TÜM DOSYALARI OLUŞTUR** - create_file tool ile 20 dosya yarat
2. ✅ **SONRA npm komutlarını çalıştır** - install işlemleri
3. ✅ **Her dosyanın İÇERİĞİNİ TAM YAZ** - Boş bırakma!
4. ✅ **package.json'lara scripts ekle** - npm init'ten sonra düzenle
5. ✅ **Probe ile doğrula** - Her adımda kontrol et

---

## 📁 OLUŞTURULACAK DOSYALAR (20 adet - Sırayla yap!)

### Adım 1: Root Dosyaları (3 dosya)

#### 1.1 `package.json` (Root)
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
  },
  "description": "Full-stack blog platform with Express and React"
}
```

#### 1.2 `README.md` (Root)
```markdown
# Blog Platform

Full-stack blog platformu: Express REST API + Vite React TS

## Kurulum
\`\`\`bash
npm install
\`\`\`

## Çalıştırma
\`\`\`bash
npm run dev
\`\`\`

- Server: http://localhost:5174/api/health
- Client: http://localhost:5173
```

#### 1.3 `.gitignore` (Root)
```
node_modules/
dist/
.env
*.log
.DS_Store
```

### Adım 2: Server Dosyaları (6 dosya)

#### 2.1 `server/package.json`
```json
{
  "name": "blog-server",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
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

#### 2.2 `server/tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

#### 2.3 `server/src/index.ts`
```typescript
import express from 'express';
import cors from 'cors';
import router from './routes.js';

const app = express();
const PORT = 5174;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

// Routes
app.use('/api', router);

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`🔍 Health check: http://localhost:${PORT}/api/health`);
});
```

#### 2.4 `server/src/routes.ts`
```typescript
import { Router } from 'express';
import * as db from './db.js';

const router = Router();

// GET /api/posts - Tüm yazılar
router.get('/posts', async (req, res) => {
  try {
    const posts = await db.getAllPosts();
    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// GET /api/posts/:id - Tek yazı
router.get('/posts/:id', async (req, res) => {
  try {
    const post = await db.getPostById(req.params.id);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    res.json(post);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch post' });
  }
});

// POST /api/posts - Yeni yazı
router.post('/posts', async (req, res) => {
  try {
    const { title, slug, content, tags } = req.body;
    
    // Validation
    if (!title || !slug || !content) {
      return res.status(400).json({ error: 'title, slug, content required' });
    }

    // Check slug uniqueness
    const existing = await db.getPostBySlug(slug);
    if (existing) {
      return res.status(409).json({ error: 'Slug already exists' });
    }

    const newPost = await db.createPost({ title, slug, content, tags: tags || [] });
    res.status(201).json(newPost);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create post' });
  }
});

export default router;
```

#### 2.5 `server/src/db.ts`
```typescript
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DB_PATH = join(__dirname, '../data/posts.json');

interface Post {
  id: string;
  title: string;
  slug: string;
  content: string;
  tags: string[];
  createdAt: string;
}

// Initialize DB
async function ensureDB() {
  if (!existsSync(DB_PATH)) {
    await mkdir(dirname(DB_PATH), { recursive: true });
    await writeFile(DB_PATH, JSON.stringify([], null, 2));
  }
}

export async function getAllPosts(): Promise<Post[]> {
  await ensureDB();
  const data = await readFile(DB_PATH, 'utf-8');
  return JSON.parse(data);
}

export async function getPostById(id: string): Promise<Post | null> {
  const posts = await getAllPosts();
  return posts.find(p => p.id === id) || null;
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  const posts = await getAllPosts();
  return posts.find(p => p.slug === slug) || null;
}

export async function createPost(data: Omit<Post, 'id' | 'createdAt'>): Promise<Post> {
  const posts = await getAllPosts();
  const newPost: Post = {
    ...data,
    id: String(posts.length + 1),
    createdAt: new Date().toISOString()
  };
  posts.push(newPost);
  await writeFile(DB_PATH, JSON.stringify(posts, null, 2));
  return newPost;
}
```

#### 2.6 `server/data/posts.json`
```json
[
  {
    "id": "1",
    "title": "Hello Blog",
    "slug": "hello-blog",
    "content": "# Merhaba\n\nBu ilk yazı. Blog platformuna hoş geldiniz!",
    "tags": ["intro", "welcome"],
    "createdAt": "2025-01-10T12:00:00Z"
  }
]
```

### Adım 3: Client Dosyaları (11 dosya)

**NOT:** Client klasörü Vite ile oluşturulacak ama özelleştirilmesi gerekiyor!

#### 3.1 `client/vite.config.ts` (ÖNEMLİ: Proxy ekle!)
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5174',
        changeOrigin: true
      }
    }
  }
});
```

#### 3.2 `client/src/main.tsx`
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

#### 3.3 `client/src/App.tsx`
```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import PostDetail from './pages/PostDetail';
import Admin from './pages/Admin';

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/post/:slug" element={<PostDetail />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
```

#### 3.4 `client/src/components/Layout.tsx`
```tsx
import { Link } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <nav className="flex justify-between items-center">
            <Link to="/" className="text-2xl font-bold text-blue-600">
              Blog Platform
            </Link>
            <div className="space-x-4">
              <Link to="/" className="text-gray-600 hover:text-gray-900">
                Home
              </Link>
              <Link to="/admin" className="text-gray-600 hover:text-gray-900">
                Admin
              </Link>
            </div>
          </nav>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}
```

#### 3.5 `client/src/components/PostCard.tsx`
```tsx
import { Link } from 'react-router-dom';

interface PostCardProps {
  id: string;
  title: string;
  slug: string;
  content: string;
  tags: string[];
  createdAt: string;
}

export default function PostCard({ title, slug, content, tags, createdAt }: PostCardProps) {
  const excerpt = content.substring(0, 150) + '...';
  
  return (
    <article className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition">
      <Link to={`/post/${slug}`}>
        <h2 className="text-2xl font-bold text-gray-900 mb-2 hover:text-blue-600">
          {title}
        </h2>
      </Link>
      <p className="text-gray-600 mb-4">{excerpt}</p>
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          {tags.map(tag => (
            <span key={tag} className="px-2 py-1 bg-blue-100 text-blue-600 rounded text-sm">
              {tag}
            </span>
          ))}
        </div>
        <time className="text-sm text-gray-500">
          {new Date(createdAt).toLocaleDateString('tr-TR')}
        </time>
      </div>
    </article>
  );
}
```

#### 3.6 `client/src/pages/Home.tsx`
```tsx
import { useEffect, useState } from 'react';
import PostCard from '../components/PostCard';
import { getAllPosts } from '../lib/api';

interface Post {
  id: string;
  title: string;
  slug: string;
  content: string;
  tags: string[];
  createdAt: string;
}

export default function Home() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAllPosts()
      .then(data => {
        setPosts(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch posts:', err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="text-center text-gray-500">Loading...</div>;
  }

  return (
    <div>
      <h1 className="text-4xl font-bold text-gray-900 mb-8">Latest Posts</h1>
      <div className="space-y-6">
        {posts.map(post => (
          <PostCard key={post.id} {...post} />
        ))}
      </div>
    </div>
  );
}
```

#### 3.7 `client/src/pages/PostDetail.tsx`
```tsx
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getPostById } from '../lib/api';
import { renderMarkdown } from '../lib/markdown';

interface Post {
  id: string;
  title: string;
  slug: string;
  content: string;
  tags: string[];
  createdAt: string;
}

export default function PostDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    
    getPostById(slug)
      .then(data => {
        setPost(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch post:', err);
        setLoading(false);
      });
  }, [slug]);

  if (loading) {
    return <div className="text-center text-gray-500">Loading...</div>;
  }

  if (!post) {
    return (
      <div className="text-center">
        <p className="text-red-500 mb-4">Post not found</p>
        <Link to="/" className="text-blue-600 hover:underline">
          ← Back to home
        </Link>
      </div>
    );
  }

  return (
    <article className="bg-white rounded-lg shadow-md p-8">
      <Link to="/" className="text-blue-600 hover:underline mb-4 inline-block">
        ← Back to posts
      </Link>
      <h1 className="text-4xl font-bold text-gray-900 mb-4">{post.title}</h1>
      <div className="flex gap-2 mb-6">
        {post.tags.map(tag => (
          <span key={tag} className="px-3 py-1 bg-blue-100 text-blue-600 rounded">
            {tag}
          </span>
        ))}
      </div>
      <time className="text-sm text-gray-500 block mb-8">
        {new Date(post.createdAt).toLocaleDateString('tr-TR', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })}
      </time>
      <div 
        className="prose prose-lg max-w-none"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(post.content) }}
      />
    </article>
  );
}
```

#### 3.8 `client/src/pages/Admin.tsx`
```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPost } from '../lib/api';

export default function Admin() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    content: '',
    tags: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const tagsArray = formData.tags.split(',').map(t => t.trim()).filter(Boolean);
      await createPost({
        title: formData.title,
        slug: formData.slug,
        content: formData.content,
        tags: tagsArray
      });
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Failed to create post');
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Create New Post</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Title
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={e => setFormData({ ...formData, title: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Slug (URL-friendly)
          </label>
          <input
            type="text"
            value={formData.slug}
            onChange={e => setFormData({ ...formData, slug: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            pattern="[a-z0-9-]+"
            required
          />
          <p className="text-sm text-gray-500 mt-1">Only lowercase letters, numbers, and hyphens</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Content (Markdown)
          </label>
          <textarea
            value={formData.content}
            onChange={e => setFormData({ ...formData, content: e.target.value })}
            rows={10}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tags (comma-separated)
          </label>
          <input
            type="text"
            value={formData.tags}
            onChange={e => setFormData({ ...formData, tags: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="javascript, react, tutorial"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {loading ? 'Creating...' : 'Create Post'}
        </button>
      </form>
    </div>
  );
}
```

#### 3.9 `client/src/lib/api.ts`
```typescript
const API_BASE = '/api';

export async function getAllPosts() {
  const res = await fetch(`${API_BASE}/posts`);
  if (!res.ok) throw new Error('Failed to fetch posts');
  return res.json();
}

export async function getPostById(id: string) {
  const res = await fetch(`${API_BASE}/posts/${id}`);
  if (!res.ok) throw new Error('Failed to fetch post');
  return res.json();
}

export async function createPost(data: { title: string; slug: string; content: string; tags: string[] }) {
  const res = await fetch(`${API_BASE}/posts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to create post');
  }
  return res.json();
}
```

#### 3.10 `client/src/lib/markdown.ts`
```typescript
// Simple markdown to HTML (for basic rendering)
export function renderMarkdown(content: string): string {
  return content
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*)\*/gim, '<em>$1</em>')
    .replace(/\n$/gim, '<br />');
}
```

#### 3.11 `client/src/styles/index.css`
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.prose {
  max-width: none;
}

.prose h1 {
  @apply text-3xl font-bold mb-4 mt-6;
}

.prose h2 {
  @apply text-2xl font-bold mb-3 mt-5;
}

.prose h3 {
  @apply text-xl font-bold mb-2 mt-4;
}

.prose p {
  @apply mb-4;
}
```

---

## 🚀 Agent'a Verme Şekli - YENİ PROMPT

```
Blog platformunu TAM OLARAK kur - 20 dosya oluştur:

⚠️ ÖNCELİK: Önce TÜM dosyaları create_file ile oluştur, SONRA npm komutlarını çalıştır!

ADIM 1: DOSYA OLUŞTURMA (create_file tool ile)
1. Root: package.json, README.md, .gitignore
2. Server: package.json, tsconfig.json, src/index.ts, src/routes.ts, src/db.ts, data/posts.json
3. Client scaffold: npm create vite@latest client -- --template react-ts
4. Client özelleştirme: vite.config.ts (proxy ekle!), src/main.tsx, src/App.tsx, components/Layout.tsx, components/PostCard.tsx, pages/Home.tsx, pages/PostDetail.tsx, pages/Admin.tsx, lib/api.ts, lib/markdown.ts, styles/index.css

ADIM 2: DEPENDENCY KURULUMU (run_cmd tool ile)
1. Root: npm install -D concurrently
2. Server: npm --workspace server install
3. Client: npm --workspace client install
4. Client extra: npm --workspace client install react-router-dom
5. Client Tailwind: npm --workspace client install -D tailwindcss postcss autoprefixer && npx tailwindcss init -p

ADIM 3: DOĞRULAMA
1. npm run dev:server → http://localhost:5174/api/health → {"ok":true}
2. npm run dev:client → http://localhost:5173 → "Hello Blog" görünmeli

DETAYLI DOSYA İÇERİKLERİ: BLOG_PLATFORM_TEST_V2.md dosyasına bak!

NOT: package.json'larda workspaces ve scripts MUTLAKA olmalı!
```

---

## ✅ Acceptance Kriterleri

### Dosya Kontrolü
```bash
# 20 dosya mevcut olmalı
ls -R blog-platform/
```

### Server Health
```bash
curl http://localhost:5174/api/health
# → {"ok":true}
```

### Client Homepage
- `http://localhost:5173/` → "Hello Blog" yazısı görünür
- Admin'den yeni yazı oluştur → liste güncellenir

---

## 📊 Beklenen Çıktı

```
✅ 20/20 dosya oluşturuldu
✅ Root package.json - workspaces configured
✅ Server health check - PASS
✅ Client homepage - PASS
✅ Blog post creation - PASS

SUCCESS RATE: 100%
```
