/**
 * ADAPTIVE REFLEXION MEMORY AGENT
 * 
 * v2.1 Component - Pattern Learning with Weighted Scoring
 * 
 * Bu agent geçmiş projelerdeki başarılı fix pattern'lerini öğrenir
 * ve benzer projelerde tekrar kullanılmak üzere saklar.
 * 
 * Weighted Scoring Formula:
 * score = pattern.count + (fix.successRate * 10) + (context.similarity * 100)
 * 
 * @author KayraDeniz v2.1
 * @date 2025-10-19
 */

class AdaptiveReflexionMemory {
    constructor() {
        // Pattern storage: Map<contextHash, PatternData>
        this.patterns = new Map();
        
        // Recent patterns cache for quick access
        this.recentPatterns = [];
        this.maxRecentSize = 10;
        
        // Performance metrics
        this.metrics = {
            totalPatterns: 0,
            totalRecalls: 0,
            successfulRecalls: 0,
            avgSimilarityScore: 0
        };
        
        console.log('🧠 AdaptiveReflexionMemory initialized');
    }

    /**
     * Yeni bir pattern kaydet
     * @param {Object} context - Proje context bilgisi
     * @param {Array} fixes - Uygulanan fix'ler
     * @param {boolean} success - Fix başarılı mı?
     */
    async storePattern(context, fixes, success) {
        const contextHash = this._generateContextHash(context);
        
        let pattern = this.patterns.get(contextHash);
        
        if (!pattern) {
            // Yeni pattern
            pattern = {
                contextHash,
                context: this._sanitizeContext(context),
                fixes: [],
                count: 0,
                successCount: 0,
                failureCount: 0,
                successRate: 0,
                firstSeen: new Date().toISOString(),
                lastUsed: new Date().toISOString(),
                tags: this._extractTags(context)
            };
            this.patterns.set(contextHash, pattern);
            this.metrics.totalPatterns++;
        }
        
        // Fix'leri ekle
        fixes.forEach(fix => {
            const existingFix = pattern.fixes.find(f => 
                f.type === fix.type && f.path === fix.path
            );
            
            if (existingFix) {
                existingFix.useCount++;
                if (success) existingFix.successCount++;
                existingFix.successRate = existingFix.successCount / existingFix.useCount;
            } else {
                pattern.fixes.push({
                    ...fix,
                    useCount: 1,
                    successCount: success ? 1 : 0,
                    successRate: success ? 1.0 : 0.0
                });
            }
        });
        
        // Pattern istatistikleri güncelle
        pattern.count++;
        if (success) {
            pattern.successCount++;
        } else {
            pattern.failureCount++;
        }
        pattern.successRate = pattern.successCount / pattern.count;
        pattern.lastUsed = new Date().toISOString();
        
        // Recent patterns'e ekle
        this._updateRecentPatterns(pattern);
        
        console.log(`✅ Pattern stored: ${contextHash} (success rate: ${(pattern.successRate * 100).toFixed(1)}%)`);
        
        return pattern;
    }

    /**
     * Mevcut context'e benzer pattern'leri bul
     * @param {Object} currentContext - Mevcut proje context'i
     * @param {number} minSimilarity - Minimum benzerlik skoru (0-1)
     * @returns {Array} - Benzer pattern'ler (en yüksek score önce)
     */
    async findSimilarContext(currentContext, minSimilarity = 0.5) {
        this.metrics.totalRecalls++;
        
        const scores = [];
        const currentTags = this._extractTags(currentContext);
        
        for (const [hash, pattern] of this.patterns) {
            const similarity = this._calculateSimilarity(currentContext, pattern.context);
            
            if (similarity < minSimilarity) {
                continue; // Too different
            }
            
            // Weighted scoring formula
            // count: pattern kullanım sıklığı
            // successRate: başarı oranı (x10 weight)
            // similarity: context benzerliği (x100 weight)
            const score = 
                pattern.count + 
                (pattern.successRate * 10) + 
                (similarity * 100);
            
            scores.push({
                hash,
                pattern,
                similarity,
                score,
                matchedTags: this._getMatchedTags(currentTags, pattern.tags)
            });
        }
        
        // Score'a göre sırala (en yüksek önce)
        scores.sort((a, b) => b.score - a.score);
        
        if (scores.length > 0) {
            this.metrics.successfulRecalls++;
            this.metrics.avgSimilarityScore = 
                (this.metrics.avgSimilarityScore + scores[0].similarity) / 2;
        }
        
        console.log(`🔍 Found ${scores.length} similar patterns (min similarity: ${minSimilarity})`);
        
        return scores;
    }

    /**
     * Benzer pattern varsa optimize edilmiş plan öner
     * @param {Object} currentContext - Mevcut context
     * @returns {Object|null} - Önerilen plan veya null
     */
    async suggestOptimizedPlan(currentContext) {
        const similarPatterns = await this.findSimilarContext(currentContext, 0.75);
        
        if (similarPatterns.length === 0) {
            console.log('📭 No similar patterns found for optimization');
            return null;
        }
        
        const best = similarPatterns[0];
        
        console.log(`💡 Suggesting optimized plan from pattern: ${best.hash}`);
        console.log(`   Similarity: ${(best.similarity * 100).toFixed(1)}%`);
        console.log(`   Success Rate: ${(best.pattern.successRate * 100).toFixed(1)}%`);
        console.log(`   Used: ${best.pattern.count} times`);
        
        return {
            pattern: best.pattern,
            similarity: best.similarity,
            score: best.score,
            suggestedFixes: this._rankFixesBySuccess(best.pattern.fixes),
            confidence: this._calculateConfidence(best.pattern),
            reasoning: this._generateReasoning(best, currentContext)
        };
    }

    /**
     * Pattern istatistiklerini al
     */
    getMetrics() {
        return {
            ...this.metrics,
            totalPatterns: this.patterns.size,
            recallSuccessRate: this.metrics.totalRecalls > 0 
                ? this.metrics.successfulRecalls / this.metrics.totalRecalls 
                : 0
        };
    }

    /**
     * Tüm pattern'leri export et (Learning Store sync için)
     */
    exportPatterns() {
        return Array.from(this.patterns.values()).map(pattern => ({
            ...pattern,
            fixes: pattern.fixes.map(fix => ({
                type: fix.type,
                path: fix.path,
                successRate: fix.successRate,
                useCount: fix.useCount
            }))
        }));
    }

    /**
     * Pattern'leri import et (Learning Store'dan yükleme)
     */
    importPatterns(patterns) {
        patterns.forEach(pattern => {
            this.patterns.set(pattern.contextHash, pattern);
        });
        this.metrics.totalPatterns = this.patterns.size;
        console.log(`📥 Imported ${patterns.length} patterns`);
    }

    /**
     * Bellek temizleme (eski, başarısız pattern'leri sil)
     */
    cleanupPatterns(options = {}) {
        const {
            minSuccessRate = 0.3,
            minUseCount = 2,
            maxAge = 90 * 24 * 60 * 60 * 1000 // 90 gün
        } = options;

        const now = Date.now();
        let removed = 0;

        for (const [hash, pattern] of this.patterns) {
            const age = now - new Date(pattern.lastUsed).getTime();
            
            if (
                pattern.successRate < minSuccessRate ||
                pattern.count < minUseCount ||
                age > maxAge
            ) {
                this.patterns.delete(hash);
                removed++;
            }
        }

        console.log(`🧹 Cleaned up ${removed} old/unsuccessful patterns`);
        this.metrics.totalPatterns = this.patterns.size;
    }

    // ============ PRIVATE METHODS ============

    /**
     * Context'ten hash oluştur
     */
    _generateContextHash(context) {
        const key = JSON.stringify({
            projectType: context.projectType || 'unknown',
            technologies: (context.technologies || []).sort(),
            errorType: context.errorType || null
        });
        
        // Simple hash function
        let hash = 0;
        for (let i = 0; i < key.length; i++) {
            const char = key.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        
        return `ctx_${Math.abs(hash).toString(16)}`;
    }

    /**
     * Context'i sanitize et (hassas bilgileri çıkar)
     */
    _sanitizeContext(context) {
        return {
            projectType: context.projectType,
            technologies: context.technologies,
            errorType: context.errorType,
            fileCount: context.fileCount,
            complexity: context.complexity
        };
    }

    /**
     * Context'ten tag'leri çıkar
     */
    _extractTags(context) {
        const tags = new Set();
        
        if (context.projectType) tags.add(context.projectType);
        if (context.technologies) {
            context.technologies.forEach(tech => tags.add(tech.toLowerCase()));
        }
        if (context.errorType) tags.add(context.errorType);
        
        return Array.from(tags);
    }

    /**
     * İki context arasındaki benzerliği hesapla
     * @returns {number} - 0-1 arası benzerlik skoru
     */
    _calculateSimilarity(context1, context2) {
        let score = 0;
        let maxScore = 0;

        // Project type benzerliği (weight: 3)
        maxScore += 3;
        if (context1.projectType === context2.projectType) {
            score += 3;
        }

        // Technology overlap (weight: 5)
        maxScore += 5;
        const tech1 = new Set(context1.technologies || []);
        const tech2 = new Set(context2.technologies || []);
        const intersection = new Set([...tech1].filter(x => tech2.has(x)));
        const union = new Set([...tech1, ...tech2]);
        
        if (union.size > 0) {
            score += (intersection.size / union.size) * 5;
        }

        // Error type benzerliği (weight: 2)
        maxScore += 2;
        if (context1.errorType === context2.errorType) {
            score += 2;
        }

        return maxScore > 0 ? score / maxScore : 0;
    }

    /**
     * Matched tag'leri bul
     */
    _getMatchedTags(tags1, tags2) {
        return tags1.filter(tag => tags2.includes(tag));
    }

    /**
     * Fix'leri başarı oranına göre sırala
     */
    _rankFixesBySuccess(fixes) {
        return [...fixes].sort((a, b) => {
            // Önce success rate, sonra use count
            if (b.successRate !== a.successRate) {
                return b.successRate - a.successRate;
            }
            return b.useCount - a.useCount;
        });
    }

    /**
     * Pattern confidence hesapla
     */
    _calculateConfidence(pattern) {
        // Confidence = (successRate * 0.6) + (normalized count * 0.4)
        const normalizedCount = Math.min(pattern.count / 10, 1);
        return (pattern.successRate * 0.6) + (normalizedCount * 0.4);
    }

    /**
     * Öneri için açıklama oluştur
     */
    _generateReasoning(matchResult, currentContext) {
        const { pattern, similarity, score } = matchResult;
        
        return {
            turkish: `Bu pattern ${pattern.count} kez kullanıldı ve ${(pattern.successRate * 100).toFixed(0)}% başarı oranına sahip. Mevcut projenizle ${(similarity * 100).toFixed(0)}% benzerlik gösteriyor.`,
            english: `This pattern has been used ${pattern.count} times with ${(pattern.successRate * 100).toFixed(0)}% success rate. It shows ${(similarity * 100).toFixed(0)}% similarity with your current project.`,
            confidence: this._calculateConfidence(pattern),
            tags: pattern.tags
        };
    }

    /**
     * Recent patterns cache'i güncelle
     */
    _updateRecentPatterns(pattern) {
        // Varsa kaldır
        const index = this.recentPatterns.findIndex(p => p.contextHash === pattern.contextHash);
        if (index !== -1) {
            this.recentPatterns.splice(index, 1);
        }
        
        // En başa ekle
        this.recentPatterns.unshift(pattern);
        
        // Max size kontrolü
        if (this.recentPatterns.length > this.maxRecentSize) {
            this.recentPatterns.pop();
        }
    }
}

// Export for ES6 modules (MUST BE FIRST!)
export { AdaptiveReflexionMemory };

// Export for Node.js and Browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdaptiveReflexionMemory;
}

// Browser global
if (typeof window !== 'undefined') {
    window.AdaptiveReflexionMemory = AdaptiveReflexionMemory;
}

console.log('✅ AdaptiveReflexionMemory class loaded');
