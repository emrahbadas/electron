# 🎓 Usta Modu - Draggable & Collapsible UI

## 🎯 Problem

**ÖNCESİ:**
- Usta Modu paneli sağ alt köşede **sabit** pozisyonda
- Chat box'ı kapatıyor, kullanıcı rahatsız
- Kapatılamıyor, küçültülemiyor

**SONRASI:**
- ✅ **Draggable**: Mouse ile istediğin yere sürükle
- ✅ **Collapsible**: 📕 butonu ile küçült/büyüt
- ✅ **Smart positioning**: Ekran sınırlarına çarpmaz
- ✅ **Smooth animations**: Yumuşak geçişler

---

## 🚀 Özellikler

### 1️⃣ **Sürüklenebilir (Draggable)**

```typescript
// State
const [position, setPosition] = useState({ 
  x: window.innerWidth - 470, // Başlangıç: sağ üst
  y: 20 
});
const [isDragging, setIsDragging] = useState(false);

// Mouse handlers
const handleMouseDown = (e) => {
  if (e.target.closest('.header')) { // Sadece header sürüklenebilir
    setIsDragging(true);
    // Offset hesapla (mouse'un panel içindeki pozisyonu)
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  }
};

const handleMouseMove = (e) => {
  if (isDragging) {
    // Ekran sınırlarına göre clamp (taşma önleme)
    const newX = Math.max(0, Math.min(window.innerWidth - 450, e.clientX - dragOffset.x));
    const newY = Math.max(0, Math.min(window.innerHeight - 100, e.clientY - dragOffset.y));
    setPosition({ x: newX, y: newY });
  }
};
```

**Kullanım:**
1. Header'a tıkla (🎓 Usta Modu başlığı)
2. Mouse ile sürükle
3. Bırak (istediğin pozisyonda kalır)

**Cursor değişimi:**
- Normal: `cursor: 'default'`
- Header hover: `cursor: 'grab'`
- Dragging: `cursor: 'grabbing'`

---

### 2️⃣ **Katlanabilir (Collapsible)**

```typescript
const [isCollapsed, setIsCollapsed] = useState(false);

// Toggle function
const toggleCollapse = () => {
  setIsCollapsed(prev => !prev);
};

// Conditional rendering
{!isCollapsed && (
  <div className="messages">
    {/* Mesajlar */}
  </div>
)}
```

**Kullanım:**
1. 📕 butonuna tıkla → Panel küçülür (sadece header görünür)
2. 📖 butonuna tıkla → Panel açılır (mesajlar görünür)

**Width değişimi:**
- Açık: `width: 450px`
- Kapalı: `width: 200px`

---

### 3️⃣ **Smart Positioning**

```typescript
// Ekran sınırlarına çarpmayı önle
const newX = Math.max(
  0, // Sol sınır
  Math.min(
    window.innerWidth - 450, // Sağ sınır
    e.clientX - dragOffset.x
  )
);

const newY = Math.max(
  0, // Üst sınır
  Math.min(
    window.innerHeight - 100, // Alt sınır
    e.clientY - dragOffset.y
  )
);
```

**Avantaj:** Panel ekrandan taşmaz, her zaman görünür kalır.

---

### 4️⃣ **Smooth Animations**

```typescript
// CSS transitions
style={{
  transition: isDragging ? 'none' : 'width 0.3s ease, box-shadow 0.2s ease',
  boxShadow: isDragging 
    ? '0 12px 48px rgba(0,0,0,0.6)' // Daha belirgin gölge
    : '0 8px 32px rgba(0,0,0,0.4)'
}}
```

**Efektler:**
- Width değişimi: 300ms ease
- Shadow değişimi: 200ms ease
- Dragging sırasında transition yok (performans)

---

## 📊 State Yönetimi

```typescript
// Position state
const [position, setPosition] = useState({ 
  x: window.innerWidth - 470, 
  y: 20 
});

// Collapse state
const [isCollapsed, setIsCollapsed] = useState(false);

// Dragging state
const [isDragging, setIsDragging] = useState(false);
const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

// Refs
const containerRef = useRef<HTMLDivElement>(null);
```

**Lifecycle:**
1. Mount: `position` hesaplanır (sağ üst köşe)
2. Drag start: `isDragging = true`, offset hesaplanır
3. Drag move: `position` güncellenir (her mousemove'da)
4. Drag end: `isDragging = false`
5. Collapse: `isCollapsed` toggle, width değişir

---

## 🎨 Visual Feedback

### **Dragging State:**
```typescript
cursor: isDragging ? 'grabbing' : 'default'
boxShadow: isDragging ? '0 12px 48px rgba(0,0,0,0.6)' : '0 8px 32px rgba(0,0,0,0.4)'
userSelect: 'none' // Text seçimini engelle
```

### **Collapse Icon:**
```typescript
{isCollapsed ? '📖' : '📕'} // Kapalı/Açık göstergesi
title={isCollapsed ? 'Genişlet' : 'Küçült'} // Tooltip
```

### **Header Cursor:**
```typescript
// Header
cursor: 'grab' // Sürüklenebilir olduğunu göster

// Dragging
cursor: 'grabbing' // Sürükleme aktif
```

---

## 🧪 Test Senaryoları

### **Scenario 1: Sürükle**
1. Uygulamayı aç
2. Usta Modu panelinin header'ına tıkla
3. Mouse'u hareket ettir
4. Panel takip etmeli
5. Bırak → Panel kalmalı

**Expected:** ✅ Panel sürükleniyor, ekrandan taşmıyor

---

### **Scenario 2: Küçült**
1. 📕 butonuna tıkla
2. Panel 200px'e küçülmeli
3. Mesajlar gizlenmeli
4. Footer gizlenmeli
5. Sadece header + collapse butonu görünür

**Expected:** ✅ Panel küçülüyor, chat box açık

---

### **Scenario 3: Tekrar Aç**
1. Küçültülmüş panelde 📖 butonuna tıkla
2. Panel 450px'e büyümeli
3. Mesajlar görünmeli
4. Footer görünmeli

**Expected:** ✅ Panel açılıyor, mesajlar kaybolmamış

---

### **Scenario 4: Sürükle + Küçült**
1. Paneli sol üst köşeye sürükle
2. 📕 ile küçült
3. Tekrar aç
4. Position korunmalı (sol üst)

**Expected:** ✅ Position saklanıyor

---

### **Scenario 5: Ekran Sınırları**
1. Paneli sağ kenara sürükle (ekran dışına çıkar gibi)
2. Panel ekran sınırında durmalı
3. Taşmamalı

**Expected:** ✅ Clamp çalışıyor

---

## 🔧 Implementation Details

### **Event Handlers:**

```typescript
// Mouse down on header
handleMouseDown(e: React.MouseEvent) {
  if (e.target.closest('.header')) {
    setIsDragging(true);
    // Calculate offset
  }
}

// Mouse move (document level)
handleMouseMove(e: MouseEvent) {
  if (isDragging) {
    // Update position with clamping
  }
}

// Mouse up (document level)
handleMouseUp() {
  setIsDragging(false);
}
```

### **useEffect for Document Listeners:**

```typescript
useEffect(() => {
  if (isDragging) {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }
}, [isDragging, handleMouseMove, handleMouseUp]);
```

**Neden document.addEventListener?**
- Panel dışına mouse çıkınca da sürükleme devam etsin
- Hızlı hareket ederken panel kaybolmasın
- Mouse up her yerde algılansın

---

## 📈 Performance

### **Optimization Techniques:**

1. **useCallback for handlers:**
   ```typescript
   const handleMouseMove = useCallback((e: MouseEvent) => {
     // ...
   }, [isDragging, dragOffset]);
   ```

2. **Conditional transitions:**
   ```typescript
   transition: isDragging ? 'none' : '...' // Dragging sırasında animasyon yok
   ```

3. **userSelect: 'none':**
   ```typescript
   userSelect: 'none' // Text seçimini engelle (performans)
   ```

4. **Throttling (optional):**
   ```typescript
   // Eğer çok yavaşsa eklenebilir
   const throttledMouseMove = throttle(handleMouseMove, 16); // 60 FPS
   ```

---

## 🎯 Benefits

### **Kullanıcı Deneyimi:**
- ✅ Chat box artık engellenmiyor
- ✅ Kullanıcı kendi layout'unu oluşturuyor
- ✅ Küçük ekranlarda yer kazancı
- ✅ Profesyonel görünüm

### **Developer Experience:**
- ✅ React state ile yönetim (type-safe)
- ✅ useCallback ile performans
- ✅ useEffect ile cleanup
- ✅ Conditional rendering (basit)

---

## 🚀 Future Enhancements

### **1. Position Persistence**
```typescript
// LocalStorage'a kaydet
useEffect(() => {
  localStorage.setItem('ustaModu_position', JSON.stringify(position));
}, [position]);

// Mount'ta yükle
useEffect(() => {
  const saved = localStorage.getItem('ustaModu_position');
  if (saved) setPosition(JSON.parse(saved));
}, []);
```

### **2. Resize Handles**
```typescript
// Köşelerden resize
<div className="resize-handle" onMouseDown={handleResizeStart} />
```

### **3. Snap to Edges**
```typescript
// Kenarlardan 50px yakınsa snap
if (Math.abs(newX) < 50) newX = 0;
if (Math.abs(newX - (window.innerWidth - 450)) < 50) newX = window.innerWidth - 450;
```

### **4. Multiple Panels**
```typescript
// Birden fazla Usta Modu (farklı projeler)
<UstaModu key="project1" projectId="1" />
<UstaModu key="project2" projectId="2" />
```

---

## 📝 Commit Message

```bash
feat(UstaModu): Add draggable & collapsible UI

BEFORE:
- Fixed position (bottom-right)
- Blocks chat box
- Not closable

AFTER:
- Draggable (grab header, move anywhere)
- Collapsible (📕/📖 button, toggle visibility)
- Smart positioning (clamp to screen bounds)
- Smooth animations (width, shadow transitions)
- Performance optimized (useCallback, conditional transitions)

Features:
- position state (x, y coords)
- isDragging state (mouse tracking)
- isCollapsed state (visibility toggle)
- handleMouseDown/Move/Up (event handlers)
- Document-level listeners (drag outside panel)
- Screen bounds clamping (Math.max/min)
- Conditional rendering (hide messages when collapsed)

UX improvements:
- Chat box no longer blocked
- User controls layout
- Space saving on small screens
- Professional appearance

Bundle: 598.37 kB (gzip: 180.30 kB)
Type-safe: TypeScript + React hooks
```

---

## 🎉 Sonuç

**Usta Modu artık:**
1. 🎯 Sürüklenebilir (istediğin yere koy)
2. 📕 Katlanabilir (küçült/büyüt)
3. 🚀 Performanslı (useCallback, no transition while dragging)
4. 💎 Profesyonel (smooth animations, visual feedback)

**Chat box problemi çözüldü!** 🎊
