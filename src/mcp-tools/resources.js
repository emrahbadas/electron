/**
 * MCP Resources Endpoint Implementation
 * 
 * Resources expose contextual data through URIs (file://, git://, https://)
 * This allows external MCP agents to access project files, git state, and web resources.
 * 
 * Specification: https://spec.modelcontextprotocol.io/specification/server/resources/
 */

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readFileAsync = promisify(fs.readFile);
const readdirAsync = promisify(fs.readdir);
const statAsync = promisify(fs.stat);
const { execSync } = require('child_process');

/**
 * Resource URI Schemes:
 * - file:///absolute/path - Filesystem resources
 * - git://HEAD/path - Current git state
 * - git://diff - Unstaged changes
 * - git://staged - Staged changes
 * - https://... - Web resources (via fetch)
 */

class ResourceManager {
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot;
    this.subscribers = new Map(); // uri -> Set<callbackId>
  }

  /**
   * resources/list
   * 
   * Lists available resources with pagination support.
   * 
   * @param {Object} params
   * @param {string} [params.cursor] - Pagination cursor (opaque token)
   * @returns {Object} { resources: Array<Resource>, nextCursor?: string }
   */
  async list(params = {}) {
    const { cursor } = params;
    const pageSize = 50; // Items per page
    
    const allResources = [];

    // 1. File resources (workspace files)
    try {
      const files = await this.#scanWorkspaceFiles(this.workspaceRoot);
      files.forEach(filePath => {
        const relativePath = path.relative(this.workspaceRoot, filePath);
        allResources.push({
          uri: `file://${filePath}`,
          name: relativePath,
          mimeType: this.#getMimeType(filePath),
          description: `Workspace file: ${relativePath}`
        });
      });
    } catch (error) {
      console.error('[resources/list] File scan error:', error);
    }

    // 2. Git resources (if workspace is a git repo)
    try {
      if (this.#isGitRepo(this.workspaceRoot)) {
        allResources.push(
          {
            uri: 'git://HEAD/diff',
            name: 'Current Diff (HEAD vs Working Tree)',
            mimeType: 'text/x-diff',
            description: 'Uncommitted changes in working directory'
          },
          {
            uri: 'git://staged',
            name: 'Staged Changes',
            mimeType: 'text/x-diff',
            description: 'Changes staged for commit'
          },
          {
            uri: 'git://log',
            name: 'Git Log (last 10)',
            mimeType: 'text/plain',
            description: 'Recent commit history'
          },
          {
            uri: 'git://status',
            name: 'Git Status',
            mimeType: 'text/plain',
            description: 'Current repository status'
          }
        );
      }
    } catch (error) {
      console.error('[resources/list] Git scan error:', error);
    }

    // 3. Pagination
    const startIndex = cursor ? parseInt(cursor, 10) : 0;
    const endIndex = startIndex + pageSize;
    const page = allResources.slice(startIndex, endIndex);
    const hasMore = endIndex < allResources.length;

    return {
      resources: page,
      nextCursor: hasMore ? String(endIndex) : undefined
    };
  }

  /**
   * resources/read
   * 
   * Reads resource content by URI.
   * 
   * @param {Object} params
   * @param {string} params.uri - Resource URI (file://, git://, https://)
   * @returns {Object} { contents: Array<{ uri, mimeType?, text?, blob? }> }
   */
  async read(params) {
    const { uri } = params;

    if (!uri) {
      throw new Error('Missing required parameter: uri');
    }

    // Parse URI scheme
    const parsed = new URL(uri);
    const scheme = parsed.protocol.replace(':', '');

    switch (scheme) {
      case 'file':
        return await this.#readFileResource(parsed.pathname);
      
      case 'git':
        return await this.#readGitResource(parsed.host + parsed.pathname);
      
      case 'https':
      case 'http':
        return await this.#readHttpResource(uri);
      
      default:
        throw new Error(`Unsupported URI scheme: ${scheme}`);
    }
  }

  /**
   * resources/subscribe
   * 
   * Subscribes to resource change notifications.
   * 
   * @param {Object} params
   * @param {string} params.uri - Resource URI to watch
   * @returns {void}
   */
  async subscribe(params) {
    const { uri } = params;

    if (!uri) {
      throw new Error('Missing required parameter: uri');
    }

    // Generate unique subscriber ID
    const subscriberId = `sub_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    if (!this.subscribers.has(uri)) {
      this.subscribers.set(uri, new Set());
      
      // Start watching resource (for file:// URIs)
      if (uri.startsWith('file://')) {
        this.#watchFile(uri);
      }
    }

    this.subscribers.get(uri).add(subscriberId);

    console.log(`[resources/subscribe] Subscribed to ${uri} (id: ${subscriberId})`);
    return { subscriberId };
  }

  /**
   * resources/unsubscribe
   * 
   * Unsubscribes from resource change notifications.
   * 
   * @param {Object} params
   * @param {string} params.uri - Resource URI
   * @param {string} params.subscriberId - Subscriber ID from subscribe()
   * @returns {void}
   */
  async unsubscribe(params) {
    const { uri, subscriberId } = params;

    if (!uri || !subscriberId) {
      throw new Error('Missing required parameters: uri, subscriberId');
    }

    if (this.subscribers.has(uri)) {
      this.subscribers.get(uri).delete(subscriberId);
      
      // If no more subscribers, stop watching
      if (this.subscribers.get(uri).size === 0) {
        this.subscribers.delete(uri);
        this.#unwatchFile(uri);
      }
    }

    console.log(`[resources/unsubscribe] Unsubscribed from ${uri} (id: ${subscriberId})`);
  }

  /**
   * Emit resource update notification to all subscribers
   * 
   * @private
   * @param {string} uri - Resource URI that changed
   */
  #notifySubscribers(uri) {
    if (this.subscribers.has(uri)) {
      const notification = {
        method: 'notifications/resources/updated',
        params: { uri }
      };
      
      // TODO: Send notification through MCP server transport
      console.log('[resources/notify]', notification);
    }
  }

  /**
   * Scan workspace for files (excludes node_modules, .git, etc.)
   * 
   * @private
   * @param {string} dir - Directory to scan
   * @param {number} [depth=0] - Current recursion depth
   * @param {number} [maxDepth=5] - Maximum recursion depth
   * @returns {Promise<string[]>} Array of absolute file paths
   */
  async #scanWorkspaceFiles(dir, depth = 0, maxDepth = 5) {
    if (depth > maxDepth) return [];

    const excludePatterns = [
      'node_modules',
      '.git',
      '.vscode',
      'dist',
      'build',
      'coverage',
      '.next',
      '.cache',
      '.env'
    ];

    const files = [];
    const entries = await readdirAsync(dir, { withFileTypes: true });

    for (const entry of entries) {
      // Skip excluded directories
      if (excludePatterns.some(pattern => entry.name.includes(pattern))) {
        continue;
      }

      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        const subFiles = await this.#scanWorkspaceFiles(fullPath, depth + 1, maxDepth);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        // Skip binary files (rough heuristic)
        if (!this.#isBinaryFile(entry.name)) {
          files.push(fullPath);
        }
      }
    }

    return files;
  }

  /**
   * Check if workspace is a git repository
   * 
   * @private
   * @param {string} dir - Directory to check
   * @returns {boolean}
   */
  #isGitRepo(dir) {
    try {
      const gitDir = path.join(dir, '.git');
      return fs.existsSync(gitDir);
    } catch {
      return false;
    }
  }

  /**
   * Read file:// resource
   * 
   * @private
   * @param {string} filePath - Absolute file path (from URL.pathname)
   * @returns {Promise<Object>}
   */
  async #readFileResource(filePath) {
    try {
      // Windows fix: URL.pathname returns "/C:/path" but we need "C:/path"
      // Also decode URL-encoded characters (e.g., %20 -> space)
      let normalizedPath = decodeURIComponent(filePath);
      
      // Remove leading slash on Windows (e.g., "/C:/..." -> "C:/...")
      if (process.platform === 'win32' && /^\/[A-Z]:/.test(normalizedPath)) {
        normalizedPath = normalizedPath.slice(1);
      }

      const content = await readFileAsync(normalizedPath, 'utf8');
      const mimeType = this.#getMimeType(normalizedPath);

      return {
        contents: [{
          uri: `file://${normalizedPath}`,
          mimeType,
          text: content
        }]
      };
    } catch (error) {
      throw new Error(`Failed to read file: ${error.message}`);
    }
  }

  /**
   * Read git:// resource
   * 
   * @private
   * @param {string} gitPath - Git path (e.g., "HEAD/diff", "staged", "log")
   * @returns {Promise<Object>}
   */
  async #readGitResource(gitPath) {
    try {
      let content;
      let mimeType = 'text/plain';

      switch (gitPath) {
        case 'HEAD/diff':
          content = execSync('git diff HEAD', { cwd: this.workspaceRoot, encoding: 'utf8' });
          mimeType = 'text/x-diff';
          break;

        case 'staged':
          content = execSync('git diff --cached', { cwd: this.workspaceRoot, encoding: 'utf8' });
          mimeType = 'text/x-diff';
          break;

        case 'log':
          content = execSync('git log --oneline -n 10', { cwd: this.workspaceRoot, encoding: 'utf8' });
          break;

        case 'status':
          content = execSync('git status --short', { cwd: this.workspaceRoot, encoding: 'utf8' });
          break;

        default:
          throw new Error(`Unknown git resource: ${gitPath}`);
      }

      return {
        contents: [{
          uri: `git://${gitPath}`,
          mimeType,
          text: content
        }]
      };
    } catch (error) {
      throw new Error(`Failed to read git resource: ${error.message}`);
    }
  }

  /**
   * Read https:// resource (web fetch)
   * 
   * @private
   * @param {string} url - HTTPS URL
   * @returns {Promise<Object>}
   */
  async #readHttpResource(url) {
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || 'application/octet-stream';
      const content = await response.text();

      return {
        contents: [{
          uri: url,
          mimeType: contentType,
          text: content
        }]
      };
    } catch (error) {
      throw new Error(`Failed to fetch HTTP resource: ${error.message}`);
    }
  }

  /**
   * Get MIME type from file extension
   * 
   * @private
   * @param {string} filePath - File path
   * @returns {string} MIME type
   */
  #getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.js': 'text/javascript',
      '.jsx': 'text/javascript',
      '.ts': 'text/typescript',
      '.tsx': 'text/typescript',
      '.json': 'application/json',
      '.md': 'text/markdown',
      '.html': 'text/html',
      '.css': 'text/css',
      '.py': 'text/x-python',
      '.java': 'text/x-java',
      '.rb': 'text/x-ruby',
      '.go': 'text/x-go',
      '.rs': 'text/x-rust',
      '.c': 'text/x-c',
      '.cpp': 'text/x-c++',
      '.h': 'text/x-c',
      '.sh': 'text/x-shellscript',
      '.txt': 'text/plain',
      '.xml': 'application/xml',
      '.yaml': 'text/yaml',
      '.yml': 'text/yaml',
      '.toml': 'text/toml',
      '.ini': 'text/plain',
      '.env': 'text/plain'
    };

    return mimeTypes[ext] || 'text/plain';
  }

  /**
   * Check if file is likely binary (rough heuristic)
   * 
   * @private
   * @param {string} filename - Filename
   * @returns {boolean}
   */
  #isBinaryFile(filename) {
    const binaryExtensions = [
      '.exe', '.dll', '.so', '.dylib',
      '.jpg', '.jpeg', '.png', '.gif', '.webp', '.ico',
      '.mp3', '.mp4', '.wav', '.ogg', '.flac',
      '.pdf', '.zip', '.tar', '.gz', '.bz2',
      '.woff', '.woff2', '.ttf', '.eot',
      '.pyc', '.class', '.o', '.obj'
    ];

    const ext = path.extname(filename).toLowerCase();
    return binaryExtensions.includes(ext);
  }

  /**
   * Watch file:// resource for changes (stub implementation)
   * 
   * @private
   * @param {string} uri - File URI
   */
  #watchFile(uri) {
    // TODO: Implement fs.watch() for file change detection
    console.log(`[resources/watch] Started watching ${uri}`);
  }

  /**
   * Stop watching file:// resource
   * 
   * @private
   * @param {string} uri - File URI
   */
  #unwatchFile(uri) {
    // TODO: Clean up fs.watch()
    console.log(`[resources/unwatch] Stopped watching ${uri}`);
  }
}

module.exports = { ResourceManager };
