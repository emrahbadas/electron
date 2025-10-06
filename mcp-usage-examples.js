// MCP Tools Kullanım Örnekleri
// Frontend'de JavaScript ile direkt kullanım

// ===== ÖRNEK 1: Basit Dosya Oluşturma =====
async function createSimpleFile() {
    try {
        const result = await window.mcpTools.createFile(
            'test-dosya.txt', 
            'Bu MCP ile oluşturulan bir dosya!'
        );
        console.log('Dosya oluşturuldu:', result);
    } catch (error) {
        console.error('Hata:', error);
    }
}

// ===== ÖRNEK 2: HTML Kod Dosyası =====
async function createHTMLFile() {
    const htmlContent = `<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <title>MCP Test Sayfası</title>
</head>
<body>
    <h1>Merhaba MCP!</h1>
    <p>Bu sayfa MCP tools ile oluşturuldu.</p>
</body>
</html>`;

    const result = await window.mcpTools.writeCode(
        'mcp-test.html', 
        htmlContent, 
        'html'
    );
    console.log('HTML dosyası oluşturuldu:', result);
}

// ===== ÖRNEK 3: Proje Yapısı Oluşturma =====
async function createWebProject() {
    const result = await window.mcpTools.generateProject(
        'yeni-web-projesi',
        'web',
        './projeler'
    );
    console.log('Proje oluşturuldu:', result);
}

// ===== ÖRNEK 4: Agent Sistemi ile Entegrasyon =====
async function agentCreateFiles(prompt) {
    // Agent'tan gelen prompt'u işle
    if (prompt.includes('HTML sayfası oluştur')) {
        return await createHTMLFile();
    }
    
    if (prompt.includes('proje oluştur')) {
        return await createWebProject();
    }
    
    // Normal dosya oluşturma
    return await window.mcpTools.createFile('agent-output.txt', prompt);
}

// ===== ÖRNEK 5: MCP Durumu Kontrol =====
async function checkMCPStatus() {
    const status = await window.electronAPI.mcpStatus();
    console.log('MCP Durumu:', status);
    
    if (status.connected) {
        console.log(`✅ MCP bağlı - ${status.toolCount} tool mevcut`);
        
        // Mevcut tools'ları listele
        const tools = await window.electronAPI.mcpListTools();
        console.log('Mevcut Tools:', tools);
    } else {
        console.log('❌ MCP bağlı değil');
    }
}

// ===== ÖRNEK 6: Event-Driven Kullanım =====
// MCP durumu değiştiğinde otomatik tepki
window.addEventListener('mcpStatusChanged', (event) => {
    const { connected } = event.detail;
    
    if (connected) {
        console.log('🟢 MCP sistemi aktif');
        // UI'da yeşil durum göster
        updateUIStatus('connected');
    } else {
        console.log('🔴 MCP sistemi pasif');
        // UI'da kırmızı durum göster
        updateUIStatus('disconnected');
    }
});

function updateUIStatus(status) {
    const statusElement = document.getElementById('mcp-status');
    if (statusElement) {
        statusElement.className = `mcp-${status}`;
        statusElement.textContent = status === 'connected' ? 'MCP: Aktif' : 'MCP: Pasif';
    }
}

// ===== KULLANIM =====
// Sayfa yüklendiğinde test et
document.addEventListener('DOMContentLoaded', async () => {
    await checkMCPStatus();
    
    // Test dosyası oluştur
    // await createSimpleFile();
    
    // HTML projesi oluştur
    // await createHTMLFile();
});

// Console'dan manuel test
// createSimpleFile();
// createHTMLFile();
// createWebProject();
// checkMCPStatus();