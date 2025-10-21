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
     * @returns {Object} - { intent, nature, requiresTools, conversational }
     */
    analyzeIntent(message) {
        const text = message.toLowerCase();
        
        // 🧠 STEP 1: İç Sorgulama - İsteğin doğasını belirle
        const nature = this.classifyRequestNature(text);
        
        // ✅ FIX: Nature → Intent mapping
        const intentMap = {
            "simple_chat": "simple_chat",      // ✅ NEW: Direct simple responses
            "how_to_question": "exploration",  // ✅ Informational, not creation
            "question": "exploration",
            "file_operation": "execution",
            "creation": "creation",
            "analysis": "analysis",
            "discussion": "idea",
            "unclear": "exploration"
        };
        
        // ✅ Greeting signals (selamlaşma)
        if (text.match(/^(selam|merhaba|hey|hi|hello|günaydın|iyi akşamlar|nasılsın|naber)[\s!.?]*$/i)) {
            return {
                intent: "greeting",
                nature: "greeting",
                requiresTools: false,
                conversational: true,
                reasoning: "Basit selamlama - sohbet yanıtı yeterli"
            };
        }
        
        // Reflection signals
        if (text.includes("hata") || 
            text.includes("neden") || 
            text.includes("analiz") ||
            text.includes("başarısız") ||
            text.includes("çalışmıyor")) {
            return {
                intent: "reflection",
                nature: nature.type,
                requiresTools: nature.needsTools,
                conversational: false,
                reasoning: "Hata analizi - kod okuma/debug tool gerekebilir"
            };
        }
        
        // Command signals  
        if (text.includes("npm") || 
            text.includes("run") ||
            text.includes("build") ||
            text.includes("install") ||
            text.includes("yap") ||
            text.includes("oluştur") ||
            text.includes("çalıştır")) {
            return {
                intent: "command",
                nature: "action",
                requiresTools: true,
                conversational: false,
                reasoning: "Komut/üretim talebi - tool çağrısı zorunlu"
            };
        }
        
        // Exploration signals
        if (text.includes("nasıl") ||
            text.includes("ne olur") ||
            text.includes("göster") ||
            text.includes("açıkla") ||
            text.includes("nedir")) {
            return {
                intent: intentMap[nature.type] || "exploration",  // ✅ Use mapping
                nature: nature.type,
                requiresTools: nature.needsTools,
                conversational: nature.type === "question" || nature.type === "how_to_question",
                reasoning: nature.type === "question" || nature.type === "how_to_question"
                    ? "Bilgi istemi - sohbet yanıtı yeterli"
                    : "Keşif talebi - kod okuma gerekebilir"
            };
        }
        
        // ✅ FIX: Use intentMap for default routing
        return {
            intent: intentMap[nature.type] || "exploration",  // ✅ Map nature to intent
            nature: nature.type,
            requiresTools: nature.needsTools,
            conversational: nature.type === "discussion" || nature.type === "simple_chat",
            reasoning: nature.reasoning
        };
    }
    
    /**
     * 🧠 İÇSEL SORGULAMA: İsteğin doğasını belirle
     * Sohbet mi? Tool çağrısı mı? Üretim mi? Analiz mi?
     * @param {string} text - Küçük harfe çevrilmiş mesaj
     * @returns {Object} - { type, needsTools, reasoning }
     */
    classifyRequestNature(text) {
        // 0️⃣ ÇOK KISA/BASIT CEVAPLAR (Conversational - No Tools)
        // "evet", "hayır", "tamam", "olur", "adın ne" gibi
        const simpleResponsePatterns = [
            /^(evet|hayır|tamam|olur|peki|ok|okay|yok|var)[\s!.?]*$/i,
            /^(adın|ismin|kim|kimsin|ne yapıyorsun)[\s!.?]*$/i,
            /^(ne|naber|nasılsın|iyi misin)[\s!.?]*$/i
        ];
        
        // ✅ FIX: Context-aware simple chat detection
        // "evet" → simple_chat ✅
        // "evet Phase 2'yi başlat" → NOT simple_chat (has context) ✅
        const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
        const hasContext = wordCount > 2 || text.includes('phase') || text.includes('faz');
        
        if (simpleResponsePatterns.some(p => p.test(text)) && !hasContext) {
            return {
                type: "simple_chat",
                needsTools: false,
                reasoning: "Basit sohbet - direkt yanıt yeterli, tool gerekmez"
            };
        }
        
        // 1️⃣ SORU/BİLGİ İSTEMİ (Conversational - No Tools)
        // ÖNEMLİ: "nasıl yapılır" ile "nasıl yazılır" ayrımı!
        const questionPatterns = [
            /^(ne|nedir|neden|kim|hangi|kaç)/i,
            /(anlat|bilgi ver|açıkla|söyle|öğren)/i,
            /\?$/  // Soru işareti ile bitiyor
        ];
        
        // ✅ FIX: Expanded pattern to catch more variations
        // "nasıl yazılır/yapılır/yapılabilir/olur/olabilir" = bilgi sorusu
        const isHowToQuestion = /nasıl (yazılır|yapılır|yapılabilir|olur|olabilir|çalışır|kullanılır|kullanılabilir|edilir|edebilir)/i.test(text);
        const isActionRequest = /(yap|oluştur|üret|kur|hazırla|başlat)/i.test(text);
        
        if (questionPatterns.some(p => p.test(text))) {
            // "nasıl yazılır" ama "yap" yok → Bilgi sorusu
            if (isHowToQuestion && !isActionRequest) {
                return {
                    type: "how_to_question",
                    needsTools: false,
                    reasoning: "Nasıl yapıldığını öğrenmek istiyor - açıklama yeterli, kod üretme değil"
                };
            }
            
            // "yap", "oluştur" var → Action talebi
            if (isActionRequest) {
                return {
                    type: "tutorial",
                    needsTools: true,
                    reasoning: "Pratik uygulama sorusu - kod örneği göstermeli"
                };
            }
            
            return {
                type: "question",
                needsTools: false,
                reasoning: "Bilgi istemi - sohbet yanıtı yeterli"
            };
        }
        
        // 2️⃣ DOSYA İŞLEMLERİ (Action - Tools Required)
        const filePatterns = [
            /(oku|yaz|sil|kaydet|aç|kapat|düzenle|değiştir)/i,
            /(dosya|klasör|directory|file|folder)/i,
            /(package\.json|readme|config|\.js|\.py|\.css)/i
        ];
        
        if (filePatterns.some(p => p.test(text))) {
            return {
                type: "file_operation",
                needsTools: true,
                reasoning: "Dosya işlemi - fs.read/fs.write tool zorunlu"
            };
        }
        
        // 3️⃣ KOD ÜRETME/PROJE OLUŞTURMA (Action - Tools Required)
        // ÖNEMLİ: Sadece "yap", "oluştur" gibi ACTION kelimeleri varsa
        const creationPatterns = [
            /^(yap|oluştur|üret|hazırla|kur|setup|create|build|make)/i,
            /(proje|uygulama|website|api|component|class|function)\s+(yap|oluştur)/i
        ];
        
        if (creationPatterns.some(p => p.test(text))) {
            return {
                type: "creation",
                needsTools: true,
                reasoning: "Kod üretimi - create_file/write_code tool zorunlu"
            };
        }
        
        // 4️⃣ KOD ANALİZİ/OKUMA (Mixed - May Need Tools)
        const analysisPatterns = [
            /(incele|kontrol|test|debug|bak|görüntüle|listele)/i,
            /(varsa|varmı|kontrol et|check)/i
        ];
        
        if (analysisPatterns.some(p => p.test(text))) {
            return {
                type: "analysis",
                needsTools: true,
                reasoning: "Kod analizi - read_file/list_files tool gerekebilir"
            };
        }
        
        // 5️⃣ FIKIR TARTIŞMASI/BEYIN FIRTINASI (Conversational - No Tools)
        const discussionPatterns = [
            /(düşün|öneri|tavsiye|görüş|fikir|plan)/i,
            /(hangisi|hangi yol|alternatif|seçenek)/i,
            /(ne dersin|ne düşünüyorsun|önerir misin)/i
        ];
        
        if (discussionPatterns.some(p => p.test(text))) {
            return {
                type: "discussion",
                needsTools: false,
                reasoning: "Fikir tartışması - sohbet yeterli, tool gerekmez"
            };
        }
        
        // 6️⃣ BELİRSİZ/GENEL (Default - Analyze Context)
        return {
            type: "unclear",
            needsTools: false,
            reasoning: "Belirsiz istek - sohbet ile netleştir, sonra tool karar ver"
        };
    }
    
    /**
     * Niyet bazlı akıl yürütme yapar
     * @param {string} intent - Tespit edilen niyet veya intent object
     * @param {Object} payload - Mesaj ve context bilgisi
     * @returns {Object} - Karar objesi
     */
    reason(intent, payload) {
        // Handle new intent object format
        const intentType = typeof intent === 'string' ? intent : intent.intent;
        const intentData = typeof intent === 'object' ? intent : null;
        
        // ✅ FIX: Check nature first for simple_chat
        if (intentData?.nature === "simple_chat") {
            return this.brainstorm(payload, intentData);  // Simple chat handler
        }
        
        switch (intentType) {
            case "greeting":
                return this.respondToGreeting(payload, intentData);
            
            case "simple_chat":  // ✅ NEW: Handle simple chat intent
                return this.brainstorm(payload, intentData);
            
            case "idea":
                return this.brainstorm(payload, intentData);
            
            case "command":
                return this.evaluateExecution(payload, intentData);
            case "reflection":
                return this.selfReflect(payload, intentData);
            case "exploration":
                return this.explore(payload, intentData);
            default:
                return this.brainstorm(payload, intentData);
        }
    }
    
    /**
     * Selamlaşma yanıtı
     * @param {Object} data - Mesaj verisi
     * @param {Object} intentData - Intent analiz sonucu (opsiyonel)
     * @returns {Object} - Selamlaşma yanıtı
     */
    respondToGreeting(data, intentData = null) {
        const { prompt } = data;
        
        const greetings = [
            "👋 Selam! Sana nasıl yardımcı olabilirim?",
            "🐉 Merhaba! Ben KayraDeniz, Kod Canavarı. Ne yapmak istersin?",
            "✨ Hey! Bugün hangi projeyi hayata geçirelim?",
            "💻 Selam kaptan! Kodlamaya hazırım!"
        ];
        
        const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
        
        return {
            type: "dialogue",
            intent: "greeting",
            mood: "friendly",
            approved: true,
            message: randomGreeting,
            reasoning: "Basit bir selamlama - agent çağırmaya gerek yok.",
            skipExecution: true,  // 🔑 ANAHTAR: Execution'ı atla!
            metadata: {
                greeting: true,
                timestamp: Date.now()
            }
        };
    }
    
    /**
     * Fikir üretme ve beyin fırtınası
     * @param {Object} data - Mesaj verisi
     * @param {Object} intentData - Intent analiz sonucu (opsiyonel)
     * @returns {Object} - Brainstorming yanıtı
     */
    brainstorm(data, intentData = null) {
        const { prompt, context } = data;
        
        // 🧠 Use intentData if available
        const skipTools = intentData?.requiresTools === false;
        const isConversational = intentData?.conversational === true;
        const isSimpleChat = intentData?.nature === "simple_chat";
        
        // 🎯 SIMPLE CHAT: "evet", "hayır", "adın ne" gibi basit sohbetler
        if (isSimpleChat) {
            const simpleResponses = {
                "evet": "✅ Anladım! Devam ediyorum...",
                "hayır": "❌ Tamam, iptal ediyorum.",
                "tamam": "👍 Oldu!",
                "olur": "✅ Harika!",
                "adın": "🐉 Ben KayraDeniz, Kod Canavarı!",
                "ismin": "🐉 Benim adım KayraDeniz!",
                "kim": "🐉 Ben KayraDeniz, senin kod yazma asistanınım!",
                "kimsin": "🐉 Ben KayraDeniz! Kod yazmak, proje oluşturmak ve sorunları çözmek için buradayım!",
                "naber": "💪 İyidir! Kod yazmaya hazırım!",
                "nasılsın": "🚀 Harikayım! Ne yapalım bugün?"
            };
            
            const response = Object.keys(simpleResponses).find(key => prompt.toLowerCase().includes(key));
            
            return {
                type: "dialogue",
                intent: "simple_chat",
                mood: "friendly",
                approved: true,
                message: response ? simpleResponses[response] : "💬 Anlıyorum! Başka bir şey söylemek ister misin?",
                reasoning: "Basit sohbet yanıtı - tool gerekmez",
                skipExecution: true,  // 🔑 Simple chat = no tools
                metadata: {
                    simpleChat: true,
                    timestamp: Date.now()
                }
            };
        }
        
        return {
            type: "dialogue",
            intent: "idea",
            mood: "creative",
            approved: true,
            message: isConversational 
                ? `💭 ${prompt} hakkında konuşalım! Ne düşünüyorsun?`
                : `� Düşünüyorum kaptan... "${prompt}" hakkında birkaç fikrim var.`,
            reasoning: intentData?.reasoning || "Bu bir fikir tartışması, risk yok.",
            skipExecution: skipTools,  // 🔑 Tool gerekmeyen sohbetler için
            suggestions: isConversational ? [
                "Daha fazla detay verebilir misin?",
                "Hangi açıdan yaklaşalım?",
                "Başka neler düşündün?"
            ] : [
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
     * @param {Object} intentData - Intent analiz sonucu (opsiyonel)
     * @returns {Object} - Değerlendirme sonucu
     */
    evaluateExecution(data, intentData = null) {
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
     * @param {Object} intentData - Intent analiz sonucu (opsiyonel)
     * @returns {Object} - Refleksiyon sonucu
     */
    selfReflect(data, intentData = null) {
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
     * @param {Object} intentData - Intent analiz sonucu (opsiyonel)
     * @returns {Object} - Açıklama yanıtı
     */
    explore(data, intentData = null) {
        const { prompt } = data;
        
        // 🧠 Use intentData if available
        const skipTools = intentData?.requiresTools === false;
        const nature = intentData?.nature;
        
        // ✅ FIX: Route simple_chat to brainstorm instead!
        if (nature === "simple_chat") {
            return this.brainstorm(data, intentData);
        }
        
        // ✅ FIX: Special message for how-to questions
        const isHowTo = nature === "how_to_question";
        const message = isHowTo
            ? `📝 "${prompt}" hakkında adım adım açıklayayım...\n\n[Sohbet modunda açıklama yapacağım, kod üretmeyeceğim]`
            : `📚 "${prompt}" hakkında bilgi vereyim kaptan...`;
        
        return {
            type: "explanation",
            intent: "exploration",
            mood: "educational",
            approved: true,
            message,
            reasoning: intentData?.reasoning || "Bu bir öğrenme ve keşif isteği.",
            skipExecution: skipTools,  // 🔑 Bilgi soruları tool gerektirmez
            metadata: {
                educationalContent: true,
                tutorialMode: isHowTo,
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
