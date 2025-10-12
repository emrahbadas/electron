/**
 * 🔍 PROBE MATRIX SYSTEM
 * 
 * Evidence-based validation system.
 * NO PASS without proof.
 * 
 * Probe Types:
 * - FILE: Check if file exists
 * - HTTP: Check HTTP endpoint response
 * - PORT: Check if port is listening
 * - REGEX: Check if content matches pattern
 * - PROCESS: Check if process is running
 * 
 * LLM cannot say "done" - probe must pass!
 */

class ProbeMatrix {
    constructor() {
        // Configuration
        this.config = {
            timeout: 10000, // 10 seconds max per probe
            retries: 3,
            retryDelay: 1000
        };
        
        // Probe results cache
        this.cache = new Map();
        
        console.log('✅ Probe Matrix initialized');
    }
    
    /**
     * Run all probes in matrix
     * @param {Array} probes - Array of probe definitions
     * @returns {Promise<Object>} Results
     */
    async runProbes(probes) {
        if (!probes || probes.length === 0) {
            return {
                passed: true,
                skipped: true,
                message: 'No probes defined'
            };
        }
        
        console.log(`🔍 Running ${probes.length} probes...`);
        
        const results = [];
        let passedCount = 0;
        
        for (const probe of probes) {
            const result = await this.runProbe(probe);
            results.push(result);
            
            if (result.ok) {
                passedCount++;
            }
        }
        
        const passed = passedCount === probes.length;
        
        return {
            passed,
            total: probes.length,
            passedCount,
            failedCount: probes.length - passedCount,
            results,
            summary: this.generateSummary(results)
        };
    }
    
    /**
     * Run single probe
     * @param {Object} probe - Probe definition
     * @returns {Promise<Object>} Result
     */
    async runProbe(probe) {
        const { type, target, ...options } = probe;
        
        console.log(`🔍 Probe ${type}: ${target}`);
        
        try {
            let result;
            
            switch (type.toLowerCase()) {
                case 'file':
                    result = await this.probeFile(target, options);
                    break;
                case 'http':
                    result = await this.probeHttp(target, options);
                    break;
                case 'port':
                    result = await this.probePort(target, options);
                    break;
                case 'regex':
                    result = await this.probeRegex(target, options);
                    break;
                case 'process':
                    result = await this.probeProcess(target, options);
                    break;
                default:
                    throw new Error(`Unknown probe type: ${type}`);
            }
            
            return {
                type,
                target,
                ok: result.ok,
                message: result.message,
                details: result.details,
                timestamp: Date.now()
            };
            
        } catch (error) {
            console.error(`❌ Probe ${type} failed:`, error);
            
            return {
                type,
                target,
                ok: false,
                message: error.message,
                error: error,
                timestamp: Date.now()
            };
        }
    }
    
    /**
     * Probe: Check if file exists
     * @param {string} filepath - File path
     * @param {Object} options - Options
     * @returns {Promise<Object>} Result
     */
    async probeFile(filepath, options = {}) {
        const { checkContent = false, pattern = null } = options;
        
        try {
            // Check if file exists
            const exists = await window.electronAPI.fileExists(filepath);
            
            if (!exists) {
                return {
                    ok: false,
                    message: `File does not exist: ${filepath}`
                };
            }
            
            // Optional: Check content
            if (checkContent && pattern) {
                const content = await window.electronAPI.readFile(filepath);
                const regex = new RegExp(pattern);
                const matches = regex.test(content);
                
                if (!matches) {
                    return {
                        ok: false,
                        message: `File exists but content doesn't match pattern: ${pattern}`
                    };
                }
            }
            
            return {
                ok: true,
                message: `File exists: ${filepath}`,
                details: { filepath }
            };
            
        } catch (error) {
            return {
                ok: false,
                message: `File check failed: ${error.message}`,
                error
            };
        }
    }
    
    /**
     * Probe: Check HTTP endpoint
     * @param {string} url - URL
     * @param {Object} options - Options
     * @returns {Promise<Object>} Result
     */
    async probeHttp(url, options = {}) {
        const {
            method = 'GET',
            expectedStatus = 200,
            pattern = null,
            timeout = this.config.timeout
        } = options;
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);
            
            const response = await fetch(url, {
                method,
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            // Check status code
            if (response.status !== expectedStatus) {
                return {
                    ok: false,
                    message: `HTTP ${response.status} (expected ${expectedStatus})`,
                    details: { status: response.status, url }
                };
            }
            
            // Optional: Check response body
            if (pattern) {
                const text = await response.text();
                const regex = new RegExp(pattern);
                
                if (!regex.test(text)) {
                    return {
                        ok: false,
                        message: `Response doesn't match pattern: ${pattern}`,
                        details: { status: response.status, url }
                    };
                }
            }
            
            return {
                ok: true,
                message: `HTTP ${response.status} OK`,
                details: {
                    status: response.status,
                    url,
                    statusText: response.statusText
                }
            };
            
        } catch (error) {
            return {
                ok: false,
                message: `HTTP request failed: ${error.message}`,
                error
            };
        }
    }
    
    /**
     * Probe: Check if port is listening
     * @param {number} port - Port number
     * @param {Object} options - Options
     * @returns {Promise<Object>} Result
     */
    async probePort(port, options = {}) {
        const { host = 'localhost', timeout = this.config.timeout } = options;
        
        try {
            const url = `http://${host}:${port}`;
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);
            
            const response = await fetch(url, {
                method: 'HEAD',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            return {
                ok: true,
                message: `Port ${port} is listening`,
                details: { port, host }
            };
            
        } catch (error) {
            // Connection refused = port not listening
            return {
                ok: false,
                message: `Port ${port} is not listening`,
                details: { port, host },
                error
            };
        }
    }
    
    /**
     * Probe: Check if content matches regex
     * @param {string} filepath - File to check
     * @param {Object} options - Options
     * @returns {Promise<Object>} Result
     */
    async probeRegex(filepath, options = {}) {
        const { pattern } = options;
        
        if (!pattern) {
            return {
                ok: false,
                message: 'Pattern is required for regex probe'
            };
        }
        
        try {
            const content = await window.electronAPI.readFile(filepath);
            const regex = new RegExp(pattern, options.flags || 'i');
            const matches = regex.test(content);
            
            if (!matches) {
                return {
                    ok: false,
                    message: `Content doesn't match pattern: ${pattern}`
                };
            }
            
            return {
                ok: true,
                message: `Pattern matched: ${pattern}`,
                details: { filepath, pattern }
            };
            
        } catch (error) {
            return {
                ok: false,
                message: `Regex probe failed: ${error.message}`,
                error
            };
        }
    }
    
    /**
     * Probe: Check if process is running
     * @param {string} processName - Process name
     * @param {Object} options - Options
     * @returns {Promise<Object>} Result
     */
    async probeProcess(processName, options = {}) {
        try {
            // Use tasklist on Windows
            const result = await window.electronAPI.runCommand(`tasklist | findstr /i "${processName}"`);
            
            const running = result.output && result.output.toLowerCase().includes(processName.toLowerCase());
            
            if (!running) {
                return {
                    ok: false,
                    message: `Process not running: ${processName}`
                };
            }
            
            return {
                ok: true,
                message: `Process running: ${processName}`,
                details: { processName }
            };
            
        } catch (error) {
            return {
                ok: false,
                message: `Process check failed: ${error.message}`,
                error
            };
        }
    }
    
    /**
     * Generate summary of probe results
     * @param {Array} results - Probe results
     * @returns {string} Summary text
     */
    generateSummary(results) {
        const passed = results.filter(r => r.ok);
        const failed = results.filter(r => !r.ok);
        
        let summary = `🔍 Probe Results: ${passed.length}/${results.length} passed\n\n`;
        
        if (failed.length > 0) {
            summary += '❌ **Failed Probes:**\n';
            failed.forEach(r => {
                summary += `  - ${r.type}: ${r.target}\n`;
                summary += `    ${r.message}\n`;
            });
            summary += '\n';
        }
        
        if (passed.length > 0) {
            summary += '✅ **Passed Probes:**\n';
            passed.forEach(r => {
                summary += `  - ${r.type}: ${r.target}\n`;
            });
        }
        
        return summary;
    }
    
    /**
     * Retry failed probes
     * @param {Array} failedResults - Failed probe results
     * @returns {Promise<Object>} Retry results
     */
    async retryFailed(failedResults) {
        console.log(`🔄 Retrying ${failedResults.length} failed probes...`);
        
        const retryResults = [];
        
        for (const failed of failedResults) {
            const probe = {
                type: failed.type,
                target: failed.target
            };
            
            const result = await this.runProbe(probe);
            retryResults.push(result);
        }
        
        return {
            total: retryResults.length,
            passed: retryResults.filter(r => r.ok).length,
            failed: retryResults.filter(r => !r.ok).length,
            results: retryResults
        };
    }
    
    /**
     * Get statistics
     * @returns {Object} Stats
     */
    getStats() {
        return {
            cacheSize: this.cache.size,
            config: this.config
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProbeMatrix;
}
