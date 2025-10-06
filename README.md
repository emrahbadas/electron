# Gezgin

Terminal paneli ekle. Node.js sürümünü göster. package.json'a build script'i ekle.

## Vizyon

- Denizlerin rehberi Bilinmeyen Kaptan tarafından tutulan canlı bir seyahat günlüğü
- lacivert denizler, köpük beyazı dalgalar ve bakır pusula tonları paletinde, Playfair Display ve Inter fontlarıyla hazırlanmış modern arayüz
- Sayfalar arası perde animasyonları, kaydırma bazlı mikro etkileşimler

## Sayfa Bölümleri

1. **Kahraman (Hero)** – Kaptanın selamlaması, son rota çağrısı
2. **Rotalar** – Öne çıkan üç ülke kartı, özet bilgiler
3. **Kültür & Ritüeller** – Tarih, kültür ve gelenek vurguları
4. **Lezzet Haritası** – Bölgesel tatlar ve hikâyeleri
5. **Seyir Defteri** – Günlük kayıtları ve hatırlatıcılar

## Öne Çıkan Özellikler

- Deniz temalı kahraman bölüm
- İnteraktif rota kartları
- Perde efektiyle sayfa geçişleri
- Günlük kayıtları ve gastronomi köşesi

## Teknolojiler

- Frontend: HTML5, CSS3, JavaScript
- Backend: Static
- Veri: JSON files
- Dağıtım: Vercel

## Proje Dosya Yapısı

```
gezgin/
├── index.html
├── styles.css
└── script.js
```

## Geliştirme Adımları

- [x] README hazırla ve yapılacakları listele
- [x] Deniz temalı ana sayfayı oluştur
- [x] Responsive stil katmanını ekle
- [x] JavaScript ile geçiş animasyonlarını bağla
- [ ] İçeriği zenginleştir ve yeni destinasyonlar ekle

## Çalıştırma

Statik yapı olduğu için doğrudan dosyayı tarayıcıda açabilir veya aşağıdaki gibi hafif bir sunucu kullanabilirsin:

```
npx serve .
```

## Sonraki Adımlar

- Rota kartlarını JSON dosyasından dinamik yükleme
- Fotoğraf galerisi ve kaptanın sesli notlarını ekleme
- Işık ve karanlık tema geçişi ekleme
