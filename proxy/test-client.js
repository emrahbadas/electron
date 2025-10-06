const http = require('http');

// Test configuration
const SERVER_URL = 'http://127.0.0.1:3001';

// Utility function to make HTTP requests
function makeRequest(path, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, SERVER_URL);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const response = JSON.parse(body);
                    resolve({ status: res.statusCode, data: response });
                } catch (e) {
                    resolve({ status: res.statusCode, data: body });
                }
            });
        });

        req.on('error', reject);

        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

// Test functions
async function testHealth() {
    console.log('🔍 Testing Health Check...');
    try {
        const result = await makeRequest('/health');
        console.log(`✅ Health Check: ${result.status}`);
        console.log('   Response:', result.data);
        return result.status === 200;
    } catch (error) {
        console.log('❌ Health Check Failed:', error.message);
        return false;
    }
}

async function testModels() {
    console.log('\n🔍 Testing Models Endpoint...');
    try {
        const result = await makeRequest('/ai/models');
        console.log(`✅ Models: ${result.status}`);
        if (result.data.models) {
            console.log(`   Available models: ${result.data.models.length}`);
            console.log(`   First model: ${result.data.models[0]?.name || 'N/A'}`);
        } else {
            console.log('   Response:', result.data);
        }
        return result.status === 200;
    } catch (error) {
        console.log('❌ Models Test Failed:', error.message);
        return false;
    }
}

async function testChat() {
    console.log('\n🔍 Testing Chat Endpoint...');
    try {
        const chatData = {
            messages: [
                { role: 'user', content: 'Merhaba! Kısa bir test mesajı gönderiyorum.' }
            ],
            model: 'gpt-4o-mini',
            max_tokens: 100
        };

        const result = await makeRequest('/ai/chat', 'POST', chatData);
        console.log(`✅ Chat: ${result.status}`);
        
        if (result.data.choices && result.data.choices[0]) {
            const response = result.data.choices[0].message.content;
            console.log(`   AI Response: ${response.substring(0, 100)}...`);
        } else {
            console.log('   Response:', result.data);
        }
        
        return result.status === 200;
    } catch (error) {
        console.log('❌ Chat Test Failed:', error.message);
        return false;
    }
}

// Main test function
async function runTests() {
    console.log('==========================================');
    console.log('     GitHub Models API Proxy - Test');
    console.log('==========================================\n');

    // Test 1: Health Check
    const healthOk = await testHealth();
    if (!healthOk) {
        console.log('\n❌ Server is not responding. Make sure it\'s running.');
        console.log('   Run: start-server.bat');
        return;
    }

    // Test 2: Models
    const modelsOk = await testModels();

    // Test 3: Chat (only if models work)
    if (modelsOk) {
        await testChat();
    }

    console.log('\n==========================================');
    console.log('                Test Complete');
    console.log('==========================================');
}

// Run tests
runTests().catch(error => {
    console.error('❌ Test Suite Failed:', error);
});

module.exports = { makeRequest, testHealth, testModels, testChat };