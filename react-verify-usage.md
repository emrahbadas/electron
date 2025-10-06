# ReAct+Verify Agent Sistemi Kullanım Rehberi

Bu döküman, KayraDeniz'in yeni **ReAct+Verify+Runbook** agent sisteminin nasıl kullanılacağını açıklar.

## 🎯 Sistem Özellikleri

✅ **Claude Sonnet 4 Tarzı Yanıtlar**: Sistematik, operasyonel, adım adım yaklaşım  
✅ **Multi-Platform Komutlar**: Windows + Unix için ayrı komut blokları  
✅ **Doğrulama Adımları**: Her işlem için beklenen sonuçlar  
✅ **4 Uzman Agent Rolü**: Analyzer, Generator, Documentation, Coordinator  

## 🚀 Kullanım

### 1. Agent Mode'u Aktif Et

- Üst menüden **"Agent Mode"** butonuna tıkla
- OpenAI API anahtarının ayarlı olduğundan emin ol

### 2. Proje Klasörü Seç

- **"Proje Klasörü Seç"** butonuna tıkla
- Analiz edilecek proje dizinini seç

### 3. Agent Rolü Seç (Opsiyonel)

- **Analyzer**: Kod analizi, bug detection
- **Generator**: Kod üretimi, refactoring  
- **Documentation**: README, API docs oluşturma
- **Coordinator**: Karmaşık görev koordinasyonu

### 4. Komut Ver

Agent otomatik olarak uygun rolü seçer. Örnek komutlar:

```
projeyi analiz et ve rapor oluştur
README.md dosyası yaz
kod kalitesini kontrol et
test dosyaları oluştur
proje dokümantasyonunu güncelleştir
```

## 📋 ReAct+Verify Format Örneği

Agent'lar şu formatta yanıt verir:

```
🧭 Plan
• Proje dosyalarını listele
• package.json'ı analiz et  
• Ana kaynak dosyaları oku
• Kalite raporu oluştur

🛠️ Komutlar (Windows)
```powershell
Get-ChildItem -Path . -Recurse -Include "*.js"
```

🛠️ Komutlar (Unix)

```bash
find . -name "*.js" -type f
```

🧪 Doğrulama
• JavaScript dosyaları listelenmeli
• Syntax hataları tespit edilmeli

🧩 Bulgular
• 15 JavaScript dosyası bulundu
• 3 syntax hatası tespit edildi
• Toplam kod kalitesi: B+

✅ Sonuç & Bir Sonraki Adım
• Analiz tamamlandı. Hataları düzeltmek için 'fix syntax errors' komutu verin.

```

## 🔧 Teknik Detaylar

- **Tool Server**: HTTP (port 7777) veya IPC üzerinden dosya işlemleri
- **Token Management**: Büyük dosyalar otomatik chunking ile işlenir
- **Path Security**: Windows path normalization ve güvenlik kontrolü
- **Rate Limiting**: OpenAI API limitlerini aşmamak için gecikme

## 🎨 Avantajlar

✅ **Sistematik**: Her agent aynı yapıyı kullanır  
✅ **Operasyonel**: Her adım açık komutlarla belirtilir  
✅ **Multi-Platform**: Windows ve Unix için ayrı komutlar  
✅ **Doğrulanabilir**: Her işlem için beklenen sonuç  
✅ **Tekrarlanabilir**: Runbook formatı ile aynı sonuç  

## 📚 Daha Fazla Bilgi

- `agent-style-guide.md`: Teknik implementasyon detayları
- Console logs: Gerçek zamanlı işlem takibi  
- Error handling: Otomatik retry ve fallback mekanizmaları

---

**Not**: Bu sistem Claude Sonnet 4'ün "reasoning + verification" yaklaşımından esinlenmiştir ve tüm ajanların tutarlı, profesyonel yanıtlar vermesini sağlar.
