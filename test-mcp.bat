@echo off
echo ===============================================
echo Mini MCP Server + Test Suite
echo ===============================================
echo.

echo [1/3] Node proseslerini temizliyor...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul

echo [2/3] Mini MCP server'i baslatiliyor...
cd proxy
start /B node server.js
cd ..

echo [3/3] 5 saniye bekleniyor (server hazirlansin)...
timeout /t 5 /nobreak >nul

echo.
echo ===============================================
echo Test baslatiliyor...
echo ===============================================
echo.

node test-mcp-mini.js

echo.
echo ===============================================
echo Server durduruluyor...
echo ===============================================
taskkill /F /IM node.exe >nul 2>&1

pause
