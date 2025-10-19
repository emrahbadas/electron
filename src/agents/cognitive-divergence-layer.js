/**
 * COGNITIVE DIVERGENCE LAYER
 * 
 * v2.1 Component - Anti-Pattern-Trap Mechanism
 * 
 * Bu layer, agent'ın geçmiş pattern'lere körü körüne bağlı kalmasını
 * engeller ve yeni/hybrid projelerde creative exploration'ı sağlar.
 * 
 * PROBLEM:
 * KargoMarketing.com gibi hybrid projeler (buyer+seller+carrier)
 * pure e-commerce veya pure logistics pattern'lerine zorlanıyor.
 * 
 * ÇÖZÜM:
 * - Similarity > 0.8 && known type → REUSE_PATTERN
 * - Similarity < 0.8 || novel type → EXPLORE_NEW
 * - Hybrid detection → BALANCED_APPROACH
 * 
 * @author KayraDeniz v2.1
 * @date 2025-10-19
 */

class CognitiveDivergenceLayer {
    constructor(replayEngine) {
        this.replayEngine = replayEngine;
        
        // Novelty threshold (0-1)
        // 0.8 = %80 benzerlik altı "novel" sayılır
        this.noveltyThreshold = 0.8;
        
        // Known project types
        this.knownTypes = new Set([
            'blog-platform',
            'e-commerce',
            'todo-app',
            'chat-app',
            'portfolio',
            'landing-page',
            'api-server',
            'game'
        ]);
        
        // Hybrid detection patterns
        this.hybridPatterns = [
            { keywords: ['buyer', 'seller', 'carrier'], type: 'marketplace-logistics' },
            { keywords: ['social', 'e-commerce'], type: 'social-commerce' },
            { keywords: ['learning', 'game'], type: 'educational-game' },
            { keywords: ['blog', 'shop'], type: 'content-commerce' }
        ];
        
        // Decision history
        this.decisions = [];
        this.maxHistorySize = 100;
        
        // Metrics
        this.metrics = {
            totalDecisions: 0,
            reusePatternCount: 0,
            exploreNewCount: 0,
            balancedApproachCount: 0,
            hybridDetections: 0
        };
        
        console.log('🎨 CognitiveDivergenceLayer initialized');
        console.log(`   Novelty Threshold: ${this.noveltyThreshold}`);
    }

    /**
     * Projenin stratejisini belirle: REUSE vs EXPLORE vs BALANCED
     * @param {Object} projectContext - Proje context'i
     * @returns {Object} - Strategy decision
     */
    async decideStrategy(projectContext) {
        console.log('🤔 Cognitive Divergence: Analyzing project...');
        console.log('   Project Type:', projectContext.projectType);
        console.log('   Description:', projectContext.description?.substring(0, 100));
        
        this.metrics.totalDecisions++;
        
        // 1. HYBRID DETECTION
        const hybridAnalysis = this._detectHybridProject(projectContext);
        if (hybridAnalysis.isHybrid) {
            console.log('🎭 HYBRID PROJECT DETECTED!');
            console.log(`   Hybrid Type: ${hybridAnalysis.hybridType}`);
            console.log(`   Components: ${hybridAnalysis.components.join(', ')}`);
            
            this.metrics.hybridDetections++;
            
            const decision = {
                strategy: 'BALANCED_APPROACH',
                reason: 'Hybrid project detected - avoiding forced categorization',
                hybridAnalysis,
                guidance: this._createHybridGuidance(hybridAnalysis),
                confidence: 0.9,
                divergenceLevel: 'HIGH' // Hybrid projelerde yüksek divergence
            };
            
            this._recordDecision(decision, projectContext);
            this.metrics.balancedApproachCount++;
            
            return decision;
        }
        
        // 2. SIMILARITY CHECK (via Context Replay Engine)
        let similarityScore = 0;
        let similarPattern = null;
        
        if (this.replayEngine) {
            const replay = await this.replayEngine.replayPatternsFor(projectContext, {
                minSimilarity: 0.5,
                autoApply: false
            });
            
            if (replay) {
                similarityScore = replay.similarity;
                similarPattern = replay;
                console.log(`   Found similar pattern: ${(similarityScore * 100).toFixed(1)}% match`);
            }
        }
        
        // 3. KNOWN TYPE CHECK
        const isKnownType = this.knownTypes.has(projectContext.projectType);
        
        console.log(`   Similarity Score: ${(similarityScore * 100).toFixed(1)}%`);
        console.log(`   Known Type: ${isKnownType ? 'Yes' : 'No'}`);
        console.log(`   Novelty Threshold: ${(this.noveltyThreshold * 100).toFixed(1)}%`);
        
        // 4. DECISION LOGIC
        if (similarityScore >= this.noveltyThreshold && isKnownType) {
            // STRATEGY: REUSE_PATTERN
            console.log('♻️ DECISION: REUSE_PATTERN (high similarity + known type)');
            
            const decision = {
                strategy: 'REUSE_PATTERN',
                reason: `High similarity (${(similarityScore * 100).toFixed(1)}%) with known ${projectContext.projectType}`,
                pattern: similarPattern,
                confidence: similarityScore,
                divergenceLevel: 'LOW',
                guidance: this._createReuseGuidance(similarPattern)
            };
            
            this._recordDecision(decision, projectContext);
            this.metrics.reusePatternCount++;
            
            return decision;
            
        } else {
            // STRATEGY: EXPLORE_NEW
            console.log('🚀 DECISION: EXPLORE_NEW (low similarity or novel type)');
            
            const decision = {
                strategy: 'EXPLORE_NEW',
                reason: similarityScore < this.noveltyThreshold
                    ? `Low similarity (${(similarityScore * 100).toFixed(1)}%) - needs custom approach`
                    : `Novel project type: ${projectContext.projectType}`,
                confidence: 1 - similarityScore, // Novel ise confidence yüksek
                divergenceLevel: 'HIGH',
                guidance: this._createExplorationGuidance(projectContext)
            };
            
            this._recordDecision(decision, projectContext);
            this.metrics.exploreNewCount++;
            
            return decision;
        }
    }

    /**
     * Novelty threshold'u dinamik olarak ayarla
     * @param {number} newThreshold - 0-1 arası yeni threshold
     */
    setNoveltyThreshold(newThreshold) {
        if (newThreshold < 0 || newThreshold > 1) {
            throw new Error('Novelty threshold must be between 0 and 1');
        }
        
        const oldThreshold = this.noveltyThreshold;
        this.noveltyThreshold = newThreshold;
        
        console.log(`🎚️ Novelty threshold changed: ${oldThreshold} → ${newThreshold}`);
        
        if (newThreshold < 0.7) {
            console.log('   ⚠️ Low threshold = More pattern reuse (faster but less creative)');
        } else if (newThreshold > 0.85) {
            console.log('   ⚠️ High threshold = More exploration (slower but more creative)');
        }
    }

    /**
     * Yeni known type ekle
     */
    addKnownType(projectType) {
        this.knownTypes.add(projectType);
        console.log(`✅ Added known type: ${projectType}`);
    }

    /**
     * Metrics al
     */
    getMetrics() {
        return {
            ...this.metrics,
            reuseRate: this.metrics.totalDecisions > 0
                ? this.metrics.reusePatternCount / this.metrics.totalDecisions
                : 0,
            explorationRate: this.metrics.totalDecisions > 0
                ? this.metrics.exploreNewCount / this.metrics.totalDecisions
                : 0,
            balancedRate: this.metrics.totalDecisions > 0
                ? this.metrics.balancedApproachCount / this.metrics.totalDecisions
                : 0
        };
    }

    /**
     * Decision history al
     */
    getDecisions() {
        return this.decisions;
    }

    // ============ PRIVATE METHODS ============

    /**
     * Hybrid project detection
     */
    _detectHybridProject(projectContext) {
        const description = (projectContext.description || '').toLowerCase();
        const projectType = (projectContext.projectType || '').toLowerCase();
        const requirements = (projectContext.requirements || []).map(r => r.toLowerCase());
        
        const allText = `${description} ${projectType} ${requirements.join(' ')}`;
        
        // Hybrid pattern matching
        for (const pattern of this.hybridPatterns) {
            const matchCount = pattern.keywords.filter(keyword => 
                allText.includes(keyword)
            ).length;
            
            if (matchCount >= 2) {
                return {
                    isHybrid: true,
                    hybridType: pattern.type,
                    components: pattern.keywords.filter(k => allText.includes(k)),
                    confidence: matchCount / pattern.keywords.length
                };
            }
        }
        
        // Keyword diversity check (farklı kategorilerden keyword'ler)
        const categories = {
            ecommerce: ['shop', 'cart', 'product', 'payment', 'buy', 'sell'],
            social: ['user', 'profile', 'friend', 'follow', 'post', 'comment'],
            logistics: ['ship', 'deliver', 'track', 'carrier', 'warehouse'],
            content: ['blog', 'article', 'post', 'read', 'publish']
        };
        
        const matchedCategories = [];
        for (const [category, keywords] of Object.entries(categories)) {
            if (keywords.some(keyword => allText.includes(keyword))) {
                matchedCategories.push(category);
            }
        }
        
        if (matchedCategories.length >= 2) {
            return {
                isHybrid: true,
                hybridType: matchedCategories.join('-'),
                components: matchedCategories,
                confidence: 0.7
            };
        }
        
        return { isHybrid: false };
    }

    /**
     * Hybrid proje için guidance oluştur
     */
    _createHybridGuidance(hybridAnalysis) {
        return {
            rules: [
                `Bu proje HYBRID bir sistem: ${hybridAnalysis.components.join(' + ')}`,
                'Hiçbir component\'i baskın hale getirme - balance koru',
                'Pure kategorilere (e-commerce, logistics, vb.) zorlama',
                'Her component için ayrı module/service tasarla',
                'Component\'ler arası integration\'a özel önem ver'
            ],
            warnings: [
                '⚠️ Pattern trap riski yüksek - geçmiş pattern\'lere körü körüne bağlanma',
                '⚠️ Kullanıcıya sık sık doğrulama sor - hybrid requirements değişken olabilir',
                `⚠️ ${hybridAnalysis.components.join(' ve ')} arasındaki dengeyi korumaya dikkat et`
            ],
            approach: 'CUSTOM_ARCHITECTURE',
            estimatedComplexity: 'HIGH'
        };
    }

    /**
     * Pattern reuse için guidance
     */
    _createReuseGuidance(similarPattern) {
        return {
            rules: [
                'Benzer proje bulundu - proven pattern\'i kullan',
                'Geçmiş başarılı fix\'leri replay et',
                'Build time\'ı kısalt - optimized yapı kullan'
            ],
            warnings: [
                '⚠️ Kullanıcının özel requirement\'larını atla - pattern\'e kör körüne uyma',
                '⚠️ Pattern güncel mi kontrol et - eski dependency sürümleri olabilir'
            ],
            approach: 'PATTERN_REUSE',
            estimatedComplexity: 'LOW',
            pattern: similarPattern
        };
    }

    /**
     * Exploration için guidance
     */
    _createExplorationGuidance(projectContext) {
        return {
            rules: [
                'Unique requirement\'ları anlamak için önce analiz yap',
                'Bilinen kategorilere zorla - custom çözüm gerekebilir',
                'Kullanıcıya belirsiz kısımlar için soru sor',
                'İlk versiyonu basit tut, sonra iterate et',
                'Best practices\'i takip et ama rigid pattern\'lerden kaçın'
            ],
            warnings: [
                '⚠️ Exploration daha uzun sürebilir - sabırlı ol',
                '⚠️ Kullanıcıdan frequent feedback al',
                '⚠️ Modüler yap - değişiklik olasılığı yüksek'
            ],
            approach: 'CREATIVE_EXPLORATION',
            estimatedComplexity: 'MEDIUM-HIGH',
            suggestions: this._generateExplorationSuggestions(projectContext)
        };
    }

    /**
     * Exploration suggestions oluştur
     */
    _generateExplorationSuggestions(projectContext) {
        return [
            `${projectContext.projectType} için modern best practices araştır`,
            'Benzer ama tam aynı olmayan open-source projeleri incele',
            'Tech stack seçimini kullanıcıyla doğrula',
            'MVP approach kullan - ilk önce core features'
        ];
    }

    /**
     * Decision'ı kaydet
     */
    _recordDecision(decision, projectContext) {
        const record = {
            ...decision,
            projectContext: {
                projectType: projectContext.projectType,
                description: projectContext.description?.substring(0, 200)
            },
            timestamp: new Date().toISOString(),
            id: `decision_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        };
        
        this.decisions.unshift(record);
        
        // Max size kontrolü
        if (this.decisions.length > this.maxHistorySize) {
            this.decisions.pop();
        }
        
        console.log(`📝 Decision recorded: ${decision.strategy}`);
    }
}

// Export for ES6 modules (MUST BE FIRST!)
export { CognitiveDivergenceLayer };

// Export for Node.js and Browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CognitiveDivergenceLayer;
}

// Browser global
if (typeof window !== 'undefined') {
    window.CognitiveDivergenceLayer = CognitiveDivergenceLayer;
}

console.log('✅ CognitiveDivergenceLayer class loaded');
