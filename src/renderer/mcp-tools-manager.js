// KayraDeniz MCP Tools Integration
// Electron uygulamasında MCP tools'ları kullanmak için yardımcı sınıf

class MCPToolsManager {
    constructor() {
        this.isConnected = false;
        this.availableTools = [];
        this.statusCheckInterval = null;
    }

    async waitForElectronAPI(timeoutMs = 5000) {
        const pollInterval = 100;
        const maxAttempts = Math.ceil(timeoutMs / pollInterval);

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            if (window.electronAPI && typeof window.electronAPI.mcpStatus === 'function') {
                return true;
            }
            await new Promise(resolve => setTimeout(resolve, pollInterval));
        }

        throw new Error('electronAPI henüz hazır değil');
    }

    /**
     * MCP Manager'ı başlat
     */
    async initialize() {
        try {
            await this.waitForElectronAPI();

            // MCP durumunu kontrol et
            await this.checkStatus();
            
            // Tools'ları yükle
            if (this.isConnected) {
                await this.loadTools();
            }

            // Periyodik durum kontrolü başlat
            this.startStatusMonitoring();
            
            console.log('MCP Tools Manager başlatıldı');
        } catch (error) {
            console.error('MCP Manager başlatma hatası:', error);
        }
    }

    /**
     * MCP bağlantı durumunu kontrol et
     */
    async checkStatus() {
        try {
            if (!window.electronAPI || typeof window.electronAPI.mcpStatus !== 'function') {
                throw new Error('electronAPI.mcpStatus kullanılamıyor');
            }

            const status = await window.electronAPI.mcpStatus();
            this.isConnected = status.connected;
            
            console.log('MCP Durumu:', status);
            return status;
        } catch (error) {
            console.error('MCP durum kontrolü hatası:', error);
            this.isConnected = false;
            return { connected: false, toolCount: 0 };
        }
    }

    /**
     * Mevcut tools'ları yükle
     */
    async loadTools() {
        try {
            this.availableTools = await window.electronAPI.mcpListTools();
            console.log('MCP Tools yüklendi:', this.availableTools);
            
            // UI'ya tools'ları göster
            this.updateToolsUI();
        } catch (error) {
            console.error('Tools yükleme hatası:', error);
            this.availableTools = [];
        }
    }

    /**
     * MCP test bağlantısı
     */
    async testConnection() {
        try {
            const result = await window.electronAPI.mcpTest();
            console.log('MCP Test sonucu:', result);
            
            this.showNotification('MCP Test Başarılı', result, 'success');
            return result;
        } catch (error) {
            console.error('MCP test hatası:', error);
            this.showNotification('MCP Test Hatası', error.message, 'error');
            throw error;
        }
    }

    /**
     * MCP durum bilgisini al (frontend için)
     */
    async getStatus() {
        try {
            const status = await this.checkStatus();
            return {
                connected: status.connected,
                toolCount: status.toolCount,
                isReady: this.isReady
            };
        } catch (error) {
            console.error('getStatus hatası:', error);
            return {
                connected: false,
                toolCount: 0,
                isReady: false,
                error: error.message
            };
        }
    }

    /**
     * Dosya okunan metodu
     */
    async readFile(filePath) {
        try {
            const result = await window.electronAPI.mcpReadFile(filePath);
            console.log('Dosya okundu:', filePath);
            
            this.showNotification('Dosya Okundu', `${filePath} başarıyla okundu`, 'success');
            return result;
        } catch (error) {
            console.error('Dosya okuma hatası:', error);
            this.showNotification('Dosya Okuma Hatası', error.message, 'error');
            throw error;
        }
    }

    /**
     * Dosya oluştur
     */
    async createFile(filePath, content) {
        try {
            // Get current working directory from app instance
            const workingDirectory = window.app?.currentWorkingDirectory || null;
            console.log('Creating file in working directory:', workingDirectory);
            
            const result = await window.electronAPI.mcpCreateFile(filePath, content, workingDirectory);
            console.log('Dosya oluşturuldu:', result);
            
            this.showNotification('Dosya Oluşturuldu', `${filePath} başarıyla oluşturuldu`, 'success');
            return result;
        } catch (error) {
            console.error('Dosya oluşturma hatası:', error);
            this.showNotification('Dosya Oluşturma Hatası', error.message, 'error');
            throw error;
        }
    }

    /**
     * Kod dosyası yaz
     */
    async writeCode(filePath, content, language = 'javascript') {
        try {
            // Get current working directory from app instance
            const workingDirectory = window.app?.currentWorkingDirectory || null;
            console.log('Writing code in working directory:', workingDirectory);
            
            const result = await window.electronAPI.mcpWriteCode(filePath, content, language, workingDirectory);
            console.log('Kod dosyası yazıldı:', result);
            
            this.showNotification('Kod Dosyası Oluşturuldu', `${filePath} (${language}) başarıyla oluşturuldu`, 'success');
            return result;
        } catch (error) {
            console.error('Kod yazma hatası:', error);
            this.showNotification('Kod Yazma Hatası', error.message, 'error');
            throw error;
        }
    }

    /**
     * Proje yapısı oluştur
     */
    async generateProject(projectName, projectType = 'web', basePath = '.') {
        try {
            // Get current working directory from app instance
            const workingDirectory = window.app?.currentWorkingDirectory || null;
            console.log('Generating project in working directory:', workingDirectory);
            
            const result = await window.electronAPI.mcpGenerateProject(projectName, projectType, basePath, workingDirectory);
            console.log('Proje oluşturuldu:', result);
            
            this.showNotification('Proje Oluşturuldu', `${projectName} (${projectType}) projesi oluşturuldu`, 'success');
            return result;
        } catch (error) {
            console.error('Proje oluşturma hatası:', error);
            this.showNotification('Proje Oluşturma Hatası', error.message, 'error');
            throw error;
        }
    }

    /**
     * Dosyaları listele
     */
    async listFiles(directoryPath = '.') {
        try {
            const result = await window.electronAPI.mcpListFiles(directoryPath);
            console.log('Dosyalar listelendi:', result);
            return result;
        } catch (error) {
            console.error('Dosya listeleme hatası:', error);
            throw error;
        }
    }

    /**
     * Genel tool çağırma
     */
    async callTool(toolName, args = {}) {
        try {
            const result = await window.electronAPI.mcpCallTool(toolName, args);
            console.log(`Tool '${toolName}' çalıştırıldı:`, result);
            return result;
        } catch (error) {
            console.error(`Tool '${toolName}' hatası:`, error);
            throw error;
        }
    }

    /**
     * Durum izlemeyi başlat
     */
    startStatusMonitoring() {
        if (this.statusCheckInterval) {
            clearInterval(this.statusCheckInterval);
        }

        this.statusCheckInterval = setInterval(async () => {
            const wasConnected = this.isConnected;
            await this.checkStatus();
            
            // Bağlantı durumu değiştiyse bildir
            if (wasConnected !== this.isConnected) {
                this.updateConnectionStatus();
            }
        }, 10000); // 10 saniyede bir kontrol
    }

    /**
     * Durum izlemeyi durdur
     */
    stopStatusMonitoring() {
        if (this.statusCheckInterval) {
            clearInterval(this.statusCheckInterval);
            this.statusCheckInterval = null;
        }
    }

    /**
     * Bağlantı durumu UI güncellemesi
     */
    updateConnectionStatus() {
        const statusElement = document.getElementById('mcp-status');
        if (statusElement) {
            statusElement.className = this.isConnected ? 'mcp-connected' : 'mcp-disconnected';
            statusElement.textContent = this.isConnected ? 'MCP: Bağlı' : 'MCP: Bağlı Değil';
        }

        // Event gönder
        window.dispatchEvent(new CustomEvent('mcpStatusChanged', {
            detail: { connected: this.isConnected }
        }));
    }

    /**
     * Tools UI güncellemesi
     */
    updateToolsUI() {
        const toolsList = document.getElementById('mcp-tools-list');
        if (toolsList) {
            toolsList.innerHTML = '';
            
            this.availableTools.forEach(tool => {
                const toolElement = document.createElement('div');
                toolElement.className = 'mcp-tool-item';
                toolElement.innerHTML = `
                    <div class="tool-name">${tool.name}</div>
                    <div class="tool-description">${tool.description}</div>
                    <button onclick="mcpTools.callTool('${tool.name}')" class="tool-call-btn">Çalıştır</button>
                `;
                toolsList.appendChild(toolElement);
            });
        }
    }

    /**
     * Bildirim göster
     */
    showNotification(title, message, type = 'info') {
        // Mevcut bildirim sistemini kullan veya basit alert
        if (window.showToast) {
            window.showToast(message, type);
        } else {
            console.log(`${type.toUpperCase()}: ${title} - ${message}`);
        }
    }

    /**
     * Manager'ı temizle
     */
    destroy() {
        this.stopStatusMonitoring();
        this.availableTools = [];
        this.isConnected = false;
    }
}

// Global instance
const mcpTools = new MCPToolsManager();

// UI ready olduğunda başlat
document.addEventListener('DOMContentLoaded', () => {
    mcpTools.initialize();
});

// Window unload olduğunda temizle
window.addEventListener('beforeunload', () => {
    mcpTools.destroy();
});

// Global erişim için
window.mcpTools = mcpTools;