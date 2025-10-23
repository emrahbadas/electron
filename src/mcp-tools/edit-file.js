/**
 * MCP Advanced File Operations - Edit File
 * CRITICAL: Line-based editing with git diff preview
 * Implements edit_file per MCP specification
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class FileEditor {
    constructor() {
        this.editHistory = [];
        this.maxHistorySize = 100;
    }
    
    /**
     * Edit file with line-based operations
     * @param {object} params - Parameters
     * @param {string} params.path - File path (absolute)
     * @param {Array<object>} params.edits - Array of edit operations
     * @param {boolean} params.dryRun - Preview mode (default: false)
     * @param {boolean} params.createBackup - Create .bak file (default: true)
     * @returns {object} - Edit result with diff preview
     */
    async editFile(params) {
        const { 
            path: filePath, 
            edits, 
            dryRun = false, 
            createBackup = true 
        } = params;
        
        if (!filePath) {
            throw new Error('File path is required');
        }
        
        if (!edits || !Array.isArray(edits) || edits.length === 0) {
            throw new Error('Edits array is required');
        }
        
        // Validate file exists
        if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        }
        
        // Read original content
        const originalContent = fs.readFileSync(filePath, 'utf8');
        const originalLines = originalContent.split('\n');
        
        // Apply edits
        const editedLines = [...originalLines];
        const appliedEdits = [];
        
        // Sort edits by line number (descending) to prevent offset issues
        const sortedEdits = [...edits].sort((a, b) => {
            const aLine = a.startLine || a.line || 0;
            const bLine = b.startLine || b.line || 0;
            return bLine - aLine;
        });
        
        for (const edit of sortedEdits) {
            try {
                const applied = await this.applyEdit(editedLines, edit);
                appliedEdits.push(applied);
            } catch (error) {
                throw new Error(`Failed to apply edit: ${error.message}`);
            }
        }
        
        const editedContent = editedLines.join('\n');
        
        // Generate diff
        const diff = this.generateDiff(originalContent, editedContent, filePath);
        
        // If not dry run, write changes
        if (!dryRun) {
            // Create backup if requested
            if (createBackup) {
                const backupPath = `${filePath}.bak`;
                fs.writeFileSync(backupPath, originalContent, 'utf8');
            }
            
            // Write edited content
            fs.writeFileSync(filePath, editedContent, 'utf8');
            
            // Add to history
            this.addToHistory({
                path: filePath,
                timestamp: new Date().toISOString(),
                edits: appliedEdits,
                diff
            });
        }
        
        return {
            success: true,
            path: filePath,
            dryRun,
            editsApplied: appliedEdits.length,
            diff,
            preview: dryRun ? editedContent : null,
            linesAdded: this.countDiffLines(diff, '+'),
            linesRemoved: this.countDiffLines(diff, '-')
        };
    }
    
    /**
     * Apply single edit operation
     * @param {Array<string>} lines - File lines
     * @param {object} edit - Edit operation
     * @returns {object} - Applied edit details
     */
    async applyEdit(lines, edit) {
        const { operation, line, startLine, endLine, content, pattern } = edit;
        
        switch (operation) {
            case 'insert':
                return this.insertLines(lines, line, content);
            
            case 'replace':
                return this.replaceLines(lines, startLine, endLine, content);
            
            case 'delete':
                return this.deleteLines(lines, startLine, endLine);
            
            case 'replacePattern':
                return this.replacePattern(lines, pattern, content);
            
            default:
                throw new Error(`Unknown operation: ${operation}`);
        }
    }
    
    /**
     * Insert lines at specified position
     */
    insertLines(lines, line, content) {
        const insertIndex = line - 1; // Convert to 0-based
        
        if (insertIndex < 0 || insertIndex > lines.length) {
            throw new Error(`Invalid line number: ${line}`);
        }
        
        const newLines = content.split('\n');
        lines.splice(insertIndex, 0, ...newLines);
        
        return {
            operation: 'insert',
            line,
            linesAdded: newLines.length,
            content
        };
    }
    
    /**
     * Replace lines in range
     */
    replaceLines(lines, startLine, endLine, content) {
        const startIndex = startLine - 1; // Convert to 0-based
        const endIndex = endLine - 1;
        
        if (startIndex < 0 || endIndex >= lines.length || startIndex > endIndex) {
            throw new Error(`Invalid line range: ${startLine}-${endLine}`);
        }
        
        const deleteCount = endIndex - startIndex + 1;
        const newLines = content.split('\n');
        lines.splice(startIndex, deleteCount, ...newLines);
        
        return {
            operation: 'replace',
            startLine,
            endLine,
            linesRemoved: deleteCount,
            linesAdded: newLines.length,
            content
        };
    }
    
    /**
     * Delete lines in range
     */
    deleteLines(lines, startLine, endLine) {
        const startIndex = startLine - 1;
        const endIndex = endLine - 1;
        
        if (startIndex < 0 || endIndex >= lines.length || startIndex > endIndex) {
            throw new Error(`Invalid line range: ${startLine}-${endLine}`);
        }
        
        const deleteCount = endIndex - startIndex + 1;
        const deleted = lines.splice(startIndex, deleteCount);
        
        return {
            operation: 'delete',
            startLine,
            endLine,
            linesRemoved: deleteCount,
            deletedContent: deleted.join('\n')
        };
    }
    
    /**
     * Replace pattern in all lines
     */
    replacePattern(lines, pattern, replacement) {
        let matchCount = 0;
        const regex = new RegExp(pattern, 'g');
        
        for (let i = 0; i < lines.length; i++) {
            const matches = lines[i].match(regex);
            if (matches) {
                matchCount += matches.length;
                lines[i] = lines[i].replace(regex, replacement);
            }
        }
        
        return {
            operation: 'replacePattern',
            pattern,
            replacement,
            matchCount
        };
    }
    
    /**
     * Generate unified diff
     */
    generateDiff(originalContent, editedContent, filePath) {
        try {
            // Write temp files
            const tempDir = path.join(process.cwd(), '.temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            
            const originalFile = path.join(tempDir, 'original.txt');
            const editedFile = path.join(tempDir, 'edited.txt');
            
            fs.writeFileSync(originalFile, originalContent, 'utf8');
            fs.writeFileSync(editedFile, editedContent, 'utf8');
            
            // Generate diff using git
            try {
                const diff = execSync(
                    `git diff --no-index "${originalFile}" "${editedFile}"`,
                    { encoding: 'utf8' }
                ).toString();
                
                // Clean up
                fs.unlinkSync(originalFile);
                fs.unlinkSync(editedFile);
                
                return diff;
            } catch (error) {
                // Git diff exits with 1 if there are differences
                // This is expected, return the output
                const diff = error.stdout ? error.stdout.toString() : '';
                
                // Clean up
                if (fs.existsSync(originalFile)) fs.unlinkSync(originalFile);
                if (fs.existsSync(editedFile)) fs.unlinkSync(editedFile);
                
                return diff;
            }
        } catch (error) {
            // Fallback to simple diff
            return this.simpleDiff(originalContent, editedContent);
        }
    }
    
    /**
     * Simple diff fallback (if git not available)
     */
    simpleDiff(original, edited) {
        const originalLines = original.split('\n');
        const editedLines = edited.split('\n');
        
        let diff = '--- original\n+++ edited\n';
        
        const maxLines = Math.max(originalLines.length, editedLines.length);
        
        for (let i = 0; i < maxLines; i++) {
            const origLine = originalLines[i] || '';
            const editLine = editedLines[i] || '';
            
            if (origLine !== editLine) {
                if (origLine) {
                    diff += `-${origLine}\n`;
                }
                if (editLine) {
                    diff += `+${editLine}\n`;
                }
            }
        }
        
        return diff;
    }
    
    /**
     * Count diff lines by prefix
     */
    countDiffLines(diff, prefix) {
        const lines = diff.split('\n');
        return lines.filter(line => line.startsWith(prefix)).length;
    }
    
    /**
     * Add edit to history
     */
    addToHistory(edit) {
        this.editHistory.push(edit);
        
        // Trim history if too large
        if (this.editHistory.length > this.maxHistorySize) {
            this.editHistory.shift();
        }
    }
    
    /**
     * Get edit history
     */
    getHistory(limit = 10) {
        return this.editHistory.slice(-limit);
    }
    
    /**
     * Undo last edit (restore from backup)
     */
    async undoLastEdit(filePath) {
        const backupPath = `${filePath}.bak`;
        
        if (!fs.existsSync(backupPath)) {
            throw new Error('No backup file found');
        }
        
        const backupContent = fs.readFileSync(backupPath, 'utf8');
        fs.writeFileSync(filePath, backupContent, 'utf8');
        
        return {
            success: true,
            path: filePath,
            message: 'File restored from backup'
        };
    }
    
    /**
     * Get edit statistics
     */
    getStats() {
        return {
            totalEdits: this.editHistory.length,
            recentEdits: this.editHistory.slice(-5).map(e => ({
                path: e.path,
                timestamp: e.timestamp,
                editsApplied: e.edits.length
            }))
        };
    }
}

// Singleton instance
let fileEditor = null;

function getFileEditor() {
    if (!fileEditor) {
        fileEditor = new FileEditor();
    }
    return fileEditor;
}

module.exports = {
    FileEditor,
    getFileEditor
};
