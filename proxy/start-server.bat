@echo off
echo ==========================================
echo     AI Proxy Server - GitHub Models API
echo ==========================================
echo.

:: Check if simple-server.js exists
if not exist "simple-server.js" (
    echo ❌ HATA: simple-server.js dosyası bulunamadı!
    echo 📍 Bu scripti proxy klasörü içinde çalıştırın.
    pause
    exit /b 1
)

:: Check for GitHub token
if "%GITHUB_TOKEN%"=="" (
    echo ⚠️  UYARI: GITHUB_TOKEN environment variable bulunamadı!
    echo.
    echo 🔑 GitHub token oluşturmak için:
    echo    1. https://github.com/settings/tokens adresine gidin
    echo    2. "Generate new token" → "Fine-grained personal access token"
    echo    3. Permissions → "Model endpoints" → "Read" seçin
    echo    4. Token'ı kopyalayın
    echo.
    set /p TOKEN="GitHub Token girin (boş bırakabilirsiniz): "
    if not "!TOKEN!"=="" (
        set GITHUB_TOKEN=!TOKEN!
        echo ✅ Token geçici olarak ayarlandı.
    )
)

echo.
echo 🚀 Proxy sunucusu başlatılıyor...
echo 📍 Port: 3001
echo 🔗 Health Check: http://127.0.0.1:3001/health
echo.
echo ⚡ Durdurmak için Ctrl+C tuşlayın
echo ==========================================

:: Start the server
node simple-server.js