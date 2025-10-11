// Direct MCP server test - detaylı debug
const express = require('express');

console.log('✅ Express import successful');

const app = express();
console.log('✅ Express app created');

app.get('/test', (req, res) => {
    res.json({ status: 'OK', test: true });
});

const server = app.listen(7777, '127.0.0.1', () => {
    console.log('✅ Server listening on 127.0.0.1:7777');
    console.log('💡 Keep-alive: Server will stay running...');
    
    // Self-test
    setTimeout(() => {
        const http = require('http');
        http.get('http://127.0.0.1:7777/test', (res) => {
            console.log('✅ Self-test successful:', res.statusCode);
            console.log('✅ Server is ready for external requests');
        }).on('error', (err) => {
            console.error('❌ Self-test failed:', err.message);
        });
    }, 1000);
    
    // Keep-alive interval
    setInterval(() => {
        // Just keep event loop active
    }, 1000000);
});

server.on('error', (err) => {
    console.error('❌ Server error:', err);
});

server.on('listening', () => {
    console.log('✅ Server "listening" event fired');
});

console.log('✅ Script completed without errors');
