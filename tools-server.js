// tools-server.js
const express = require("express");
const cors = require("cors");
const fs = require("fs").promises;
const path = require("path");
const child_process = require("child_process");

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Security: Authentication middleware for production
const AGENT_KEY = process.env.AGENT_KEY || 'dev-key-12345';
if (process.env.NODE_ENV === 'production') {
    app.use((req, res, next) => {
        const authHeader = req.headers['x-agent-key'];
        if (!authHeader || authHeader !== AGENT_KEY) {
            return res.status(401).json({ error: 'Unauthorized: Missing or invalid X-Agent-Key' });
        }
        next();
    });
    console.log('🔐 Production mode: X-Agent-Key authentication enabled');
} else {
    console.log('🔓 Development mode: No authentication required');
}

// Request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// --- Güvenlik ---
let ROOT = process.env.AGENT_ROOT?.replace(/\\/g, "/") || process.cwd().replace(/\\/g, "/");
const ALLOWED_CMDS = new Set(["node", "npm", "pnpm", "yarn", "git", "echo", "python"]);

function guard(p) {
    if (!ROOT) {
        throw new Error("ROOT seçilmedi");
    }

    // Improved normalization for Windows compatibility
    const normalizePathForComparison = (pathStr) => {
        return path.resolve(pathStr)
            .replace(/[\\/]+/g, "/")
            .toLowerCase(); // Case-insensitive for Windows
    };

    const root = normalizePathForComparison(ROOT);
    const full = normalizePathForComparison(path.resolve(ROOT, p));

    console.log(`Guard check: input="${p}", full="${full}", root="${root}"`);

    // Platform-aware path checking
    const isSubPath = process.platform === "win32"
        ? (full === root || full.startsWith(root + "/"))
        : (full === root || full.startsWith(root + "/"));

    if (!isSubPath) {
        console.log(`❌ Path escape detected: ${full} ∉ ${root}`);
        throw new Error(`Path escape tespit edildi: ${full} ana dizin dışında`);
    }

    // Return the actual resolved path (not normalized for comparison)
    const actualPath = path.resolve(ROOT, p);
    console.log(`✅ Path allowed: ${actualPath}`);
    return actualPath;
}

// --- Araçlar ---
app.post("/tool/list_dir", async (req, res) => {
    try {
        const { dir = "." } = req.body;
        const full = guard(dir);
        const entries = await fs.readdir(full, { withFileTypes: true });
        res.json(entries.map(e => ({ name: e.name, type: e.isDirectory() ? "dir" : "file" })));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post("/tool/glob", async (req, res) => {
    try {
        const { pattern = "*.md", dir = "." } = req.body;
        const micromatch = require("micromatch");
        console.log(`Glob request: pattern="${pattern}", dir="${dir}"`);

        // Hariç tutulacak klasörler ve dosyalar
        const excludePatterns = [
            '**/node_modules/**',
            '**/.git/**',
            '**/dist/**',
            '**/build/**',
            '**/.vscode/**',
            '**/.idea/**',
            '**/coverage/**',
            '**/temp/**',
            '**/tmp/**',
            '**/*.log',
            '**/package-lock.json',
            '**/yarn.lock'
        ];

        async function walk(d, out = []) {
            try {
                const full = guard(d);
                console.log(`Walking directory: ${full}`);
                const entries = await fs.readdir(full, { withFileTypes: true });

                for (const e of entries) {
                    // Skip hidden directories and files starting with .
                    if (e.name.startsWith('.') && !e.name.endsWith('.js') && !e.name.endsWith('.json')) continue;

                    // Skip common exclude patterns
                    if (['node_modules', 'dist', 'build', 'coverage', 'temp', 'tmp'].includes(e.name)) continue;

                    // Always use forward slashes for micromatch
                    const relativePath = path.posix.join(d.replace(/[\\/]+/g, "/"), e.name);

                    // Check if path matches exclude patterns
                    const isExcluded = excludePatterns.some(exclude =>
                        micromatch.isMatch(relativePath, exclude)
                    );

                    if (isExcluded) continue;

                    if (e.isDirectory()) {
                        await walk(relativePath, out);
                    } else {
                        out.push(relativePath.startsWith('./') ? relativePath.slice(2) : relativePath);
                    }
                }
            } catch (walkError) {
                console.log(`Walk error in ${d}: ${walkError.message}`);
            }
            return out;
        }

        const all = await walk(dir);
        console.log(`Found ${all.length} files total (after filtering)`);

        const matched = micromatch(all, pattern);
        console.log(`Matched ${matched.length} files with pattern "${pattern}"`);

        // Token limitini aşmamak için dosya sayısını sınırla
        const maxFiles = 50;
        if (matched.length > maxFiles) {
            console.log(`Too many files (${matched.length}), limiting to ${maxFiles}`);
            // Önce önemli dosyaları seç
            const priorityFiles = matched.filter(f =>
                f.includes('package.json') ||
                f.includes('main.') ||
                f.includes('index.') ||
                f.includes('app.') ||
                f.includes('README') ||
                f.startsWith('src/') ||
                f.startsWith('lib/')
            );

            const otherFiles = matched.filter(f => !priorityFiles.includes(f));
            const result = [...priorityFiles, ...otherFiles.slice(0, maxFiles - priorityFiles.length)];

            res.json(result);
        } else {
            res.json(matched);
        }

    } catch (error) {
        console.error(`Glob error: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

app.post("/tool/read_file", async (req, res) => {
    try {
        const { file } = req.body;
        const full = guard(file);
        const content = await fs.readFile(full, "utf8");
        res.json({ content });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post("/tool/write_file", async (req, res) => {
    try {
        const { file, content } = req.body;
        const full = guard(file);
        await fs.mkdir(path.dirname(full), { recursive: true });
        await fs.writeFile(full, content, "utf8");
        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post("/tool/run_cmd", async (req, res) => {
    try {
        const { cmd, args = [], cwd = "." } = req.body;
        if (!ALLOWED_CMDS.has(cmd)) {
            return res.status(400).json({ error: "Komut izinli değil" });
        }

        const fullCwd = guard(cwd);
        child_process.execFile(cmd, args, {
            cwd: fullCwd,
            shell: false,
            windowsHide: true,
            timeout: 60_000
        }, (err, stdout, stderr) => {
            if (err) {
                return res.status(500).json({ error: err.message, stdout, stderr });
            }
            res.json({ stdout, stderr });
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Yeni endpoint: Working directory değiştirme
app.post("/tool/set_working_dir", async (req, res) => {
    try {
        const { dir } = req.body;
        if (!dir) {
            return res.status(400).json({ error: "Directory path required" });
        }

        const normalizedDir = path.resolve(dir).replace(/\\/g, "/");
        console.log(`Attempting to change working directory to: ${normalizedDir}`);

        // Check if directory exists
        try {
            await fs.access(normalizedDir);
            ROOT = normalizedDir;
            console.log(`✅ Working directory changed to: ${ROOT}`);
            res.json({ success: true, workingDir: ROOT });
        } catch (error) {
            console.log(`❌ Directory does not exist: ${normalizedDir}`);
            res.status(400).json({ error: "Directory does not exist" });
        }
    } catch (error) {
        console.error(`Error changing working directory: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

const PORT = 7777;
const HOST = '127.0.0.1'; // Security: Only bind to localhost
app.listen(PORT, HOST, () => {
    console.log(`🔧 Agent tools listening on http://${HOST}:${PORT}`);
    console.log("📁 ROOT:", ROOT);
    console.log("🔑 AGENT_KEY:", process.env.NODE_ENV === 'production' ? '***' : AGENT_KEY);
});