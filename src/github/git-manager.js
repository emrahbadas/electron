/**
 * KayraDeniz Git Manager
 * Local Git repository yönetimi (clone, commit, push, pull)
 */

const { exec, spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

class GitManager {
    constructor() {
        this.workingDirectory = null;
        this.gitPath = 'git'; // Git executable path
    }

    /**
     * Çalışma dizinini ayarla
     * @param {string} directory - Working directory path
     */
    setWorkingDirectory(directory) {
        this.workingDirectory = directory;
        console.log(`Git working directory: ${directory}`);
    }

    /**
     * Git komutu çalıştır
     * @param {string} command - Git command
     * @param {string} cwd - Working directory
     * @returns {Promise<string>} Command output
     */
    async runGitCommand(command, cwd = null) {
        return new Promise((resolve, reject) => {
            const workDir = cwd || this.workingDirectory || process.cwd();
            
            exec(`git ${command}`, { 
                cwd: workDir,
                encoding: 'utf8',
                maxBuffer: 1024 * 1024 * 10 // 10MB buffer
            }, (error, stdout, stderr) => {
                if (error) {
                    console.error(`Git command failed: git ${command}`);
                    console.error(`Error: ${error.message}`);
                    console.error(`Stderr: ${stderr}`);
                    reject(new Error(`Git command failed: ${error.message}\n${stderr}`));
                } else {
                    resolve(stdout.trim());
                }
            });
        });
    }

    /**
     * Git kurulumunu kontrol et
     * @returns {Promise<boolean>} Git availability
     */
    async checkGitAvailable() {
        try {
            await this.runGitCommand('--version');
            return true;
        } catch (error) {
            console.error('Git not found:', error);
            return false;
        }
    }

    /**
     * Repository clone et
     * @param {string} url - Repository URL
     * @param {string} targetDir - Target directory
     * @param {object} options - Clone options
     * @returns {Promise<string>} Clone result
     */
    async cloneRepository(url, targetDir, options = {}) {
        try {
            let command = `clone "${url}" "${targetDir}"`;
            
            if (options.branch) {
                command += ` --branch ${options.branch}`;
            }
            
            if (options.depth) {
                command += ` --depth ${options.depth}`;
            }

            if (options.recursive) {
                command += ' --recursive';
            }

            const result = await this.runGitCommand(command);
            console.log(`Repository cloned: ${url} -> ${targetDir}`);
            return result;
        } catch (error) {
            console.error('Clone failed:', error);
            throw error;
        }
    }

    /**
     * Repository durumunu kontrol et
     * @param {string} repoPath - Repository path
     * @returns {Promise<object>} Repository status
     */
    async getStatus(repoPath = null) {
        try {
            const workDir = repoPath || this.workingDirectory;
            const status = await this.runGitCommand('status --porcelain', workDir);
            const branch = await this.runGitCommand('rev-parse --abbrev-ref HEAD', workDir);
            
            const statusLines = status.split('\n').filter(line => line.trim());
            const changes = {
                modified: [],
                added: [],
                deleted: [],
                untracked: [],
                renamed: []
            };

            statusLines.forEach(line => {
                const statusCode = line.substring(0, 2);
                const fileName = line.substring(3);
                
                if (statusCode.includes('M')) changes.modified.push(fileName);
                if (statusCode.includes('A')) changes.added.push(fileName);
                if (statusCode.includes('D')) changes.deleted.push(fileName);
                if (statusCode.includes('??')) changes.untracked.push(fileName);
                if (statusCode.includes('R')) changes.renamed.push(fileName);
            });

            return {
                branch,
                changes,
                isClean: statusLines.length === 0,
                hasChanges: statusLines.length > 0
            };
        } catch (error) {
            console.error('Status check failed:', error);
            throw error;
        }
    }

    /**
     * Dosyaları stage'e ekle
     * @param {Array|string} files - Files to add (. for all)
     * @param {string} repoPath - Repository path
     * @returns {Promise<string>} Add result
     */
    async addFiles(files = '.', repoPath = null) {
        try {
            const workDir = repoPath || this.workingDirectory;
            const fileList = Array.isArray(files) ? files.join(' ') : files;
            const result = await this.runGitCommand(`add ${fileList}`, workDir);
            console.log(`Files added to stage: ${fileList}`);
            return result;
        } catch (error) {
            console.error('Add files failed:', error);
            throw error;
        }
    }

    /**
     * Commit oluştur
     * @param {string} message - Commit message
     * @param {string} repoPath - Repository path
     * @param {object} options - Commit options
     * @returns {Promise<string>} Commit result
     */
    async commit(message, repoPath = null, options = {}) {
        try {
            const workDir = repoPath || this.workingDirectory;
            let command = `commit -m "${message}"`;
            
            if (options.all) {
                command = `commit -am "${message}"`;
            }

            if (options.amend) {
                command += ' --amend';
            }

            const result = await this.runGitCommand(command, workDir);
            console.log(`Commit created: ${message}`);
            return result;
        } catch (error) {
            console.error('Commit failed:', error);
            throw error;
        }
    }

    /**
     * Remote repository'e push et
     * @param {string} remote - Remote name (default: origin)
     * @param {string} branch - Branch name
     * @param {string} repoPath - Repository path
     * @param {object} options - Push options
     * @returns {Promise<string>} Push result
     */
    async push(remote = 'origin', branch = null, repoPath = null, options = {}) {
        try {
            const workDir = repoPath || this.workingDirectory;
            
            if (!branch) {
                branch = await this.runGitCommand('rev-parse --abbrev-ref HEAD', workDir);
            }

            let command = `push ${remote} ${branch}`;
            
            if (options.force) {
                command += ' --force';
            }

            if (options.setUpstream) {
                command += ' --set-upstream';
            }

            const result = await this.runGitCommand(command, workDir);
            console.log(`Pushed to ${remote}/${branch}`);
            return result;
        } catch (error) {
            console.error('Push failed:', error);
            throw error;
        }
    }

    /**
     * Remote repository'den pull et
     * @param {string} remote - Remote name (default: origin)
     * @param {string} branch - Branch name
     * @param {string} repoPath - Repository path
     * @returns {Promise<string>} Pull result
     */
    async pull(remote = 'origin', branch = null, repoPath = null) {
        try {
            const workDir = repoPath || this.workingDirectory;
            
            if (!branch) {
                branch = await this.runGitCommand('rev-parse --abbrev-ref HEAD', workDir);
            }

            const command = `pull ${remote} ${branch}`;
            const result = await this.runGitCommand(command, workDir);
            console.log(`Pulled from ${remote}/${branch}`);
            return result;
        } catch (error) {
            console.error('Pull failed:', error);
            throw error;
        }
    }

    /**
     * Yeni branch oluştur
     * @param {string} branchName - Branch name
     * @param {string} repoPath - Repository path
     * @param {boolean} checkout - Checkout after creation
     * @returns {Promise<string>} Branch creation result
     */
    async createBranch(branchName, repoPath = null, checkout = true) {
        try {
            const workDir = repoPath || this.workingDirectory;
            let command = checkout ? `checkout -b ${branchName}` : `branch ${branchName}`;
            
            const result = await this.runGitCommand(command, workDir);
            console.log(`Branch created: ${branchName}`);
            return result;
        } catch (error) {
            console.error('Branch creation failed:', error);
            throw error;
        }
    }

    /**
     * Branch'e geç
     * @param {string} branchName - Branch name
     * @param {string} repoPath - Repository path
     * @returns {Promise<string>} Checkout result
     */
    async checkoutBranch(branchName, repoPath = null) {
        try {
            const workDir = repoPath || this.workingDirectory;
            const result = await this.runGitCommand(`checkout ${branchName}`, workDir);
            console.log(`Switched to branch: ${branchName}`);
            return result;
        } catch (error) {
            console.error('Checkout failed:', error);
            throw error;
        }
    }

    /**
     * Branch listesi al
     * @param {string} repoPath - Repository path
     * @param {boolean} remote - Include remote branches
     * @returns {Promise<Array>} Branch list
     */
    async getBranches(repoPath = null, remote = false) {
        try {
            const workDir = repoPath || this.workingDirectory;
            const command = remote ? 'branch -a' : 'branch';
            const result = await this.runGitCommand(command, workDir);
            
            const branches = result.split('\n')
                .map(line => line.trim().replace(/^\*\s+/, ''))
                .filter(line => line && !line.startsWith('->'));
            
            return branches;
        } catch (error) {
            console.error('Get branches failed:', error);
            throw error;
        }
    }

    /**
     * Remote repository listesi al
     * @param {string} repoPath - Repository path
     * @returns {Promise<Array>} Remote list
     */
    async getRemotes(repoPath = null) {
        try {
            const workDir = repoPath || this.workingDirectory;
            const result = await this.runGitCommand('remote -v', workDir);
            
            const remotes = {};
            result.split('\n').forEach(line => {
                const match = line.match(/^(\w+)\s+(.+?)\s+\((fetch|push)\)$/);
                if (match) {
                    const [, name, url, type] = match;
                    if (!remotes[name]) {
                        remotes[name] = {};
                    }
                    remotes[name][type] = url;
                }
            });
            
            return remotes;
        } catch (error) {
            console.error('Get remotes failed:', error);
            throw error;
        }
    }

    /**
     * Commit geçmişi al
     * @param {string} repoPath - Repository path
     * @param {number} limit - Commit limit
     * @returns {Promise<Array>} Commit history
     */
    async getCommitHistory(repoPath = null, limit = 10) {
        try {
            const workDir = repoPath || this.workingDirectory;
            const command = `log --oneline -${limit} --format="%H|%an|%ae|%ad|%s" --date=iso`;
            const result = await this.runGitCommand(command, workDir);
            
            const commits = result.split('\n').map(line => {
                const [hash, author, email, date, message] = line.split('|');
                return {
                    hash: hash?.substring(0, 7),
                    fullHash: hash,
                    author,
                    email,
                    date: new Date(date),
                    message
                };
            }).filter(commit => commit.hash);
            
            return commits;
        } catch (error) {
            console.error('Get commit history failed:', error);
            throw error;
        }
    }

    /**
     * Repository'nin Git repo olup olmadığını kontrol et
     * @param {string} repoPath - Repository path
     * @returns {Promise<boolean>} Is Git repository
     */
    async isGitRepository(repoPath = null) {
        try {
            const workDir = repoPath || this.workingDirectory;
            await this.runGitCommand('rev-parse --git-dir', workDir);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Git repository'yi initialize et
     * @param {string} repoPath - Repository path
     * @returns {Promise<string>} Init result
     */
    async initRepository(repoPath = null) {
        try {
            const workDir = repoPath || this.workingDirectory;
            const result = await this.runGitCommand('init', workDir);
            console.log(`Git repository initialized: ${workDir}`);
            return result;
        } catch (error) {
            console.error('Repository init failed:', error);
            throw error;
        }
    }

    /**
     * Git config ayarla
     * @param {string} key - Config key
     * @param {string} value - Config value
     * @param {string} repoPath - Repository path
     * @param {boolean} global - Global config
     * @returns {Promise<string>} Config result
     */
    async setConfig(key, value, repoPath = null, global = false) {
        try {
            const workDir = repoPath || this.workingDirectory;
            const scope = global ? '--global' : '--local';
            const command = `config ${scope} ${key} "${value}"`;
            const result = await this.runGitCommand(command, workDir);
            console.log(`Git config set: ${key} = ${value}`);
            return result;
        } catch (error) {
            console.error('Set config failed:', error);
            throw error;
        }
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GitManager;
}

// Global access
if (typeof window !== 'undefined') {
    window.GitManager = GitManager;
}