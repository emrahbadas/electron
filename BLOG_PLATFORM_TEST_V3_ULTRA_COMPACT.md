# Blog Platform Test V3 - Ultra Compact (Sadece Komutlar)

## 🎯 Test Prompt (Agent'a ver)

```
Blog platform kur:

1. Root package.json dosyası oluştur - workspaces server ve client
2. Server klasörü kur - Express TypeScript
3. Client klasörü kur - Vite React TypeScript
4. Dependencies kur
5. Test et

Detay: BLOG_PLATFORM_TEST_V2.md dosyasına bak
```

---

## 📝 Alternatif (Daha Az Dosya İçeriği)

```
Basit blog platformu:

ADIM 1: Klasörleri oluştur
- mkdir server
- mkdir server/src
- mkdir server/data
- mkdir client

ADIM 2: package.json'ları yaz (sadece bunları)
- Root: workspaces + concurrently scripts
- Server: tsx + express deps

ADIM 3: Vite client
- npm create vite@latest client -- --template react-ts

ADIM 4: npm install
- npm install -D concurrently
- npm --workspace server install
- npm --workspace client install

HEDEF: npm run dev çalışsın
```

---

## 🎯 En Basit Versiyon

```
Blog platform - sadece iskelet:

1. package.json (root) - workspaces: ["server", "client"]
2. server/package.json - Express deps
3. npm create vite client
4. npm install

Sonra dosyaları manuel ekleriz
```
