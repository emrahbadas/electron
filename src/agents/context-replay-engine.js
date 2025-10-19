/**
 * CONTEXT REPLAY ENGINE
 * 
 * v2.1 Component - Smart Previous Project Matching
 * 
 * Bu engine geçmiş projelerdeki başarılı çözümleri hatırlar
 * ve benzer yeni projelerde otomatik olarak replay eder.
 * 
 * KargoMarketing.com gibi hybrid projelerde pattern trap'e
 * düşmemek için Cognitive Divergence Layer ile entegre çalışır.
 * 
 * @author KayraDeniz v2.1
 * @date 2025-10-19
 */

class ContextReplayEngine {
    constructor(learningStore, adaptiveMemory) {
        this.learningStore = learningStore;
        this.adaptiveMemory = adaptiveMemory;
        
        // Replay history
        this.replayHistory = [];
        this.maxHistorySize = 50;
        
        // Performance metrics
        this.metrics = {
            totalReplays: 0,
            successfulReplays: 0,
            failedReplays: 0,
            avgTimesSaved: 0
        };
        
        console.log('🔁 ContextReplayEngine initialized');
    }

    /**
     * Belirli bir proje tipi için pattern'leri replay et
     * @param {Object} projectContext - Mevcut proje context'i
     * @param {Object} options - Replay seçenekleri
     * @returns {Object|null} - Replay sonucu veya null
     */
    async replayPatternsFor(projectContext, options = {}) {
        const {
            minSimilarity = 0.75,
            autoApply = false,
            safeMode = true
        } = options;

        console.log('🔍 Searching for replayable patterns...');
        console.log('   Project Type:', projectContext.projectType);
        console.log('   Technologies:', projectContext.technologies?.join(', '));
        
        // Adaptive Memory'den benzer pattern'leri bul
        const similarPatterns = await this.adaptiveMemory.findSimilarContext(
            projectContext,
            minSimilarity
        );

        if (similarPatterns.length === 0) {
            console.log('📭 No patterns found for replay');
            return null;
        }

        const best = similarPatterns[0];
        
        // Similarity threshold kontrolü
        if (best.similarity < minSimilarity) {
            console.log(`⚠️ Best match similarity (${(best.similarity * 100).toFixed(1)}%) below threshold (${minSimilarity * 100}%)`);
            return null;
        }

        console.log(`✅ Found replayable pattern:`);
        console.log(`   Similarity: ${(best.similarity * 100).toFixed(1)}%`);
        console.log(`   Success Rate: ${(best.pattern.successRate * 100).toFixed(1)}%`);
        console.log(`   Times Used: ${best.pattern.count}`);

        // Learned fixes'ları hazırla
        const learnedFixes = this.injectLearnedFixes(best.pattern, projectContext);

        const replayResult = {
            patternHash: best.hash,
            similarity: best.similarity,
            confidence: this._calculateConfidence(best.pattern),
            learnedFixes,
            estimatedTimeSaved: this._estimateTimeSaved(learnedFixes),
            appliedAt: new Date().toISOString(),
            autoApplied: false
        };

        // Auto-apply ise fix'leri uygula
        if (autoApply && !safeMode) {
            console.log('⚡ Auto-applying learned fixes...');
            const applyResult = await this._applyFixes(learnedFixes);
            replayResult.autoApplied = true;
            replayResult.applyResult = applyResult;
        }

        // Metrics güncelle
        this.metrics.totalReplays++;
        this.metrics.avgTimesSaved = 
            (this.metrics.avgTimesSaved + replayResult.estimatedTimeSaved) / 2;

        // History'e ekle
        this._addToHistory(replayResult);

        console.log(`💡 Replay prepared (auto-applied: ${autoApply})`);
        
        return replayResult;
    }

    /**
     * Pattern'den learned fix'leri çıkar ve mevcut context'e uyarla
     * @param {Object} pattern - Kayıtlı pattern
     * @param {Object} currentContext - Mevcut proje context'i
     * @returns {Array} - Inject edilmiş fix'ler
     */
    injectLearnedFixes(pattern, currentContext) {
        console.log('💉 Injecting learned fixes into current context...');
        
        const learnedFixes = [];
        
        // Success rate > 0.8 olan fix'leri al
        const highSuccessFixes = pattern.fixes.filter(fix => fix.successRate >= 0.8);
        
        console.log(`   Found ${highSuccessFixes.length} high-success fixes (>80%)`);

        highSuccessFixes.forEach(fix => {
            // Path adaptation (workspace root değişmiş olabilir)
            const adaptedFix = {
                ...fix,
                path: this._adaptPath(fix.path, currentContext),
                learnedFrom: pattern.contextHash,
                originalSuccessRate: fix.successRate,
                injectedAt: new Date().toISOString(),
                reasoning: {
                    turkish: `Bu fix geçmişte ${fix.useCount} kez kullanıldı ve ${(fix.successRate * 100).toFixed(0)}% başarı oranına sahip.`,
                    english: `This fix was used ${fix.useCount} times with ${(fix.successRate * 100).toFixed(0)}% success rate.`
                }
            };

            learnedFixes.push(adaptedFix);
        });

        console.log(`✅ Injected ${learnedFixes.length} learned fixes`);
        
        return learnedFixes;
    }

    /**
     * Replay edilen pattern'den Night Orders oluştur
     * @param {Object} pattern - Replay edilecek pattern
     * @param {Object} currentContext - Mevcut context
     * @returns {Object} - Night Orders JSON
     */
    async generateNightOrdersFromReplay(pattern, currentContext) {
        console.log('📋 Generating Night Orders from replayed pattern...');

        const learnedFixes = this.injectLearnedFixes(pattern, currentContext);

        const nightOrders = {
            mission: `Recreate ${pattern.context.projectType} using learned patterns`,
            acceptance: [
                'build: exit 0',
                'lint: pass',
                'detector: no placeholders'
            ],
            steps: [],
            metadata: {
                replayedFrom: pattern.contextHash,
                similarity: this._calculateSimilarity(pattern.context, currentContext),
                confidence: this._calculateConfidence(pattern),
                learnedFixCount: learnedFixes.length
            }
        };

        // Fix'leri step'lere çevir
        learnedFixes.forEach((fix, index) => {
            const step = {
                id: `R${index + 1}`,
                tool: this._fixTypeToTool(fix.type),
                args: this._fixToArgs(fix),
                explain: {
                    goal: `Apply learned fix: ${fix.type} on ${fix.path}`,
                    rationale: fix.reasoning.english
                },
                verify: ['lint'],
                metadata: {
                    learnedFrom: fix.learnedFrom,
                    successRate: fix.originalSuccessRate
                }
            };

            nightOrders.steps.push(step);
        });

        console.log(`✅ Generated ${nightOrders.steps.length} replay steps`);
        
        return nightOrders;
    }

    /**
     * Replay history'yi al
     */
    getHistory() {
        return this.replayHistory;
    }

    /**
     * Replay metrics'i al
     */
    getMetrics() {
        return {
            ...this.metrics,
            successRate: this.metrics.totalReplays > 0
                ? this.metrics.successfulReplays / this.metrics.totalReplays
                : 0
        };
    }

    /**
     * Replay sonucunu işaretle (başarılı/başarısız)
     */
    markReplayResult(replayId, success) {
        const replay = this.replayHistory.find(r => r.id === replayId);
        
        if (!replay) {
            console.warn(`⚠️ Replay not found: ${replayId}`);
            return;
        }

        replay.success = success;
        replay.completedAt = new Date().toISOString();

        if (success) {
            this.metrics.successfulReplays++;
            console.log(`✅ Replay marked as successful: ${replayId}`);
        } else {
            this.metrics.failedReplays++;
            console.log(`❌ Replay marked as failed: ${replayId}`);
        }
    }

    // ============ PRIVATE METHODS ============

    /**
     * Path adaptation (workspace root değişebilir)
     */
    _adaptPath(originalPath, currentContext) {
        // Basit path adaptation
        // Gerçek implementasyonda workspace root değişikliği handle edilmeli
        const fileName = originalPath.split(/[/\\]/).pop();
        return currentContext.workspaceRoot 
            ? `${currentContext.workspaceRoot}/${fileName}`
            : originalPath;
    }

    /**
     * Fix'leri fiziksel olarak uygula
     */
    async _applyFixes(fixes) {
        if (!window.reflexionApplier) {
            console.warn('⚠️ ReflexionApplier not available');
            return { success: false, error: 'ReflexionApplier not loaded' };
        }

        console.log(`⚡ Applying ${fixes.length} fixes...`);
        
        const results = [];
        
        for (const fix of fixes) {
            try {
                const result = await window.reflexionApplier.applySingleFix(fix);
                results.push({ fix, result });
            } catch (error) {
                console.error(`❌ Fix failed:`, error);
                results.push({ fix, error: error.message });
            }
        }

        const successCount = results.filter(r => r.result?.success).length;
        
        console.log(`✅ Applied ${successCount}/${fixes.length} fixes successfully`);
        
        return {
            success: successCount === fixes.length,
            applied: successCount,
            total: fixes.length,
            results
        };
    }

    /**
     * Confidence hesapla
     */
    _calculateConfidence(pattern) {
        const successRateWeight = 0.6;
        const countWeight = 0.4;
        const normalizedCount = Math.min(pattern.count / 10, 1);
        
        return (pattern.successRate * successRateWeight) + (normalizedCount * countWeight);
    }

    /**
     * Context similarity hesapla
     */
    _calculateSimilarity(context1, context2) {
        if (this.adaptiveMemory) {
            return this.adaptiveMemory._calculateSimilarity(context1, context2);
        }
        
        // Fallback simple similarity
        return context1.projectType === context2.projectType ? 0.8 : 0.3;
    }

    /**
     * Tahmini zaman tasarrufu hesapla
     */
    _estimateTimeSaved(fixes) {
        // Her fix ortalama 2 dakika kazandırır varsayımı
        const minutesPerFix = 2;
        return fixes.length * minutesPerFix;
    }

    /**
     * History'e ekle
     */
    _addToHistory(replay) {
        const replayWithId = {
            ...replay,
            id: `replay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            success: null, // Henüz belli değil
            completedAt: null
        };

        this.replayHistory.unshift(replayWithId);

        // Max size kontrolü
        if (this.replayHistory.length > this.maxHistorySize) {
            this.replayHistory.pop();
        }

        return replayWithId.id;
    }

    /**
     * Fix type'ı tool name'e çevir
     */
    _fixTypeToTool(fixType) {
        const mapping = {
            'UPDATE_FILE': 'fs.write',
            'CREATE_FILE': 'fs.write',
            'DELETE_FILE': 'fs.delete',
            'RUN_COMMAND': 'terminal.exec',
            'EXEC': 'terminal.exec'
        };
        
        return mapping[fixType] || 'fs.write';
    }

    /**
     * Fix'i tool args'a çevir
     */
    _fixToArgs(fix) {
        switch (fix.type) {
            case 'UPDATE_FILE':
            case 'CREATE_FILE':
                return {
                    path: fix.path,
                    content: fix.suggestedContent || fix.content || ''
                };
            
            case 'DELETE_FILE':
                return {
                    path: fix.path
                };
            
            case 'RUN_COMMAND':
            case 'EXEC':
                return {
                    cmd: fix.command
                };
            
            default:
                return {};
        }
    }
}

// Export for Node.js and Browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ContextReplayEngine;
}

// Browser global
if (typeof window !== 'undefined') {
    window.ContextReplayEngine = ContextReplayEngine;
}

console.log('✅ ContextReplayEngine class loaded');
