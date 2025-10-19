/**
 * SELF-DIVERGENCE PROTOCOL
 * 
 * v2.1 Component - Internal Questioning System
 * 
 * Bu protocol, agent'ın kendi kararlarını sorgulayarak
 * pattern trap'e düşmesini önler. Meta-cognitive reasoning layer.
 * 
 * SORULAR:
 * 1. "Bu proje geçmiş pattern'e ne kadar benziyor?"
 * 2. "Benzerlik kullanıcı amacına hizmet ediyor mu?"
 * 3. "Bu proje gerçekten X kategorisi mi yoksa hybrid mi?"
 * 4. "Neden farklılaşmam gerek?"
 * 5. "Kullanıcı ne istedi, ben ne anladım?"
 * 
 * @author KayraDeniz v2.1
 * @date 2025-10-19
 */

class SelfDivergenceProtocol {
    constructor(divergenceLayer) {
        this.divergenceLayer = divergenceLayer;
        
        // Questioning templates
        this.questionTemplates = {
            similarity: {
                tr: 'Bu proje geçmiş pattern\'e ne kadar benziyor?',
                en: 'How similar is this project to past patterns?',
                weight: 0.3
            },
            alignment: {
                tr: 'Benzerlik kullanıcı amacına hizmet ediyor mu?',
                en: 'Does the similarity serve user\'s intent?',
                weight: 0.4
            },
            categorization: {
                tr: 'Bu proje gerçekten {category} mı yoksa hybrid mi?',
                en: 'Is this really a {category} or is it hybrid?',
                weight: 0.3
            },
            divergence: {
                tr: 'Neden farklılaşmam gerekiyor?',
                en: 'Why should I diverge from the pattern?',
                weight: 0.2
            },
            understanding: {
                tr: 'Kullanıcı ne istedi, ben ne anladım?',
                en: 'What did user want vs what did I understand?',
                weight: 0.5
            }
        };
        
        // Reasoning history
        this.reasoningHistory = [];
        this.maxHistorySize = 50;
        
        // Metrics
        this.metrics = {
            totalQuestioned: 0,
            divergenceDecisions: 0,
            alignmentDecisions: 0,
            avgDivergenceScore: 0
        };
        
        console.log('🤔 SelfDivergenceProtocol initialized');
    }

    /**
     * Bir decision'ı internal questioning ile doğrula
     * @param {Object} decision - Cognitive Divergence Layer decision'ı
     * @param {Object} context - Proje context'i
     * @returns {Object} - Questioning result with divergence recommendation
     */
    async questionDecision(decision, context) {
        console.log('🔍 Self-Divergence: Questioning decision...');
        console.log(`   Strategy: ${decision.strategy}`);
        
        this.metrics.totalQuestioned++;
        
        const questions = this._generateQuestions(decision, context);
        const answers = [];
        
        // Her soruyu reasoning loop'a sok
        for (const question of questions) {
            console.log(`   ❓ ${question.text.tr}`);
            
            const answer = await this._internalReasoning(question, decision, context);
            answers.push(answer);
            
            console.log(`   💭 ${answer.reasoning.tr}`);
            console.log(`   📊 Divergence needed: ${answer.divergenceNeeded ? 'YES' : 'NO'} (score: ${answer.divergenceScore.toFixed(2)})`);
        }
        
        // Tüm cevapları aggregate et
        const aggregated = this._aggregateAnswers(answers);
        
        console.log('\n📋 SELF-DIVERGENCE SUMMARY:');
        console.log(`   Overall Divergence Score: ${aggregated.overallDivergenceScore.toFixed(2)}`);
        console.log(`   Recommendation: ${aggregated.recommendation}`);
        console.log(`   Confidence: ${(aggregated.confidence * 100).toFixed(1)}%`);
        
        // History'e kaydet
        this._recordReasoning({
            decision,
            context,
            questions,
            answers,
            aggregated,
            timestamp: new Date().toISOString()
        });
        
        // Metrics güncelle
        if (aggregated.recommendation === 'DIVERGE') {
            this.metrics.divergenceDecisions++;
        } else {
            this.metrics.alignmentDecisions++;
        }
        
        this.metrics.avgDivergenceScore = 
            (this.metrics.avgDivergenceScore + aggregated.overallDivergenceScore) / 2;
        
        return aggregated;
    }

    /**
     * Kullanıcı intent'i ile agent understanding'i karşılaştır
     * @param {string} userRequest - Kullanıcının orijinal isteği
     * @param {Object} agentPlan - Agent'ın oluşturduğu plan
     * @returns {Object} - Alignment analysis
     */
    async checkAlignmentWithUserIntent(userRequest, agentPlan) {
        console.log('🎯 Checking alignment with user intent...');
        
        const analysis = {
            userIntent: this._extractIntent(userRequest),
            agentUnderstanding: this._extractUnderstanding(agentPlan),
            mismatches: [],
            alignmentScore: 0,
            warnings: []
        };
        
        // Intent vs Understanding comparison
        const intentKeywords = analysis.userIntent.keywords;
        const planKeywords = analysis.agentUnderstanding.keywords;
        
        // Missing keywords (kullanıcı istedi ama planda yok)
        const missing = intentKeywords.filter(k => !planKeywords.includes(k));
        if (missing.length > 0) {
            analysis.mismatches.push({
                type: 'MISSING_FEATURES',
                keywords: missing,
                severity: 'MEDIUM',
                message: `Kullanıcı "${missing.join(', ')}" istedi ama planda yok`
            });
        }
        
        // Extra keywords (planda var ama kullanıcı istemedi)
        const extra = planKeywords.filter(k => !intentKeywords.includes(k));
        if (extra.length > 0) {
            analysis.warnings.push({
                type: 'EXTRA_FEATURES',
                keywords: extra,
                message: `Planda "${extra.join(', ')}" var ama kullanıcı istemedi`
            });
        }
        
        // Alignment score
        const overlap = intentKeywords.filter(k => planKeywords.includes(k)).length;
        analysis.alignmentScore = intentKeywords.length > 0 
            ? overlap / intentKeywords.length 
            : 0;
        
        console.log(`   Alignment Score: ${(analysis.alignmentScore * 100).toFixed(1)}%`);
        
        if (analysis.alignmentScore < 0.7) {
            console.log('   ⚠️ LOW ALIGNMENT - User intent may not be fully understood!');
        }
        
        return analysis;
    }

    /**
     * Metrics al
     */
    getMetrics() {
        return {
            ...this.metrics,
            divergenceRate: this.metrics.totalQuestioned > 0
                ? this.metrics.divergenceDecisions / this.metrics.totalQuestioned
                : 0
        };
    }

    /**
     * Reasoning history al
     */
    getHistory() {
        return this.reasoningHistory;
    }

    // ============ PRIVATE METHODS ============

    /**
     * Decision ve context'e göre sorular oluştur
     */
    _generateQuestions(decision, context) {
        const questions = [];
        
        // Soru 1: Similarity
        if (decision.pattern) {
            questions.push({
                template: this.questionTemplates.similarity,
                text: this.questionTemplates.similarity,
                data: {
                    similarity: decision.pattern.similarity,
                    patternHash: decision.pattern.patternHash
                }
            });
        }
        
        // Soru 2: Alignment
        questions.push({
            template: this.questionTemplates.alignment,
            text: this.questionTemplates.alignment,
            data: {
                strategy: decision.strategy,
                userContext: context.description
            }
        });
        
        // Soru 3: Categorization
        if (context.projectType) {
            const text = {
                tr: this.questionTemplates.categorization.tr.replace('{category}', context.projectType),
                en: this.questionTemplates.categorization.en.replace('{category}', context.projectType)
            };
            
            questions.push({
                template: this.questionTemplates.categorization,
                text,
                data: {
                    projectType: context.projectType,
                    description: context.description
                }
            });
        }
        
        // Soru 4: Divergence (sadece REUSE_PATTERN ise)
        if (decision.strategy === 'REUSE_PATTERN') {
            questions.push({
                template: this.questionTemplates.divergence,
                text: this.questionTemplates.divergence,
                data: {
                    pattern: decision.pattern,
                    context
                }
            });
        }
        
        // Soru 5: Understanding
        questions.push({
            template: this.questionTemplates.understanding,
            text: this.questionTemplates.understanding,
            data: {
                userRequest: context.description,
                agentPlan: decision
            }
        });
        
        return questions;
    }

    /**
     * Internal reasoning - Her soru için AI benzeri düşünme
     */
    async _internalReasoning(question, decision, context) {
        const { template, data } = question;
        
        let divergenceScore = 0;
        let reasoning = { tr: '', en: '' };
        let divergenceNeeded = false;
        
        switch (template) {
            case this.questionTemplates.similarity:
                // Similarity sorusu
                if (data.similarity > 0.9) {
                    reasoning.tr = 'Çok yüksek benzerlik (%90+) - pattern güvenli görünüyor';
                    reasoning.en = 'Very high similarity (90%+) - pattern seems safe';
                    divergenceScore = 0.1;
                } else if (data.similarity > 0.75) {
                    reasoning.tr = 'İyi benzerlik (%75-90) - pattern kullanılabilir ama dikkatli olmalı';
                    reasoning.en = 'Good similarity (75-90%) - pattern usable but be careful';
                    divergenceScore = 0.3;
                } else {
                    reasoning.tr = 'Düşük benzerlik (<75%) - pattern riskli, özel yaklaşım gerek';
                    reasoning.en = 'Low similarity (<75%) - pattern risky, custom approach needed';
                    divergenceScore = 0.7;
                    divergenceNeeded = true;
                }
                break;
            
            case this.questionTemplates.alignment:
                // Alignment sorusu
                const hasUserDescription = context.description && context.description.length > 20;
                
                if (!hasUserDescription) {
                    reasoning.tr = 'Kullanıcı yeterli detay vermemiş - varsayımlara dikkat!';
                    reasoning.en = 'User didn\'t provide enough detail - watch assumptions!';
                    divergenceScore = 0.4;
                } else if (decision.strategy === 'BALANCED_APPROACH') {
                    reasoning.tr = 'Hybrid proje - kullanıcı amacı ile uyumlu görünüyor';
                    reasoning.en = 'Hybrid project - seems aligned with user intent';
                    divergenceScore = 0.2;
                } else {
                    reasoning.tr = 'Kullanıcı intent\'i ile strategy uyumlu';
                    reasoning.en = 'Strategy aligned with user intent';
                    divergenceScore = 0.1;
                }
                break;
            
            case this.questionTemplates.categorization:
                // Categorization sorusu
                const desc = (data.description || '').toLowerCase();
                const type = (data.projectType || '').toLowerCase();
                
                // Hybrid indicator keywords
                const hybridIndicators = ['and', 've', 'with', 'hybrid', 'multi'];
                const hasHybridKeyword = hybridIndicators.some(ind => desc.includes(ind));
                
                if (hasHybridKeyword && decision.strategy !== 'BALANCED_APPROACH') {
                    reasoning.tr = 'Açıklamada hybrid belirtileri var ama strategi BALANCED değil!';
                    reasoning.en = 'Hybrid indicators in description but strategy is not BALANCED!';
                    divergenceScore = 0.8;
                    divergenceNeeded = true;
                } else if (!hasHybridKeyword && decision.strategy === 'BALANCED_APPROACH') {
                    reasoning.tr = 'Strategy BALANCED ama hybrid belirtisi yok - tekrar kontrol et';
                    reasoning.en = 'Strategy is BALANCED but no hybrid indicators - recheck';
                    divergenceScore = 0.5;
                } else {
                    reasoning.tr = 'Kategorizasyon doğru görünüyor';
                    reasoning.en = 'Categorization seems correct';
                    divergenceScore = 0.1;
                }
                break;
            
            case this.questionTemplates.divergence:
                // Divergence sorusu (REUSE_PATTERN için)
                if (data.pattern.similarity < 0.85) {
                    reasoning.tr = 'Benzerlik %85\'in altında - bazı custom değişiklikler gerekebilir';
                    reasoning.en = 'Similarity below 85% - some custom modifications may be needed';
                    divergenceScore = 0.6;
                    divergenceNeeded = true;
                } else {
                    reasoning.tr = 'Pattern reuse mantıklı - farklılaşma gerekmeyebilir';
                    reasoning.en = 'Pattern reuse makes sense - divergence may not be needed';
                    divergenceScore = 0.2;
                }
                break;
            
            case this.questionTemplates.understanding:
                // Understanding sorusu
                const userWords = (data.userRequest || '').toLowerCase().split(/\s+/);
                const planWords = JSON.stringify(data.agentPlan).toLowerCase().split(/\s+/);
                
                const commonWords = userWords.filter(w => 
                    w.length > 3 && planWords.includes(w)
                ).length;
                
                const understandingScore = userWords.length > 0 
                    ? commonWords / userWords.length 
                    : 0;
                
                if (understandingScore < 0.4) {
                    reasoning.tr = 'Kullanıcı isteği ile plan arasında düşük örtüşme - yeniden analiz et!';
                    reasoning.en = 'Low overlap between user request and plan - re-analyze!';
                    divergenceScore = 0.9;
                    divergenceNeeded = true;
                } else if (understandingScore < 0.6) {
                    reasoning.tr = 'Orta seviye anlama - bazı noktalar gözden kaçmış olabilir';
                    reasoning.en = 'Medium understanding - some points may be missed';
                    divergenceScore = 0.5;
                } else {
                    reasoning.tr = 'İyi seviye anlama - kullanıcı isteği doğru anlaşılmış';
                    reasoning.en = 'Good understanding - user request properly understood';
                    divergenceScore = 0.2;
                }
                break;
        }
        
        return {
            question: question.text,
            reasoning,
            divergenceScore,
            divergenceNeeded,
            weight: template.weight
        };
    }

    /**
     * Cevapları aggregate et
     */
    _aggregateAnswers(answers) {
        // Weighted average divergence score
        let totalWeightedScore = 0;
        let totalWeight = 0;
        let divergenceCount = 0;
        
        answers.forEach(answer => {
            totalWeightedScore += answer.divergenceScore * answer.weight;
            totalWeight += answer.weight;
            if (answer.divergenceNeeded) divergenceCount++;
        });
        
        const overallDivergenceScore = totalWeight > 0 
            ? totalWeightedScore / totalWeight 
            : 0;
        
        // Recommendation
        let recommendation = 'ALIGN'; // Default: stick to decision
        let confidence = 0.8;
        
        if (divergenceCount >= answers.length / 2) {
            // Çoğu soru divergence öneriyorsa
            recommendation = 'DIVERGE';
            confidence = overallDivergenceScore;
        } else if (overallDivergenceScore > 0.6) {
            // Score yüksek ama çoğunluk divergence önermiyorsa
            recommendation = 'RECONSIDER';
            confidence = 0.6;
        }
        
        return {
            overallDivergenceScore,
            recommendation, // ALIGN | RECONSIDER | DIVERGE
            confidence,
            divergenceCount,
            totalQuestions: answers.length,
            details: answers.map(a => ({
                question: a.question.tr,
                reasoning: a.reasoning.tr,
                score: a.divergenceScore
            }))
        };
    }

    /**
     * User intent extract
     */
    _extractIntent(userRequest) {
        const keywords = (userRequest || '')
            .toLowerCase()
            .split(/\s+/)
            .filter(word => word.length > 3);
        
        return {
            originalRequest: userRequest,
            keywords: [...new Set(keywords)] // unique
        };
    }

    /**
     * Agent understanding extract
     */
    _extractUnderstanding(agentPlan) {
        const planStr = JSON.stringify(agentPlan).toLowerCase();
        const keywords = planStr
            .split(/\s+/)
            .filter(word => word.length > 3 && /^[a-z]+$/.test(word));
        
        return {
            strategy: agentPlan.strategy,
            keywords: [...new Set(keywords)]
        };
    }

    /**
     * Reasoning'i history'e kaydet
     */
    _recordReasoning(record) {
        this.reasoningHistory.unshift(record);
        
        if (this.reasoningHistory.length > this.maxHistorySize) {
            this.reasoningHistory.pop();
        }
    }
}

// Export for Node.js and Browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SelfDivergenceProtocol;
}

// Browser global
if (typeof window !== 'undefined') {
    window.SelfDivergenceProtocol = SelfDivergenceProtocol;
}

console.log('✅ SelfDivergenceProtocol class loaded');
