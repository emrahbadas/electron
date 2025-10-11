# 🔧 Workspace Root Düzeltme

## Problem
localStorage'da yanlış klasör kayıtlı: `Yeni klasör (4)`  
Olması gereken: `Yeni klasör (5)\blog-platform`

---

## ✅ Çözüm: DevTools Console

### Adım 1: DevTools Aç
- **Windows:** `Ctrl + Shift + I` veya `F12`
- **Console** sekmesine git

### Adım 2: localStorage'ı Güncelle
Console'a şunu yapıştır ve Enter:

```javascript
localStorage.setItem('currentFolder', 'C:\\Users\\emrah badas\\OneDrive\\Desktop\\kodlama\\Yeni klasör (5)\\blog-platform');
window.__CURRENT_FOLDER__ = 'C:\\Users\\emrah badas\\OneDrive\\Desktop\\kodlama\\Yeni klasör (5)\\blog-platform';
console.log('✅ Workspace root güncellendi:', localStorage.getItem('currentFolder'));
```

### Adım 3: Doğrulama
Console'da şunu çalıştır:

```javascript
console.log('Current workspace:', localStorage.getItem('currentFolder'));
```

**Beklenen çıktı:**
```
Current workspace: C:\Users\emrah badas\OneDrive\Desktop\kodlama\Yeni klasör (5)\blog-platform
```

### Adım 4: Uygulamayı Yenile
- **Windows:** `Ctrl + R` veya `F5`

---

## ✅ Alternatif: Folder Picker Kullan

Eğer DevTools çalışmazsa:

1. **"📁 Klasör Seç"** butonuna tıkla (sol panelde)
2. Navigate: `C:\Users\emrah badas\OneDrive\Desktop\kodlama\Yeni klasör (5)\blog-platform`
3. **"Klasörü Seç"** tıkla

---

## 🎯 Test

Yeniledikten sonra console'da şunu görmelisin:

```
📁 Workspace root restored: C:\Users\emrah badas\OneDrive\Desktop\kodlama\Yeni klasör (5)\blog-platform
```

Eğer hala **"Yeni klasör (4)"** görünüyorsa, DevTools'tan manuel düzelt (Adım 2).
