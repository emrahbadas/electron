/**
 * MultiEdit System - Continue Agent Style
 * Atomic multi-operation file editing with rollback support
 * Based on Continue's multiEdit tool implementation
 */

class MultiEditSystem {
    constructor() {
        this.editHistory = new Map(); // filepath -> { original, timestamp }
        this.maxHistorySize = 50; // Keep last 50 file states
    }

    /**
     * Execute multiple edits on a single file atomically
     * @param {string} filepath - Absolute path to file
     * @param {Array<EditOperation>} edits - Array of edit operations
     * @param {Object} options - Additional options
     * @returns {Promise<EditResult>}
     */
    async executeMultiEdit(filepath, edits, options = {}) {
        const {
            validateOnly = false,
            createBackup = true,
            dryRun = false
        } = options;

        try {
            console.log(`🔧 MultiEdit: Starting ${edits.length} edits on ${filepath}`);

            // Step 1: Validate inputs
            this.validateInputs(filepath, edits);

            // Step 2: Read current file content
            const originalContent = await this.readFile(filepath);

            // Step 3: Backup original content
            if (createBackup) {
                this.saveToHistory(filepath, originalContent);
            }

            // Step 4: Apply edits sequentially
            let currentContent = originalContent;
            const appliedEdits = [];

            for (let i = 0; i < edits.length; i++) {
                const edit = edits[i];
                console.log(`  ✏️ Applying edit ${i + 1}/${edits.length}: ${edit.old_string.substring(0, 50)}...`);

                const result = this.applyEdit(currentContent, edit, i);
                currentContent = result.newContent;
                appliedEdits.push({
                    index: i,
                    edit,
                    success: true,
                    replacements: result.replacements
                });
            }

            // Step 5: Validate result
            const validationResult = this.validateResult(originalContent, currentContent, edits);
            if (!validationResult.valid) {
                throw new Error(`Validation failed: ${validationResult.error}`);
            }

            // Step 6: Write to file (if not dry run)
            if (!dryRun) {
                await this.writeFile(filepath, currentContent);
                console.log(`✅ MultiEdit: Successfully applied ${edits.length} edits to ${filepath}`);
            } else {
                console.log(`🔍 MultiEdit: Dry run completed, no changes written`);
            }

            return {
                success: true,
                filepath,
                originalContent,
                newContent: currentContent,
                appliedEdits,
                diff: this.generateDiff(originalContent, currentContent),
                stats: {
                    totalEdits: edits.length,
                    linesAdded: this.countLines(currentContent) - this.countLines(originalContent),
                    charsAdded: currentContent.length - originalContent.length
                }
            };

        } catch (error) {
            console.error(`❌ MultiEdit failed: ${error.message}`);
            
            // Attempt rollback if backup exists
            if (this.editHistory.has(filepath)) {
                console.log(`🔄 Rolling back to previous version...`);
                await this.rollback(filepath);
            }

            throw error;
        }
    }

    /**
     * Apply a single edit operation
     * @param {string} content - Current content
     * @param {EditOperation} edit - Edit to apply
     * @param {number} index - Edit index for error messages
     * @returns {Object} Result with newContent and replacements count
     */
    applyEdit(content, edit, index) {
        const { old_string, new_string, replace_all = false } = edit;

        // Validate strings are different
        if (old_string === new_string) {
            throw new Error(`Edit ${index}: old_string and new_string must be different`);
        }

        // Check if old_string exists
        if (!content.includes(old_string)) {
            throw new Error(`Edit ${index}: old_string not found in content:\n"${old_string}"`);
        }

        let newContent;
        let replacements = 0;

        if (replace_all) {
            // Replace all occurrences
            const regex = new RegExp(this.escapeRegex(old_string), 'g');
            newContent = content.replace(regex, () => {
                replacements++;
                return new_string;
            });
        } else {
            // Replace only first occurrence
            const index = content.indexOf(old_string);
            newContent = content.substring(0, index) + new_string + content.substring(index + old_string.length);
            replacements = 1;
        }

        if (replacements === 0) {
            throw new Error(`Edit ${index}: No replacements made (this should not happen)`);
        }

        return { newContent, replacements };
    }

    /**
     * Validate inputs before processing
     */
    validateInputs(filepath, edits) {
        if (!filepath || typeof filepath !== 'string') {
            throw new Error('Invalid filepath: must be a non-empty string');
        }

        if (!Array.isArray(edits) || edits.length === 0) {
            throw new Error('Invalid edits: must be a non-empty array');
        }

        edits.forEach((edit, index) => {
            if (!edit.old_string || typeof edit.old_string !== 'string') {
                throw new Error(`Edit ${index}: old_string is required and must be a string`);
            }
            if (!edit.new_string || typeof edit.new_string !== 'string') {
                throw new Error(`Edit ${index}: new_string is required and must be a string`);
            }
        });
    }

    /**
     * Validate final result
     */
    validateResult(originalContent, newContent, edits) {
        // Check content actually changed
        if (originalContent === newContent) {
            return {
                valid: false,
                error: 'No changes detected after applying edits'
            };
        }

        // Check content is not empty (unless it was empty before)
        if (newContent.trim() === '' && originalContent.trim() !== '') {
            return {
                valid: false,
                error: 'Result is empty but original was not'
            };
        }

        return { valid: true };
    }

    /**
     * Save file state to history
     */
    saveToHistory(filepath, content) {
        this.editHistory.set(filepath, {
            content,
            timestamp: Date.now()
        });

        // Trim history if too large
        if (this.editHistory.size > this.maxHistorySize) {
            const oldestKey = Array.from(this.editHistory.keys())[0];
            this.editHistory.delete(oldestKey);
        }
    }

    /**
     * Rollback to previous version
     */
    async rollback(filepath) {
        const backup = this.editHistory.get(filepath);
        if (!backup) {
            throw new Error(`No backup found for ${filepath}`);
        }

        await this.writeFile(filepath, backup.content);
        console.log(`✅ Rollback successful for ${filepath}`);
        return true;
    }

    /**
     * Generate diff preview
     */
    generateDiff(oldContent, newContent) {
        const oldLines = oldContent.split('\n');
        const newLines = newContent.split('\n');
        const diff = [];

        const maxLines = Math.max(oldLines.length, newLines.length);
        for (let i = 0; i < maxLines; i++) {
            const oldLine = oldLines[i] || '';
            const newLine = newLines[i] || '';

            if (oldLine !== newLine) {
                if (oldLine) diff.push(`- ${oldLine}`);
                if (newLine) diff.push(`+ ${newLine}`);
            }
        }

        return diff;
    }

    /**
     * Helper: Escape regex special characters
     */
    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Helper: Count lines
     */
    countLines(content) {
        return content.split('\n').length;
    }

    /**
     * Read file using Electron API
     */
    async readFile(filepath) {
        if (!window.electronAPI || !window.electronAPI.readFile) {
            throw new Error('electronAPI.readFile not available');
        }

        const result = await window.electronAPI.readFile(filepath);
        if (!result.success) {
            throw new Error(`Failed to read file: ${result.error}`);
        }

        return result.content;
    }

    /**
     * Write file using Electron API
     */
    async writeFile(filepath, content) {
        if (!window.electronAPI || !window.electronAPI.writeFile) {
            throw new Error('electronAPI.writeFile not available');
        }

        const result = await window.electronAPI.writeFile(filepath, content);
        if (!result.success) {
            throw new Error(`Failed to write file: ${result.error}`);
        }

        return true;
    }

    /**
     * Clear edit history
     */
    clearHistory() {
        this.editHistory.clear();
        console.log('✅ Edit history cleared');
    }

    /**
     * Get history for a specific file
     */
    getHistory(filepath) {
        return this.editHistory.get(filepath);
    }

    /**
     * Get all history
     */
    getAllHistory() {
        return Array.from(this.editHistory.entries()).map(([filepath, data]) => ({
            filepath,
            timestamp: data.timestamp,
            size: data.content.length
        }));
    }
}

/**
 * @typedef {Object} EditOperation
 * @property {string} old_string - Exact text to replace (including whitespace)
 * @property {string} new_string - New text to insert
 * @property {boolean} [replace_all=false] - Replace all occurrences
 */

/**
 * @typedef {Object} EditResult
 * @property {boolean} success - Whether operation succeeded
 * @property {string} filepath - File path
 * @property {string} originalContent - Original file content
 * @property {string} newContent - New file content
 * @property {Array} appliedEdits - Details of each applied edit
 * @property {Array<string>} diff - Line-by-line diff
 * @property {Object} stats - Statistics about the edit
 */

// Export for use in app.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MultiEditSystem;
}
