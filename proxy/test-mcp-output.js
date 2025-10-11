// Test mcp-mini router mounting
const express = require('express');

console.log('1️⃣ Creating Express app...');
const app = express();

console.log('2️⃣ Adding middleware...');
app.use(express.json());

console.log('3️⃣ Loading mcp-mini router...');
const mcpRouter = require('./mcp-mini.js');
console.log('✅ Router loaded, type:', typeof mcpRouter);

console.log('4️⃣ Mounting router...');
app.use('/', mcpRouter);
console.log('✅ Router mounted');

console.log('5️⃣ Starting server...');
const server = app.listen(7777, '127.0.0.1', () => {
    console.log('✅ Server listening on 127.0.0.1:7777');
    console.log('💡 Waiting for connections...');
    
    // Keep process alive with setInterval (Express server alone may not be enough)
    const keepAlive = setInterval(() => {
        // Just keep event loop busy
    }, 1000);
    
    // Cleanup on server close
    server.on('close', () => {
        clearInterval(keepAlive);
    });
});

server.on('error', (err) => {
    console.error('❌ Server error:', err);
});

// Prevent process exit on unhandled events
process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught exception:', err);
});

process.on('SIGINT', () => {
    console.log('\n👋 Shutting down...');
    server.close(() => process.exit(0));
});

console.log('6️⃣ Script execution complete - server should stay running');
