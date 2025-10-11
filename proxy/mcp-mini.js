/**
 * Mini MCP (Management Control Platform) Server
 * Gerçek build/test/probe yetenekleriyle kod doğrulama
 */

const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const router = express.Router();

// Güvenlik: Sandbox kök klasör
const ROOT = process.env.WORKDIR || process.cwd();
const safe = (p) => path.resolve(ROOT, p);

// İzin verilen komutlar (whitelist)
const ALLOWED_COMMANDS = new Set(['npm', 'npx', 'node', 'pnpm', 'yarn', 'git', 'powershell', 'cmd', 'echo', 'dir', 'ls', 'cat', 'type']);

// Build/test kuyruğu (tek seferde bir işlem)
let buildQueue = Promise.resolve();

/**
 * Güvenli komut çalıştırma
 * @param {string} cmd - Komut adı
 * @param {string[]} args - Argümanlar
 * @param {string} cwd - Çalışma dizini
 * @param {number} timeoutMs - Timeout (ms)
 */
function runCommand(cmd, args = [], cwd = ROOT, timeoutMs = 60000) {
    return new Promise((resolve) => {
        // Whitelist kontrolü
        if (!ALLOWED_COMMANDS.has(cmd)) {
            return resolve({ 
                ok: false, 
                error: `❌ Komut izin listesinde değil: ${cmd}`,
                allowed: Array.from(ALLOWED_COMMANDS)
            });
        }

        let killed = false;
        
        // Windows fix: npm/npx are .cmd files, need shell: true or .cmd extension
        // For security, we only enable shell for whitelisted commands
        const isWindows = process.platform === 'win32';
        const needsShell = isWindows && ['npm', 'npx', 'yarn', 'pnpm'].includes(cmd);
        
        const ps = spawn(cmd, args, { 
            cwd: safe(cwd), 
            shell: needsShell, // Enable shell for Windows batch files
            env: { ...process.env, FORCE_COLOR: '0' } // Renk kodlarını devre dışı bırak
        });

        let stdout = '';
        let stderr = '';

        // Timeout
        const timer = setTimeout(() => {
            killed = true;
            ps.kill('SIGKILL');
        }, timeoutMs);

        ps.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        ps.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        ps.on('close', (code) => {
            clearTimeout(timer);
            
            resolve({
                ok: code === 0 && !killed,
                code,
                stdout: stdout.slice(-2000), // Son 2KB
                stderr: stderr.slice(-2000),
                killed,
                fullOutput: stdout + stderr
            });
        });

        ps.on('error', (err) => {
            clearTimeout(timer);
            resolve({
                ok: false,
                error: err.message,
                stderr: err.toString()
            });
        });
    });
}

/**
 * Schema validation helper
 */
function validateSchema(schema, data, toolName) {
    const missing = [];
    for (const [key, required] of Object.entries(schema)) {
        if (required && !data[key]) {
            missing.push(key);
        }
    }
    
    if (missing.length > 0) {
        throw new Error(`❌ ${toolName} schema hatası: Eksik parametreler [${missing.join(', ')}]`);
    }
}

// ================================
// FS TOOLS
// ================================

router.post('/fs/read', (req, res) => {
    try {
        validateSchema({ path: true }, req.body, 'fs/read');
        
        const filePath = safe(req.body.path);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ 
                ok: false, 
                error: `Dosya bulunamadı: ${req.body.path}` 
            });
        }
        
        const data = fs.readFileSync(filePath, 'utf8');
        const stats = fs.statSync(filePath);
        
        res.json({ 
            ok: true, 
            path: req.body.path,
            data,
            size: stats.size,
            modified: stats.mtime
        });
        
    } catch (error) {
        res.status(400).json({ ok: false, error: error.message });
    }
});

router.post('/fs/write', (req, res) => {
    try {
        validateSchema({ path: true, data: true }, req.body, 'fs/write');
        
        const filePath = safe(req.body.path);
        const { data } = req.body;
        
        // Placeholder kontrolü
        const placeholderPattern = /TODO|PLACEHOLDER|<GÜNCELLE>|lorem ipsum|\.\.\..*code.*\.\.\./i;
        if (placeholderPattern.test(data)) {
            return res.status(400).json({ 
                ok: false, 
                error: '❌ Placeholder tespit edildi! Gerçek kod yazın.',
                detected: data.match(placeholderPattern)?.[0]
            });
        }
        
        // Dizin oluştur
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        
        // Dosyayı yaz
        fs.writeFileSync(filePath, data, 'utf8');
        
        res.json({ 
            ok: true, 
            path: req.body.path,
            size: Buffer.byteLength(data, 'utf8'),
            written: new Date().toISOString()
        });
        
    } catch (error) {
        res.status(400).json({ ok: false, error: error.message });
    }
});

router.post('/fs/exists', (req, res) => {
    try {
        validateSchema({ path: true }, req.body, 'fs/exists');
        
        const filePath = safe(req.body.path);
        const exists = fs.existsSync(filePath);
        
        let stats = null;
        if (exists) {
            const s = fs.statSync(filePath);
            stats = {
                isFile: s.isFile(),
                isDirectory: s.isDirectory(),
                size: s.size,
                modified: s.mtime
            };
        }
        
        res.json({ 
            ok: true, 
            exists,
            path: req.body.path,
            stats
        });
        
    } catch (error) {
        res.status(400).json({ ok: false, error: error.message });
    }
});

// ================================
// SHELL TOOL
// ================================

router.post('/shell/run', async (req, res) => {
    try {
        validateSchema({ cmd: true }, req.body, 'shell/run');
        
        const { cmd, args = [], cwd = '.', timeout = 60000 } = req.body;
        
        console.log(`🔧 Shell çalıştırılıyor: ${cmd} ${args.join(' ')}`);
        
        const result = await runCommand(cmd, args, cwd, timeout);
        
        res.json({
            ...result,
            command: `${cmd} ${args.join(' ')}`,
            cwd: safe(cwd)
        });
        
    } catch (error) {
        res.status(400).json({ ok: false, error: error.message });
    }
});

// ================================
// BUILD TOOL
// ================================

router.post('/build', async (req, res) => {
    try {
        const { cwd = '.', skipPackageCheck = false } = req.body;
        const workDir = safe(cwd);
        const packagePath = path.join(workDir, 'package.json');
        
        // package.json kontrolü
        if (!skipPackageCheck && !fs.existsSync(packagePath)) {
            return res.json({ 
                ok: false, 
                skip: true,
                reason: 'package.json bulunamadı',
                suggestion: 'Önce npm init veya proje oluşturma'
            });
        }
        
        // package.json analizi
        let packageData = null;
        let hasNext = false;
        let hasVite = false;
        
        if (fs.existsSync(packagePath)) {
            packageData = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
            hasNext = !!(packageData.dependencies?.next || packageData.devDependencies?.next);
            hasVite = !!(packageData.dependencies?.vite || packageData.devDependencies?.vite);
        }
        
        console.log(`🏗️ Build başlatılıyor... (Next: ${hasNext}, Vite: ${hasVite})`);
        
        // Kuyruk ile sırayla çalıştır
        const buildPromise = buildQueue.then(async () => {
            const result = await runCommand('npm', ['run', 'build'], cwd, 300000); // 5 dakika
            return result;
        });
        
        buildQueue = buildPromise.catch(() => {}); // Hata durumunda kuyruk devam etsin
        
        const result = await buildPromise;
        
        res.json({
            ...result,
            context: {
                hasNext,
                hasVite,
                framework: hasNext ? 'Next.js' : hasVite ? 'Vite' : 'Unknown'
            }
        });
        
    } catch (error) {
        res.status(400).json({ ok: false, error: error.message });
    }
});

// ================================
// TEST TOOL
// ================================

router.post('/test', async (req, res) => {
    try {
        const { cwd = '.', testFile = null } = req.body;
        const workDir = safe(cwd);
        const packagePath = path.join(workDir, 'package.json');
        
        if (!fs.existsSync(packagePath)) {
            return res.json({ 
                ok: false, 
                skip: true,
                reason: 'package.json bulunamadı'
            });
        }
        
        const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        const hasTestScript = !!packageData.scripts?.test;
        
        if (!hasTestScript) {
            return res.json({ 
                ok: false, 
                skip: true,
                reason: 'package.json içinde test script tanımlı değil'
            });
        }
        
        console.log(`🧪 Test başlatılıyor...`);
        
        const testArgs = ['test'];
        if (testFile) {
            testArgs.push(testFile);
        }
        
        const result = await runCommand('npm', testArgs, cwd, 180000); // 3 dakika
        
        res.json(result);
        
    } catch (error) {
        res.status(400).json({ ok: false, error: error.message });
    }
});

// ================================
// PROBE TOOL (HTTP health check)
// ================================

router.post('/probe', async (req, res) => {
    try {
        const { url = 'http://localhost:5173', timeout = 5000 } = req.body;
        
        console.log(`🔍 Probe: ${url}`);
        
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            timeout
        };
        
        const protocol = urlObj.protocol === 'https:' ? require('https') : http;
        
        const probePromise = new Promise((resolve) => {
            const req = protocol.request(options, (response) => {
                let body = '';
                
                response.on('data', (chunk) => {
                    body += chunk.toString();
                });
                
                response.on('end', () => {
                    resolve({
                        ok: response.statusCode === 200,
                        status: response.statusCode,
                        statusText: response.statusMessage,
                        bodyLength: body.length,
                        bodyPreview: body.slice(0, 200)
                    });
                });
            });
            
            req.on('error', (error) => {
                resolve({
                    ok: false,
                    error: error.message,
                    code: error.code
                });
            });
            
            req.on('timeout', () => {
                req.destroy();
                resolve({
                    ok: false,
                    error: 'Timeout',
                    timeout: true
                });
            });
            
            req.end();
        });
        
        const result = await probePromise;
        
        res.json({
            ...result,
            url,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        res.status(400).json({ ok: false, error: error.message });
    }
});

// ================================
// CONTEXT GUARD (Next.js vs Vite)
// ================================

router.post('/context/guard', async (req, res) => {
    try {
        const { cwd = '.' } = req.body;
        const workDir = safe(cwd);
        const packagePath = path.join(workDir, 'package.json');
        
        if (!fs.existsSync(packagePath)) {
            return res.json({ 
                ok: true,
                framework: 'unknown',
                rules: []
            });
        }
        
        const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        
        const hasNext = !!(packageData.dependencies?.next || packageData.devDependencies?.next);
        const hasVite = !!(packageData.dependencies?.vite || packageData.devDependencies?.vite);
        const hasReact = !!(packageData.dependencies?.react || packageData.devDependencies?.react);
        
        const rules = [];
        
        if (hasNext) {
            rules.push({
                type: 'block',
                pattern: 'index.html',
                reason: 'Next.js projelerinde index.html yazılamaz (pages/ veya app/ kullanın)'
            });
            rules.push({
                type: 'warn',
                pattern: 'public/index.html',
                reason: 'Next.js public/ klasöründe static dosyalar olmalı'
            });
        }
        
        if (hasVite && !hasNext) {
            rules.push({
                type: 'require',
                pattern: 'index.html',
                reason: 'Vite projelerinde kök dizinde index.html gerekli'
            });
        }
        
        res.json({
            ok: true,
            framework: hasNext ? 'Next.js' : hasVite ? 'Vite' : hasReact ? 'React' : 'unknown',
            rules,
            dependencies: {
                next: hasNext,
                vite: hasVite,
                react: hasReact
            }
        });
        
    } catch (error) {
        res.status(400).json({ ok: false, error: error.message });
    }
});

// ================================
// HEALTH CHECK
// ================================

router.get('/health', (req, res) => {
    res.json({ 
        ok: true, 
        name: 'KayraDeniz Mini MCP',
        version: '1.0.0',
        uptime: process.uptime(),
        workdir: ROOT,
        allowedCommands: Array.from(ALLOWED_COMMANDS)
    });
});

// ================================
// VERIFICATION MATRIX (Topluca doğrulama)
// ================================

router.post('/verify', async (req, res) => {
    try {
        const { cwd = '.', checkLint = true, checkBuild = true, checkProbe = false, probeUrl = 'http://localhost:5173' } = req.body;
        
        console.log('🔍 Verification Matrix başlatılıyor...');
        
        const results = {
            timestamp: new Date().toISOString(),
            cwd: safe(cwd),
            checks: {}
        };
        
        // Context Guard
        const guardReq = await fetch(`http://localhost:${process.env.PORT || 3001}/mcp/context/guard`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cwd })
        });
        results.checks.guard = await guardReq.json();
        
        // Lint (opsiyonel)
        if (checkLint) {
            const lintResult = await runCommand('npx', ['eslint', '.', '--max-warnings', '0'], cwd, 60000);
            results.checks.lint = {
                ok: lintResult.ok,
                warnings: lintResult.stderr.match(/warning/gi)?.length || 0,
                errors: lintResult.stderr.match(/error/gi)?.length || 0
            };
        }
        
        // Build
        if (checkBuild) {
            const buildResult = await runCommand('npm', ['run', 'build'], cwd, 300000);
            results.checks.build = {
                ok: buildResult.ok,
                output: buildResult.stderr.slice(-500)
            };
        }
        
        // Probe (opsiyonel)
        if (checkProbe) {
            const probeReq = await fetch(`http://localhost:${process.env.PORT || 3001}/mcp/probe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: probeUrl })
            });
            results.checks.probe = await probeReq.json();
        }
        
        // Genel sonuç
        results.ok = Object.values(results.checks).every(check => check.ok !== false);
        
        res.json(results);
        
    } catch (error) {
        res.status(400).json({ ok: false, error: error.message });
    }
});

module.exports = router;
