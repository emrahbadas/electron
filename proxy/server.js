const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Mini MCP Router
const mcpRouter = require('./mcp-mini.js');

// Middleware
app.use(cors());
app.use(express.json());

// Mount MCP endpoints
app.use('/mcp', mcpRouter);
console.log('🔧 Mini MCP mounted at /mcp/*');

// GitHub Models API Proxy
app.post('/ai/chat', async (req, res) => {
    try {
        const { messages, model = process.env.MODEL_NAME || 'gpt-4o-mini', ...options } = req.body;
        
        if (!process.env.GITHUB_TOKEN) {
            return res.status(500).json({ error: 'GitHub token not configured' });
        }

        console.log('🤖 AI Request:', { model, messageCount: messages?.length });

        const response = await fetch('https://api.github.com/inference/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-GitHub-Api-Version': '2022-11-28',
                'User-Agent': 'KayraDeniz-AI-Proxy/1.0'
            },
            body: JSON.stringify({
                model,
                messages,
                temperature: options.temperature || 0.7,
                max_tokens: options.max_tokens || 2000,
                stream: false,
                ...options
            })
        });

        const data = await response.json();
        
        if (!response.ok) {
            console.error('❌ GitHub API Error:', data);
            return res.status(response.status).json({ 
                error: data.message || 'GitHub API Error',
                details: data
            });
        }

        console.log('✅ AI Response received');
        res.json(data);

    } catch (error) {
        console.error('❌ Proxy Error:', error);
        res.status(500).json({ 
            error: 'Proxy server error',
            details: error.message 
        });
    }
});

// Get available models
app.get('/ai/models', async (req, res) => {
    try {
        if (!process.env.GITHUB_TOKEN) {
            return res.status(500).json({ error: 'GitHub token not configured' });
        }

        const response = await fetch('https://api.github.com/catalog/models', {
            headers: {
                'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
                'X-GitHub-Api-Version': '2022-11-28'
            }
        });

        const data = await response.json();
        
        if (!response.ok) {
            return res.status(response.status).json(data);
        }

        // Sadece chat completion destekleyen modelleri filtrele
        const chatModels = data.items?.filter(model => 
            model.modalities?.includes('text') || 
            model.modalities?.includes('chat')
        ) || [];

        res.json({ models: chatModels });

    } catch (error) {
        console.error('❌ Models fetch error:', error);
        res.status(500).json({ 
            error: 'Failed to fetch models',
            details: error.message 
        });
    }
});

// Health check (proxy server)
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        service: 'AI Proxy Server',
        timestamp: new Date().toISOString(),
        github_token: process.env.GITHUB_TOKEN ? 'Configured' : 'Missing',
        mcp_enabled: true,
        mcp_health: `http://127.0.0.1:${PORT}/mcp/health`
    });
});

// Start server
app.listen(PORT, '127.0.0.1', () => {
    console.log(`🚀 AI Proxy Server running on http://127.0.0.1:${PORT}`);
    console.log(`📋 Health check: http://127.0.0.1:${PORT}/health`);
    console.log(`🤖 AI Chat endpoint: http://127.0.0.1:${PORT}/ai/chat`);
    console.log(`📊 Models endpoint: http://127.0.0.1:${PORT}/ai/models`);
    console.log(`\n🔧 Mini MCP Endpoints:`);
    console.log(`   - FS: /mcp/fs/{read,write,exists}`);
    console.log(`   - Shell: /mcp/shell/run`);
    console.log(`   - Build: /mcp/build`);
    console.log(`   - Test: /mcp/test`);
    console.log(`   - Probe: /mcp/probe`);
    console.log(`   - Guard: /mcp/context/guard`);
    console.log(`   - Verify: /mcp/verify`);
    console.log(`   - Health: /mcp/health\n`);
});

module.exports = app;