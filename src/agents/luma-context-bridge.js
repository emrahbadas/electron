/**
 * 🌉 LUMA CONTEXT BRIDGE
 * 
 * Luma Core'u KayraDeniz sistemine bağlar:
 * - SessionContext ile kısa süreli hafıza
 * - LearningStore ile uzun süreli öğrenme
 * - MultiAgentCoordinator ile ajan orkestrasyon
 * 
 * @version 1.0.0
 * @author KayraDeniz Team
 */

import { LumaCore } from './luma-core.js';

export class LumaContextBridge {
    constructor(options = {}) {
        this.luma = new LumaCore();
        this.sessionContext = options.sessionContext || null;
        this.learningStore = options.learningStore || null;
        this.eventBus = options.eventBus || null;
        
        this.history = []; // Karar geçmişi
        this.maxHistory = 100;
        
        console.log('🌉 Luma Context Bridge initialized');
    }
    
    /**
     * SessionContext'i bağla
     * @param {Object} sessionContext - SessionContext instance
     */
    connectSessionContext(sessionContext) {
        this.sessionContext = sessionContext;
        console.log('✅ SessionContext connected to Luma');
    }
    
    /**
     * LearningStore'u bağla
     * @param {Object} learningStore - LearningStore instance
     */
    connectLearningStore(learningStore) {
        this.learningStore = learningStore;
        console.log('✅ LearningStore connected to Luma');
    }
    
    /**
     * EventBus'ı bağla (Usta Modu narration için)
     * @param {Object} eventBus - EventBus instance
     */
    connectEventBus(eventBus) {
        this.eventBus = eventBus;
        console.log('✅ EventBus connected to Luma');
    }
    
    /**
     * Kullanıcı mesajını işle (ana entry point)
     * @param {string} message - Kullanıcı mesajı
     * @param {Object} options - Ek seçenekler
     * @returns {Promise<Object>} - Luma kararı
     */
    async processMessage(message, options = {}) {
        try {
            // 1. Intent analizi
            const intent = this.luma.analyzeIntent(message);
            
            // Usta Modu'na bildir
            this.emitNarration('LUMA_THINKING', {
                message: `🧠 Luma düşünüyor... (Intent: ${intent})`,
                intent
            });
            
            // 2. Context toplama
            const context = this.gatherContext();
            
            // 3. LearningStore'dan ilgili pattern'leri getir
            const learningData = this.getLearningData(message);
            
            // 4. Luma reasoning
            const decision = this.luma.reason(intent, {
                prompt: message,
                context,
                learningStore: this.learningStore,
                error: options.error || null,
                ...learningData
            });
            
            // 5. Kararı kaydet
            this.recordDecision(intent, message, decision);
            
            // 6. SessionContext'e kaydet
            if (this.sessionContext) {
                this.sessionContext.recordOperation(
                    intent,
                    decision.message,
                    decision.approved !== false
                );
            }
            
            // 7. Eğer hata refleksiyonu ise LearningStore'a yaz
            if (intent === 'reflection' && decision.type !== 'learned_response') {
                this.saveLearning(message, decision);
            }
            
            // 8. Usta Modu'na sonucu bildir
            this.emitNarration('LUMA_DECISION', {
                message: decision.message,
                decision
            });
            
            return decision;
            
        } catch (error) {
            console.error('❌ Luma processing error:', error);
            return {
                type: 'error',
                intent: 'unknown',
                approved: false,
                message: `🔴 Luma hatası: ${error.message}`,
                error: error.message
            };
        }
    }
    
    /**
     * Mevcut context'i topla
     * @returns {Object} - Toplanan context
     */
    gatherContext() {
        if (!this.sessionContext) {
            return {
                hasPackageJson: false,
                hasSrcFolder: false,
                isMonorepo: false
            };
        }
        
        const ctx = this.sessionContext.context;
        
        return {
            // Proje bilgisi
            projectName: ctx.currentProject?.name || 'Unknown',
            projectType: ctx.currentProject?.type || 'Unknown',
            hasPackageJson: ctx.currentProject?.hasPackageJson || false,
            hasSrcFolder: ctx.currentProject?.hasSrcFolder || false,
            isMonorepo: ctx.currentProject?.isMonorepo || false,
            
            // Mission bilgisi
            activeMission: ctx.activeMission?.goal || null,
            currentPhase: ctx.activeMission?.currentPhase || 1,
            
            // Son işlemler
            lastOperations: ctx.operationHistory?.slice(-5) || [],
            
            // Hata durumu
            hasErrors: ctx.errors?.length > 0,
            lastError: ctx.errors?.[ctx.errors.length - 1] || null
        };
    }
    
    /**
     * LearningStore'dan ilgili veriyi al
     * @param {string} message - Kullanıcı mesajı
     * @returns {Object} - Learning data
     */
    getLearningData(message) {
        if (!this.learningStore) {
            return { patterns: [], stats: null };
        }
        
        try {
            // Mesajda geçen hata kelimelerini ara
            const patterns = this.learningStore.search(message);
            const stats = this.learningStore.getStats();
            
            return {
                patterns: patterns.slice(0, 3), // En yakın 3 pattern
                stats
            };
        } catch (error) {
            console.error('❌ Learning data fetch error:', error);
            return { patterns: [], stats: null };
        }
    }
    
    /**
     * Luma kararını kaydet
     * @param {string} intent - Niyet tipi
     * @param {string} message - Kullanıcı mesajı
     * @param {Object} decision - Luma kararı
     */
    recordDecision(intent, message, decision) {
        const record = {
            timestamp: Date.now(),
            intent,
            message,
            decision: {
                type: decision.type,
                approved: decision.approved,
                mood: decision.mood,
                reasoning: decision.reasoning
            }
        };
        
        this.history.push(record);
        
        // History limit kontrolü
        if (this.history.length > this.maxHistory) {
            this.history = this.history.slice(-this.maxHistory);
        }
    }
    
    /**
     * LearningStore'a öğrenme kaydı yaz
     * @param {string} message - Kullanıcı mesajı
     * @param {Object} decision - Luma kararı
     */
    saveLearning(message, decision) {
        if (!this.learningStore) return;
        
        try {
            const reflection = {
                mission: this.sessionContext?.context?.activeMission?.goal || 'General',
                step: decision.intent,
                tool: 'luma-reasoning',
                error: message,
                rootCause: decision.reasoning || '',
                fix: decision.solution || decision.message,
                result: decision.approved ? 'PASS' : 'FAIL',
                pattern: `luma-${decision.intent}-${Date.now()}`,
                metadata: {
                    lumaType: decision.type,
                    mood: decision.mood,
                    projectContext: this.sessionContext?.context?.currentProject?.name || 'Unknown'
                }
            };
            
            this.learningStore.saveReflection(reflection);
            console.log('📚 Luma learning saved to store');
            
        } catch (error) {
            console.error('❌ Learning save error:', error);
        }
    }
    
    /**
     * Usta Modu'na narration event gönder
     * @param {string} eventType - Event tipi
     * @param {Object} data - Event verisi
     */
    emitNarration(eventType, data) {
        if (!this.eventBus) return;
        
        try {
            this.eventBus.emit(eventType, {
                source: 'luma-core',
                timestamp: Date.now(),
                ...data
            });
        } catch (error) {
            console.error('❌ EventBus emit error:', error);
        }
    }
    
    /**
     * Karar geçmişini getir
     * @param {number} limit - Limit (0 = hepsi)
     * @returns {Array} - Karar geçmişi
     */
    getHistory(limit = 10) {
        if (limit === 0) return this.history;
        return this.history.slice(-limit);
    }
    
    /**
     * İstatistikleri getir
     * @returns {Object} - Luma stats
     */
    getStats() {
        const total = this.history.length;
        const approved = this.history.filter(h => h.decision.approved).length;
        const rejected = total - approved;
        
        const intentCounts = {};
        this.history.forEach(h => {
            intentCounts[h.intent] = (intentCounts[h.intent] || 0) + 1;
        });
        
        return {
            totalDecisions: total,
            approved,
            rejected,
            approvalRate: total > 0 ? ((approved / total) * 100).toFixed(1) : 0,
            intentDistribution: intentCounts,
            learningStoreStats: this.learningStore?.getStats() || null
        };
    }
    
    /**
     * Bridge'i sıfırla
     */
    reset() {
        this.history = [];
        console.log('🔄 Luma Bridge reset');
    }
}

export default LumaContextBridge;
