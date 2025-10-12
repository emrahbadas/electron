/**
 * ViewRepoMap System - Continue Agent Style
 * Project structure visualization and navigation
 * Provides AI agents with complete codebase understanding
 */

class ViewRepoMapSystem {
    constructor() {
        this.cache = null;
        this.cacheTimeout = 30000; // 30 seconds
        this.lastCacheTime = 0;
        
        // File patterns to ignore
        this.ignorePatterns = [
            'node_modules',
            '.git',
            'dist',
            'build',
            'coverage',
            '.next',
            '.nuxt',
            'out',
            '.cache',
            '__pycache__',
            '*.pyc',
            '.DS_Store',
            'Thumbs.db',
            '.vscode',
            '.idea',
            '*.log',
            'tmp',
            'temp'
        ];

        // Important file extensions for code analysis
        this.codeExtensions = [
            '.js', '.jsx', '.ts', '.tsx',
            '.py', '.java', '.cpp', '.c', '.h',
            '.cs', '.go', '.rs', '.swift',
            '.html', '.css', '.scss', '.sass',
            '.json', '.xml', '.yaml', '.yml',
            '.md', '.txt'
        ];
    }

    /**
     * Generate repository map
     * @param {Object} options - Map generation options
     * @returns {Promise<RepoMapResult>}
     */
    async viewRepoMap(options = {}) {
        const {
            rootPath = this.getWorkingDirectory(),
            maxDepth = 5,
            includeStats = true,
            includeFileTree = true,
            includeImportGraph = false,
            useCache = true
        } = options;

        try {
            console.log('🗺️ ViewRepoMap: Generating project map...');

            // Check cache
            if (useCache && this.isCacheValid()) {
                console.log('✅ Using cached repo map');
                return this.cache;
            }

            // Build repository map
            const result = {
                success: true,
                rootPath,
                timestamp: Date.now(),
                structure: {},
                stats: {},
                fileTree: [],
                formatted: ''
            };

            // Scan directory structure
            result.structure = await this.scanDirectory(rootPath, 0, maxDepth);

            // Calculate statistics
            if (includeStats) {
                result.stats = this.calculateStats(result.structure);
            }

            // Generate file tree visualization
            if (includeFileTree) {
                result.fileTree = this.generateFileTree(result.structure);
            }

            // Generate import graph (optional, more expensive)
            if (includeImportGraph) {
                result.importGraph = await this.generateImportGraph(result.structure);
            }

            // Format for human reading
            result.formatted = this.formatRepoMap(result);

            // Cache result
            this.cache = result;
            this.lastCacheTime = Date.now();

            console.log(`✅ ViewRepoMap: Scanned ${result.stats.totalFiles} files in ${result.stats.totalDirectories} directories`);
            return result;

        } catch (error) {
            console.error('❌ ViewRepoMap failed:', error);
            return {
                success: false,
                error: error.message,
                rootPath,
                fallback: this.getFallbackMap(rootPath)
            };
        }
    }

    /**
     * Recursively scan directory
     */
    async scanDirectory(dirPath, currentDepth, maxDepth) {
        if (currentDepth >= maxDepth) {
            return { truncated: true, reason: 'max depth reached' };
        }

        try {
            const entries = await this.readDirectory(dirPath);
            const structure = {
                path: dirPath,
                name: this.getBasename(dirPath),
                type: 'directory',
                depth: currentDepth,
                children: []
            };

            for (const entry of entries) {
                // Skip ignored patterns
                if (this.shouldIgnore(entry.name)) {
                    continue;
                }

                const fullPath = this.joinPath(dirPath, entry.name);

                if (entry.isDirectory) {
                    // Recursively scan subdirectory
                    const subStructure = await this.scanDirectory(fullPath, currentDepth + 1, maxDepth);
                    structure.children.push(subStructure);
                } else {
                    // Add file entry
                    structure.children.push({
                        path: fullPath,
                        name: entry.name,
                        type: 'file',
                        extension: this.getExtension(entry.name),
                        size: entry.size || 0,
                        isCode: this.isCodeFile(entry.name),
                        depth: currentDepth + 1
                    });
                }
            }

            // Sort: directories first, then files alphabetically
            structure.children.sort((a, b) => {
                if (a.type === 'directory' && b.type !== 'directory') return -1;
                if (a.type !== 'directory' && b.type === 'directory') return 1;
                return a.name.localeCompare(b.name);
            });

            return structure;

        } catch (error) {
            console.warn(`Could not scan directory ${dirPath}:`, error.message);
            return {
                path: dirPath,
                name: this.getBasename(dirPath),
                type: 'directory',
                error: error.message,
                children: []
            };
        }
    }

    /**
     * Calculate project statistics
     */
    calculateStats(structure) {
        const stats = {
            totalFiles: 0,
            totalDirectories: 0,
            codeFiles: 0,
            totalSize: 0,
            filesByExtension: {},
            deepestLevel: 0
        };

        const traverse = (node, depth = 0) => {
            stats.deepestLevel = Math.max(stats.deepestLevel, depth);

            if (node.type === 'directory') {
                stats.totalDirectories++;
                if (node.children) {
                    node.children.forEach(child => traverse(child, depth + 1));
                }
            } else if (node.type === 'file') {
                stats.totalFiles++;
                stats.totalSize += node.size || 0;

                if (node.isCode) {
                    stats.codeFiles++;
                }

                const ext = node.extension || 'no extension';
                stats.filesByExtension[ext] = (stats.filesByExtension[ext] || 0) + 1;
            }
        };

        traverse(structure);
        return stats;
    }

    /**
     * Generate ASCII file tree
     */
    generateFileTree(structure, prefix = '', isLast = true) {
        const lines = [];
        const connector = isLast ? '└── ' : '├── ';
        const icon = structure.type === 'directory' ? '📁' : '📄';
        
        let label = `${icon} ${structure.name}`;
        if (structure.type === 'file' && structure.size) {
            label += ` (${this.formatFileSize(structure.size)})`;
        }

        lines.push(prefix + connector + label);

        if (structure.children && structure.children.length > 0) {
            const childPrefix = prefix + (isLast ? '    ' : '│   ');
            
            structure.children.forEach((child, index) => {
                const childIsLast = index === structure.children.length - 1;
                const childLines = this.generateFileTree(child, childPrefix, childIsLast);
                lines.push(...childLines);
            });
        }

        return lines;
    }

    /**
     * Format repo map for display
     */
    formatRepoMap(result) {
        const lines = [];

        lines.push('# 🗺️ Repository Map\n');
        lines.push(`📁 **Root Path**: ${result.rootPath}`);
        lines.push(`⏰ **Generated**: ${new Date(result.timestamp).toLocaleString()}\n`);

        // Statistics
        if (result.stats) {
            lines.push('## 📊 Project Statistics\n');
            lines.push(`- **Total Files**: ${result.stats.totalFiles}`);
            lines.push(`- **Code Files**: ${result.stats.codeFiles}`);
            lines.push(`- **Directories**: ${result.stats.totalDirectories}`);
            lines.push(`- **Total Size**: ${this.formatFileSize(result.stats.totalSize)}`);
            lines.push(`- **Max Depth**: ${result.stats.deepestLevel}\n`);

            // File types breakdown
            if (Object.keys(result.stats.filesByExtension).length > 0) {
                lines.push('### 📑 File Types:\n');
                const sorted = Object.entries(result.stats.filesByExtension)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 10); // Top 10

                sorted.forEach(([ext, count]) => {
                    lines.push(`  - **${ext}**: ${count} files`);
                });
                lines.push('');
            }
        }

        // File tree
        if (result.fileTree && result.fileTree.length > 0) {
            lines.push('## 📂 Directory Structure\n');
            lines.push('```');
            lines.push(...result.fileTree);
            lines.push('```\n');
        }

        // Import graph
        if (result.importGraph) {
            lines.push('## 🔗 Import Dependencies\n');
            lines.push('```');
            lines.push(JSON.stringify(result.importGraph, null, 2));
            lines.push('```\n');
        }

        return lines.join('\n');
    }

    /**
     * Generate import/dependency graph (simplified)
     */
    async generateImportGraph(structure) {
        const graph = {
            nodes: [],
            edges: []
        };

        const traverse = async (node) => {
            if (node.type === 'file' && node.isCode) {
                graph.nodes.push({
                    id: node.path,
                    name: node.name,
                    type: node.extension
                });

                // TODO: Parse file for imports
                // This would require reading each file and analyzing imports
                // For now, just track file existence
            }

            if (node.children) {
                for (const child of node.children) {
                    await traverse(child);
                }
            }
        };

        await traverse(structure);
        return graph;
    }

    /**
     * Check if cache is valid
     */
    isCacheValid() {
        if (!this.cache) return false;
        const age = Date.now() - this.lastCacheTime;
        return age < this.cacheTimeout;
    }

    /**
     * Get fallback map when scanning fails
     */
    getFallbackMap(rootPath) {
        return {
            success: true,
            fallbackMode: true,
            rootPath,
            message: 'Could not generate full repo map. Showing basic structure.',
            stats: {
                totalFiles: 0,
                totalDirectories: 0,
                codeFiles: 0
            }
        };
    }

    /**
     * Check if file should be ignored
     */
    shouldIgnore(name) {
        return this.ignorePatterns.some(pattern => {
            if (pattern.includes('*')) {
                const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
                return regex.test(name);
            }
            return name === pattern || name.startsWith(pattern);
        });
    }

    /**
     * Check if file is a code file
     */
    isCodeFile(name) {
        const ext = this.getExtension(name);
        return this.codeExtensions.includes(ext);
    }

    /**
     * Get file extension
     */
    getExtension(filename) {
        const match = filename.match(/\.[^.]+$/);
        return match ? match[0] : '';
    }

    /**
     * Get basename from path
     */
    getBasename(filepath) {
        return filepath.split(/[/\\]/).pop() || filepath;
    }

    /**
     * Join path segments
     */
    joinPath(...segments) {
        return segments.join('/').replace(/\/+/g, '/');
    }

    /**
     * Format file size
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Read directory using Electron API
     */
    async readDirectory(dirPath) {
        if (!window.electronAPI || !window.electronAPI.readDirectory) {
            throw new Error('electronAPI.readDirectory not available');
        }

        const result = await window.electronAPI.readDirectory(dirPath);
        if (!result.success) {
            throw new Error(result.error || 'Failed to read directory');
        }

        return result.files || [];
    }

    /**
     * Get working directory
     */
    getWorkingDirectory() {
        if (window.__CURRENT_FOLDER__) {
            return window.__CURRENT_FOLDER__;
        }

        const saved = localStorage.getItem('currentFolder');
        if (saved) {
            return saved;
        }

        return process.cwd?.() || '.';
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache = null;
        this.lastCacheTime = 0;
    }

    /**
     * Add custom ignore pattern
     */
    addIgnorePattern(pattern) {
        if (!this.ignorePatterns.includes(pattern)) {
            this.ignorePatterns.push(pattern);
        }
    }

    /**
     * Remove ignore pattern
     */
    removeIgnorePattern(pattern) {
        const index = this.ignorePatterns.indexOf(pattern);
        if (index > -1) {
            this.ignorePatterns.splice(index, 1);
        }
    }
}

/**
 * @typedef {Object} RepoMapResult
 * @property {boolean} success - Operation success
 * @property {string} rootPath - Project root path
 * @property {Object} structure - Complete directory tree
 * @property {Object} stats - Project statistics
 * @property {Array<string>} fileTree - ASCII file tree
 * @property {string} formatted - Human-readable output
 */

// Export for use in app.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ViewRepoMapSystem;
}
