/**
 * MCP Git Advanced Operations
 * diff, blame, log advanced, stash, cherry-pick, rebase
 */

const { execSync } = require('child_process');
const path = require('path');

class GitAdvanced {
    constructor() {
        this.operationHistory = [];
    }
    
    /**
     * Get git diff
     * @param {object} params - Parameters
     * @param {string} params.path - Repository path
     * @param {string} params.ref1 - First reference (commit/branch)
     * @param {string} params.ref2 - Second reference (optional)
     * @param {string} params.filePath - Specific file (optional)
     * @param {boolean} params.staged - Show staged changes only
     * @returns {object} - Diff output
     */
    async diff(params) {
        const { path: repoPath = process.cwd(), ref1, ref2, filePath, staged = false } = params;
        
        let command = 'git diff';
        
        if (staged) {
            command += ' --staged';
        } else if (ref1 && ref2) {
            command += ` ${ref1} ${ref2}`;
        } else if (ref1) {
            command += ` ${ref1}`;
        }
        
        if (filePath) {
            command += ` -- ${filePath}`;
        }
        
        try {
            const output = execSync(command, {
                cwd: repoPath,
                encoding: 'utf8',
                maxBuffer: 10 * 1024 * 1024 // 10MB
            });
            
            const stats = this.parseDiffStats(output);
            
            this.addToHistory({
                operation: 'diff',
                command,
                success: true,
                timestamp: new Date().toISOString()
            });
            
            return {
                success: true,
                diff: output,
                stats,
                command
            };
        } catch (error) {
            // Git diff returns exit code 1 if there are differences
            const output = error.stdout || '';
            const stats = this.parseDiffStats(output);
            
            return {
                success: true,
                diff: output,
                stats,
                command
            };
        }
    }
    
    /**
     * Get git blame
     * @param {object} params - Parameters
     * @param {string} params.path - Repository path
     * @param {string} params.filePath - File to blame
     * @param {number} params.startLine - Start line (optional)
     * @param {number} params.endLine - End line (optional)
     * @returns {object} - Blame output
     */
    async blame(params) {
        const { path: repoPath = process.cwd(), filePath, startLine, endLine } = params;
        
        if (!filePath) {
            throw new Error('File path is required for blame');
        }
        
        let command = `git blame -p`;
        
        if (startLine && endLine) {
            command += ` -L ${startLine},${endLine}`;
        }
        
        command += ` "${filePath}"`;
        
        try {
            const output = execSync(command, {
                cwd: repoPath,
                encoding: 'utf8',
                maxBuffer: 10 * 1024 * 1024
            });
            
            const parsed = this.parseBlame(output);
            
            this.addToHistory({
                operation: 'blame',
                command,
                success: true,
                timestamp: new Date().toISOString()
            });
            
            return {
                success: true,
                filePath,
                blame: parsed,
                command
            };
        } catch (error) {
            throw new Error(`Git blame failed: ${error.message}`);
        }
    }
    
    /**
     * Get advanced git log
     * @param {object} params - Parameters
     * @param {string} params.path - Repository path
     * @param {number} params.maxCount - Max commits to show
     * @param {string} params.since - Since date (e.g., "2 weeks ago")
     * @param {string} params.author - Filter by author
     * @param {string} params.filePath - Filter by file
     * @param {boolean} params.oneline - Compact format
     * @returns {object} - Log output
     */
    async log(params) {
        const { 
            path: repoPath = process.cwd(), 
            maxCount = 20, 
            since, 
            author, 
            filePath,
            oneline = false
        } = params;
        
        let command = 'git log';
        
        if (oneline) {
            command += ' --oneline';
        } else {
            command += ' --pretty=format:"%H|%an|%ae|%ad|%s"';
        }
        
        command += ` -n ${maxCount}`;
        
        if (since) {
            command += ` --since="${since}"`;
        }
        
        if (author) {
            command += ` --author="${author}"`;
        }
        
        if (filePath) {
            command += ` -- "${filePath}"`;
        }
        
        try {
            const output = execSync(command, {
                cwd: repoPath,
                encoding: 'utf8'
            });
            
            const commits = this.parseLog(output, oneline);
            
            this.addToHistory({
                operation: 'log',
                command,
                success: true,
                timestamp: new Date().toISOString()
            });
            
            return {
                success: true,
                commits,
                count: commits.length,
                command
            };
        } catch (error) {
            throw new Error(`Git log failed: ${error.message}`);
        }
    }
    
    /**
     * Stash changes
     * @param {object} params - Parameters
     * @param {string} params.path - Repository path
     * @param {string} params.operation - list, push, pop, apply, drop
     * @param {string} params.message - Stash message (for push)
     * @param {number} params.index - Stash index (for pop/apply/drop)
     * @returns {object} - Stash result
     */
    async stash(params) {
        const { path: repoPath = process.cwd(), operation = 'list', message, index = 0 } = params;
        
        let command = 'git stash';
        
        switch (operation) {
            case 'list':
                command += ' list';
                break;
            case 'push':
                command += ' push';
                if (message) {
                    command += ` -m "${message}"`;
                }
                break;
            case 'pop':
                command += ` pop stash@{${index}}`;
                break;
            case 'apply':
                command += ` apply stash@{${index}}`;
                break;
            case 'drop':
                command += ` drop stash@{${index}}`;
                break;
            default:
                throw new Error(`Unknown stash operation: ${operation}`);
        }
        
        try {
            const output = execSync(command, {
                cwd: repoPath,
                encoding: 'utf8'
            });
            
            this.addToHistory({
                operation: 'stash',
                subOperation: operation,
                command,
                success: true,
                timestamp: new Date().toISOString()
            });
            
            return {
                success: true,
                operation,
                output: output.trim(),
                command
            };
        } catch (error) {
            throw new Error(`Git stash ${operation} failed: ${error.message}`);
        }
    }
    
    /**
     * Cherry-pick commits
     * @param {object} params - Parameters
     * @param {string} params.path - Repository path
     * @param {string} params.commit - Commit hash to cherry-pick
     * @param {boolean} params.noCommit - Don't auto-commit
     * @returns {object} - Cherry-pick result
     */
    async cherryPick(params) {
        const { path: repoPath = process.cwd(), commit, noCommit = false } = params;
        
        if (!commit) {
            throw new Error('Commit hash is required for cherry-pick');
        }
        
        let command = `git cherry-pick ${commit}`;
        
        if (noCommit) {
            command += ' --no-commit';
        }
        
        try {
            const output = execSync(command, {
                cwd: repoPath,
                encoding: 'utf8'
            });
            
            this.addToHistory({
                operation: 'cherry-pick',
                command,
                success: true,
                timestamp: new Date().toISOString()
            });
            
            return {
                success: true,
                commit,
                output: output.trim(),
                command
            };
        } catch (error) {
            throw new Error(`Git cherry-pick failed: ${error.message}`);
        }
    }
    
    /**
     * Rebase commits
     * @param {object} params - Parameters
     * @param {string} params.path - Repository path
     * @param {string} params.operation - start, continue, abort, skip
     * @param {string} params.onto - Rebase onto branch/commit
     * @param {boolean} params.interactive - Interactive rebase
     * @returns {object} - Rebase result
     */
    async rebase(params) {
        const { 
            path: repoPath = process.cwd(), 
            operation = 'start', 
            onto, 
            interactive = false 
        } = params;
        
        let command = 'git rebase';
        
        switch (operation) {
            case 'start':
                if (!onto) {
                    throw new Error('Target branch/commit is required for rebase');
                }
                if (interactive) {
                    command += ' -i';
                }
                command += ` ${onto}`;
                break;
            case 'continue':
                command += ' --continue';
                break;
            case 'abort':
                command += ' --abort';
                break;
            case 'skip':
                command += ' --skip';
                break;
            default:
                throw new Error(`Unknown rebase operation: ${operation}`);
        }
        
        try {
            const output = execSync(command, {
                cwd: repoPath,
                encoding: 'utf8'
            });
            
            this.addToHistory({
                operation: 'rebase',
                subOperation: operation,
                command,
                success: true,
                timestamp: new Date().toISOString()
            });
            
            return {
                success: true,
                operation,
                output: output.trim(),
                command
            };
        } catch (error) {
            // Rebase might fail but return useful info
            return {
                success: false,
                operation,
                error: error.message,
                output: error.stdout ? error.stdout.trim() : '',
                command
            };
        }
    }
    
    /**
     * Parse diff statistics
     */
    parseDiffStats(diff) {
        const lines = diff.split('\n');
        let filesChanged = 0;
        let insertions = 0;
        let deletions = 0;
        
        for (const line of lines) {
            if (line.startsWith('+++') || line.startsWith('---')) {
                filesChanged++;
            } else if (line.startsWith('+') && !line.startsWith('+++')) {
                insertions++;
            } else if (line.startsWith('-') && !line.startsWith('---')) {
                deletions++;
            }
        }
        
        return {
            filesChanged: Math.floor(filesChanged / 2), // Divide by 2 (+++ and ---)
            insertions,
            deletions
        };
    }
    
    /**
     * Parse blame output
     */
    parseBlame(output) {
        const lines = output.split('\n');
        const blameLines = [];
        let currentCommit = null;
        
        for (const line of lines) {
            if (line.match(/^[a-f0-9]{40}/)) {
                currentCommit = line.split(' ')[0];
            } else if (line.startsWith('author ')) {
                const author = line.substring(7);
                blameLines.push({ commit: currentCommit, author });
            }
        }
        
        return blameLines;
    }
    
    /**
     * Parse log output
     */
    parseLog(output, oneline) {
        const lines = output.trim().split('\n');
        
        if (oneline) {
            return lines.map(line => {
                const parts = line.split(' ');
                return {
                    hash: parts[0],
                    message: parts.slice(1).join(' ')
                };
            });
        }
        
        return lines.map(line => {
            const [hash, author, email, date, message] = line.split('|');
            return { hash, author, email, date, message };
        });
    }
    
    /**
     * Add to history
     */
    addToHistory(entry) {
        this.operationHistory.push(entry);
        if (this.operationHistory.length > 100) {
            this.operationHistory.shift();
        }
    }
    
    /**
     * Get statistics
     */
    getStats() {
        const operations = {};
        for (const entry of this.operationHistory) {
            operations[entry.operation] = (operations[entry.operation] || 0) + 1;
        }
        
        return {
            totalOperations: this.operationHistory.length,
            operations,
            recentOperations: this.operationHistory.slice(-5)
        };
    }
}

// Singleton instance
let gitAdvanced = null;

function getGitAdvanced() {
    if (!gitAdvanced) {
        gitAdvanced = new GitAdvanced();
    }
    return gitAdvanced;
}

module.exports = {
    GitAdvanced,
    getGitAdvanced
};
