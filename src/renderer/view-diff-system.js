/**
 * ViewDiff System - Continue Agent Style
 * Git diff visualization and change preview
 * Shows working changes, staged changes, and provides approval workflow
 */

class ViewDiffSystem {
    constructor() {
        this.diffCache = new Map(); // Cache diffs for performance
        this.cacheTimeout = 5000; // 5 seconds
    }

    /**
     * Get current git diff
     * @param {Object} options - Diff options
     * @returns {Promise<DiffResult>}
     */
    async viewDiff(options = {}) {
        const {
            includeUntracked = false,
            includeStaged = true,
            includeUnstaged = true,
            maxFiles = 50,
            contextLines = 3
        } = options;

        try {
            console.log('🔍 ViewDiff: Getting git changes...');

            // Check if git is available
            const hasGit = await this.checkGitAvailable();
            if (!hasGit) {
                return this.getFallbackDiff();
            }

            // Get current working directory
            const workingDir = this.getWorkingDirectory();

            // Build diff results
            const result = {
                success: true,
                workingDirectory: workingDir,
                timestamp: Date.now(),
                changes: {
                    staged: [],
                    unstaged: [],
                    untracked: []
                },
                summary: {
                    totalFiles: 0,
                    additions: 0,
                    deletions: 0,
                    modifications: 0
                },
                raw: ''
            };

            // Get staged changes
            if (includeStaged) {
                result.changes.staged = await this.getStagedChanges(workingDir, contextLines);
            }

            // Get unstaged changes
            if (includeUnstaged) {
                result.changes.unstaged = await this.getUnstagedChanges(workingDir, contextLines);
            }

            // Get untracked files
            if (includeUntracked) {
                result.changes.untracked = await this.getUntrackedFiles(workingDir);
            }

            // Calculate summary
            this.calculateSummary(result);

            // Generate human-readable diff
            result.formatted = this.formatDiff(result);

            console.log(`✅ ViewDiff: Found ${result.summary.totalFiles} changed files`);
            return result;

        } catch (error) {
            console.error('❌ ViewDiff failed:', error);
            return {
                success: false,
                error: error.message,
                fallback: await this.getFallbackDiff()
            };
        }
    }

    /**
     * Get staged changes (git diff --cached)
     */
    async getStagedChanges(workingDir, contextLines) {
        try {
            const command = `git diff --cached -U${contextLines} --no-color`;
            const result = await this.runGitCommand(command, workingDir);
            return this.parseDiffOutput(result, 'staged');
        } catch (error) {
            console.warn('Could not get staged changes:', error.message);
            return [];
        }
    }

    /**
     * Get unstaged changes (git diff)
     */
    async getUnstagedChanges(workingDir, contextLines) {
        try {
            const command = `git diff -U${contextLines} --no-color`;
            const result = await this.runGitCommand(command, workingDir);
            return this.parseDiffOutput(result, 'unstaged');
        } catch (error) {
            console.warn('Could not get unstaged changes:', error.message);
            return [];
        }
    }

    /**
     * Get untracked files
     */
    async getUntrackedFiles(workingDir) {
        try {
            const command = 'git ls-files --others --exclude-standard';
            const result = await this.runGitCommand(command, workingDir);
            
            return result.split('\n')
                .filter(line => line.trim())
                .map(filepath => ({
                    type: 'untracked',
                    filepath,
                    status: 'new file',
                    additions: 0,
                    deletions: 0
                }));
        } catch (error) {
            console.warn('Could not get untracked files:', error.message);
            return [];
        }
    }

    /**
     * Parse git diff output
     */
    parseDiffOutput(diffOutput, changeType) {
        if (!diffOutput || !diffOutput.trim()) {
            return [];
        }

        const files = [];
        const fileBlocks = diffOutput.split('diff --git');

        for (const block of fileBlocks) {
            if (!block.trim()) continue;

            const file = this.parseFileBlock(block, changeType);
            if (file) {
                files.push(file);
            }
        }

        return files;
    }

    /**
     * Parse individual file diff block
     */
    parseFileBlock(block, changeType) {
        const lines = block.split('\n');
        
        // Extract filepath
        const filepathMatch = lines[0].match(/a\/(.+?) b\/(.+?)$/);
        if (!filepathMatch) return null;

        const filepath = filepathMatch[2];

        // Detect file status
        let status = 'modified';
        if (block.includes('new file mode')) status = 'added';
        if (block.includes('deleted file mode')) status = 'deleted';
        if (block.includes('rename from')) status = 'renamed';

        // Count additions/deletions
        let additions = 0;
        let deletions = 0;
        const hunks = [];
        let currentHunk = null;

        for (const line of lines) {
            // New hunk
            if (line.startsWith('@@')) {
                if (currentHunk) hunks.push(currentHunk);
                
                const hunkMatch = line.match(/@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@(.*)/);
                currentHunk = {
                    oldStart: parseInt(hunkMatch[1]),
                    oldLines: parseInt(hunkMatch[2] || '1'),
                    newStart: parseInt(hunkMatch[3]),
                    newLines: parseInt(hunkMatch[4] || '1'),
                    header: hunkMatch[5]?.trim() || '',
                    changes: []
                };
            }
            // Added line
            else if (line.startsWith('+') && !line.startsWith('+++')) {
                additions++;
                if (currentHunk) {
                    currentHunk.changes.push({ type: 'add', content: line.substring(1) });
                }
            }
            // Deleted line
            else if (line.startsWith('-') && !line.startsWith('---')) {
                deletions++;
                if (currentHunk) {
                    currentHunk.changes.push({ type: 'delete', content: line.substring(1) });
                }
            }
            // Context line
            else if (line.startsWith(' ') && currentHunk) {
                currentHunk.changes.push({ type: 'context', content: line.substring(1) });
            }
        }

        if (currentHunk) hunks.push(currentHunk);

        return {
            type: changeType,
            filepath,
            status,
            additions,
            deletions,
            hunks,
            raw: block
        };
    }

    /**
     * Calculate summary statistics
     */
    calculateSummary(result) {
        const allChanges = [
            ...result.changes.staged,
            ...result.changes.unstaged,
            ...result.changes.untracked
        ];

        result.summary.totalFiles = allChanges.length;
        result.summary.additions = allChanges.reduce((sum, f) => sum + (f.additions || 0), 0);
        result.summary.deletions = allChanges.reduce((sum, f) => sum + (f.deletions || 0), 0);
        result.summary.modifications = allChanges.filter(f => f.status === 'modified').length;
    }

    /**
     * Format diff for human reading
     */
    formatDiff(result) {
        const lines = [];

        lines.push('# Git Diff Summary\n');
        lines.push(`📁 Working Directory: ${result.workingDirectory}`);
        lines.push(`📊 Total Files: ${result.summary.totalFiles}`);
        lines.push(`➕ Additions: ${result.summary.additions}`);
        lines.push(`➖ Deletions: ${result.summary.deletions}\n`);

        // Staged changes
        if (result.changes.staged.length > 0) {
            lines.push('## 🟢 Staged Changes (Ready to Commit)\n');
            result.changes.staged.forEach(file => {
                lines.push(this.formatFileChange(file));
            });
        }

        // Unstaged changes
        if (result.changes.unstaged.length > 0) {
            lines.push('\n## 🟡 Unstaged Changes (Not Yet Staged)\n');
            result.changes.unstaged.forEach(file => {
                lines.push(this.formatFileChange(file));
            });
        }

        // Untracked files
        if (result.changes.untracked.length > 0) {
            lines.push('\n## 🔵 Untracked Files (New Files)\n');
            result.changes.untracked.forEach(file => {
                lines.push(`  📄 ${file.filepath}`);
            });
        }

        return lines.join('\n');
    }

    /**
     * Format individual file change
     */
    formatFileChange(file) {
        const statusEmoji = {
            'added': '✨',
            'deleted': '🗑️',
            'modified': '✏️',
            'renamed': '🔄'
        };

        const emoji = statusEmoji[file.status] || '📝';
        let output = `  ${emoji} ${file.filepath} (+${file.additions} -${file.deletions})\n`;

        // Show first few hunks
        if (file.hunks && file.hunks.length > 0) {
            const maxHunks = 2;
            for (let i = 0; i < Math.min(maxHunks, file.hunks.length); i++) {
                const hunk = file.hunks[i];
                output += `    @@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@\n`;
                
                // Show first few changes
                const maxChanges = 5;
                for (let j = 0; j < Math.min(maxChanges, hunk.changes.length); j++) {
                    const change = hunk.changes[j];
                    const prefix = change.type === 'add' ? '+' : change.type === 'delete' ? '-' : ' ';
                    output += `    ${prefix} ${change.content}\n`;
                }

                if (hunk.changes.length > maxChanges) {
                    output += `    ... (${hunk.changes.length - maxChanges} more lines)\n`;
                }
            }

            if (file.hunks.length > maxHunks) {
                output += `    ... (${file.hunks.length - maxHunks} more hunks)\n`;
            }
        }

        return output;
    }

    /**
     * Get fallback diff when git is not available
     */
    async getFallbackDiff() {
        console.log('⚠️ ViewDiff: Git not available, using fallback');
        
        return {
            success: true,
            fallbackMode: true,
            message: 'Git not available. Showing file system changes only.',
            changes: {
                staged: [],
                unstaged: [],
                untracked: []
            },
            summary: {
                totalFiles: 0,
                additions: 0,
                deletions: 0,
                modifications: 0
            }
        };
    }

    /**
     * Check if git is available
     */
    async checkGitAvailable() {
        try {
            const result = await this.runGitCommand('git --version', process.cwd());
            return result.includes('git version');
        } catch (error) {
            return false;
        }
    }

    /**
     * Run git command
     */
    async runGitCommand(command, cwd) {
        if (!window.electronAPI || !window.electronAPI.runCommand) {
            throw new Error('electronAPI.runCommand not available');
        }

        const result = await window.electronAPI.runCommand(command, cwd);
        
        if (!result.success) {
            throw new Error(result.error || 'Git command failed');
        }

        return result.stdout || '';
    }

    /**
     * Get working directory
     */
    getWorkingDirectory() {
        // Try to get from window context
        if (window.__CURRENT_FOLDER__) {
            return window.__CURRENT_FOLDER__;
        }

        // Fallback to localStorage
        const saved = localStorage.getItem('currentFolder');
        if (saved) {
            return saved;
        }

        // Last resort: process.cwd() or default
        return process.cwd?.() || 'Unknown';
    }

    /**
     * Clear diff cache
     */
    clearCache() {
        this.diffCache.clear();
    }

    /**
     * Create approval UI for diff
     */
    createDiffApprovalUI(diffResult) {
        return {
            title: 'Review Changes',
            summary: `${diffResult.summary.totalFiles} files changed, +${diffResult.summary.additions} -${diffResult.summary.deletions}`,
            formatted: diffResult.formatted,
            actions: [
                { label: 'Approve & Commit', value: 'approve', type: 'primary' },
                { label: 'Review Details', value: 'review', type: 'secondary' },
                { label: 'Reject', value: 'reject', type: 'danger' }
            ]
        };
    }
}

/**
 * @typedef {Object} DiffResult
 * @property {boolean} success - Operation success
 * @property {string} workingDirectory - Current working directory
 * @property {Object} changes - All changes categorized
 * @property {Object} summary - Statistics summary
 * @property {string} formatted - Human-readable diff
 */

// Export for use in app.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ViewDiffSystem;
}
