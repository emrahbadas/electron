/**
 * 🧠 LUMA CORE - KayraDeniz Bilinç Çekirdeği
 * 
 * Reasoning, intent analysis ve sezgisel karar verme motoru.
 * KayraDeniz'i "komut alan bot"tan "düşünen ajan"a dönüştürür.
 * 
 * @version 1.0.0
 * @author KayraDeniz Team
 */

export class LumaCore {
    constructor(context = {}) {
        this.context = context;
        this.modes = ["idea", "command", "reflection", "exploration"];
        this.riskPatterns = [
            /rm\s+-rf/i,
            /delete\s+.*\*/i,
            /drop\s+database/i,
            /format\s+[a-z]:/i,
            /git\s+reset\s+--hard/i
        ];
        
        console.log('🧠 Luma Core initialized');
    }
    
    /**
     * Kullanıcı mesajının niyetini analiz eder
     * @param {string} message - Kullanıcı mesajı
     * @returns {string} - "idea" | "command" | "reflection" | "exploration"
     */
    analyzeIntent(message) {
        const text = message.toLowerCase();
        
        // Reflection signals
        if (text.includes("hata") || 
            text.includes("neden") || 
            text.includes("analiz") ||
            text.includes("başarısız") ||
            text.includes("çalışmıyor")) {
            return "reflection";
        }
        
        // Command signals  
        if (text.includes("npm") || 
            text.includes("run") ||
            text.includes("build") ||
            text.includes("install") ||
            text.includes("yap") ||
            text.includes("oluştur") ||
            text.includes("çalıştır")) {
            return "command";
        }
        
        // Exploration signals
        if (text.includes("nasıl") ||
            text.includes("ne olur") ||
            text.includes("göster") ||
            text.includes("açıkla") ||
            text.includes("nedir")) {
            return "exploration";
        }
        
        // Default to idea (brainstorming, discussion)
        return "idea";
    }
    
    /**
     * Niyet bazlı akıl yürütme yapar
     * @param {string} intent - Tespit edilen niyet
     * @param {Object} payload - Mesaj ve context bilgisi
     * @returns {Object} - Karar objesi
     */
    reason(intent, payload) {
        switch (intent) {
            case "idea":
                return this.brainstorm(payload);
            case "command":
                return this.evaluateExecution(payload);
            case "reflection":
                return this.selfReflect(payload);
            case "exploration":
                return this.explore(payload);
            default:
                return this.brainstorm(payload);
        }
    }
    
    /**
     * Fikir üretme ve beyin fırtınası
     * @param {Object} data - Mesaj verisi
     * @returns {Object} - Brainstorming yanıtı
     */
    brainstorm(data) {
        const { prompt, context } = data;
        
        return {
            type: "dialogue",
            intent: "idea",
            mood: "creative",
            approved: true,
            message: `💡 Düşünüyorum kaptan... "${prompt}" hakkında birkaç fikrim var.`,
            reasoning: "Bu bir fikir tartışması, risk yok.",
            suggestions: [
                "Konuyu daha detaylı açabilir misin?",
                "Hangi yaklaşımı tercih edersin?",
                "Alternatif çözümler gösterebilirim."
            ],
            metadata: {
                contextUsed: !!context,
                timestamp: Date.now()
            }
        };
    }
    
    /**
     * Komut güvenlik değerlendirmesi
     * @param {Object} data - Komut verisi
     * @returns {Object} - Değerlendirme sonucu
     */
    evaluateExecution(data) {
        const { prompt, context } = data;
        
        // Risk analizi
        const isRisky = this.riskPatterns.some(pattern => pattern.test(prompt));
        
        if (isRisky) {
            return {
                type: "warning",
                intent: "command",
                mood: "cautious",
                approved: false,
                message: `⚠️ DUR KAPTAN! Bu komut riskli: "${prompt}"`,
                reasoning: "Veri kaybı veya sistem hasarı riski tespit edildi.",
                alternatives: [
                    "Önce backup alalım",
                    "Daha güvenli bir yöntem kullanabiliriz",
                    "Bu komutu manuel olarak sen çalıştır"
                ],
                metadata: {
                    riskLevel: "HIGH",
                    requiresConfirmation: true,
                    timestamp: Date.now()
                }
            };
        }
        
        // Context kontrolü
        const contextIssue = this.checkContextRequirements(prompt, context);
        if (contextIssue) {
            return {
                type: "suggestion",
                intent: "command",
                mood: "helpful",
                approved: false,
                message: `🤔 Mantıklı ama önce: ${contextIssue}`,
                reasoning: "Komut için gerekli context eksik veya uyumsuz.",
                fix: this.suggestContextFix(contextIssue),
                metadata: {
                    riskLevel: "LOW",
                    autoFixable: true,
                    timestamp: Date.now()
                }
            };
        }
        
        // Onaylandı
        return {
            type: "approval",
            intent: "command",
            mood: "confident",
            approved: true,
            message: `✅ Anladım kaptan, uyguluyorum: "${prompt}"`,
            reasoning: "Komut güvenli ve context uygun.",
            metadata: {
                riskLevel: "NONE",
                timestamp: Date.now()
            }
        };
    }
    
    /**
     * Hata refleksiyonu ve öğrenme
     * @param {Object} data - Hata verisi
     * @returns {Object} - Refleksiyon sonucu
     */
    selfReflect(data) {
        const { error, context, learningStore } = data;
        
        // LearningStore'dan benzer hataları ara
        let pastPattern = null;
        if (learningStore) {
            const similar = learningStore.search(error || "");
            if (similar.length > 0) {
                pastPattern = similar[0];
            }
        }
        
        if (pastPattern) {
            return {
                type: "learned_response",
                intent: "reflection",
                mood: "experienced",
                approved: true,
                message: `🔍 Bu hatayı daha önce gördüm kaptan! Pattern: "${pastPattern.pattern}"`,
                reasoning: `Geçmişte ${pastPattern.result === 'PASS' ? 'çözmüştüm' : 'çözmeye çalışmıştım'}.`,
                solution: pastPattern.fix || "Çözüm kaydı yok, yeni deneme yapacağım.",
                metadata: {
                    patternId: pastPattern.pattern,
                    previousAttempts: pastPattern.count || 1,
                    lastSeen: pastPattern.timestamp,
                    timestamp: Date.now()
                }
            };
        }
        
        // Yeni hata - refleksiyon modu
        return {
            type: "new_reflection",
            intent: "reflection",
            mood: "analytical",
            approved: true,
            message: `🧪 Yeni hata tipi: "${error}". Analiz edip çözüm bulacağım.`,
            reasoning: "LearningStore'da benzer pattern yok, yeni deneme gerekiyor.",
            strategy: "Incremental fix with verification at each step",
            metadata: {
                isNovel: true,
                willLearn: true,
                timestamp: Date.now()
            }
        };
    }
    
    /**
     * Keşif ve açıklama modu
     * @param {Object} data - Soru verisi
     * @returns {Object} - Açıklama yanıtı
     */
    explore(data) {
        const { prompt } = data;
        
        return {
            type: "explanation",
            intent: "exploration",
            mood: "educational",
            approved: true,
            message: `📚 "${prompt}" hakkında bilgi vereyim kaptan...`,
            reasoning: "Bu bir öğrenme ve keşif isteği.",
            metadata: {
                educationalContent: true,
                timestamp: Date.now()
            }
        };
    }
    
    /**
     * Context gereksinimlerini kontrol eder
     * @param {string} prompt - Komut
     * @param {Object} context - Mevcut context
     * @returns {string|null} - Sorun varsa açıklama
     */
    checkContextRequirements(prompt, context) {
        // npm komutları için package.json kontrolü
        if (prompt.includes("npm") && !context?.hasPackageJson) {
            return "package.json dosyası bulunamadı";
        }
        
        // build komutları için src dizini kontrolü
        if (prompt.includes("build") && !context?.hasSrcFolder) {
            return "kaynak kod dizini (src/) bulunamadı";
        }
        
        // monorepo komutları için workspaces kontrolü
        if (prompt.includes("workspaces") && !context?.isMonorepo) {
            return "bu proje monorepo değil";
        }
        
        return null;
    }
    
    /**
     * Context sorunları için fix önerileri
     * @param {string} issue - Tespit edilen sorun
     * @returns {string} - Öneri
     */
    suggestContextFix(issue) {
        if (issue.includes("package.json")) {
            return "Önce `npm init` çalıştıralım";
        }
        if (issue.includes("src/")) {
            return "Doğru dizine geçelim veya src/ oluşturalım";
        }
        if (issue.includes("monorepo")) {
            return "Standart npm komutlarını kullanmalıyız";
        }
        return "Context'i düzeltelim";
    }
}

export default LumaCore;
