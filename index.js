// KayraDeniz Projesi
// KayraDeniz Kod Canavarı tarafından oluşturuldu

document.addEventListener('DOMContentLoaded', function() {
    console.log('KayraDeniz Projesi yüklendi!');
    
    // Ana uygulama başlangıcı
    initializeApp();
});

function initializeApp() {
    // Uygulama başlatma kodları
    console.log('Uygulama başlatılıyor...');
    
    // Event listener'lar
    setupEventListeners();
}

function setupEventListeners() {
    // Olay dinleyicilerini kur
    console.log('Event listener'lar kuruldu');
}

// Utility fonksiyonlar
function showMessage(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);
}

export { initializeApp, setupEventListeners, showMessage };