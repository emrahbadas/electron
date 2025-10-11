@echo off
echo ===============================================
echo Mini MCP Standalone Server (Port 7777)
echo ===============================================
echo.

cd proxy

echo [1/2] Checking node_modules...
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    echo.
)

echo [2/2] Starting Mini MCP on port 7777...
echo.

node mcp-standalone.js

pause
