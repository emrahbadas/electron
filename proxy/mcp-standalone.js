/**
 * Mini MCP Standalone Server (Port 7777)
 * Mevcut tools-server yerine çalışır
 */

const express = require('express');
const cors = require('cors');

// Mini MCP router'ını import et
const mcpRouter = require('./mcp-mini.js');

const app = express();
const PORT = process.env.MCP_PORT || 7777;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check (eski tools-server uyumlu)
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK',
        name: 'KayraDeniz Mini MCP (Standalone)',
        version: '1.0.0',
        port: PORT,
        uptime: process.uptime()
    });
});

// MCP endpoints'leri root seviyede mount et (eski API uyumlu)
app.use('/', mcpRouter);

// Error handling
app.on('error', (err) => {
    console.error('❌ Server Error:', err);
    process.exit(1);
});

process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Start server
const server = app.listen(PORT, '127.0.0.1', () => {
    console.log(`\n🔧 Mini MCP Standalone Server`);
    console.log(`📡 Running on http://127.0.0.1:${PORT}`);
    console.log(`✅ Health: http://127.0.0.1:${PORT}/health`);
    console.log(`\n📋 Endpoints:`);
    console.log(`   - /fs/read, /fs/write, /fs/exists`);
    console.log(`   - /shell/run`);
    console.log(`   - /build, /test, /probe`);
    console.log(`   - /context/guard`);
    console.log(`   - /verify\n`);
    console.log(`💡 Server is running - Press Ctrl+C to stop\n`);
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} already in use!`);
        console.error(`💡 Try: Get-Process -Id (Get-NetTCPConnection -LocalPort ${PORT}).OwningProcess | Stop-Process -Force`);
        process.exit(1);
    } else {
        console.error('❌ Server error:', err);
        process.exit(1);
    }
});

// Keep process alive (server will keep event loop running)
server.on('close', () => {
    console.log('\n👋 Server stopped');
    process.exit(0);
});

module.exports = { app, server };
