/**
 * MCP Advanced File Operations - Additional Tools
 * read_media_file, directory_tree, read_multiple_files, head_file, tail_file
 */

const fs = require('fs');
const path = require('path');

class AdvancedFileOperations {
    constructor() {
        this.supportedMediaTypes = {
            image: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'],
            audio: ['.mp3', '.wav', '.ogg', '.m4a', '.flac'],
            video: ['.mp4', '.avi', '.mkv', '.mov', '.webm']
        };
    }
    
    /**
     * Read media file as base64
     * @param {object} params - Parameters
     * @param {string} params.path - File path
     * @param {string} params.mimeType - Optional MIME type override
     * @returns {object} - Base64 encoded content with metadata
     */
    async readMediaFile(params) {
        const { path: filePath, mimeType } = params;
        
        if (!filePath) {
            throw new Error('File path is required');
        }
        
        if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        }
        
        const stats = fs.statSync(filePath);
        const ext = path.extname(filePath).toLowerCase();
        
        // Detect media type
        let detectedType = 'unknown';
        for (const [type, extensions] of Object.entries(this.supportedMediaTypes)) {
            if (extensions.includes(ext)) {
                detectedType = type;
                break;
            }
        }
        
        // Read as buffer
        const buffer = fs.readFileSync(filePath);
        const base64 = buffer.toString('base64');
        
        // Determine MIME type
        const detectedMimeType = mimeType || this.getMimeType(ext);
        
        return {
            success: true,
            path: filePath,
            mediaType: detectedType,
            mimeType: detectedMimeType,
            base64: base64,
            size: stats.size,
            extension: ext,
            encoding: 'base64'
        };
    }
    
    /**
     * Get MIME type from extension
     */
    getMimeType(ext) {
        const mimeTypes = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.bmp': 'image/bmp',
            '.webp': 'image/webp',
            '.svg': 'image/svg+xml',
            '.mp3': 'audio/mpeg',
            '.wav': 'audio/wav',
            '.ogg': 'audio/ogg',
            '.m4a': 'audio/mp4',
            '.flac': 'audio/flac',
            '.mp4': 'video/mp4',
            '.avi': 'video/x-msvideo',
            '.mkv': 'video/x-matroska',
            '.mov': 'video/quicktime',
            '.webm': 'video/webm'
        };
        
        return mimeTypes[ext] || 'application/octet-stream';
    }
    
    /**
     * Generate directory tree
     * @param {object} params - Parameters
     * @param {string} params.path - Directory path
     * @param {number} params.maxDepth - Maximum depth (default: 5)
     * @param {Array<string>} params.excludePatterns - Patterns to exclude
     * @returns {object} - Recursive tree structure
     */
    async directoryTree(params) {
        const { 
            path: dirPath, 
            maxDepth = 5, 
            excludePatterns = ['node_modules', '.git', 'dist', 'build', '.temp'] 
        } = params;
        
        if (!dirPath) {
            throw new Error('Directory path is required');
        }
        
        if (!fs.existsSync(dirPath)) {
            throw new Error(`Directory not found: ${dirPath}`);
        }
        
        const tree = await this.buildTree(dirPath, 0, maxDepth, excludePatterns);
        
        return {
            success: true,
            path: dirPath,
            tree,
            maxDepth
        };
    }
    
    /**
     * Build tree recursively
     */
    async buildTree(dirPath, depth, maxDepth, excludePatterns) {
        if (depth >= maxDepth) {
            return null;
        }
        
        const stats = fs.statSync(dirPath);
        const name = path.basename(dirPath);
        
        // Check exclude patterns
        for (const pattern of excludePatterns) {
            if (name.includes(pattern)) {
                return null;
            }
        }
        
        if (stats.isFile()) {
            return {
                name,
                type: 'file',
                size: stats.size,
                extension: path.extname(name)
            };
        }
        
        if (stats.isDirectory()) {
            const entries = fs.readdirSync(dirPath, { withFileTypes: true });
            const children = [];
            
            for (const entry of entries) {
                const childPath = path.join(dirPath, entry.name);
                const child = await this.buildTree(childPath, depth + 1, maxDepth, excludePatterns);
                
                if (child) {
                    children.push(child);
                }
            }
            
            return {
                name,
                type: 'directory',
                children,
                count: children.length
            };
        }
        
        return null;
    }
    
    /**
     * Read multiple files in batch
     * @param {object} params - Parameters
     * @param {Array<string>} params.paths - Array of file paths
     * @param {string} params.encoding - Encoding (default: utf8)
     * @returns {object} - Batch read results
     */
    async readMultipleFiles(params) {
        const { paths, encoding = 'utf8' } = params;
        
        if (!paths || !Array.isArray(paths) || paths.length === 0) {
            throw new Error('Paths array is required');
        }
        
        const results = [];
        const errors = [];
        
        for (const filePath of paths) {
            try {
                const content = fs.readFileSync(filePath, encoding);
                const stats = fs.statSync(filePath);
                
                results.push({
                    path: filePath,
                    success: true,
                    content,
                    size: stats.size,
                    lines: content.split('\n').length
                });
            } catch (error) {
                errors.push({
                    path: filePath,
                    success: false,
                    error: error.message
                });
            }
        }
        
        return {
            success: true,
            total: paths.length,
            succeeded: results.length,
            failed: errors.length,
            results,
            errors
        };
    }
    
    /**
     * Read first N lines of file
     * @param {object} params - Parameters
     * @param {string} params.path - File path
     * @param {number} params.lines - Number of lines to read
     * @returns {object} - Head content
     */
    async headFile(params) {
        const { path: filePath, lines = 10 } = params;
        
        if (!filePath) {
            throw new Error('File path is required');
        }
        
        if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        }
        
        const content = fs.readFileSync(filePath, 'utf8');
        const allLines = content.split('\n');
        const headLines = allLines.slice(0, lines);
        
        return {
            success: true,
            path: filePath,
            lines: lines,
            content: headLines.join('\n'),
            linesRead: headLines.length,
            totalLines: allLines.length,
            hasMore: allLines.length > lines
        };
    }
    
    /**
     * Read last N lines of file
     * @param {object} params - Parameters
     * @param {string} params.path - File path
     * @param {number} params.lines - Number of lines to read
     * @returns {object} - Tail content
     */
    async tailFile(params) {
        const { path: filePath, lines = 10 } = params;
        
        if (!filePath) {
            throw new Error('File path is required');
        }
        
        if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        }
        
        const content = fs.readFileSync(filePath, 'utf8');
        const allLines = content.split('\n');
        const tailLines = allLines.slice(-lines);
        
        return {
            success: true,
            path: filePath,
            lines: lines,
            content: tailLines.join('\n'),
            linesRead: tailLines.length,
            totalLines: allLines.length,
            hasMore: allLines.length > lines
        };
    }
}

// Singleton instance
let advancedFileOps = null;

function getAdvancedFileOps() {
    if (!advancedFileOps) {
        advancedFileOps = new AdvancedFileOperations();
    }
    return advancedFileOps;
}

module.exports = {
    AdvancedFileOperations,
    getAdvancedFileOps
};
