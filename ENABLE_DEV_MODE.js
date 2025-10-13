/**
 * 🔓 DEVELOPER MODE ACTIVATOR
 * 
 * 📋 KULLANIM:
 * 1. Electron uygulamasında F12 tuşuna bas (DevTools)
 * 2. Console sekmesine git
 * 3. Bu dosyanın içeriğini KOPYALA-YAPIŞTIR
 * 4. Enter'a bas
 * 
 * ✅ SONUÇ:
 * - Developer Mode: ENABLED
 * - Tüm approval'lar otomatik onaylanır
 * - Token validation bypass edilir
 * - Sonsuz döngü kırılır
 */

console.log('🔧 Developer Mode aktifleştiriliyor...');

// Developer Mode'u localStorage'a kaydet
localStorage.setItem('developerMode', 'true');

// KodCanavari instance'ını güncelle
if (window.kodCanavari) {
    window.kodCanavari.developerMode = true;
    console.log('✅ KodCanavari instance güncellendi');
}

console.log('🔓 Developer Mode: ENABLED ✅');
console.log('💡 Artık tüm işlemler otomatik onaylanacak!');
console.log('🔄 Sayfayı yenile (Ctrl+R) ve tekrar dene');

// Auto reload
setTimeout(() => {
    console.log('🔄 Otomatik yenileme...');
    location.reload();
}, 2000);
