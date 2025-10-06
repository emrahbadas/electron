// Basit HTTP server for GitHub Models API proxy
const http = require('http');
const url = require('url');

// Environment variables (hardcoded for simplicity)
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const PORT = process.env.PORT || 3001;
const MODEL_NAME = process.env.MODEL_NAME || 'gpt-4o-mini';

// CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
};

// Create server
const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const method = req.method;
    const pathname = parsedUrl.pathname;

    // Handle CORS preflight
    if (method === 'OPTIONS') {
        res.writeHead(200, corsHeaders);
        res.end();
        return;
    }

    // Health check
    if (pathname === '/health') {
        res.writeHead(200, corsHeaders);
        res.end(JSON.stringify({
            status: 'OK',
            timestamp: new Date().toISOString(),
            github_token: GITHUB_TOKEN ? 'Configured' : 'Missing'
        }));
        return;
    }

    // AI Chat endpoint
    if (pathname === '/ai/chat' && method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const requestData = JSON.parse(body);
                const { messages, model = MODEL_NAME, ...options } = requestData;

                if (!GITHUB_TOKEN) {
                    res.writeHead(500, corsHeaders);
                    res.end(JSON.stringify({ error: 'GitHub token not configured' }));
                    return;
                }

                console.log('🤖 AI Request:', { model, messageCount: messages?.length });

                // GitHub Models API request
                const response = await fetch('https://api.github.com/inference/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${GITHUB_TOKEN}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'X-GitHub-Api-Version': '2022-11-28'
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
                    res.writeHead(response.status, corsHeaders);
                    res.end(JSON.stringify({
                        error: data.message || 'GitHub API Error',
                        details: data
                    }));
                    return;
                }

                console.log('✅ AI Response received');
                res.writeHead(200, corsHeaders);
                res.end(JSON.stringify(data));

            } catch (error) {
                console.error('❌ Proxy Error:', error);
                res.writeHead(500, corsHeaders);
                res.end(JSON.stringify({
                    error: 'Proxy server error',
                    details: error.message
                }));
            }
        });
        return;
    }

    // Models endpoint
    if (pathname === '/ai/models') {
        try {
            if (!GITHUB_TOKEN) {
                res.writeHead(500, corsHeaders);
                res.end(JSON.stringify({ error: 'GitHub token not configured' }));
                return;
            }

            const response = await fetch('https://api.github.com/catalog/models', {
                headers: {
                    'Authorization': `Bearer ${GITHUB_TOKEN}`,
                    'X-GitHub-Api-Version': '2022-11-28'
                }
            });

            const data = await response.json();

            if (!response.ok) {
                res.writeHead(response.status, corsHeaders);
                res.end(JSON.stringify(data));
                return;
            }

            // Filter chat models
            const chatModels = data.items?.filter(model =>
                model.modalities?.includes('text') ||
                model.modalities?.includes('chat')
            ) || [];

            res.writeHead(200, corsHeaders);
            res.end(JSON.stringify({ models: chatModels }));

        } catch (error) {
            console.error('❌ Models fetch error:', error);
            res.writeHead(500, corsHeaders);
            res.end(JSON.stringify({
                error: 'Failed to fetch models',
                details: error.message
            }));
        }
        return;
    }

    // 404
    res.writeHead(404, corsHeaders);
    res.end(JSON.stringify({ error: 'Not found' }));
});

// Start server
server.listen(PORT, '127.0.0.1', () => {
    console.log(`🚀 AI Proxy Server running on http://127.0.0.1:${PORT}`);
    console.log(`📋 Health check: http://127.0.0.1:${PORT}/health`);
    console.log(`🤖 AI Chat endpoint: http://127.0.0.1:${PORT}/ai/chat`);
    console.log(`📊 Models endpoint: http://127.0.0.1:${PORT}/ai/models`);
    console.log(`🔑 GitHub Token: ${GITHUB_TOKEN ? 'Configured' : 'MISSING - Please set GITHUB_TOKEN env var'}`);
});

module.exports = server;