/**
 * MCP HTTP Client - GET/POST with custom headers
 * Implements HTTP operations per MCP specification
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

class HttpClient {
    constructor() {
        this.requestHistory = [];
        this.maxHistorySize = 50;
    }
    
    /**
     * HTTP GET request
     * @param {object} params - Parameters
     * @param {string} params.url - Target URL
     * @param {object} params.headers - Custom headers
     * @param {number} params.timeout - Timeout in ms (default: 30000)
     * @returns {object} - Response data
     */
    async get(params) {
        const { url, headers = {}, timeout = 30000 } = params;
        
        if (!url) {
            throw new Error('URL is required');
        }
        
        return await this.request({
            url,
            method: 'GET',
            headers,
            timeout
        });
    }
    
    /**
     * HTTP POST request
     * @param {object} params - Parameters
     * @param {string} params.url - Target URL
     * @param {object} params.body - Request body
     * @param {object} params.headers - Custom headers
     * @param {number} params.timeout - Timeout in ms
     * @returns {object} - Response data
     */
    async post(params) {
        const { url, body, headers = {}, timeout = 30000 } = params;
        
        if (!url) {
            throw new Error('URL is required');
        }
        
        // Serialize body if object
        let requestBody = body;
        if (typeof body === 'object') {
            requestBody = JSON.stringify(body);
            headers['Content-Type'] = headers['Content-Type'] || 'application/json';
        }
        
        return await this.request({
            url,
            method: 'POST',
            headers,
            body: requestBody,
            timeout
        });
    }
    
    /**
     * Generic HTTP request
     * @param {object} options - Request options
     * @returns {Promise<object>} - Response
     */
    async request(options) {
        const { url, method, headers = {}, body, timeout = 30000 } = options;
        
        const startTime = Date.now();
        const parsedUrl = new URL(url);
        const protocol = parsedUrl.protocol === 'https:' ? https : http;
        
        return new Promise((resolve, reject) => {
            const requestOptions = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port,
                path: parsedUrl.pathname + parsedUrl.search,
                method,
                headers: {
                    'User-Agent': 'KodCanavari-MCP/1.0',
                    ...headers
                }
            };
            
            const req = protocol.request(requestOptions, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    const duration = Date.now() - startTime;
                    
                    // Parse response
                    let parsedData = data;
                    const contentType = res.headers['content-type'] || '';
                    
                    if (contentType.includes('application/json')) {
                        try {
                            parsedData = JSON.parse(data);
                        } catch (e) {
                            // Keep as string if JSON parse fails
                        }
                    }
                    
                    const response = {
                        success: res.statusCode >= 200 && res.statusCode < 300,
                        statusCode: res.statusCode,
                        statusMessage: res.statusMessage,
                        headers: res.headers,
                        body: parsedData,
                        contentType,
                        size: data.length,
                        duration
                    };
                    
                    // Add to history
                    this.addToHistory({
                        url,
                        method,
                        requestHeaders: headers,
                        response,
                        timestamp: new Date().toISOString()
                    });
                    
                    resolve(response);
                });
            });
            
            req.on('error', (error) => {
                const duration = Date.now() - startTime;
                
                reject({
                    success: false,
                    error: error.message,
                    duration
                });
            });
            
            // Set timeout
            req.setTimeout(timeout, () => {
                req.destroy();
                reject({
                    success: false,
                    error: `Request timeout after ${timeout}ms`
                });
            });
            
            // Write body if POST
            if (body) {
                req.write(body);
            }
            
            req.end();
        });
    }
    
    /**
     * Add request to history
     */
    addToHistory(entry) {
        this.requestHistory.push(entry);
        
        if (this.requestHistory.length > this.maxHistorySize) {
            this.requestHistory.shift();
        }
    }
    
    /**
     * Get request history
     */
    getHistory(limit = 10) {
        return this.requestHistory.slice(-limit);
    }
    
    /**
     * Get statistics
     */
    getStats() {
        const successful = this.requestHistory.filter(r => r.response.success).length;
        const failed = this.requestHistory.length - successful;
        
        const durations = this.requestHistory.map(r => r.response.duration);
        const avgDuration = durations.length > 0 
            ? durations.reduce((a, b) => a + b, 0) / durations.length 
            : 0;
        
        return {
            totalRequests: this.requestHistory.length,
            successful,
            failed,
            successRate: this.requestHistory.length > 0 
                ? (successful / this.requestHistory.length * 100).toFixed(1) + '%'
                : '0%',
            averageDuration: Math.round(avgDuration) + 'ms'
        };
    }
}

// Singleton instance
let httpClient = null;

function getHttpClient() {
    if (!httpClient) {
        httpClient = new HttpClient();
    }
    return httpClient;
}

module.exports = {
    HttpClient,
    getHttpClient
};
