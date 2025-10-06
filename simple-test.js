// Simple tool server test
const http = require('http');

const testData = JSON.stringify({ dir: '.' });

const options = {
    hostname: 'localhost',
    port: 7777,
    path: '/tool/list_dir',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': testData.length
    }
};

console.log('Testing tool server connection...');

const req = http.request(options, (res) => {
    console.log(`Status Code: ${res.statusCode}`);
    console.log(`Headers:`, res.headers);

    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log('Response Body:', data);
        if (res.statusCode === 200) {
            console.log('✅ Tool server is working correctly!');
        } else {
            console.log('❌ Tool server returned error');
        }
    });
});

req.on('error', (err) => {
    console.error('❌ Connection error:', err.message);
});

req.write(testData);
req.end();