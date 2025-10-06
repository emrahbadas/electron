/**
 * KayraDeniz Code Agent System
 * Continue.dev/Cline benzeri kod editör agent sistemi
 */

class CodeAgent {
    constructor() {
        this.apiKey = null;
        this.model = 'gpt-3.5-turbo'; // Default model
        this.baseURL = 'https://api.openai.com/v1';
        this.conversationHistory = [];
        this.activeProject = null;
        this.fileContext = new Map();
    }

    /**
     * OpenAI API key ayarla
     * @param {string} apiKey - OpenAI API key
     * @param {string} model - Model name (gpt-3.5-turbo, gpt-4, etc.)
     */
    setAPIKey(apiKey, model = 'gpt-3.5-turbo') {
        this.apiKey = apiKey;
        this.model = model;
        console.log(`Code Agent API key set with model: ${model}`);
    }

    /**
     * Aktif projeyi ayarla
     * @param {string} projectPath - Project directory path
     */
    setActiveProject(projectPath) {
        this.activeProject = projectPath;
        console.log(`Active project set: ${projectPath}`);
    }

    /**
     * Dosya context'ini güncelle
     * @param {string} filePath - File path
     * @param {string} content - File content
     */
    updateFileContext(filePath, content) {
        this.fileContext.set(filePath, {
            content,
            lastModified: Date.now(),
            lines: content.split('\n').length
        });
    }

    /**
     * OpenAI API'ye istek gönder
     * @param {string} prompt - User prompt
     * @param {object} options - Request options
     * @returns {Promise<string>} AI response
     */
    async callAI(prompt, options = {}) {
        if (!this.apiKey) {
            throw new Error('OpenAI API key not set! Use setAPIKey() first.');
        }

        const systemPrompt = `You are KayraDeniz Code Agent, an advanced AI coding assistant similar to Continue.dev and Cline. You can:

1. 📝 **Code Analysis**: Analyze code files, understand structure, find bugs
2. 🛠️ **Code Generation**: Write new functions, classes, components
3. ♻️ **Refactoring**: Improve code quality, restructure code
4. 🐛 **Debugging**: Find and fix bugs, suggest solutions
5. 📚 **Documentation**: Generate comments, README files
6. 🎯 **Optimization**: Improve performance, suggest best practices
7. 🔍 **Code Review**: Review code quality, suggest improvements

Current project: ${this.activeProject || 'Not set'}
Available files in context: ${Array.from(this.fileContext.keys()).join(', ')}

Always provide actionable, specific suggestions with code examples.
When suggesting changes, provide both the original and modified code.
Use Turkish for explanations but keep code comments in English.`;

        const messages = [
            { role: 'system', content: systemPrompt },
            ...this.conversationHistory.slice(-5), // Son 5 mesaj
            { role: 'user', content: prompt }
        ];

        try {
            const response = await fetch(`${this.baseURL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: this.model,
                    messages,
                    max_tokens: options.maxTokens || 2000,
                    temperature: options.temperature || 0.7,
                    stream: false
                })
            });

            if (!response.ok) {
                throw new Error(`OpenAI API error: ${response.status} - ${response.statusText}`);
            }

            const data = await response.json();
            const aiResponse = data.choices[0].message.content;

            // Konuşma geçmişini güncelle
            this.conversationHistory.push(
                { role: 'user', content: prompt },
                { role: 'assistant', content: aiResponse }
            );

            // Geçmişi sınırla (son 20 mesaj)
            if (this.conversationHistory.length > 20) {
                this.conversationHistory = this.conversationHistory.slice(-20);
            }

            return aiResponse;
        } catch (error) {
            console.error('AI API call failed:', error);
            throw error;
        }
    }

    /**
     * Kod dosyasını analiz et
     * @param {string} filePath - File path
     * @param {string} content - File content
     * @returns {Promise<object>} Analysis result
     */
    async analyzeCode(filePath, content) {
        this.updateFileContext(filePath, content);

        const prompt = `Lütfen bu kod dosyasını analiz et:

**Dosya:** ${filePath}

\`\`\`
${content}
\`\`\`

Analiz et:
1. 🔍 Kod kalitesi ve structure
2. 🐛 Potansiyel buglar veya problemler
3. ⚡ Performans iyileştirme önerileri
4. 📝 Eksik dokümantasyon
5. 🎯 Best practice önerileri
6. ♻️ Refactoring fırsatları

Türkçe açıklama yap ama kod örnekleri İngilizce olsun.`;

        try {
            const analysis = await this.callAI(prompt);
            
            return {
                success: true,
                filePath,
                analysis,
                timestamp: Date.now(),
                suggestions: this.extractSuggestions(analysis)
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                filePath
            };
        }
    }

    /**
     * Kod düzenleme yap
     * @param {string} filePath - File path
     * @param {string} content - Current content
     * @param {string} instruction - Edit instruction
     * @returns {Promise<object>} Edit result
     */
    async editCode(filePath, content, instruction) {
        this.updateFileContext(filePath, content);

        const prompt = `Bu kod dosyasını düzenle:

**Dosya:** ${filePath}
**İstek:** ${instruction}

**Mevcut Kod:**
\`\`\`
${content}
\`\`\`

Lütfen:
1. 🎯 İsteği tam olarak yerine getir
2. 📝 Değişiklikleri açıkla
3. 🔄 Düzenlenmiş kodu ver
4. ⚠️ Dikkat edilmesi gereken noktaları belirt
5. ✅ Test önerileri sun

Yanıtını şu formatta ver:
## 📝 Değişiklik Açıklaması
[Açıklama]

## 🔄 Düzenlenmiş Kod
\`\`\`
[Yeni kod]
\`\`\`

## ⚠️ Dikkat Noktaları
[Uyarılar]

## ✅ Test Önerileri
[Test önerileri]`;

        try {
            const editResult = await this.callAI(prompt);
            
            return {
                success: true,
                filePath,
                originalContent: content,
                editResult,
                timestamp: Date.now(),
                newContent: this.extractCodeFromResponse(editResult)
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                filePath
            };
        }
    }

    /**
     * Yeni kod generate et
     * @param {string} description - Code description
     * @param {string} language - Programming language
     * @param {string} framework - Framework (optional)
     * @returns {Promise<object>} Generated code
     */
    async generateCode(description, language, framework = null) {
        const frameworkText = framework ? ` (${framework} framework)` : '';
        
        const prompt = `${language}${frameworkText} dilinde kod yaz:

**İstek:** ${description}

Lütfen:
1. 🎯 Temiz, okunabilir kod yaz
2. 📝 Açıklayıcı comment'ler ekle
3. 🔒 Error handling ekle
4. 📚 Kullanım örneği ver
5. 🎨 Best practices uygula

Yanıtını şu formatta ver:
## 📝 Açıklama
[Kodun ne yaptığı]

## 🔄 Generated Kod
\`\`\`${language}
[Kod]
\`\`\`

## 📚 Kullanım Örneği
\`\`\`${language}
[Örnek kullanım]
\`\`\`

## 💡 Öneriler
[Ek öneriler]`;

        try {
            const generatedCode = await this.callAI(prompt);
            
            return {
                success: true,
                description,
                language,
                framework,
                generatedCode,
                timestamp: Date.now(),
                code: this.extractCodeFromResponse(generatedCode)
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Bug fix önerisi
     * @param {string} filePath - File path
     * @param {string} content - File content
     * @param {string} bugDescription - Bug description
     * @returns {Promise<object>} Bug fix suggestion
     */
    async fixBug(filePath, content, bugDescription) {
        this.updateFileContext(filePath, content);

        const prompt = `Bu kod dosyasındaki bug'ı düzelt:

**Dosya:** ${filePath}
**Bug Açıklaması:** ${bugDescription}

**Kod:**
\`\`\`
${content}
\`\`\`

Lütfen:
1. 🐛 Bug'ın nedenini analiz et
2. 🔧 Düzeltme önerisi sun
3. 🔄 Düzeltilmiş kodu ver
4. ✅ Test önerisi yap
5. 🛡️ Benzer bugları önleme önerileri ver

Yanıtını şu formatta ver:
## 🐛 Bug Analizi
[Sorunun nedeni]

## 🔧 Çözüm
[Çözüm açıklaması]

## 🔄 Düzeltilmiş Kod
\`\`\`
[Düzeltilmiş kod]
\`\`\`

## ✅ Test Önerisi
[Test kodları]

## 🛡️ Önleme Önerileri
[Gelecekte bu tür bugları önleme]`;

        try {
            const bugFix = await this.callAI(prompt);
            
            return {
                success: true,
                filePath,
                bugDescription,
                originalContent: content,
                bugFix,
                timestamp: Date.now(),
                fixedContent: this.extractCodeFromResponse(bugFix)
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                filePath
            };
        }
    }

    /**
     * Kod review yap
     * @param {string} filePath - File path
     * @param {string} content - File content
     * @returns {Promise<object>} Code review
     */
    async reviewCode(filePath, content) {
        this.updateFileContext(filePath, content);

        const prompt = `Bu kodu review et:

**Dosya:** ${filePath}

\`\`\`
${content}
\`\`\`

Code review kriterleri:
1. 📊 Kod kalitesi (1-10 puan)
2. 🔒 Güvenlik açıkları
3. ⚡ Performans değerlendirmesi
4. 📝 Dokümantasyon yeterliliği
5. 🎯 Best practices compliance
6. ♻️ Refactoring önerileri
7. 🧪 Test edilebilirlik

Yanıtını şu formatta ver:
## 📊 Genel Değerlendirme
**Puan:** [1-10]/10
**Özet:** [Genel görüş]

## ✅ İyi Yanlar
[Pozitif noktalar]

## ⚠️ İyileştirme Alanları
[Problemler ve öneriler]

## 🔒 Güvenlik
[Güvenlik değerlendirmesi]

## ⚡ Performans
[Performans önerileri]

## 💡 Refactoring Önerileri
[Konkret öneriler]`;

        try {
            const review = await this.callAI(prompt);
            
            return {
                success: true,
                filePath,
                review,
                timestamp: Date.now(),
                score: this.extractScoreFromResponse(review)
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                filePath
            };
        }
    }

    /**
     * Proje dokümantasyonu oluştur
     * @param {Array} files - File list with content
     * @param {string} projectName - Project name
     * @returns {Promise<object>} Documentation
     */
    async generateDocumentation(files, projectName) {
        const fileList = files.map(f => `- ${f.path} (${f.content.split('\n').length} lines)`).join('\n');
        
        const prompt = `Bu proje için kapsamlı dokümantasyon oluştur:

**Proje:** ${projectName}

**Dosyalar:**
${fileList}

**Analizlenecek Dosya İçerikleri:**
${files.map(f => `
### ${f.path}
\`\`\`
${f.content.substring(0, 1000)}${f.content.length > 1000 ? '...' : ''}
\`\`\`
`).join('\n')}

Lütfen şu dokümantasyonu oluştur:
1. 📋 Proje Overview
2. 🏗️ Architecture açıklaması
3. 📁 Dosya yapısı
4. ⚙️ Setup/Installation
5. 🚀 Usage examples
6. 🔧 API documentation
7. 🧪 Testing
8. 🤝 Contributing guidelines

README.md formatında markdown olarak ver.`;

        try {
            const documentation = await this.callAI(prompt, { maxTokens: 3000 });
            
            return {
                success: true,
                projectName,
                documentation,
                timestamp: Date.now(),
                files: files.map(f => f.path)
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Konuşma geçmişini temizle
     */
    clearHistory() {
        this.conversationHistory = [];
        console.log('Conversation history cleared');
    }

    /**
     * File context'i temizle
     */
    clearFileContext() {
        this.fileContext.clear();
        console.log('File context cleared');
    }

    /**
     * Agent durumunu al
     * @returns {object} Agent status
     */
    getStatus() {
        return {
            apiKeySet: !!this.apiKey,
            model: this.model,
            activeProject: this.activeProject,
            conversationLength: this.conversationHistory.length,
            filesInContext: this.fileContext.size,
            lastActivity: this.conversationHistory.length > 0 ? 
                this.conversationHistory[this.conversationHistory.length - 1] : null
        };
    }

    // === Helper Methods ===

    /**
     * Response'dan önerileri çıkar
     * @param {string} response - AI response
     * @returns {Array} Suggestions
     */
    extractSuggestions(response) {
        const suggestions = [];
        const lines = response.split('\n');
        
        for (const line of lines) {
            if (line.includes('öneri') || line.includes('suggest') || line.includes('💡')) {
                suggestions.push(line.trim());
            }
        }
        
        return suggestions;
    }

    /**
     * Response'dan kod çıkar
     * @param {string} response - AI response
     * @returns {string} Extracted code
     */
    extractCodeFromResponse(response) {
        const codeBlocks = response.match(/```[\s\S]*?```/g);
        if (codeBlocks && codeBlocks.length > 0) {
            // En büyük kod bloğunu al
            const largestBlock = codeBlocks.reduce((a, b) => a.length > b.length ? a : b);
            return largestBlock.replace(/```[\w]*\n?/g, '').replace(/```$/g, '').trim();
        }
        return '';
    }

    /**
     * Response'dan score çıkar
     * @param {string} response - AI response
     * @returns {number} Score
     */
    extractScoreFromResponse(response) {
        const scoreMatch = response.match(/(\d+)\/10/);
        return scoreMatch ? parseInt(scoreMatch[1]) : 0;
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CodeAgent;
}

// Global access
if (typeof window !== 'undefined') {
    window.CodeAgent = CodeAgent;
}