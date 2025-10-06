const http = require('http');

const data = JSON.stringify({
    dir: '.'
});

const options = {
    hostname: 'localhost',
    port: 7777,
    path: '/tool/list_dir',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

console.log('Testing tool server...');

const req = http.request(options, (res) => {
    console.log(`Status: ${res.statusCode}`);

    let responseData = '';
    res.on('data', (chunk) => {
        responseData += chunk;
    });

    res.on('end', () => {
        try {
            const result = JSON.parse(responseData);
            console.log('Response:', result);
        } catch (e) {
            console.log('Raw response:', responseData);
        }
    });
});

req.on('error', (error) => {
    console.error('Error:', error.message);
});

req.write(data);
req.end();