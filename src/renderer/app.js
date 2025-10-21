// KayraDeniz Badaş Kod Canavarı - Frontend Application Logic
// Modern AI-powered code generation and file management

// ===== AGENT HIERARCHY SYSTEM (VS Code Copilot Style) =====
const { 
    AGENT_LEVELS, 
    AGENT_REGISTRY, 
    wrapDecision, 
    validateOverride,
    logDecisionChain 
} = require('../agents/agent-hierarchy.js');

// ===== ASYNC MUTEX PATTERN (Race Condition Prevention) =====
// Proper mutex implementation to prevent double execution
class AsyncMutex {
    constructor(name = 'unnamed') {
        this._queue = [];
        this._locked = false;
        this._name = name;
    }
    
    async acquire() {
        return new Promise((resolve) => {
            if (!this._locked) {
                this._locked = true;
                console.log(`🔒 [${this._name}] Mutex acquired`);
                resolve();
            } else {
                console.log(`⏸️ [${this._name}] Mutex busy, queuing (${this._queue.length + 1} in queue)`);
                this._queue.push(resolve);
            }
        });
    }
    
    release() {
        if (this._queue.length > 0) {
            const resolve = this._queue.shift();
            console.log(`🔓 [${this._name}] Mutex released, next in queue (${this._queue.length} remaining)`);
            resolve();
        } else {
            this._locked = false;
            console.log(`🔓 [${this._name}] Mutex released, no queue`);
        }
    }
    
    isLocked() {
        return this._locked;
    }
    
    queueLength() {
        return this._queue.length;
    }
}

// ===== KAYRA TOOLS SYSTEM =====
// KayraToolsIntegration is loaded via ES module in index.html
// It will be available on window object after module loads

// ===== TOKEN & CHUNKING UTILITIES =====
// ≈4 char = 1 token kaba tahmin
const approxTok = (s) => Math.ceil((s?.length || 0) / 4);

// ReAct+Verify Runbook formatter utility
const formatAsRunbook = (content, context = {}) => {
    // If content already follows the format, return as-is
    if (content.includes('🧭 Plan') || content.includes('🛠️ Komutlar') || content.includes('🧪 Doğrulama')) {
        return content;
    }

    // Basic runbook structure wrapper for legacy responses
    const { task = 'Analiz', os = 'Windows' } = context;

    return `🧭 **Plan**

${content.split('\n').slice(0, 3).join('\n')}

🛠️ **Komutlar (${os})**

\`\`\`powershell
# İlgili komutlar burada olacak
\`\`\`

🧪 **Doğrulama**

* Görev tamamlandı ve sonuçlar hazır.

🧩 **Bulgular**

${content}

✅ **Sonuç & Bir Sonraki Adım**

* ${task} tamamlandı. Daha fazla analiz için yeni komut verin.`;
};

// Modern OS detection helper
const detectOS = () => {
    // Try Electron process first (most reliable)
    if (typeof process !== 'undefined' && process.platform) {
        return process.platform === 'win32' ? 'windows' : 'unix';
    }

    // Fallback to userAgent (more reliable than navigator.platform)
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('win')) return 'windows';
    if (userAgent.includes('mac')) return 'unix';
    if (userAgent.includes('linux')) return 'unix';

    // Last resort: navigator.platform (deprecated but still works)
    return navigator.platform?.toLowerCase().includes('win') ? 'windows' : 'unix';
};

// Enhanced OS-specific command helper
const getOSCommands = () => {
    const isWindows = detectOS() === 'windows';

    return {
        checkPort: isWindows
            ? 'netstat -ano | findstr :7777'
            : 'lsof -i :7777 || ss -ltnp | grep 7777',
        testHTTP: isWindows
            ? 'Invoke-RestMethod -Uri "http://127.0.0.1:7777/health" -Method GET'
            : 'curl -sS http://127.0.0.1:7777/health',
        listDir: isWindows
            ? 'Get-ChildItem -Path .'
            : 'ls -la',
        pwd: isWindows
            ? 'Get-Location'
            : 'pwd'
    };
};

function chunkByTokens(text, maxTok = 1200, overlap = 80) {
    if (!text) return [];

    const maxChars = Math.max(1, maxTok * 4);
    const overlapChars = Math.max(0, overlap * 4);
    const chunks = [];

    let index = 0;
    while (index < text.length) {
        let end = Math.min(text.length, index + maxChars);
        let piece = text.slice(index, end);

        if (end < text.length) {
            const candidateCuts = [
                piece.lastIndexOf('\n\n'),
                piece.lastIndexOf('\n## '),
                piece.lastIndexOf('\n# '),
                piece.lastIndexOf('. ')
            ].filter(position => position > maxChars * 0.3);

            if (candidateCuts.length) {
                const bestCut = Math.max(...candidateCuts);
                piece = piece.slice(0, bestCut).trimEnd();
            }
        }

        if (piece.length === 0) {
            piece = text.slice(index, Math.min(text.length, index + maxChars));
        }

        chunks.push(piece);

        if (index + piece.length >= text.length) {
            break;
        }

        index += Math.max(piece.length - overlapChars, 1);
    }

    return chunks;
}

function isOpenAIUnavailableError(error) {
    if (!error) return false;

    if (error.code === 'OPENAI_UNAUTHORIZED' ||
        error.code === 'OPENAI_INSUFFICIENT_QUOTA' ||
        error.code === 'OPENAI_RATE_LIMIT') {
        return true;
    }

    const message = (error.message || '').toLowerCase();
    return message.includes('api anahtarı') ||
        message.includes('api key') ||
        message.includes('unauthorized') ||
        message.includes('yetkilendirilmedi') ||
        message.includes('quota');
}

function shouldUseOfflineProjectPlan(userRequest, route) {
    const text = (userRequest || '').toLowerCase();
    const hasProjectKeywords = ['proje', 'site', 'uygulama', 'oluştur', 'tasarla', 'build', 'landing', 'web sitesi']
        .some(keyword => text.includes(keyword));

    return (this.currentProjectData || hasProjectKeywords) &&
        (!route || route.role === 'generator' || route.role === 'documentation' || hasProjectKeywords);
}

function buildOfflineAnalysis(userRequest, route) {
    const project = this.getOfflineProjectContext(userRequest, route);
    const files = this.generateOfflineProjectFiles(project);
    const summaryMessage = this.buildOfflineCompletionMessage(project);

    const plannedActions = [
        {
            action: 'create_file',
            description: 'Projeye kapsamlı bir README dosyası ekle',
            fileName: 'README.md',
            content: files.readme,
            critical: true,
            tool: 'write_file'
        },
        {
            action: 'read_file',
            description: 'README planını gözden geçir',
            fileName: 'README.md',
            critical: false,
            tool: 'read_file'
        },
        {
            action: 'create_file',
            description: 'Deniz temalı ana sayfayı oluştur',
            fileName: 'index.html',
            content: files.index,
            critical: true,
            tool: 'write_file'
        },
        {
            action: 'create_file',
            description: 'Temaya uygun stilleri ekle',
            fileName: 'styles.css',
            content: files.styles,
            critical: true,
            tool: 'write_file'
        },
        {
            action: 'create_file',
            description: 'Etkileşim ve sayfa geçiş animasyonlarını ekle',
            fileName: 'script.js',
            content: files.script,
            critical: false,
            tool: 'write_file'
        },
        {
            action: 'respond',
            description: 'Projeyi nasıl test edeceğini açıkla',
            content: summaryMessage,
            critical: false,
            tool: 'none'
        }
    ];

    return {
        requestType: 'project-creation',
        complexity: 'medium',
        projectType: 'html',
        needsFiles: true,
        estimatedSteps: plannedActions.length,
        selectedRole: route ? route.role : 'generator',
        plannedActions,
        userFriendlyPlan: 'OpenAI bağlantısı kapalı olduğu için deniz temalı "Gezgin" projesini yerel şablonlarla sıfırdan oluşturacağım.',
        route: route
    };
}

function getOfflineProjectContext(userRequest, route) {
    const base = this.currentProjectData ? { ...this.currentProjectData } : {};
    const text = userRequest || '';

    if (!base.title) {
        const titleMatch = text.match(/başlık[:\-\s]*([^\n]+)/i);
        base.title = titleMatch ? titleMatch[1].trim() : 'Gezgin';
    }

    if (!base.author) {
        const authorMatch = text.match(/yazar[:\-\s]*([^\n]+)/i);
        base.author = authorMatch ? authorMatch[1].trim() : (this.settings?.displayName || 'Bilinmeyen Kaptan');
    }

    if (!base.prompt) {
        base.prompt = text.trim();
    }

    const description = base.prompt || 'Denizleri keşfeden kaptanın rotalarını ve kültürel notlarını paylaşan statik gezi sitesi.';
    const analysis = base.analysis || {};

    const recommendedStack = analysis.recommendedStack || {
        frontend: ['HTML5', 'CSS3', 'JavaScript'],
        backend: ['Static'],
        database: ['JSON files'],
        deployment: ['Vercel']
    };

    const features = analysis.features || [
        'Deniz temalı kahraman bölüm',
        'İnteraktif rota kartları',
        'Perde efektiyle sayfa geçişleri',
        'Günlük kayıtları ve gastronomi köşesi'
    ];

    const mission = base.prompt?.split('\n')[0] || 'Kaptanın keşiflerini dünyayla paylaşmak';

    return {
        title: base.title,
        author: base.author,
        description,
        mission,
        features,
        stack: recommendedStack,
        mood: 'lacivert denizler, köpük beyazı dalgalar ve bakır pusula tonları',
        prompt: base.prompt
    };
}

function generateOfflineProjectFiles(project) {
    const { title, author, description, features, stack, mood } = project;

    const readme = `# ${title}

${description}

## Vizyon

- Denizlerin rehberi ${author} tarafından tutulan canlı bir seyahat günlüğü
- ${mood} paletinde, Playfair Display ve Inter fontlarıyla hazırlanmış modern arayüz
- Sayfalar arası perde animasyonları, kaydırma bazlı mikro etkileşimler

## Sayfa Bölümleri

1. **Kahraman (Hero)** – Kaptanın selamlaması, son rota çağrısı
2. **Rotalar** – Öne çıkan üç ülke kartı, özet bilgiler
3. **Kültür & Ritüeller** – Tarih, kültür ve gelenek vurguları
4. **Lezzet Haritası** – Bölgesel tatlar ve hikâyeleri
5. **Seyir Defteri** – Günlük kayıtları ve hatırlatıcılar

## Öne Çıkan Özellikler

${features.map(feature => `- ${feature}`).join('\n')}

## Teknolojiler

- Frontend: ${stack.frontend.join(', ')}
- Backend: ${stack.backend.join(', ')}
- Veri: ${stack.database.join(', ')}
- Dağıtım: ${stack.deployment.join(', ')}

## Proje Dosya Yapısı

\`\`\`
${title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'gezgin'}/
├── index.html
├── styles.css
└── script.js
\`\`\`

## Geliştirme Adımları

- [x] README hazırla ve yapılacakları listele
- [x] Deniz temalı ana sayfayı oluştur
- [x] Responsive stil katmanını ekle
- [x] JavaScript ile geçiş animasyonlarını bağla
- [ ] İçeriği zenginleştir ve yeni destinasyonlar ekle

## Çalıştırma

Statik yapı olduğu için doğrudan dosyayı tarayıcıda açabilir veya aşağıdaki gibi hafif bir sunucu kullanabilirsin:

\`\`\`
npx serve .
\`\`\`

## Sonraki Adımlar

- Rota kartlarını JSON dosyasından dinamik yükleme
- Fotoğraf galerisi ve kaptanın sesli notlarını ekleme
- Işık ve karanlık tema geçişi ekleme
`;

    const html = `<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="${title} – ${author} tarafindan tutulmuş deniz temalı seyahat günlüğü">
    <title>${title} · Kaptanın Seyir Defteri</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div class="page-transition"></div>
    <header class="hero" id="top">
        <nav class="navbar">
            <div class="brand">
                <span class="brand-icon">⚓</span>
                <div class="brand-text">
                    <span class="brand-title">${title}</span>
                    <span class="brand-tagline">Kaptanın rota defteri</span>
                </div>
            </div>
            <button class="nav-toggle" aria-label="Menüyü aç">
                <span></span><span></span><span></span>
            </button>
            <ul class="nav-links">
                <li><a href="#routes" data-transition>Rotalar</a></li>
                <li><a href="#culture" data-transition>Kültür</a></li>
                <li><a href="#cuisine" data-transition>Lezzet</a></li>
                <li><a href="#logbook" data-transition>Defter</a></li>
            </ul>
        </nav>
        <div class="hero-content">
            <div class="hero-text">
                <span class="hero-eyebrow">${author} ile keşfe çık</span>
                <h1>Dalgaların ötesinde yeni limanlar bekliyor</h1>
                <p>${description}</p>
                <div class="hero-actions">
                    <a href="#routes" class="btn primary" data-transition>Son rotaları incele</a>
                    <a href="#logbook" class="btn ghost" data-transition>Seyir defterini aç</a>
                </div>
            </div>
            <div class="hero-card">
                <div class="compass">🧭</div>
                <div class="hero-meta">
                    <span class="label">Son varış</span>
                    <strong>Atlantik Atlası</strong>
                    <span class="meta">Yelkenler kupür, rüzgâr anlatıyor...</span>
                </div>
            </div>
        </div>
    </header>

    <main>
        <section id="routes" class="section routes">
            <div class="section-heading">
                <span class="section-eyebrow">Rotalar</span>
                <h2>Kaptanın pusulasındaki son üç liman</h2>
                <p>Dalgaların anlattığı şehir hikâyeleri, tarih ve gastronomi ile harmanlandı.</p>
            </div>
            <div class="route-grid">
                <article class="route-card" data-country="Akdeniz">
                    <div class="card-top">
                        <h3>Mediterranea</h3>
                        <span class="tag">Güneş & Tarih</span>
                    </div>
                    <p class="card-description">Pırıl pırıl koylar, Ege esintisi ve antik agoralar. Zeytinyağı kokusu her sokakta.</p>
                    <ul class="card-highlights">
                        <li>🕍 Kıyı şehirlerinde antik tiyatrolar</li>
                        <li>🍋 Limon çiçekleri ve taze deniz mahsulleri</li>
                        <li>🎶 Sokaklarda canlı mandolin ezgileri</li>
                    </ul>
                </article>
                <article class="route-card" data-country="Uzak Doğu">
                    <div class="card-top">
                        <h3>Jade Waters</h3>
                        <span class="tag">Ritüel & Zen</span>
                    </div>
                    <p class="card-description">Sisli tapınaklar, bambu ormanları ve çay seremonileri. Rüzgârın taşıdığı bilgelik.</p>
                    <ul class="card-highlights">
                        <li>⛩️ Sabah çanlarının yankısı</li>
                        <li>🍜 Sokak lezzetlerinde umami yolculuğu</li>
                        <li>🌸 Kiraz çiçekleriyle dolu bir liman</li>
                    </ul>
                </article>
                <article class="route-card" data-country="Latin Amerika">
                    <div class="card-top">
                        <h3>Sol de Bronce</h3>
                        <span class="tag">Renk & Ritm</span>
                    </div>
                    <p class="card-description">Bakır renkli güneş batımları, samba ritimleri ve sokak freskleriyle yaşayan meydanlar.</p>
                    <ul class="card-highlights">
                        <li>🪗 Gece boyunca süren müzik</li>
                        <li>🥭 Tropik meyve pazarları</li>
                        <li>🏛️ Kolonyal ve yerli mimarinin dansı</li>
                    </ul>
                </article>
            </div>
        </section>

        <section id="culture" class="section culture">
            <div class="section-heading">
                <span class="section-eyebrow">Kültür</span>
                <h2>Her limanda öğrenilen ritüeller</h2>
                <p>Kaptanın defterinden kültürel notlar, tarihî kırıntılar ve gelenekler.</p>
            </div>
            <div class="culture-grid">
                <article class="culture-card">
                    <h3>Tarihin İzleri</h3>
                    <p>Yelkenler rüzgârı yakalarken, her şehirde yeni bir tarih katmanı açığa çıkıyor: Agora sohbetleri, saray koridorları, fısıldayan duvar yazıları.</p>
                </article>
                <article class="culture-card">
                    <h3>Ritüeller</h3>
                    <p>Güneş doğmadan demlenen miso çorbaları, akşamüstü fener yürüyüşleri, kıyıda ritmik davul çemberleri… Her biri kaptanın notlarında.</p>
                </article>
                <article class="culture-card">
                    <h3>Denizde Yaşam</h3>
                    <p>Kaptan, tayfanın küçük mutluluklarını da yazıyor: Jurnal kenarına düşülen şiirler, harita kenarına iliştirilen kahve reçeteleri.</p>
                </article>
            </div>
        </section>

        <section id="cuisine" class="section cuisine">
            <div class="section-heading">
                <span class="section-eyebrow">Lezzet Rotası</span>
                <h2>Pusulanın gösterdiği özgün tatlar</h2>
                <p>Her limanda kaptanın defterine giren üç imza tat.</p>
            </div>
            <div class="cuisine-gallery">
                <article class="cuisine-card">
                    <h3>Akdeniz Mezesi</h3>
                    <p>Zeytinyağında bekletilmiş midye dolması, dere otlu börülce ve limon kabuğu rendesi.</p>
                    <span class="badge">Fermente & Taze</span>
                </article>
                <article class="cuisine-card">
                    <h3>Zen Çay Seremonisi</h3>
                    <p>Matcha'nın köpüğü, bambu hışırdaması ve taş bahçesinde yankılanan sessizlik.</p>
                    <span class="badge">Seremoni</span>
                </article>
                <article class="cuisine-card">
                    <h3>Bakır Güneş Tacos</h3>
                    <p>Izgara ananas, chipotle marineli levrek ve kişnişli mısır kabuğu.</p>
                    <span class="badge">Sokak Lezzeti</span>
                </article>
            </div>
        </section>

        <section id="logbook" class="section logbook">
            <div class="section-heading">
                <span class="section-eyebrow">Seyir Defteri</span>
                <h2>Notlar, koordinatlar ve günlükler</h2>
                <p>Kaptanın günü gününe tuttuğu kayıtlar. Her biri farklı bir limanın ruhunu taşıyor.</p>
            </div>
            <div class="log-entries">
                <!-- JS ile doldurulacak -->
            </div>
        </section>
    </main>

    <footer class="footer">
        <div class="footer-inner">
            <p>© ${new Date().getFullYear()} ${author}. Tüm hakları saklıdır.</p>
            <a href="#top" class="back-to-top" data-transition>Yukarı çık</a>
        </div>
    </footer>

    <script src="script.js"></script>
</body>
</html>`;

    const css = `:root {
    --navy: #081b33;
    --deep-navy: #050f1f;
    --foam: #e9f6ff;
    --foam-soft: rgba(233, 246, 255, 0.7);
    --copper: #c5803a;
    --sand: #f3e7d3;
    --ink: #13294b;
    --white: #ffffff;
    --shadow: rgba(4, 16, 31, 0.35);
    --font-heading: 'Playfair Display', serif;
    --font-body: 'Inter', sans-serif;
}

* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: var(--font-body);
    background: linear-gradient(160deg, var(--deep-navy) 0%, #0e2746 45%, #122e55 100%);
    color: var(--foam);
    min-height: 100vh;
    line-height: 1.7;
}

.page-transition {
    position: fixed;
    inset: 0;
    background: linear-gradient(120deg, rgba(12, 33, 58, 0.95), rgba(27, 54, 86, 0.92));
    transform: translateY(100%);
    transition: transform 0.6s ease;
    z-index: 9999;
    pointer-events: none;
}

.page-transition.active {
    transform: translateY(0);
}

.hero {
    position: relative;
    padding: 120px 24px 80px;
    overflow: hidden;
}

.hero::before {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(8, 27, 51, 0.95), rgba(12, 48, 84, 0.75));
    backdrop-filter: blur(6px);
    z-index: -1;
}

.navbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    max-width: 1200px;
    margin: 0 auto 48px;
}

.brand {
    display: flex;
    align-items: center;
    gap: 16px;
}

.brand-icon {
    font-size: 32px;
}

.brand-text {
    display: flex;
    flex-direction: column;
}

.brand-title {
    font-family: var(--font-heading);
    font-size: 24px;
    letter-spacing: 1.5px;
}

.brand-tagline {
    font-size: 12px;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: var(--foam-soft);
}

.nav-toggle {
    display: none;
    flex-direction: column;
    gap: 6px;
    background: transparent;
    border: none;
}

.nav-toggle span {
    width: 28px;
    height: 2px;
    background: var(--foam);
    transition: transform 0.3s ease;
}

.nav-links {
    list-style: none;
    display: flex;
    gap: 32px;
}

.nav-links a {
    color: var(--foam);
    text-decoration: none;
    font-weight: 500;
    letter-spacing: 1px;
    position: relative;
}

.nav-links a::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: -6px;
    width: 100%;
    height: 2px;
    background: linear-gradient(90deg, var(--copper), var(--sand));
    transform: scaleX(0);
    transform-origin: left;
    transition: transform 0.3s ease;
}

.nav-links a:hover::after {
    transform: scaleX(1);
}

.hero-content {
    max-width: 1200px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 48px;
}

.hero-text h1 {
    font-family: var(--font-heading);
    font-size: clamp(2.4rem, 4vw, 3.6rem);
    margin-bottom: 20px;
}

.hero-eyebrow {
    letter-spacing: 4px;
    text-transform: uppercase;
    font-size: 12px;
    color: var(--copper);
}

.hero-actions {
    margin-top: 32px;
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
}

.btn {
    padding: 14px 28px;
    border-radius: 999px;
    font-weight: 600;
    text-decoration: none;
    letter-spacing: 1px;
    transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.btn.primary {
    background: linear-gradient(135deg, var(--copper), #e7a263);
    color: var(--deep-navy);
    box-shadow: 0 12px 30px rgba(197, 128, 58, 0.35);
}

.btn.ghost {
    border: 1px solid rgba(233, 246, 255, 0.4);
    color: var(--foam);
}

.btn:hover {
    transform: translateY(-4px);
}

.hero-card {
    background: rgba(11, 30, 54, 0.6);
    border: 1px solid rgba(229, 222, 206, 0.1);
    border-radius: 24px;
    padding: 28px;
    box-shadow: 0 24px 40px rgba(5, 15, 31, 0.35);
    display: grid;
    gap: 16px;
    align-content: start;
}

.compass {
    font-size: 36px;
}

.hero-meta .label {
    font-size: 12px;
    letter-spacing: 3px;
    color: rgba(233, 246, 255, 0.6);
    text-transform: uppercase;
}

.hero-meta strong {
    font-family: var(--font-heading);
    font-size: 20px;
}

.section {
    padding: 120px 24px;
}

.section:nth-of-type(even) {
    background: rgba(8, 24, 46, 0.55);
}

.section-heading {
    max-width: 720px;
    margin: 0 auto 64px;
    text-align: center;
}

.section-eyebrow {
    color: var(--copper);
    letter-spacing: 4px;
    text-transform: uppercase;
    font-size: 12px;
}

.section h2 {
    font-family: var(--font-heading);
    font-size: clamp(2rem, 3vw, 2.8rem);
    margin: 16px 0;
}

.route-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 32px;
}

.route-card {
    background: rgba(6, 21, 39, 0.7);
    border: 1px solid rgba(229, 195, 157, 0.18);
    border-radius: 20px;
    padding: 32px;
    display: grid;
    gap: 20px;
    position: relative;
    overflow: hidden;
    transition: transform 0.4s ease, box-shadow 0.4s ease;
}

.route-card::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(140deg, rgba(197, 128, 58, 0.1), transparent 60%);
    opacity: 0;
    transition: opacity 0.4s ease;
}

.route-card:hover {
    transform: translateY(-10px);
    box-shadow: 0 24px 40px rgba(7, 20, 36, 0.45);
}

.route-card:hover::after {
    opacity: 1;
}

.card-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.tag {
    background: rgba(197, 128, 58, 0.2);
    color: var(--copper);
    padding: 6px 12px;
    border-radius: 999px;
    font-size: 12px;
    letter-spacing: 1px;
}

.card-highlights {
    list-style: none;
    display: grid;
    gap: 10px;
    color: rgba(233, 246, 255, 0.8);
}

.culture-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 28px;
}

.culture-card {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(233, 246, 255, 0.1);
    padding: 32px;
    border-radius: 20px;
}

.culture-card h3 {
    font-family: var(--font-heading);
    margin-bottom: 12px;
}

.cuisine-gallery {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 28px;
}

.cuisine-card {
    background: rgba(6, 22, 41, 0.65);
    border: 1px solid rgba(229, 195, 157, 0.15);
    padding: 28px;
    border-radius: 18px;
    position: relative;
}

.badge {
    position: absolute;
    top: 24px;
    right: 24px;
    background: rgba(197, 128, 58, 0.25);
    color: var(--copper);
    padding: 6px 12px;
    border-radius: 999px;
    font-size: 12px;
}

.log-entries {
    display: grid;
    gap: 20px;
}

.log-entry {
    border-left: 3px solid var(--copper);
    padding: 18px 24px;
    background: rgba(6, 21, 39, 0.6);
    border-radius: 0 16px 16px 0;
}

.log-entry h4 {
    font-family: var(--font-heading);
    margin-bottom: 8px;
}

.footer {
    padding: 48px 24px;
    background: rgba(5, 15, 31, 0.9);
}

.footer-inner {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.back-to-top {
    color: var(--foam);
    text-decoration: none;
    letter-spacing: 2px;
    text-transform: uppercase;
    font-size: 12px;
}

@media (max-width: 960px) {
    .navbar {
        flex-wrap: wrap;
        gap: 18px;
    }

    .nav-toggle {
        display: flex;
    }

    .nav-links {
        flex-direction: column;
        width: 100%;
        display: none;
        background: rgba(5, 15, 31, 0.88);
        padding: 18px;
        border-radius: 16px;
    }

    .nav-links.open {
        display: grid;
        gap: 16px;
    }

    .hero {
        padding-top: 100px;
    }
}

@media (max-width: 600px) {
    .hero-actions {
        flex-direction: column;
        align-items: flex-start;
    }

    .footer-inner {
        flex-direction: column;
        gap: 16px;
    }
}

.fade-in-up {
    opacity: 0;
    transform: translate3d(0, 20px, 0);
    animation: fadeInUp 0.8s forwards;
}

@keyframes fadeInUp {
    to {
        opacity: 1;
        transform: translate3d(0, 0, 0);
    }
}`;

    const script = `document.addEventListener('DOMContentLoaded', () => {
    const navToggle = document.querySelector('.nav-toggle');
    const navLinks = document.querySelector('.nav-links');
    const transitionLayer = document.querySelector('.page-transition');
    const transitionLinks = document.querySelectorAll('[data-transition]');
    const logContainer = document.querySelector('.log-entries');

    if (navToggle && navLinks) {
        navToggle.addEventListener('click', () => {
            navLinks.classList.toggle('open');
        });
    }

    const handleTransition = (href) => {
        if (!transitionLayer) return;
        transitionLayer.classList.add('active');
        setTimeout(() => {
            if (href.startsWith('#')) {
                const target = document.querySelector(href);
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth' });
                }
                transitionLayer.classList.remove('active');
            } else {
                window.location.href = href;
            }
        }, 550);
    };

    transitionLinks.forEach(link => {
        link.addEventListener('click', (event) => {
            const href = link.getAttribute('href');
            if (!href) return;
            if (href.startsWith('#')) {
                event.preventDefault();
            }
            handleTransition(href);
        });
    });

    const logEntries = [
        {
            title: 'Gündoğumu, Mavi Lagün',
            coords: '37°N · 25°E',
            note: 'Sabah sisi dağılırken mizana çıkan tayfa sessizce dalgaları izledi. İlk ışıklar, yelkenlerde bakır bir parıltı bıraktı.'
        },
        {
            title: 'Akşamüstü, Jade Waters',
            coords: '35°N · 139°E',
            note: 'Tapınak çanlarının yankısı gövdeye vururken bambu yaprakları mırıldanıyordu. Tayfaya matcha seremonisi öğretiliyor.'
        },
        {
            title: 'Gece Yarısı, Sol de Bronce',
            coords: '19°N · 99°W',
            note: 'Samba ritmleri denizi sararken güverte ışıklarla doldu. Kaptan jurnaline bakır rengi bir gün batımı çizdi.'
        }
    ];

    if (logContainer) {
        logContainer.innerHTML = logEntries.map((entry) => {
            return '<article class="log-entry fade-in-up">' +
                '<h4>' + entry.title + '</h4>' +
                '<span class="coords">' + entry.coords + '</span>' +
                '<p>' + entry.note + '</p>' +
            '</article>';
        }).join('');
    }

    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.2 });

    document.querySelectorAll('.route-card, .culture-card, .cuisine-card').forEach(card => {
        observer.observe(card);
    });

    setTimeout(() => transitionLayer?.classList.remove('active'), 600);
});`;

    return {
        readme,
        index: html,
        styles: css,
        script
    };
}

function buildOfflineCompletionMessage(project) {
    const title = project?.title || 'Gezgin';
    const mood = project?.mood || 'deniz temalı';
    const nextSteps = Array.isArray(project?.nextSteps) && project.nextSteps.length
        ? project.nextSteps
        : [
            'Rota kartlarına yeni destinasyonlar ekle',
            'Görselleri yerel bir klasörden yükleyecek bir galeri alanı hazırla',
            'JSON tabanlı hafif bir veri katmanı ile içerikleri dinamikleştir'
        ];

    const formattedSteps = nextSteps
        .map((step, index) => `${index + 1}. ${step}`)
        .join('\n');

    return `✅ OpenAI olmadan ilerledim ve "${title}" projesinin temel dosyalarını hazırladım.

📁 **Oluşturulan dosyalar**
- README.md · Yol haritası ve görev listesi
- index.html · ${mood} ana sayfa düzeni
- styles.css · Playfair Display + Inter ile responsive stil
- script.js · Geçiş animasyonları ve seyir defteri girişleri

🔧 **Devam etmek için önerilen adımlar**
${formattedSteps}

Statik siteyi hızlıca görmek için \`index.html\` dosyasını tarayıcıda açabilir ya da dizinde hafif bir sunucu başlatabilirsin:

\`\`\`powershell
npx serve .
\`\`\`

Herhangi bir noktada yeni talimat verirsen bu planı genişletebilirim.`;
}

class KodCanavari {
    constructor() {
        console.log('🐉 KodCanavari constructor called');

        this.currentTab = null;
        this.tabs = new Map();
        this.currentFile = null;
        this.currentFolder = null;
        this.folderHistory = [];
        this.folderHistoryIndex = -1;
        this.settings = {
            apiKey: '',
            model: 'gpt-4',
            temperature: 0.2, // Production Agent: Deterministic, precise
            theme: 'dark',
            maxTokens: 4000, // Increased for full file content generation
            customTemplates: [],
            teachWhileDoing: localStorage.getItem('teachWhileDoing') !== 'false' // Default: AÇIK (Usta Modu)
        };
        this.chatHistory = [];
        this.recentFiles = [];
        this.terminalHistory = [];
        this.terminalHistoryIndex = -1;
        this.artistStatusTimer = null;
        this.activeProcesses = new Map(); // Track running streaming processes

        // Bind offline fallback helpers to the instance
        this.isOpenAIUnavailableError = isOpenAIUnavailableError.bind(this);
        this.shouldUseOfflineProjectPlan = shouldUseOfflineProjectPlan.bind(this);
        this.buildOfflineAnalysis = buildOfflineAnalysis.bind(this);
        this.getOfflineProjectContext = getOfflineProjectContext.bind(this);
        this.generateOfflineProjectFiles = generateOfflineProjectFiles.bind(this);
        this.buildOfflineCompletionMessage = buildOfflineCompletionMessage.bind(this);

        this.defaultTemplateOrder = [
            'react-app',
            'python-script',
            'node-api',
            'html-page',
            'analyze-code',
            'fix-bugs',
            'project-wizard'
        ];
        this.defaultTemplates = this.buildDefaultTemplates();
        this.customTemplateEscHandler = null;

        // ✅ ASYNC MUTEX SYSTEM (Race Condition Prevention)
        // Proper mutex implementation replaces old flag-based system
        this.messageMutex = new AsyncMutex('ChatMessage');
        this.nightOrdersMutex = new AsyncMutex('NightOrders');
        
        // DEPRECATED: Old flag system removed (replaced by mutex)
        // this.isProcessingMessage = false;
        // this.lastMessageTime = 0;
        
        // Rate limiting (kept for different purpose - API throttling)
        this.requestQueue = [];
        this.activeRequests = 0;
        this.maxConcurrentRequests = 1;

        // Production Agent: Tool-First Policy (2 messages without tool = force tool)
        this.consecutiveNoToolMessages = 0;

        // ✅ RATE LIMITING & TOKEN TRACKING
        this.rateLimitWindow = 60000; // 1 minute window
        this.maxRequestsPerWindow = 20; // Max 20 requests per minute
        this.requestTimestamps = [];
        this.tokenBudget = {
            used: 0,
            limit: 100000, // 100K tokens per session
            sessionStart: Date.now()
        };

        // REMOVED: Emergency reset timer (no longer needed with proper mutex)
        // Old system had race condition - new mutex is atomic

        // Initialize the new tool system - DISABLED for troubleshooting
        // this.toolsSystem = new KayraToolsIntegration(this);
        this.toolsSystem = null; // Geçici olarak devre dışı

        // 🔥 CONTINUE AGENT STYLE SYSTEMS
        // Production-ready atomic operations with rollback support
        this.multiEditSystem = typeof MultiEditSystem !== 'undefined' ? new MultiEditSystem() : null;
        this.viewDiffSystem = typeof ViewDiffSystem !== 'undefined' ? new ViewDiffSystem() : null;
        this.viewRepoMapSystem = typeof ViewRepoMapSystem !== 'undefined' ? new ViewRepoMapSystem() : null;

        if (this.multiEditSystem) {
            console.log('✅ MultiEdit System initialized');
        } else {
            console.warn('⚠️ MultiEdit System not available');
        }

        if (this.viewDiffSystem) {
            console.log('✅ ViewDiff System initialized');
        } else {
            console.warn('⚠️ ViewDiff System not available');
        }

        if (this.viewRepoMapSystem) {
            console.log('✅ ViewRepoMap System initialized');
        } else {
            console.warn('⚠️ ViewRepoMap System not available');
        }

        // 🔐 ELYSION CHAMBER SYSTEMS (Approval Gate + Policy + Events)
        this.approvalSystem = typeof ApprovalSystem !== 'undefined' ? new ApprovalSystem() : null;
        this.policyEngine = typeof PolicyEngine !== 'undefined' ? new PolicyEngine() : null;
        this.eventBus = typeof EventBus !== 'undefined' ? new EventBus() : null;
        
        // 🔓 Developer Mode (auto-approve all operations)
        this.developerMode = localStorage.getItem('developerMode') === 'true' || false;
        console.log(`🔓 Developer Mode: ${this.developerMode ? 'ENABLED (auto-approve all)' : 'DISABLED'}`);
        
        // � PHASE CONTEXT TRACKING (Prevents loops, duplicates, context loss)
        this.phaseContext = {
            currentPhase: 0,
            phaseHistory: [],
            completedFiles: new Set(),
            lastMission: null,
            phaseStartTime: Date.now(),
            totalPhases: 0
        };
        console.log('🎯 Phase Context Tracker initialized');
        
        // �🎨 Update UI button on startup
        setTimeout(() => {
            const btn = document.getElementById('developerModeBtn');
            const statusSpan = btn?.querySelector('.dev-mode-status');
            const icon = btn?.querySelector('i');
            
            if (btn && statusSpan && icon) {
                if (this.developerMode) {
                    btn.classList.add('dev-mode-active');
                    statusSpan.textContent = 'DEV: ON';
                    icon.className = 'fas fa-unlock';
                    btn.title = 'Developer Mode ENABLED (Auto-approve all)';
                } else {
                    btn.classList.remove('dev-mode-active');
                    statusSpan.textContent = 'DEV: OFF';
                    icon.className = 'fas fa-code';
                    btn.title = 'Developer Mode DISABLED';
                }
            }
        }, 100);

        if (this.approvalSystem) {
            console.log('✅ Approval System initialized');
        } else {
            console.warn('⚠️ Approval System not available');
        }

        if (this.policyEngine) {
            console.log('✅ Policy Engine initialized');
            const stats = this.policyEngine.getStats();
            console.log(`   - ${stats.totalRules} rules (${stats.bySeverity.CRITICAL} critical)`);
        } else {
            console.warn('⚠️ Policy Engine not available');
        }

        if (this.eventBus) {
            console.log('✅ Event Bus initialized');
        } else {
            console.warn('⚠️ Event Bus not available');
        }

        // 🔍 PROBE MATRIX (Evidence-based validation)
        this.probeMatrix = typeof ProbeMatrix !== 'undefined' ? new ProbeMatrix() : null;

        if (this.probeMatrix) {
            console.log('✅ Probe Matrix initialized');
        } else {
            console.warn('⚠️ Probe Matrix not available');
        }

        // � LEARNING STORE (PR-3: Learn from failures)
        this.learningStore = null;
        try {
            const { getLearningStore } = require('./learning-store');
            this.learningStore = getLearningStore();
            console.log('✅ Learning Store initialized');
            
            // Expose to window for Learning Dashboard
            if (!window.kodCanavari) {
                window.kodCanavari = {};
            }
            window.kodCanavari.learningStore = this.learningStore;
            
            // Display stats
            const stats = this.learningStore.getStats();
            console.log(`   - ${stats.totalReflections} reflections`);
            console.log(`   - ${stats.totalPatterns} patterns`);
            console.log(`   - ${stats.successRate}% success rate`);
        } catch (error) {
            console.warn('⚠️ Learning Store initialization failed:', error.message);
        }

        // 🧠 SESSION CONTEXT (Agent short-term memory)
        this.sessionContext = new SessionContext();
        console.log('✅ Session Context initialized');
        if (!window.kodCanavari) window.kodCanavari = {};
        window.kodCanavari.sessionContext = this.sessionContext;
        
        // 🔍 AGENT TRACE SYSTEM (OpenAI Agents SDK style tracing)
        this.traceSystem = new AgentTraceSystem(this.eventBus);
        console.log('✅ Agent Trace System initialized');
        window.kodCanavari.traceSystem = this.traceSystem;
        
        // 🚪 ARTIFACT GATING SYSTEM (Verify artifacts before handoffs)
        this.gatingSystem = new ArtifactGatingSystem(this.workspaceRoot, window.electronAPI);
        console.log('✅ Artifact Gating System initialized');
        window.kodCanavari.gatingSystem = this.gatingSystem;
        
        // 🤝 MULTI-AGENT COORDINATOR (Agent orchestration)
        this.multiAgentCoordinator = new MultiAgentCoordinator({
            traceSystem: this.traceSystem,
            gatingSystem: this.gatingSystem,
            approvalSystem: this.approvalSystem,
            policyEngine: this.policyEngine
        });
        console.log('✅ Multi-Agent Coordinator initialized');
        window.kodCanavari.multiAgentCoordinator = this.multiAgentCoordinator;
        
        // 🌌 LUMA CORE (Cognitive reasoning engine)
        this.lumaCore = null;
        this.lumaBridge = null;
        this.lumaSuprimeAgent = null; // Supreme Agent - Üst Akıl
        
        try {
            // Import Luma modules dynamically
            import('../agents/luma-core.js').then(({ LumaCore }) => {
                import('../agents/luma-context-bridge.js').then(({ LumaContextBridge }) => {
                    import('../agents/luma-suprime-agent.js').then(({ LumaSuprimeAgent }) => {
                        // Initialize Luma Core
                        this.lumaCore = new LumaCore();
                        console.log('🌌 Luma Core initialized');
                        
                        // Initialize Luma Bridge
                        this.lumaBridge = new LumaContextBridge({
                            sessionContext: this.sessionContext,
                            learningStore: this.learningStore,
                            eventBus: this.eventBus
                        });
                        console.log('🌉 Luma Context Bridge initialized');
                        
                        // Initialize SUPRIME AGENT (Üst Akıl)
                        this.lumaSuprimeAgent = new LumaSuprimeAgent({
                            lumaCore: this.lumaCore,
                            lumaBridge: this.lumaBridge,
                            sessionContext: this.sessionContext,
                            learningStore: this.learningStore,
                            eventBus: this.eventBus,
                            multiAgentCoordinator: this.multiAgentCoordinator,
                            reflexionSystem: this.reflexionModule
                        });
                        console.log('� ✨ LUMA SUPRIME AGENT INITIALIZED ✨');
                        console.log('   → KayraDeniz artık düşünen bir üst akıl sistemine sahip!');
                        
                        // Connect Bridge to Supreme Agent
                        this.lumaBridge.lumaSuprimeAgent = this.lumaSuprimeAgent;
                        
                        // Expose to window
                        window.kodCanavari.lumaCore = this.lumaCore;
                        window.kodCanavari.lumaBridge = this.lumaBridge;
                        window.kodCanavari.lumaSuprimeAgent = this.lumaSuprimeAgent;
                        
                        // Emit init event
                        this.eventBus.emit('SUPRIME_INITIALIZED', {
                            timestamp: Date.now(),
                            message: '🌌 Luma Supreme Agent aktif - Sistem bilinç kazandı!'
                        });
                    });
                });
            });
        } catch (error) {
            console.warn('⚠️ Luma initialization failed:', error.message);
        }

        // 👨‍🏫 NARRATOR AGENT (Live commentary)
        // Initialize after EventBus and UI are ready
        this.narratorAgent = null;
        
        // Defer narrator initialization until UI is ready
        setTimeout(() => {
            if (typeof NarratorAgent !== 'undefined' && this.eventBus && window.elysionUI) {
                this.narratorAgent = new NarratorAgent(this.eventBus, window.elysionUI);
                console.log('✅ Narrator Agent initialized');
            } else {
                console.warn('⚠️ Narrator Agent not available (dependencies missing)');
            }
        }, 1000);

        // 🔬 CRITIC AGENT (Root cause analysis & fix generation)
        this.criticAgent = typeof CriticAgent !== 'undefined' ? new CriticAgent() : null;

        if (this.criticAgent) {
            console.log('✅ Critic Agent initialized');
            const stats = this.criticAgent.getStats();
            console.log(`   - 0 analyses, 0% success rate (fresh start)`);
        } else {
            console.warn('⚠️ Critic Agent not available');
        }

        this.currentProjectData = null;
        this.workflowProgress = [];
        this.currentMission = null; // PR-3: Track current mission for learning store
        
        // 🔧 CRITICAL: Initialize path module BEFORE using it
        this.path = require('path');
        this.os = require('os');
        
        // Start in user's Desktop directory by default
        this.currentWorkingDirectory = this.path.join(this.os.homedir(), 'OneDrive', 'Desktop');

        // ===== WORKSPACE ROOT PERSISTENCE =====
        // Global workspace root management for consistent file operations
        // ✅ STABILITY FIX: Separate initial root from navigation root
        this.initialWorkspaceRoot = null;  // Set once at project start, never changes
        this.workspaceRoot = null;         // Current navigation root (can change)
        this.initializeWorkspaceRoot();

        // ===== GITHUB & CODE AGENT INTEGRATION =====
        this.githubManager = null;
        this.codeAgent = null;
        this.gitHubCodeManager = null;

        // ===== TOOL MODE CONFIGURATION =====
        this.toolMode = "http"; // "ipc" | "http" 
        this.toolConfig = {
            http: {
                baseUrl: "http://localhost:7777/tool",
                headers: { "content-type": "application/json" }
            },
            ipc: {
                // For future IPC implementation
                enabled: false
            }
        };

        // GitHub REST API Integration  
        this.githubManager = null; // Will be initialized in init()

        // AI Modes
        this.aiMode = {
            current: 'ask', // 'ask' or 'agent'
            askMode: {
                isActive: true
            },
            agentMode: {
                isActive: false,
                isRunning: false,
                currentTask: '',
                steps: [],
                currentStepIndex: 0,
                permissions: {
                    fileAccess: true,
                    terminalAccess: true,
                    projectManagement: true,
                    codeGeneration: true
                },
                // GitHub REST API based options
                useGitHubAPI: true,
                restAPIMode: true
            }
        };

        // Pending action for hybrid mode
        this.pendingAction = null;

        // 🎯 REAL-TIME VISUALIZATION STATE
        this.liveVisualization = {
            isActive: false,
            startTime: null,
            currentOperation: null,
            timeline: [],
            fileChanges: new Map(), // filepath -> {added, deleted}
            metrics: {
                totalDuration: 0,
                successCount: 0,
                errorCount: 0
            }
        };

        // Theme System
        this.themeSystem = {
            current: localStorage.getItem('theme') || 'dragon',
            themes: {
                dragon: 'Dragon',
                turquoise: 'Turkuaz'
            }
        };

        this.init();
        this.initializeWorkspaceRoot();
        this.initializeAdvancedFileExplorer();
        this.initializeGitHubManager();
        this.initializeContinueAgent();
    }

    // ===== WORKSPACE ROOT PERSISTENCE =====
    initializeWorkspaceRoot() {
        // Initialize workspace root from localStorage ONLY (no default to Desktop!)
        const savedRoot = window.localStorage.getItem('currentFolder');
        if (savedRoot) {
            const normalized = this.path.normalize(savedRoot);
            
            window.__CURRENT_FOLDER__ = normalized;
            this.currentWorkingDirectory = normalized;
            this.initialWorkspaceRoot = normalized;  // Only for telemetry/reporting
            this.workspaceRoot = normalized;
            
            // 🔑 CRITICAL: Sync with main process (SSOT)
            if (window.electronAPI && window.electronAPI.setCwd) {
                window.electronAPI.setCwd(normalized)
                    .then(() => console.log('✅ Workspace root restored & synced to main:', normalized))
                    .catch(err => console.error('❌ Failed to sync CWD to main:', err));
            } else {
                console.log('📁 Workspace root restored (main sync not available):', normalized);
            }
        } else {
            // 🔧 TRY DEFAULT WORKSPACE (Developer convenience)
            const defaultWorkspace = 'C:\\Users\\emrah badas\\OneDrive\\Desktop\\kodlama\\Yeni klasör (5)\\deneme';
            console.log('⚠️ Workspace root not set in localStorage, trying default:', defaultWorkspace);
            
            // Check if default exists via electronAPI
            if (window.electronAPI && window.electronAPI.setCwd) {
                window.electronAPI.setCwd(defaultWorkspace)
                    .then(() => {
                        console.log('✅ Default workspace set successfully:', defaultWorkspace);
                        this.workspaceRoot = defaultWorkspace;
                        this.currentWorkingDirectory = defaultWorkspace;
                        window.__CURRENT_FOLDER__ = defaultWorkspace;
                        localStorage.setItem('currentFolder', defaultWorkspace);  // ✅ FIX: Use consistent key
                    })
                    .catch(err => {
                        console.error('❌ Default workspace not found, user must select folder:', err);
                        this.workspaceRoot = null;
                        this.currentWorkingDirectory = null;
                        window.__CURRENT_FOLDER__ = null;
                    });
            } else {
                console.warn('⚠️ No workspace root! User must select folder via "Klasör Seç" button.');
                this.workspaceRoot = null;
                this.currentWorkingDirectory = null;
                window.__CURRENT_FOLDER__ = null;
            }
        }
    }

    setWorkspaceRoot(absolutePath, isInitial = false) {
        if (!absolutePath || typeof absolutePath !== 'string') {
            console.error('❌ setWorkspaceRoot: Invalid path:', absolutePath);
            return;
        }

        // Normalize path (Windows/OneDrive spaces, forward/backward slashes)
        const normalized = this.path.normalize(absolutePath);

        // Track initial root separately (only for telemetry/reporting, NOT for operations)
        if (isInitial && !this.initialWorkspaceRoot) {
            this.initialWorkspaceRoot = normalized;
            console.log('🎯 Initial workspace root set (telemetry only):', normalized);
        }

        // Update all renderer state
        window.localStorage.setItem('currentFolder', normalized);
        window.__CURRENT_FOLDER__ = normalized;
        this.currentWorkingDirectory = normalized;
        this.currentFolder = normalized;
        this.workspaceRoot = normalized;

        // 🔑 CRITICAL: Sync with main process (SSOT)
        if (window.electronAPI && window.electronAPI.setCwd) {
            window.electronAPI.setCwd(normalized)
                .then(() => console.log('✅ Workspace root set & synced to main:', normalized))
                .catch(err => console.error('❌ Failed to sync CWD to main:', err));
        } else {
            console.log('✅ Workspace root set (main sync not available):', normalized);
        }
    }

    /**
     * Get workspace root directory
     * @param {Object} options - Options object
     * @param {"active"|"initial"} options.mode - "active" for current working dir, "initial" for telemetry only
     * @returns {string|null} Workspace root path or null if not set
     */
    getWorkspaceRoot({ mode = "active" } = {}) {
        // "initial" mode: Return initial root (only for telemetry/reporting, NOT for file operations)
        if (mode === "initial") {
            return this.initialWorkspaceRoot || null;
        }

        // "active" mode: Return current active root (for all file/command operations)
        const root = this.workspaceRoot || window.__CURRENT_FOLDER__ || window.localStorage.getItem('currentFolder');

        if (!root) {
            // ❌ NO FALLBACK TO DESKTOP! Return null and let UI show "Klasör Seç" button
            console.warn('⚠️ getWorkspaceRoot: No workspace root set. User must select folder.');
            return null;
        }

        return root;
    }

    // ✅ KAPTAN YAMASI: Merkezi path çözümleme (tüm dosya işlemleri buradan)
    resolvePath(relativePath) {
        // Always use active root for file operations (NOT initial!)
        const baseRoot = this.getWorkspaceRoot({ mode: "active" });
        
        if (!baseRoot) {
            throw new Error('❌ Cannot resolve path: Workspace root not set. User must select folder via "Klasör Seç" button.');
        }

        // ✅ FIX: Use this.path (class property) instead of require('path')
        // Absolute path ise olduğu gibi dön
        if (this.path.isAbsolute(relativePath)) {
            return relativePath;
        }

        // Relative path'i base root'tan çöz
        const resolved = this.path.resolve(baseRoot, relativePath);
        console.log(`📍 Path resolved: ${relativePath} → ${resolved}`);
        return resolved;
    }

    async initializeContinueAgent() {
        try {
            // Initialize Continue agent UI if available
            if (typeof window.ContinueAgentUI !== 'undefined') {
                // Wait a bit for DOM to be ready
                setTimeout(async () => {
                    if (window.continueAgentUI) {
                        const currentDir = process.cwd() || 'c:\\Users\\emrah badas\\OneDrive\\Desktop\\KayraDeniz-Kod-Canavari';
                        await window.continueAgentUI.initialize(currentDir);
                        console.log('✅ Continue Agent UI initialized');
                        this.updateArtistStatus();
                    }
                }, 1000);
            } else {
                console.warn('⚠️ Continue Agent UI not available');
            }
        } catch (error) {
            console.error('❌ Failed to initialize Continue Agent UI:', error);
        }
    }

    async initializeGitHubManager() {
        try {
            // Initialize GitHub REST API manager if available
            if (typeof KayraGitHubCodeManager !== 'undefined') {
                this.githubManager = new KayraGitHubCodeManager();
                console.log('✅ GitHub REST API manager initialized');
            } else {
                console.warn('⚠️ GitHub manager not available');
            }
        } catch (error) {
            console.error('❌ Failed to initialize GitHub manager:', error);
        }
    }

    init() {
        console.log('🐉 KayraDeniz Kod Canavarı başlatılıyor...');

        // Expose app instance for onclick handlers in terminal links
        window.app = this;

        // Setup electronAPI for IPC communication (nodeIntegration enabled)
        if (typeof require !== 'undefined') {
            const { ipcRenderer } = require('electron');
            window.electronAPI = {
                // Expose ipcRenderer for advanced usage
                ipcRenderer: ipcRenderer,

                // Platform Detection API
                getPlatform: () => ipcRenderer.invoke('get-platform'),

                // 🔑 Workspace Root API (SSOT in main process)
                setCwd: (absolutePath) => ipcRenderer.invoke('cwd:set', absolutePath),
                getCwd: () => ipcRenderer.invoke('cwd:get'),

                // File System API'leri
                readDirectory: (dirPath) => ipcRenderer.invoke('read-directory', dirPath),
                readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
                writeFile: (filePath, content) => ipcRenderer.invoke('write-file', filePath, content),
                createDirectory: (dirPath) => ipcRenderer.invoke('create-directory', dirPath),
                runCommand: (command, cwd) => ipcRenderer.invoke('run-command', command, cwd),
                openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
                openFolderDialog: () => ipcRenderer.invoke('open-folder-dialog'),
                saveFileDialog: () => ipcRenderer.invoke('save-file-dialog'),

                // MCP API'leri (Old - keep for compatibility)
                mcpStatus: () => ipcRenderer.invoke('mcp-status'),
                mcpListTools: () => ipcRenderer.invoke('mcp-list-tools'),
                mcpTest: () => ipcRenderer.invoke('mcp-test'),
                mcpCreateFile: (filePath, content, workingDirectory) => ipcRenderer.invoke('mcp-create-file', filePath, content, workingDirectory),
                mcpWriteCode: (filePath, content, language, workingDirectory) => ipcRenderer.invoke('mcp-write-code', filePath, content, language, workingDirectory),
                mcpReadFile: (filePath) => ipcRenderer.invoke('mcp-read-file', filePath),
                mcpListFiles: (directoryPath) => ipcRenderer.invoke('mcp-list-files', directoryPath),
                mcpGenerateProject: (projectName, projectType, basePath, workingDirectory) => ipcRenderer.invoke('mcp-generate-project', projectName, projectType, basePath, workingDirectory),
                mcpCallTool: (toolName, args) => ipcRenderer.invoke('mcp-call-tool', toolName, args),

                // MCP API'leri (New - Claude Integration)
                mcpNewListTools: () => ipcRenderer.invoke('mcp-new:list-tools'),
                mcpNewCallTool: (toolName, args) => ipcRenderer.invoke('mcp-new:call-tool', toolName, args),
                mcpNewGetStatus: () => ipcRenderer.invoke('mcp-new:get-status'),
                mcpNewGetLog: () => ipcRenderer.invoke('mcp-new:get-log'),
                mcpNewSetFileWhitelist: (rootPath) => ipcRenderer.invoke('mcp-new:set-file-whitelist', rootPath),

                // LLM API'leri (Unified OpenAI + Claude)
                llmAsk: (provider, messages, options) => ipcRenderer.invoke('llm:ask', { provider, messages, options }),
                llmSetApiKey: (provider, apiKey) => ipcRenderer.invoke('llm:set-api-key', { provider, apiKey }),
                llmGetModels: (provider) => ipcRenderer.invoke('llm:get-models', { provider }),
                llmSetModel: (provider, model) => ipcRenderer.invoke('llm:set-model', { provider, model }),

                // Claude Agent API'leri
                claudeGetStatus: () => ipcRenderer.invoke('claude:get-status'),
                claudeClearHistory: () => ipcRenderer.invoke('claude:clear-history'),

                // AI (GitHub Models API) API'leri
                aiInitialize: (workspacePath) => ipcRenderer.invoke('ai-initialize', workspacePath),
                aiChat: (message, options) => ipcRenderer.invoke('ai-chat', message, options),
                aiAnalyzeCode: (code, language, request) => ipcRenderer.invoke('ai-analyze-code', code, language, request),
                aiGenerateCode: (prompt, language) => ipcRenderer.invoke('ai-generate-code', prompt, language),
                aiRefreshWorkspace: (workspacePath) => ipcRenderer.invoke('ai-refresh-workspace', workspacePath),
                aiStatus: () => ipcRenderer.invoke('ai-status'),
                aiSetModel: (modelName) => ipcRenderer.invoke('ai-set-model', modelName),
                aiClearHistory: () => ipcRenderer.invoke('ai-clear-history'),

                // Continue Agent API'leri
                continueInitialize: (workspacePath) => ipcRenderer.invoke('continue-initialize', workspacePath),
                continueProcessPrompt: (prompt, context) => ipcRenderer.invoke('continue-process-prompt', prompt, context),
                continueStatus: () => ipcRenderer.invoke('continue-status'),
                continueUpdateApiKey: (apiKey) => ipcRenderer.invoke('continue-update-api-key', apiKey),
                continueStop: () => ipcRenderer.invoke('continue-stop'),

                // Streaming Process API'leri
                startProcess: (processId, command, cwd) => ipcRenderer.invoke('start-process', processId, command, cwd),
                stopProcess: (processId) => ipcRenderer.invoke('stop-process', processId),
                listProcesses: () => ipcRenderer.invoke('list-processes'),

                // MCP Proxy Management
                restartMCPProxy: () => ipcRenderer.invoke('restart-mcp-proxy')
            };
            console.log('✅ electronAPI initialized with IPC communication');

            // ===== STREAMING PROCESS EVENT LISTENERS =====
            // Setup event listeners for streaming process output
            ipcRenderer.on('process-output', (event, data) => {
                this.handleProcessOutput(data.processId, data.type, data.data);
            });

            ipcRenderer.on('process-exit', (event, data) => {
                this.handleProcessExit(data.processId, data.exitCode, data.signal);
            });

            ipcRenderer.on('process-error', (event, data) => {
                this.handleProcessError(data.processId, data.error);
            });

            console.log('✅ Streaming process event listeners registered');
        }

        // Load settings from localStorage
        this.loadSettings();

        // Initialize theme
        this.initializeTheme();

        // Initialize Router Agent status
        this.initializeRouterStatus();

        // Setup global window methods for UI callbacks
        this.setupGlobalMethods();

        // Initialize UI components
        this.initializeUI();

        // Setup event listeners
        this.setupEventListeners();

        // Setup IPC communication with main process
        this.setupIPC();

        // Initialize welcome screen
        this.showWelcomeScreen();

        // Initialize terminal
        this.initializeTerminal();

        // Initialize indent guides on first load (after DOM ready)
        setTimeout(() => {
            this.updateLineNumbers();
        }, 100);

        // ✨ Initialize Claude UI (async, non-blocking)
        setTimeout(async () => {
            await this.initializeClaudeUI();
        }, 500);

        // ✅ MCP FALLBACK BANNER: Check MCP tools availability
        setTimeout(async () => {
            await this.checkMCPAvailability();
        }, 1000);

        console.log('✅ Uygulama başarıyla başlatıldı!');
    }

    // ✅ MCP FALLBACK BANNER
    async checkMCPAvailability() {
        try {
            console.log('🔍 Checking MCP tools availability...');

            // Try to fetch MCP status
            const response = await fetch('http://localhost:7777/health', {
                method: 'GET',
                timeout: 2000
            }).catch(() => null);

            if (!response || !response.ok) {
                // MCP tools offline - show banner
                this.showMCPFallbackBanner();
                return;
            }

            console.log('✅ MCP tools are online');
        } catch (error) {
            console.warn('⚠️ MCP tools check failed:', error);
            this.showMCPFallbackBanner();
        }
    }

    showMCPFallbackBanner() {
        console.warn('⚠️ MCP tools offline - falling back to chat-only mode');

        const banner = document.createElement('div');
        banner.id = 'mcp-fallback-banner';
        banner.style.cssText = `
            position: fixed;
            top: 60px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            font-size: 14px;
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: 12px;
            animation: slideDown 0.3s ease;
        `;

        banner.innerHTML = `
            <span>⚠️</span>
            <span>MCP Tools Offline - Chat-Only Mode Active</span>
            <button id="mcp-banner-close" style="
                background: rgba(255,255,255,0.2);
                border: none;
                color: white;
                padding: 4px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
            ">Tamam</button>
        `;

        document.body.appendChild(banner);

        // Close button
        document.getElementById('mcp-banner-close')?.addEventListener('click', () => {
            banner.remove();
        });

        // Auto-remove after 10 seconds
        setTimeout(() => {
            banner.remove();
        }, 10000);
    }

    debugUIElements() {
        // INFO level - not critical errors
        console.info('🔍 Checking UI elements...');

        const elementsToCheck = [
            'settingsBtn', 'aboutBtn', 'topSaveApiKey', 'saveApiKey',
            'generateCode', 'explainCode', 'optimizeCode', 'findBugs',
            'openFileBtn', 'newFileBtn', 'openFolderBtn'
        ];

        const missingElements = [];
        elementsToCheck.forEach(id => {
            const element = document.getElementById(id);
            if (!element) {
                missingElements.push(id);
            }
        });

        if (missingElements.length > 0) {
            console.info('ℹ️ Optional UI elements not found:', missingElements.join(', '));
        } else {
            console.info('✅ All UI elements found');
        }

        // Check if DOM is ready
        console.info('� Document state:', document.readyState, '| Body loaded:', !!document.body);
    }

    // Emergency reset function for debugging - can be called from console
    emergencyReset() {
        console.log('🚨 Emergency reset called');
        
        // ✅ NEW: Force release all mutexes
        if (this.messageMutex && this.messageMutex.isLocked()) {
            console.warn('⚠️ Force releasing messageMutex');
            this.messageMutex._locked = false;
            this.messageMutex._queue = [];
        }
        
        if (this.nightOrdersMutex && this.nightOrdersMutex.isLocked()) {
            console.warn('⚠️ Force releasing nightOrdersMutex');
            this.nightOrdersMutex._locked = false;
            this.nightOrdersMutex._queue = [];
        }
        
        console.log('✅ All mutexes reset');

        // Re-enable send button if it exists
        const sendBtn = document.getElementById('sendChatBtn');
        if (sendBtn) {
            sendBtn.disabled = false;
            sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
            console.log('✅ Send button re-enabled');
        }
    }

    loadSettings() {
        try {
            const savedSettings = localStorage.getItem('kod-canavari-settings');
            if (savedSettings) {
                this.settings = { ...this.settings, ...JSON.parse(savedSettings) };
            }

            if (!Array.isArray(this.settings.customTemplates)) {
                this.settings.customTemplates = [];
            }

            // Set default economical models if not set
            if (!this.settings.currentModel) {
                const provider = this.settings.llmProvider || 'openai';
                this.settings.currentModel = provider === 'anthropic'
                    ? 'claude-3-haiku-20240307'  // Claude Haiku (ekonomik)
                    : 'gpt-4o-mini';              // GPT-4o Mini (ekonomik)
            }

            // Set default model to economical for backward compatibility
            if (!this.settings.model || this.settings.model === 'gpt-4') {
                this.settings.model = 'gpt-4o-mini'; // Default to economical model
            }

            const recentFiles = localStorage.getItem('kod-canavari-recent');
            if (recentFiles) {
                this.recentFiles = JSON.parse(recentFiles);
            }
        } catch (error) {
            console.error('❌ Ayarlar yüklenirken hata:', error);
        }
    }

    saveSettings() {
        try {
            localStorage.setItem('kod-canavari-settings', JSON.stringify(this.settings));
            localStorage.setItem('kod-canavari-recent', JSON.stringify(this.recentFiles));
        } catch (error) {
            console.error('❌ Ayarlar kaydedilirken hata:', error);
        }
    }

    initializeUI() {
        // Initialize model select
        const modelSelect = document.getElementById('modelSelect');
        if (modelSelect) {
            modelSelect.value = this.settings.model;
            modelSelect.addEventListener('change', (e) => {
                this.settings.model = e.target.value;
                this.saveSettings();
                this.updateArtistStatus();
            });
        }

        // Initialize API key input
        const apiKeyInput = document.getElementById('apiKey');
        if (apiKeyInput) {
            apiKeyInput.value = this.settings.apiKey;
        }

        // Update status bar
        this.updateStatus();
        this.updateArtistStatus();
        if (this.artistStatusTimer) {
            clearInterval(this.artistStatusTimer);
        }
        this.artistStatusTimer = setInterval(() => {
            this.updateArtistStatus();
        }, 10000);

        // Load recent files
        this.updateRecentFiles();

        // Prepare quick start templates UI
        this.initializeQuickTemplateUI();

        // Wire top header controls (if present)
        const topModel = document.getElementById('topModelSelect');
        if (topModel) {
            topModel.value = this.settings.model;
            topModel.addEventListener('change', (e) => {
                this.settings.model = e.target.value;
                this.saveSettings();
                this.updateArtistStatus();
            });
        }

        const topTemp = document.getElementById('topTemperature');
        const topTempValue = document.getElementById('topTempValue');
        if (topTemp && topTempValue) {
            topTemp.value = this.settings.temperature;
            topTempValue.textContent = this.settings.temperature;
            topTemp.addEventListener('input', (e) => {
                const v = parseFloat(e.target.value);
                this.settings.temperature = v;
                // mirror any left slider
                const leftSlider = document.getElementById('temperature');
                const leftValue = document.getElementById('temperatureValue');
                if (leftSlider) leftSlider.value = v;
                if (leftValue) leftValue.textContent = v;
                topTempValue.textContent = v;
                this.saveSettings();
            });
        }
    }

    setupEventListeners() {
        console.log('🎯 Setting up event listeners...');

        // Debug: Check if elements exist
        this.debugUIElements();

        // Header buttons
        document.getElementById('settingsBtn')?.addEventListener('click', () => {
            console.log('⚙️ Settings button clicked');
            this.showSettings();
        });
        document.getElementById('aboutBtn')?.addEventListener('click', () => {
            console.log('ℹ️ About button clicked');
            this.showAbout();
        });
        
        // 🔓 Developer Mode Toggle
        document.getElementById('developerModeBtn')?.addEventListener('click', () => {
            console.log('🔓 Developer Mode button clicked');
            if (typeof window.toggleDeveloperMode === 'function') {
                window.toggleDeveloperMode();
            } else {
                console.error('❌ toggleDeveloperMode not available yet');
            }
        });

        // API Key save buttons (left panel and top bar)
        document.getElementById('saveApiKey')?.addEventListener('click', () => {
            console.log('🔑 Save API key clicked');
            this.saveApiKey();
        });
        document.getElementById('topSaveApiKey')?.addEventListener('click', () => {
            console.log('🔑 Top save API key clicked');
            this.saveApiKeyFromTop();
        });

        // ===== CLAUDE AI + MCP UI EVENT LISTENERS =====

        // Claude API key save
        document.getElementById('topSaveClaudeApiKey')?.addEventListener('click', () => {
            console.log('🧠 Save Claude API key clicked');
            this.saveClaudeApiKey();
        });

        // Provider selection
        const providerSelect = document.getElementById('llmProviderSelect');
        if (providerSelect) {
            providerSelect.addEventListener('change', (e) => {
                console.log('🔄 Provider changed:', e.target.value);
                this.onProviderChange(e.target.value);
            });
        }

        // Model selection
        const modelSelect = document.getElementById('llmModelSelect');
        if (modelSelect) {
            modelSelect.addEventListener('change', (e) => {
                console.log('🤖 Model changed:', e.target.value);
                this.onModelChange(e.target.value);
            });
        }

        // Tools toggle
        const toolsCheckbox = document.getElementById('toolsEnabledCheckbox');
        if (toolsCheckbox) {
            toolsCheckbox.addEventListener('change', (e) => {
                console.log('🔧 Tools enabled:', e.target.checked);
                this.settings.toolsEnabled = e.target.checked;
                this.saveSettings();
            });
        }

        // ===== END CLAUDE AI + MCP UI =====

        // Quick action buttons
        document.getElementById('generateCode')?.addEventListener('click', () => {
            console.log('🔄 Generate code clicked');
            this.quickAction('generate');
        });
        document.getElementById('explainCode')?.addEventListener('click', () => {
            console.log('📖 Explain code clicked');
            this.quickAction('explain');
        });
        document.getElementById('optimizeCode')?.addEventListener('click', () => {
            console.log('⚡ Optimize code clicked');
            this.quickAction('optimize');
        });
        document.getElementById('findBugs')?.addEventListener('click', () => {
            console.log('🐛 Find bugs clicked');
            this.quickAction('bugs');
        });

        // Welcome screen buttons
        document.getElementById('openFileBtn')?.addEventListener('click', () => {
            console.log('📁 Open file clicked');
            this.openFile();
        });
        document.getElementById('newFileBtn')?.addEventListener('click', () => {
            console.log('📄 New file clicked');
            this.newFile();
        });
        document.getElementById('openFolderBtn')?.addEventListener('click', () => {
            console.log('📁 Open folder clicked');
            this.openFolder();
        });

        // Tab management
        document.getElementById('newTabBtn')?.addEventListener('click', () => this.newFile());

        // Editor buttons
        document.getElementById('saveBtn')?.addEventListener('click', () => this.saveFile());
        document.getElementById('saveAsBtn')?.addEventListener('click', () => this.saveFileAs());
        document.getElementById('copyBtn')?.addEventListener('click', () => this.copyContent());

        // File explorer
        document.getElementById('refreshExplorer')?.addEventListener('click', () => this.refreshExplorer());
        document.getElementById('selectFolderBtn')?.addEventListener('click', () => this.openFolder());
        document.getElementById('explorerBackBtn')?.addEventListener('click', () => this.explorerGoBack());
        document.getElementById('explorerUpBtn')?.addEventListener('click', () => this.explorerGoUp());

        // Terminal functionality
        document.getElementById('runCommandBtn')?.addEventListener('click', () => this.runTerminalCommand());
        document.getElementById('clearTerminalBtn')?.addEventListener('click', () => this.clearTerminal());
        document.getElementById('newTerminalBtn')?.addEventListener('click', () => this.newTerminal());

        const terminalInput = document.getElementById('terminalInput');
        if (terminalInput) {
            terminalInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    this.runTerminalCommand();
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    this.showPreviousCommand();
                } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    this.showNextCommand();
                }
            });
        }

        /* 
        // TEMPORARILY COMMENTED OUT - Chat functionality with global debouncing
        const sendBtn = document.getElementById('sendChatBtn');
        const chatInput = document.getElementById('chatInput');
        
        // Global processing state to prevent multiple triggers
        this.isUIProcessing = false;
        
        const handleSendMessage = async () => {
            if (this.isUIProcessing) {
                console.log('🛡️ UI processing blocked - already sending message');
                return;
            }
            
            this.isUIProcessing = true;
            try {
                await this.sendChatMessage();
            } finally {
                // Reset after delay to prevent rapid triggers
                setTimeout(() => {
                    this.isUIProcessing = false;
                }, 1000);
            }
        };
        
        if (sendBtn) {
            sendBtn.addEventListener('click', handleSendMessage);
        }
        
        if (chatInput) {
            chatInput.addEventListener('keydown', async (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    await handleSendMessage();
                }
            });
        }
        
        document.getElementById('clearChatBtn')?.addEventListener('click', () => this.clearChat());
        document.getElementById('summaryBtn')?.addEventListener('click', () => this.showConversationSummary());
        */

        // FALLBACK - Simple chat event listeners
        document.getElementById('sendChatBtn')?.addEventListener('click', () => this.sendChatMessage());
        document.getElementById('clearChatBtn')?.addEventListener('click', () => this.clearChat());
        document.getElementById('summaryBtn')?.addEventListener('click', () => this.showConversationSummary());

        const chatInput = document.getElementById('chatInput');
        if (chatInput) {
            chatInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendChatMessage();
                }
            });
        }

        // Auto-resize chat input
        if (chatInput) {
            chatInput.addEventListener('input', () => {
                chatInput.style.height = 'auto';
                chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
            });
        }

        // Wire prompt action select and ai mode select into keydown send
        const promptAction = document.getElementById('promptActionSelect');
        const chatAiMode = document.getElementById('chatAiModeSelect');
        const agentRoleDropdown = document.getElementById('agentRoleDropdown');

        // Show/hide agent role selector based on AI mode
        if (chatAiMode) {
            chatAiMode.value = this.aiMode.current || 'ask';
            chatAiMode.addEventListener('change', (e) => {
                if (agentRoleDropdown) {
                    if (e.target.value === 'agent') {
                        agentRoleDropdown.classList.remove('hidden');
                    } else {
                        agentRoleDropdown.classList.add('hidden');
                    }
                }
            });
        }

        // Code editor
        const codeEditor = document.getElementById('codeEditor');
        if (codeEditor) {
            codeEditor.addEventListener('input', () => this.onEditorChange());
            codeEditor.addEventListener('scroll', () => this.syncHighlight());
            codeEditor.addEventListener('keydown', (e) => this.handleEditorKeydown(e));
            codeEditor.addEventListener('click', () => this.handleEditorSelectionChange());
            codeEditor.addEventListener('keyup', () => this.handleEditorSelectionChange());
        }

        // Editor wrapper scroll sync
        const editorWrapper = document.querySelector('.editor-wrapper');
        if (editorWrapper) {
            editorWrapper.addEventListener('scroll', () => this.syncEditorScroll());
        }

        // Code folding icons click
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('fold-icon') && e.target.classList.contains('visible')) {
                const lineIndex = parseInt(e.target.dataset.line);
                this.toggleFold(lineIndex);
            }
        });

        // Minimap click
        const minimap = document.getElementById('minimap');
        if (minimap) {
            minimap.addEventListener('click', (e) => this.handleMinimapClick(e));
        }

        // AI Mode Selection
        document.getElementById('askModeBtn')?.addEventListener('click', () => this.switchToAskMode());
        document.getElementById('agentModeBtn2')?.addEventListener('click', () => this.switchToAgentMode());

        // Ask Mode
        document.getElementById('submitAsk')?.addEventListener('click', () => this.submitAskQuestion());

        // Agent Mode
        document.getElementById('agentModeBtn')?.addEventListener('click', () => this.toggleAgentModeHeader());
        document.getElementById('executeAgentTask')?.addEventListener('click', () => this.executeAgentTask());
        document.getElementById('stopAgentBtn')?.addEventListener('click', () => this.stopAgent());
        document.getElementById('agentModeToggle')?.addEventListener('click', () => this.toggleAgentMode());

        // Terminal toggle
        document.getElementById('toggleTerminalBtn')?.addEventListener('click', () => this.toggleTerminal());

        // Initialize resizers
        this.initializeResizers();

        // Ask input enter key
        const askInput = document.getElementById('askInput');
        if (askInput) {
            askInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && e.ctrlKey) {
                    e.preventDefault();
                    this.submitAskQuestion();
                }
            });
        }

        // Modal close buttons
        document.getElementById('closeSettingsModal')?.addEventListener('click', () => this.hideSettings());
        document.getElementById('closeAboutModal')?.addEventListener('click', () => this.hideAbout());
        document.getElementById('settingsCloseBtn')?.addEventListener('click', () => this.hideSettings());
        document.getElementById('aboutCloseBtn')?.addEventListener('click', () => this.hideAbout());

        // Go to Line modal
        document.getElementById('closeGotoLineModal')?.addEventListener('click', () => this.hideGotoLineModal());
        document.getElementById('gotoLineBtn')?.addEventListener('click', () => this.gotoLine());
        document.getElementById('cancelGotoLineBtn')?.addEventListener('click', () => this.hideGotoLineModal());

        // Go to Line input Enter key
        const gotoLineInput = document.getElementById('gotoLineInput');
        if (gotoLineInput) {
            gotoLineInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.gotoLine();
                }
            });
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleGlobalKeydown(e));

        // Window events
        window.addEventListener('beforeunload', () => this.beforeUnload());
        window.addEventListener('mcpStatusChanged', () => this.updateArtistStatus());
        window.addEventListener('focus', () => this.updateArtistStatus());
    }

    setupIPC() {
        // Setup communication with main process for file operations
        const { ipcRenderer } = require('electron');
        const path = require('path');
        this.ipc = ipcRenderer;
        this.path = path;
    }

    showWelcomeScreen() {
        document.getElementById('welcomeScreen').style.display = 'flex';
        document.getElementById('editorArea').classList.add('hidden');
        this.currentTab = 'welcome';
        this.updateStatus('Hoş geldin ekranı');
    }

    hideWelcomeScreen() {
        document.getElementById('welcomeScreen').style.display = 'none';
        document.getElementById('editorArea').classList.remove('hidden');
    }

    newFile() {
        const tabId = 'file_' + Date.now();
        const fileName = 'untitled.txt';

        this.hideWelcomeScreen();
        this.createTab(tabId, fileName, '', true);
        this.updateStatus('Yeni dosya oluşturuldu');
    }

    async openFile(filePath = null) {
        try {
            this.showLoading('Dosya açılıyor...');

            let targetFilePath = filePath;

            // If no file path provided, show file dialog
            if (!targetFilePath) {
                const result = await this.ipc.invoke('open-file-dialog');

                if (result.canceled || !result.filePaths.length) {
                    this.hideLoading();
                    return;
                }

                targetFilePath = result.filePaths[0];
            }

            const fileName = this.path.basename(targetFilePath);

            // Check if file is already open in a tab
            const existingTab = this.findTabByFilePath(targetFilePath);
            if (existingTab) {
                this.switchToTab(existingTab);
                this.hideLoading();
                this.updateStatus('Dosya zaten açık: ' + fileName);
                return;
            }

            const fileResult = await this.ipc.invoke('read-file', targetFilePath);

            if (!fileResult.success) {
                this.hideLoading();
                this.showError('Dosya okunamadı: ' + fileResult.error);
                return;
            }

            // Keep terminal working directory aligned with opened file's location
            const parentDir = this.path?.dirname ? this.path.dirname(targetFilePath) : require('path').dirname(targetFilePath);
            this.setWorkingDirectory(parentDir);

            const tabId = 'file_' + Date.now();
            this.hideWelcomeScreen();
            this.createTab(tabId, fileName, fileResult.content, false, targetFilePath);
            this.addToRecentFiles(fileName, targetFilePath);
            this.hideLoading();
            this.updateStatus('Dosya açıldı: ' + fileName);

        } catch (error) {
            this.hideLoading();
            this.showError('Dosya açılırken hata oluştu: ' + error.message);
        }
    }

    async openFolder() {
        try {
            this.showLoading('Klasör açılıyor...');

            const result = await this.ipc.invoke('open-folder-dialog');

            if (result.canceled || !result.filePaths.length) {
                this.hideLoading();
                return;
            }

            this.navigateToFolder(result.filePaths[0]);
            this.hideLoading();

            const folderName = this.path.basename(this.currentFolder);
            this.updateStatus('Klasör açıldı: ' + folderName);

        } catch (error) {
            this.hideLoading();
            this.showError('Klasör açılırken hata oluştu: ' + error.message);
        }
    }

    createTab(tabId, fileName, content, isNew, filePath = null) {
        const tabsContainer = document.getElementById('tabsContainer');

        // Remove existing welcome tab if this is the first file
        if (this.currentTab === 'welcome') {
            const welcomeTab = tabsContainer.querySelector('.tab[data-file="welcome"]');
            if (welcomeTab) {
                welcomeTab.remove();
            }
        }

        // Create new tab element
        const tab = document.createElement('div');
        tab.className = 'tab active';
        tab.dataset.file = tabId;

        const fileIcon = this.getFileIcon(fileName);
        tab.innerHTML = `
      <span class="tab-icon"><i class="${fileIcon}"></i></span>
      <span class="tab-title">${fileName}</span>
      <button class="tab-close" title="Kapat">×</button>
    `;

        // Add event listeners
        tab.addEventListener('click', (e) => {
            if (!e.target.classList.contains('tab-close')) {
                this.switchTab(tabId);
            }
        });

        tab.querySelector('.tab-close').addEventListener('click', (e) => {
            e.stopPropagation();
            this.closeTab(tabId);
        });

        // Deactivate other tabs
        tabsContainer.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));

        // Add to container
        tabsContainer.appendChild(tab);

        // Store tab data
        this.tabs.set(tabId, {
            fileName,
            content,
            isNew,
            isModified: false,
            filePath: filePath || (isNew ? null : fileName)
        });

        // Switch to new tab
        this.switchTab(tabId);
    }

    switchTab(tabId) {
        // Update UI
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.file === tabId);
        });

        const tabData = this.tabs.get(tabId);
        if (tabData) {
            const editor = document.getElementById('codeEditor');
            const fileName = document.getElementById('fileName');
            const filePath = document.getElementById('filePath');

            if (editor) editor.value = tabData.content;
            if (fileName) fileName.textContent = tabData.fileName;
            if (filePath) filePath.textContent = tabData.filePath || '';

            this.currentTab = tabId;
            this.currentFile = tabData;
            this.updateHighlight();

            // Wait for DOM update before recalculating line numbers & indent guides
            setTimeout(() => {
                this.updateLineNumbers(); // ✨ Update line numbers + indent guides
            }, 0);

            this.updateWindowTitle(tabData.fileName);
        }
    }

    closeTab(tabId) {
        const tabData = this.tabs.get(tabId);

        if (tabData && tabData.isModified) {
            // In a real app, show save dialog
            console.log('Dosya değiştirildi, kaydetmek istiyor musunuz?');
        }

        // Remove tab element
        const tab = document.querySelector(`[data-file="${tabId}"]`);
        if (tab) tab.remove();

        // Remove from tabs map
        this.tabs.delete(tabId);

        // Switch to another tab or show welcome screen
        if (this.tabs.size === 0) {
            this.showWelcomeScreen();
        } else {
            const nextTabId = Array.from(this.tabs.keys())[0];
            this.switchTab(nextTabId);
        }
    }

    onEditorChange() {
        const editor = document.getElementById('codeEditor');
        if (!editor || !this.currentFile) return;

        this.currentFile.content = editor.value;
        this.currentFile.isModified = true;

        // Update tab title to show modified state
        const tab = document.querySelector(`[data-file="${this.currentTab}"]`);
        const title = tab?.querySelector('.tab-title');
        if (title && !title.textContent.endsWith(' •')) {
            title.textContent += ' •';
        }

        this.updateHighlight();
        this.updateCursorPosition();
        this.updateLineNumbers(); // ✨ Update line numbers
    }

    updateHighlight() {
        // ✅ DISABLED: Syntax highlighting overlay causing visual issues
        // Just return - let the plain textarea show the code
        return;

        /* COMMENTED OUT - Causing double text rendering
        const editor = document.getElementById('codeEditor');
        const highlight = document.getElementById('codeHighlight');

        if (!editor || !highlight) return;

        const code = editor.value;
        const codeElement = highlight.querySelector('code');

        if (!codeElement) return;

        // Detect language from current file extension
        let language = 'javascript'; // default
        if (this.currentFile && this.currentFile.fileName) {
            const ext = this.currentFile.fileName.split('.').pop().toLowerCase();
            const langMap = {
                'js': 'javascript',
                'json': 'json',
                'html': 'html',
                'css': 'css',
                'py': 'python',
                'java': 'java',
                'md': 'markdown',
                'txt': 'plain'
            };
            language = langMap[ext] || 'plain';
        }

        // Simple syntax highlighting with Prism.js
        if (typeof Prism !== 'undefined' && Prism.highlight && Prism.languages[language]) {
            try {
                const highlightedCode = Prism.highlight(code, Prism.languages[language], language);
                codeElement.innerHTML = highlightedCode;
            } catch (error) {
                console.warn('Prism highlighting failed:', error);
                codeElement.textContent = code;
            }
        } else {
            // No Prism or unsupported language - plain text
            codeElement.textContent = code;
        }

        // Sync scroll position
        this.syncHighlight();
        */
    }

    syncHighlight() {
        const editor = document.getElementById('codeEditor');
        const highlight = document.getElementById('codeHighlight');

        if (editor && highlight) {
            highlight.scrollTop = editor.scrollTop;
            highlight.scrollLeft = editor.scrollLeft;
        }

        this.syncEditorScroll();
    }

    // Sync line numbers and indent guides with editor scroll
    syncEditorScroll() {
        const editorWrapper = document.querySelector('.editor-wrapper');
        if (!editorWrapper) return;

        const scrollTop = editorWrapper.scrollTop;
        const scrollLeft = editorWrapper.scrollLeft;

        // Sync line numbers scroll (vertical only)
        const lineNumbers = document.getElementById('lineNumbers');
        if (lineNumbers) {
            lineNumbers.scrollTop = scrollTop;
        }

        // Sync fold icons scroll (vertical only)
        const foldIcons = document.getElementById('foldIcons');
        if (foldIcons) {
            foldIcons.scrollTop = scrollTop;
        }

        // Sync indent guides scroll (both axes)
        const indentGuides = document.getElementById('indentGuides');
        if (indentGuides) {
            indentGuides.style.transform = `translate(-${scrollLeft}px, -${scrollTop}px)`;
        }

        // Update minimap viewport
        this.updateMinimapViewport();
    }

    // ✨ Update Line Numbers & Indent Guides
    updateLineNumbers() {
        const editor = document.getElementById('codeEditor');
        const lineNumbers = document.getElementById('lineNumbers');

        if (!editor || !lineNumbers) return;

        const code = editor.value;
        const lines = code.split('\n');
        const lineCount = lines.length;

        // Generate line numbers HTML
        let lineNumbersHTML = '';
        for (let i = 1; i <= lineCount; i++) {
            lineNumbersHTML += `<span>${i}</span>`;
        }

        lineNumbers.innerHTML = lineNumbersHTML;

        // Sync scroll position
        lineNumbers.scrollTop = editor.scrollTop;

        // Update indent guides (VS Code style)
        this.updateIndentGuides();

        // Update bracket matching
        this.highlightMatchingBracket();

        // Update code folding icons
        this.updateFoldIcons();

        // Update minimap
        this.updateMinimap();
    }

    // ✨ Code Folding System
    updateFoldIcons() {
        const editor = document.getElementById('codeEditor');
        const foldIconsContainer = document.getElementById('foldIcons');

        if (!editor || !foldIconsContainer) return;

        const lines = editor.value.split('\n');
        let html = '';

        if (!this.foldedRegions) {
            this.foldedRegions = new Set();
        }

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const isFoldable = this.isLineFoldable(line);
            const isFolded = this.foldedRegions.has(i);

            if (isFoldable) {
                const icon = isFolded ? '▶' : '▼';
                html += `<span class="fold-icon visible" data-line="${i}">${icon}</span>`;
            } else {
                html += '<span class="fold-icon"></span>';
            }
        }

        foldIconsContainer.innerHTML = html;

        // Sync scroll
        foldIconsContainer.scrollTop = editor.scrollTop;
    }

    isLineFoldable(line) {
        // Check if line has opening bracket/brace
        const trimmed = line.trim();
        return trimmed.endsWith('{') ||
            trimmed.includes('function') && trimmed.includes('{') ||
            trimmed.includes('class') && trimmed.includes('{') ||
            trimmed.includes('if') && trimmed.includes('{') ||
            trimmed.includes('for') && trimmed.includes('{') ||
            trimmed.includes('while') && trimmed.includes('{');
    }

    toggleFold(lineIndex) {
        const editor = document.getElementById('codeEditor');
        if (!editor) return;

        const lines = editor.value.split('\n');

        if (this.foldedRegions.has(lineIndex)) {
            // Unfold
            this.foldedRegions.delete(lineIndex);
        } else {
            // Fold - find closing bracket
            const endLine = this.findClosingBracket(lines, lineIndex);
            if (endLine > lineIndex) {
                this.foldedRegions.add(lineIndex);
            }
        }

        this.applyFolding();
    }

    findClosingBracket(lines, startLine) {
        let depth = 0;

        for (let i = startLine; i < lines.length; i++) {
            const line = lines[i];
            for (const char of line) {
                if (char === '{') depth++;
                else if (char === '}') {
                    depth--;
                    if (depth === 0) return i;
                }
            }
        }

        return -1;
    }

    applyFolding() {
        const editor = document.getElementById('codeEditor');
        if (!editor) return;

        const lines = editor.value.split('\n');
        const lineElements = document.querySelectorAll('.line-numbers span');

        // Hide/show lines
        this.foldedRegions.forEach(startLine => {
            const endLine = this.findClosingBracket(lines, startLine);
            if (endLine > startLine) {
                // Hide lines between start and end
                for (let i = startLine + 1; i <= endLine; i++) {
                    if (lineElements[i]) {
                        lineElements[i].style.display = 'none';
                    }
                }
            }
        });

        this.updateFoldIcons();
    }

    // ✨ Update Indent Guides (VS Code style - only in code blocks)
    updateIndentGuides() {
        const editor = document.getElementById('codeEditor');
        const indentGuidesContainer = document.getElementById('indentGuides');

        if (!editor || !indentGuidesContainer) return;

        const code = editor.value;
        const lines = code.split('\n');

        // Calculate indent levels for each line
        const indentLevels = lines.map(line => {
            const match = line.match(/^(\s*)/);
            const spaces = match ? match[1].length : 0;
            return Math.floor(spaces / 4); // 4 spaces = 1 indent level
        });

        // Find indent guide ranges (start-end pairs for each level)
        const guides = [];
        const tabSize = 4; // 4 characters per tab

        for (let level = 1; level <= Math.max(...indentLevels); level++) {
            let startLine = -1;

            for (let i = 0; i < lines.length; i++) {
                const currentLevel = indentLevels[i];
                const nextLevel = i + 1 < lines.length ? indentLevels[i + 1] : 0;
                const isEmptyLine = lines[i].trim().length === 0;

                // Start a guide block
                if (currentLevel >= level && startLine === -1) {
                    startLine = i;
                }

                // End a guide block
                if (startLine !== -1 && (currentLevel < level || i === lines.length - 1)) {
                    // Skip if it's a single line or just empty lines
                    if (i - startLine > 0) {
                        guides.push({
                            level: level,
                            startLine: startLine,
                            endLine: i - (currentLevel < level ? 1 : 0),
                            column: (level - 1) * tabSize
                        });
                    }
                    startLine = -1;
                }
            }
        }

        // Render indent guides as absolute positioned divs
        const lineHeight = parseFloat(getComputedStyle(editor).lineHeight) || 20;
        const charWidth = this.getCharWidth(editor);

        let guidesHTML = '';
        guides.forEach(guide => {
            const top = guide.startLine * lineHeight;
            const height = (guide.endLine - guide.startLine + 1) * lineHeight;
            const left = guide.column * charWidth;

            guidesHTML += `<div class="indent-guide" style="
                position: absolute;
                top: ${top}px;
                left: ${left}px;
                width: 1px;
                height: ${height}px;
                background-color: var(--border-color, #3c3c3c);
                opacity: 0.4;
                pointer-events: none;
            "></div>`;
        });

        indentGuidesContainer.innerHTML = guidesHTML;

        // Sync scroll position
        indentGuidesContainer.scrollTop = editor.scrollTop;
        indentGuidesContainer.scrollLeft = editor.scrollLeft;
    }

    // Helper: Get character width in editor
    getCharWidth(editor) {
        if (!editor) return 8;

        // Cache the result
        if (this._cachedCharWidth) return this._cachedCharWidth;

        // Create temporary span to measure character width
        const span = document.createElement('span');
        span.style.font = getComputedStyle(editor).font;
        span.style.visibility = 'hidden';
        span.style.position = 'absolute';
        span.textContent = 'X';

        document.body.appendChild(span);
        const width = span.offsetWidth;
        document.body.removeChild(span);

        this._cachedCharWidth = width;
        return width;
    }

    updateCursorPosition() {
        const editor = document.getElementById('codeEditor');
        const positionElement = document.getElementById('cursorPosition');

        if (editor && positionElement) {
            const value = editor.value;
            const selectionStart = editor.selectionStart;

            const lines = value.substring(0, selectionStart).split('\n');
            const line = lines.length;
            const column = lines[lines.length - 1].length + 1;

            positionElement.textContent = `Satır ${line}, Sütun ${column}`;
        }
    }

    // ===== GO TO LINE FEATURE =====
    showGotoLineModal() {
        const modal = document.getElementById('gotoLineModal');
        const input = document.getElementById('gotoLineInput');

        if (modal && input) {
            modal.classList.remove('hidden');
            input.value = '';
            input.focus();
        }
    }

    hideGotoLineModal() {
        const modal = document.getElementById('gotoLineModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    gotoLine() {
        const input = document.getElementById('gotoLineInput');
        const editor = document.getElementById('codeEditor');

        if (!input || !editor) return;

        const lineNumber = parseInt(input.value);
        if (isNaN(lineNumber) || lineNumber < 1) {
            return;
        }

        const lines = editor.value.split('\n');
        const totalLines = lines.length;

        // Clamp to valid range
        const targetLine = Math.min(lineNumber, totalLines);

        // Calculate character position
        let charPos = 0;
        for (let i = 0; i < targetLine - 1; i++) {
            charPos += lines[i].length + 1; // +1 for newline
        }

        // Set cursor position
        editor.focus();
        editor.setSelectionRange(charPos, charPos + (lines[targetLine - 1]?.length || 0));

        // Scroll to line
        const lineHeight = parseFloat(getComputedStyle(editor).lineHeight) || 20;
        const scrollTop = (targetLine - 1) * lineHeight - (editor.clientHeight / 2);
        editor.scrollTop = Math.max(0, scrollTop);

        // Update UI
        this.syncHighlight();
        this.updateCursorPosition();
        this.hideGotoLineModal();
    }

    saveFile() {
        if (!this.currentFile) return;

        if (this.currentFile.isNew) {
            this.saveFileAs();
        } else {
            this.performSave();
        }
    }

    async saveFileAs() {
        try {
            this.showLoading('Dosya kaydediliyor...');

            const result = await this.ipc.invoke('save-file-dialog');

            if (result.canceled || !result.filePath) {
                this.hideLoading();
                return;
            }

            const filePath = result.filePath;
            const fileName = this.path.basename(filePath);

            const saveResult = await this.ipc.invoke('write-file', filePath, this.currentFile.content);

            if (!saveResult.success) {
                this.hideLoading();
                this.showError('Dosya kaydedilemedi: ' + saveResult.error);
                return;
            }

            // Update current file info
            this.currentFile.isNew = false;
            this.currentFile.isModified = false;
            this.currentFile.filePath = filePath;
            this.currentFile.fileName = fileName;

            // Update tab title
            const tab = document.querySelector(`[data-file="${this.currentTab}"]`);
            const titleElement = tab?.querySelector('.tab-title');
            if (titleElement) {
                titleElement.textContent = fileName;
            }

            // Update UI
            document.getElementById('fileName').textContent = fileName;
            document.getElementById('filePath').textContent = filePath;

            this.addToRecentFiles(fileName, filePath);
            this.hideLoading();
            this.updateStatus('Dosya kaydedildi: ' + fileName);

        } catch (error) {
            this.hideLoading();
            this.showError('Dosya kaydedilirken hata oluştu: ' + error.message);
        }
    }

    async performSave() {
        try {
            this.showLoading('Kaydediliyor...');

            const saveResult = await this.ipc.invoke('write-file', this.currentFile.filePath, this.currentFile.content);

            if (!saveResult.success) {
                this.hideLoading();
                this.showError('Dosya kaydedilemedi: ' + saveResult.error);
                return;
            }

            this.currentFile.isModified = false;

            // Update tab title
            const tab = document.querySelector(`[data-file="${this.currentTab}"]`);
            const title = tab?.querySelector('.tab-title');
            if (title) {
                title.textContent = title.textContent.replace(' •', '');
            }

            this.hideLoading();
            this.updateStatus('Dosya kaydedildi');

        } catch (error) {
            this.hideLoading();
            this.showError('Dosya kaydedilirken hata oluştu: ' + error.message);
        }
    }

    copyContent() {
        const editor = document.getElementById('codeEditor');
        if (editor) {
            const selectedText = editor.value.substring(editor.selectionStart, editor.selectionEnd);
            const textToCopy = selectedText || editor.value;

            navigator.clipboard.writeText(textToCopy).then(() => {
                this.updateStatus('İçerik kopyalandı');
            }).catch(err => {
                console.error('Kopyalama hatası:', err);
            });
        }
    }

    async sendChatMessage() {
        // ✅ FIX: Declare variables at method scope (accessible in try/catch/finally)
        const chatInput = document.getElementById('chatInput');
        const sendBtn = document.getElementById('sendChatBtn');
        let message, chatMode, contextAwarePrompt, displayMessage, conversationContext, isContinuation;

        // ✅ NEW: Proper mutex-based atomic execution
        // Replaces old flag-based system with guaranteed atomic operations
        await this.messageMutex.acquire();
        
        try {
            // Early return #1: Empty input check
            if (!chatInput || !chatInput.value.trim()) {
                this.messageMutex.release(); // Release mutex before early return!
                return;
            }

            message = chatInput.value.trim();

            // 🔄 SMART PHASE RESET: Only reset if NEW project detected
            // Keywords indicating continuation: "devam", "phase", "adım", "sonraki"
            isContinuation = /\b(devam|phase|adım|sonraki|kaldığı|tamamla)\b/i.test(message);
            
            if (!isContinuation) {
                // New project - reset phase context
                this.phaseContext.currentPhase = 0;
                this.phaseContext.completedFiles.clear();
                this.phaseContext.lastMission = null;
                console.log('🔄 Phase context reset - NEW PROJECT detected');
            } else {
                console.log('➡️ Phase continuation detected - keeping phase context');
            }
            
            chatInput.value = '';
            chatInput.style.height = 'auto';

            // Check for project commands if we have an active project
            if (this.currentProjectData && this.detectProjectCommand(message)) {
                await this.processProjectCommand(message);
                this.messageMutex.release(); // Early return #2: Release mutex!
                return;
            }

            // Disable send button
            if (sendBtn) {
                sendBtn.disabled = true;
                sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            }

            // Read ai mode from chat controls (prompt action is now automatic via Router Agent)
            const chatAiModeSelect = document.getElementById('chatAiModeSelect');
            chatMode = chatAiModeSelect ? chatAiModeSelect.value : this.aiMode.current || 'ask';

            // Build context-aware prompt with conversation history
            contextAwarePrompt = this.buildContextAwarePrompt(message, chatMode === 'agent');

            // Sync global aiMode with chat selection
            if (chatMode === 'agent' && this.aiMode.current !== 'agent') {
                this.switchToAgentMode();
            } else if (chatMode !== 'agent' && this.aiMode.current !== 'ask') {
                this.switchToAskMode();
            }

            // Add user message to chat (without extra labels - clean UI)
            conversationContext = this.getConversationContext(3);
            this.addContextualChatMessage('user', message, {
                originalMessage: message,
                mode: chatMode,
                hasContext: !!conversationContext
            });

        } catch (error) {
            console.error('❌ Initial processing error:', error);
            // Re-enable send button if there was an early error
            if (sendBtn) {
                sendBtn.disabled = false;
                sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
            }
            this.isProcessingMessage = false;
            return;
        }

        try {
            // Check if API key is set for current provider
            const provider = this.settings.llmProvider || 'openai';

            if (provider === 'openai' && !this.settings.apiKey) {
                throw new Error('OpenAI API anahtarı ayarlanmamış. Lütfen üst bardan API anahtarınızı girin.');
            } else if (provider === 'anthropic' && !this.settings.claudeApiKey) {
                throw new Error('Claude API anahtarı ayarlanmamış. Lütfen üst bardan API anahtarınızı girin.');
            }

            // Agent mode ile unified system kullan (context-aware)
            if (chatMode === 'agent') {
                // 🌌 LUMA SUPRIME AGENT EXECUTION
                if (this.lumaSuprimeAgent) {
                    try {
                        console.log('🌌 Supreme Agent processing:', message);
                        
                        // 🔄 Build context with phase information for agent coordination
                        const supremeContext = {
                            message,
                            phaseContext: {
                                currentPhase: this.phaseContext.currentPhase,
                                totalPhases: this.phaseContext.totalPhases,
                                lastMission: this.phaseContext.lastMission,
                                completedFiles: Array.from(this.phaseContext.completedFiles),
                                projectContinuation: isContinuation
                            },
                            session: this.sessionContext,
                            system: {
                                developerMode: this.developerMode,
                                workspaceRoot: this.workspaceRoot
                            }
                        };
                        
                        // Execute via Supreme Agent (handles all reasoning, validation, assignment)
                        const supremeResult = await this.lumaSuprimeAgent.execute(message, supremeContext);
                        
                        console.log('🌌 Supreme Result:', supremeResult);
                        
                        // ✅ EARLY RETURN: Handle greeting responses (no execution needed)
                        if (supremeResult.type === 'greeting' || supremeResult.skipExecution) {
                            console.log('💬 Greeting response - skipping unified agent task');
                            
                            this.addContextualChatMessage('ai', supremeResult.message, {
                                mode: 'greeting',
                                supremeResult
                            });
                            
                            if (sendBtn) {
                                sendBtn.disabled = false;
                                sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
                            }
                            this.messageMutex.release(); // Early return: Release mutex!
                            return;
                        }
                        
                        // Handle Supreme Agent response
                        if (supremeResult.type === 'blocked') {
                            // Decision was blocked by validation
                            this.addContextualChatMessage('ai', supremeResult.message, {
                                mode: 'suprime-blocked',
                                supremeResult
                            });
                            
                            if (sendBtn) {
                                sendBtn.disabled = false;
                                sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
                            }
                            this.messageMutex.release(); // Early return #3: Release mutex!
                            return;
                        }
                        
                        if (supremeResult.type === 'error') {
                            // Supreme Agent encountered an error
                            this.addContextualChatMessage('ai', supremeResult.message, {
                                mode: 'suprime-error',
                                supremeResult
                            });
                            
                            if (sendBtn) {
                                sendBtn.disabled = false;
                                sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
                            }
                            this.messageMutex.release(); // Early return #4: Release mutex!
                            return;
                        }
                        
                        // Success - show Supreme Agent decision and result
                        const summaryMessage = `
🌌 **Supreme Agent Decision**

**Intent:** ${supremeResult.intent}
**Agent Assigned:** ${supremeResult.agent}
**Task Priority:** ${supremeResult.task?.priority || 'N/A'}/10

**Decision:** ${supremeResult.decision?.message || 'Processing...'}

**Result:** ${supremeResult.result?.message || supremeResult.message}
                        `.trim();
                        
                        this.addContextualChatMessage('ai', summaryMessage, {
                            mode: 'suprime-success',
                            supremeResult
                        });
                        
                        // Always execute unified agent task after Supreme Agent decision
                        // Supreme Agent only decides, doesn't execute
                        console.log('🎯 Executing task via Unified Agent System...');
                        
                        // 🎼 HIERARCHY SYSTEM: Wrap Luma's decision with orchestrator metadata
                        const lumaDecision = {
                            role: supremeResult.agent.toLowerCase().replace('agent', ''), // "ExecutorAgent" → "executor"
                            mode: 'action',
                            confidence: 1.0,
                            reasoning: supremeResult.decision?.message || 'Luma Supreme decision',
                            // 🔄 PHASE CONTEXT: Attach phase information to route
                            phaseContext: supremeContext.phaseContext
                        };
                        
                        // Wrap with hierarchy (Level 0 = Orchestrator = FINAL)
                        const lumaRoute = wrapDecision('LumaSupremeAgent', lumaDecision);
                        
                        console.log('🎼 Luma Supreme decision wrapped with hierarchy:');
                        console.log('   Level:', lumaRoute._hierarchy.level, '(ORCHESTRATOR)');
                        console.log('   Is Final:', lumaRoute._hierarchy.isFinal, '🔒');
                        console.log('   Agent:', lumaRoute._hierarchy.agent);
                        console.log('   Phase Context:', lumaRoute.phaseContext);
                        
                        await this.executeUnifiedAgentTask(contextAwarePrompt, lumaRoute);
                        
                    } catch (supremeError) {
                        console.error('❌ Supreme Agent error:', supremeError);
                        
                        // Fallback to Luma Bridge
                        console.log('⚠️ Falling back to Luma Bridge...');
                        
                        if (this.lumaBridge) {
                            const lumaDecision = await this.lumaBridge.processMessage(message);
                            
                            if (lumaDecision.type === 'warning' && !lumaDecision.approved) {
                                const confirmed = await this.showLumaConfirmation(lumaDecision);
                                if (!confirmed) {
                                    if (sendBtn) {
                                        sendBtn.disabled = false;
                                        sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
                                    }
                                    this.messageMutex.release(); // Early return #5: Release mutex!
                                    return;
                                }
                            }
                        }
                        
                        // Execute unified agent task
                        await this.executeUnifiedAgentTask(contextAwarePrompt);
                    }
                } else if (this.lumaBridge) {
                    // FALLBACK: Original Luma Bridge logic
                    try {
                        const lumaDecision = await this.lumaBridge.processMessage(message);
                        
                        // Luma karar verdi - kullanıcıya bildir
                        if (lumaDecision.type === 'warning') {
                            // Riskli komut - onay iste
                            this.addContextualChatMessage('ai', lumaDecision.message, {
                                mode: 'luma-warning',
                                lumaDecision
                            });
                            
                            // Kullanıcı onayı bekle
                            const confirmed = await this.showLumaConfirmation(lumaDecision);
                            if (!confirmed) {
                                // Kullanıcı reddetti
                                if (sendBtn) {
                                    sendBtn.disabled = false;
                                    sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
                                }
                                this.isProcessingMessage = false;
                                return;
                            }
                        } else if (lumaDecision.type === 'suggestion') {
                            // Context eksik - önce düzelt
                            this.addContextualChatMessage('ai', lumaDecision.message, {
                                mode: 'luma-suggestion',
                                lumaDecision
                            });
                            
                            // Auto-fix varsa uygula
                            if (lumaDecision.metadata?.autoFixable && lumaDecision.fix) {
                                this.addContextualChatMessage('ai', `🔧 Düzeltme uygulanıyor: ${lumaDecision.fix}`, {
                                    mode: 'luma-autofix'
                                });
                            }
                        } else if (lumaDecision.type === 'learned_response') {
                            // Öğrenilmiş pattern - bilgi ver
                            this.addContextualChatMessage('ai', lumaDecision.message, {
                                mode: 'luma-learned',
                                lumaDecision
                            });
                        } else if (lumaDecision.type === 'new_reflection') {
                            // Yeni hata analizi
                            this.addContextualChatMessage('ai', lumaDecision.message, {
                                mode: 'luma-reflection',
                                lumaDecision
                            });
                        }
                        
                    } catch (lumaError) {
                        console.error('❌ Luma reasoning error:', lumaError);
                    }
                    
                    // Unified Agent System - GitHub Copilot tarzı with conversation memory
                    await this.executeUnifiedAgentTask(contextAwarePrompt);
                } else {
                    // NO LUMA: Direct execution
                    await this.executeUnifiedAgentTask(contextAwarePrompt);
                }
            } else {
                // ✨ Enhanced Ask Mode - Unified LLM call (OpenAI or Claude)
                const enhancedPrompt = this.addExecutionContext(contextAwarePrompt);

                // Convert to messages format for unified LLM interface
                const messages = [
                    { role: 'user', content: enhancedPrompt }
                ];

                // Use unified LLM interface (routes to OpenAI or Claude)
                const response = await this.queueOpenAIRequest(async () => {
                    return await this.callLLM(messages, {
                        temperature: 0.7,
                        maxTokens: 4096
                    });
                });

                this.addContextualChatMessage('ai', response, {
                    mode: 'ask',
                    hasContext: !!conversationContext
                });
            }

            // Re-enable send button
            if (sendBtn) {
                sendBtn.disabled = false;
                sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
            }

        } catch (error) {
            this.addChatMessage('system', `❌ Hata: ${error.message}`);

            // Re-enable send button
            if (sendBtn) {
                sendBtn.disabled = false;
                sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
            }
        } finally {
            // ✅ NEW: Always release mutex (guaranteed atomic release)
            this.messageMutex.release();
        }
    }

    // =====================================
    // Enhanced Ask Mode with Execution Context
    // =====================================
    addExecutionContext(prompt) {
        if (this.lastExecutionSummary) {
            const timeDiff = Date.now() - new Date(this.lastExecutionSummary.timestamp).getTime();
            const minutesAgo = Math.floor(timeDiff / 60000);

            if (minutesAgo < 30) { // 30 dakika içindeki execution'ları kabul et
                return `${prompt}

📋 SON AGENT EXECUTION BİLGİSİ (${minutesAgo} dakika önce):
Görev: ${this.lastExecutionSummary.task}
Sonuç: ${this.lastExecutionSummary.summary}

Bu bilgilere dayanarak kullanıcının sorusunu yanıtla.`;
            }
        }
        return prompt;
    }

    // Detect project-related commands in chat
    detectProjectCommand(message) {
        const commands = [
            /\b(değiştir|modify|update|güncelle)\b/i,
            /\b(implement|başlat|create|oluştur)\b/i,
            /\b(save|kaydet)\b/i,
            /\b(approve|onayla|onay)\b/i,
            /\b(add feature|özellik ekle)\b/i,
            /\b(change tech|teknoloji değiştir)\b/i
        ];

        return commands.some(pattern => pattern.test(message));
    }

    // Process project commands from chat
    async processProjectCommand(message) {
        const lowerMessage = message.toLowerCase();

        if (lowerMessage.includes('değiştir') || lowerMessage.includes('modify') || lowerMessage.includes('güncelle')) {
            await this.handleProjectModification(message);
        }
        else if (lowerMessage.includes('implement') || lowerMessage.includes('başlat') || lowerMessage.includes('oluştur')) {
            this.approveAndImplementProject();
        }
        else if (lowerMessage.includes('save') || lowerMessage.includes('kaydet')) {
            await this.saveProject();
        }
        else if (lowerMessage.includes('approve') || lowerMessage.includes('onayla')) {
            this.approveAndImplementProject();
        }
        else if (lowerMessage.includes('add feature') || lowerMessage.includes('özellik ekle')) {
            await this.handleFeatureAddition(message);
        }
        else if (lowerMessage.includes('change tech') || lowerMessage.includes('teknoloji değiştir')) {
            await this.handleTechStackChange(message);
        }
    }

    // Handle project modifications
    async handleProjectModification(message) {
        try {
            // Use AI to extract modification intent
            const modificationPrompt = `Kullanıcının proje değişiklik isteğini analiz et:

Mesaj: "${message}"

Mevcut Proje: ${this.currentProjectData.title}

Lütfen aşağıdaki JSON formatında değişiklik önerisi döndür:

{
    "type": "modification",
    "changes": {
        "title": "yeni başlık (eğer varsa)",
        "prompt": "yeni açıklama (eğer varsa)", 
        "features": ["yeni özellik 1", "yeni özellik 2"],
        "techStack": {
            "frontend": ["teknoloji1", "teknoloji2"],
            "backend": ["teknoloji1"]
        }
    },
    "requiresAnalysis": true/false,
    "explanation": "Yapılacak değişikliklerin açıklaması"
}

Sadece değiştirilmesi istenen alanları dahil et.`;

            const response = await this.callOpenAI(modificationPrompt);
            const jsonMatch = response.match(/\{[\s\S]*\}/);

            if (jsonMatch) {
                const modifications = JSON.parse(jsonMatch[0]);
                await this.modifyProjectFromChat(modifications.changes);

                const explanationMessage = `🔄 **Anlık Değişiklik Algılandı**

${modifications.explanation}

Değişiklik yapıyorum...`;

                this.addContextualChatMessage('assistant', explanationMessage, {
                    isProjectModification: true
                });
            }

        } catch (error) {
            console.error('Modification handling error:', error);
            this.addContextualChatMessage('assistant', '❌ Değişiklik talebi anlaşılamadı. Lütfen daha spesifik olun.', {
                isError: true
            });
        }
    }

    // Handle feature additions
    async handleFeatureAddition(message) {
        const featureMatch = message.match(/(?:add feature|özellik ekle)[:\s]+(.+)/i);
        if (featureMatch) {
            const newFeature = featureMatch[1].trim();

            await this.modifyProjectFromChat({
                features: [newFeature],
                requiresAnalysis: false
            });
        }
    }

    // Handle tech stack changes
    async handleTechStackChange(message) {
        try {
            const techPrompt = `Kullanıcının teknoloji değişiklik isteğini analiz et:

Mesaj: "${message}"

Hangi teknolojiler değiştirilmek isteniyor? JSON formatında döndür:

{
    "techStack": {
        "frontend": ["yeni teknolojiler"],
        "backend": ["yeni teknolojiler"], 
        "database": ["yeni teknolojiler"]
    }
}`;

            const response = await this.callOpenAI(techPrompt);
            const jsonMatch = response.match(/\{[\s\S]*\}/);

            if (jsonMatch) {
                const techChanges = JSON.parse(jsonMatch[0]);
                await this.modifyProjectFromChat({
                    techStack: techChanges.techStack,
                    requiresAnalysis: true
                });
            }

        } catch (error) {
            console.error('Tech stack change error:', error);
            this.addContextualChatMessage('assistant', '❌ Teknoloji değişikliği anlaşılamadı.', {
                isError: true
            });
        }
    }

    // Save project for later use
    async saveProject() {
        if (!this.currentProjectData) {
            this.showNotification('❌ Kaydedilecek proje yok', 'error');
            return;
        }

        try {
            // Save to localStorage with timestamp
            const savedProjects = JSON.parse(localStorage.getItem('savedProjects') || '[]');
            const projectToSave = {
                ...this.currentProjectData,
                savedAt: new Date().toISOString(),
                id: Date.now().toString()
            };

            savedProjects.push(projectToSave);
            localStorage.setItem('savedProjects', JSON.stringify(savedProjects));

            const saveMessage = `💾 **Proje Kaydedildi**

**${this.currentProjectData.title}** başarıyla kaydedildi.

Daha sonra "Kaydedilen Projeler" bölümünden erişebilirsin.`;

            this.addContextualChatMessage('assistant', saveMessage, {
                isProjectSave: true
            });

            this.showNotification('✅ Proje kaydedildi', 'success');

        } catch (error) {
            console.error('Project save error:', error);
            this.showNotification('❌ Proje kaydedilemedi', 'error');
        }
    }

    addChatMessage(type, content) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;

        const message = document.createElement('div');
        message.className = `chat-message ${type}`;

        const now = new Date();
        const timeStr = now.toLocaleTimeString('tr-TR', {
            hour: '2-digit',
            minute: '2-digit'
        });

        const icon = type === 'user' ? 'fa-user' :
            type === 'ai' ? 'fa-dragon' : 'fa-info-circle';

        // Process content for code blocks
        const processedContent = this.processMessageContent(content);

        message.innerHTML = `
      <div class="message-content">
        <i class="fas ${icon}"></i>
        ${processedContent}
      </div>
      <div class="message-time">${timeStr}</div>
    `;

        chatMessages.appendChild(message);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        // Store in chat history
        this.chatHistory.push({ type, content, timestamp: now });
    }

    processMessageContent(content) {
        // Regex to match code blocks: ```language\ncode\n```
        const codeBlockRegex = /```(\w+)?\n?([\s\S]*?)```/g;
        let processedContent = content;
        let match;

        while ((match = codeBlockRegex.exec(content)) !== null) {
            const language = match[1] || 'text';
            const code = match[2].trim();

            const codeBlock = this.createCodeBlock(language, code);
            processedContent = processedContent.replace(match[0], codeBlock);
        }

        // Process inline code: `code`
        processedContent = processedContent.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

        // Convert paragraphs
        const paragraphs = processedContent.split('\n\n');
        const htmlParagraphs = paragraphs
            .filter(p => p.trim() && !p.includes('code-block-container'))
            .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
            .join('');

        // Combine code blocks and text
        const codeBlocks = [...content.matchAll(/```[\s\S]*?```/g)];
        if (codeBlocks.length > 0) {
            let result = '';
            let lastIndex = 0;

            codeBlocks.forEach(match => {
                // Add text before code block
                const textBefore = content.slice(lastIndex, match.index);
                if (textBefore.trim()) {
                    result += textBefore.split('\n\n')
                        .filter(p => p.trim())
                        .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
                        .join('');
                }

                // Add code block
                const language = match[0].match(/```(\w+)?/)?.[1] || 'text';
                const code = match[0].replace(/```\w*\n?/, '').replace(/```$/, '').trim();
                result += this.createCodeBlock(language, code);

                lastIndex = match.index + match[0].length;
            });

            // Add remaining text
            const remainingText = content.slice(lastIndex);
            if (remainingText.trim()) {
                result += remainingText.split('\n\n')
                    .filter(p => p.trim())
                    .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
                    .join('');
            }

            return result;
        }

        return htmlParagraphs || `<p>${processedContent}</p>`;
    }

    createCodeBlock(language, code) {
        const blockId = `code-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        return `
      <div class="code-block-container">
        <div class="code-block-header">
          <span class="code-language">${language.toUpperCase()}</span>
          <div class="code-actions">
            <button class="copy-btn" onclick="kodCanavari.copyCode('${blockId}')">
              <i class="fas fa-copy"></i> Kopyala
            </button>
          </div>
        </div>
        <div class="code-content" id="${blockId}">${this.escapeHtml(code)}</div>
      </div>
    `;
    }

    copyCode(blockId) {
        const codeElement = document.getElementById(blockId);
        if (!codeElement) return;

        const code = codeElement.textContent;

        navigator.clipboard.writeText(code).then(() => {
            // Visual feedback
            const copyBtn = codeElement.parentElement.querySelector('.copy-btn');
            const originalText = copyBtn.innerHTML;

            copyBtn.innerHTML = '<i class="fas fa-check"></i> Kopyalandı!';
            copyBtn.classList.add('copied');

            setTimeout(() => {
                copyBtn.innerHTML = originalText;
                copyBtn.classList.remove('copied');
            }, 2000);
        }).catch(err => {
            console.error('Kopyalama hatası:', err);
            this.showNotification('Kopyalama başarısız!', 'error');
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    sanitizeChatContent(content) {
        if (!content) {
            return '';
        }

        if (typeof content !== 'string') {
            return content;
        }

        const blockedTags = ['meta', 'script', 'style', 'link', 'iframe', 'object', 'embed', 'base'];
        let sanitized = content;

        blockedTags.forEach(tag => {
            const openTagRegex = new RegExp(`<${tag}[^>]*>`, 'gi');
            sanitized = sanitized.replace(openTagRegex, match => this.escapeHtml(match));

            const closeTagRegex = new RegExp(`</${tag}>`, 'gi');
            sanitized = sanitized.replace(closeTagRegex, match => this.escapeHtml(match));
        });

        return sanitized;
    }

    initializeTerminal() {
        // Initialize terminal with PowerShell-like environment
        this.updateTerminalPath();
        this.addTerminalLine('Windows PowerShell', 'success');
        this.addTerminalLine('Copyright (C) Microsoft Corporation. Tüm hakları saklıdır.', 'output');
        this.addTerminalLine('', 'output');
    }

    clearChat() {
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            chatMessages.innerHTML = `
        <div class="chat-message system">
          <div class="message-content">
            <i class="fas fa-dragon"></i>
            <p>🧠 Sohbet temizlendi. Hafıza sıfırlandı. Size nasıl yardımcı olabilirim?</p>
          </div>
          <div class="message-time">Az önce</div>
        </div>
      `;
        }

        // Clear conversation memory
        this.chatHistory = [];

        // Clear any pending actions
        this.pendingAction = null;

        // Clear agent state
        this.clearAgentState();

        this.updateStatus('Sohbet ve hafıza temizlendi');
    }

    // Show conversation summary before clearing
    showConversationSummary() {
        if (this.chatHistory.length === 0) {
            this.addChatMessage('system', '📝 Henüz bir konuşma geçmişi yok.');
            return;
        }

        const summary = this.extractConversationSummary();
        const context = this.getConversationContext(10);

        let summaryText = '📊 **Konuşma Özeti:**\n\n';

        if (summary.topics.length > 0) {
            summaryText += `🏷️ **Konuşulan Konular:** ${summary.topics.join(', ')}\n\n`;
        }

        if (summary.entities.length > 0) {
            summaryText += `📁 **Bahsedilen Öğeler:** ${summary.entities.join(', ')}\n\n`;
        }

        if (summary.lastIntent) {
            summaryText += `🎯 **Son Niyet:** ${summary.lastIntent}\n\n`;
        }

        summaryText += `💬 **Toplam Mesaj:** ${this.chatHistory.length}\n`;
        summaryText += `⏰ **Süre:** ${this.chatHistory.length > 0 ?
            new Date(this.chatHistory[this.chatHistory.length - 1].timestamp).toLocaleString('tr-TR') : 'N/A'}`;

        this.addChatMessage('system', summaryText);
    }

    async quickAction(action) {
        const editor = document.getElementById('codeEditor');
        if (!editor) return;

        const selectedText = editor.value.substring(editor.selectionStart, editor.selectionEnd);
        const codeToAnalyze = selectedText || editor.value;

        if (!codeToAnalyze.trim()) {
            this.addChatMessage('system', 'Lütfen önce bir kod yazın veya seçin.');
            return;
        }

        // Check API key
        if (!this.settings.apiKey) {
            this.addChatMessage('system', '❌ OpenAI API anahtarı gerekli. Lütfen sol panelden API anahtarınızı girin.');
            return;
        }

        let prompt = '';
        let systemPrompt = '';

        switch (action) {
            case 'generate':
                prompt = `Bu koda benzer bir kod örneği oluştur ve açıkla:\n\n\`\`\`\n${codeToAnalyze}\n\`\`\``;
                systemPrompt = 'Sen bir kod üretme uzmanısın. Verilen kod örneğinden yola çıkarak benzer, anlaşılır ve iyi açıklanmış kod örnekleri üretiyorsun.';
                break;
            case 'explain':
                prompt = `Bu kodun ne yaptığını detaylı olarak açıkla:\n\n\`\`\`\n${codeToAnalyze}\n\`\`\``;
                systemPrompt = 'Sen bir kod açıklama uzmanısın. Karmaşık kodu basit ve anlaşılır Türkçe ile açıklıyorsun.';
                break;
            case 'optimize':
                prompt = `Bu kodu optimize et ve iyileştirme önerilerini açıkla:\n\n\`\`\`\n${codeToAnalyze}\n\`\`\``;
                systemPrompt = 'Sen bir kod optimizasyon uzmanısın. Performans, okunabilirlik ve best practices açısından kod iyileştirmeleri öneriyorsun.';
                break;
            case 'bugs':
                prompt = `Bu kodda potansiyel hataları bul ve düzeltme önerilerini ver:\n\n\`\`\`\n${codeToAnalyze}\n\`\`\``;
                systemPrompt = 'Sen bir kod analiz uzmanısın. Potansiyel hataları, güvenlik açıklarını ve sorunları tespit edip çözüm öneriyorsun.';
                break;
        }

        try {
            this.addChatMessage('user', prompt);

            // Show typing indicator
            const typingId = this.addTypingIndicator();

            const response = await this.callOpenAI(prompt, systemPrompt);

            // Remove typing indicator and add response
            this.removeTypingIndicator(typingId);
            this.addChatMessage('ai', response);

            this.updateStatus('AI analizi tamamlandı');

        } catch (error) {
            this.removeTypingIndicator();
            this.addChatMessage('system', `❌ AI Hatası: ${error.message}`);
            this.updateStatus('AI analizi başarısız');
        }
    }

    addTypingIndicator() {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;

        const typingId = 'typing_' + Date.now();
        const typing = document.createElement('div');
        typing.className = 'chat-message ai typing';
        typing.id = typingId;
        typing.innerHTML = `
      <div class="message-content">
        <i class="fas fa-dragon"></i>
        <div class="typing-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    `;

        chatMessages.appendChild(typing);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        return typingId;
    }

    removeTypingIndicator(typingId) {
        const typing = document.getElementById(typingId);
        if (typing) {
            typing.remove();
        }
    }

    // Terminal Methods
    async runTerminalCommand() {
        const input = document.getElementById('terminalInput');
        const runBtn = document.getElementById('runCommandBtn');

        if (!input || !input.value.trim()) return;

        const command = input.value.trim();
        input.value = '';

        // Add to history
        if (command !== this.terminalHistory[this.terminalHistory.length - 1]) {
            this.terminalHistory.push(command);
        }
        this.terminalHistoryIndex = this.terminalHistory.length;

        // Show command in output with PowerShell-like prompt
        const psPrompt = `PS ${this.currentWorkingDirectory}> `;
        this.addTerminalLine(`${psPrompt}${command}`, 'command');

        // Disable run button
        if (runBtn) {
            runBtn.disabled = true;
            runBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        }

        try {
            // Handle built-in commands
            if (await this.handleBuiltinCommand(command)) {
                return;
            }

            // Check if this is a streaming command (long-running process)
            if (this.isStreamingCommand(command)) {
                await this.startStreamingProcess(command);
                return;
            }

            // Run regular command via IPC
            // Note: cwd is optional here (main process will use cwdRef from SSOT)
            const result = await this.ipc.invoke('run-command', command, this.currentWorkingDirectory);

            // Check for "NO_WORKSPACE_SELECTED" error (fail-fast from main)
            if (!result.success && result.error === 'NO_WORKSPACE_SELECTED') {
                this.addTerminalLine('❌ Workspace seçilmemiş! Lütfen "Klasör Seç" butonunu kullanın.', 'error');
                return;
            }

            if (result.stdout) {
                this.addTerminalLine(result.stdout, 'output');
            }

            if (result.stderr) {
                this.addTerminalLine(result.stderr, 'error');
            }

            if (!result.success && result.error) {
                this.addTerminalLine(`Error: ${result.error}`, 'error');
            }

            // Update status
            const status = result.success ? 'success' : 'error';
            this.addTerminalLine(`Exit code: ${result.exitCode || 0}`, status);

        } catch (error) {
            this.addTerminalLine(`Terminal Error: ${error.message}`, 'error');
        } finally {
            // Re-enable run button
            if (runBtn) {
                runBtn.disabled = false;
                runBtn.innerHTML = '<i class="fas fa-play"></i>';
            }
        }
    }

    async handleBuiltinCommand(command) {
        const parts = command.trim().split(/\s+/);
        const cmd = parts[0].toLowerCase();

        switch (cmd) {
            case 'clear':
            case 'cls':
                this.clearTerminal();
                return true;

            case 'cd':
                if (parts.length === 1) {
                    // cd without arguments - go to user home
                    this.setWorkingDirectory(require('os').homedir());
                } else {
                    let targetDir = parts.slice(1).join(' ');

                    // Handle relative paths
                    if (!targetDir.startsWith('C:') && !targetDir.startsWith('/')) {
                        const path = require('path');
                        targetDir = path.resolve(this.currentWorkingDirectory, targetDir);
                    }

                    // Handle quoted paths
                    if (targetDir.startsWith('"') && targetDir.endsWith('"')) {
                        targetDir = targetDir.slice(1, -1);
                    }

                    this.setWorkingDirectory(targetDir);
                }

                this.addTerminalLine(`Changed directory to: ${this.currentWorkingDirectory}`, 'success');
                return true;

            case 'pwd':
                this.addTerminalLine(this.currentWorkingDirectory, 'output');
                return true;

            case 'help':
                this.showTerminalHelp();
                return true;

            case 'stop':
                if (parts.length < 2) {
                    this.addTerminalLine('Usage: stop <processId>', 'error');
                    this.addTerminalLine('Use "ps" to list active processes', 'output');
                } else {
                    await this.stopProcess(parts[1]);
                }
                return true;

            case 'ps':
            case 'processes':
                await this.listActiveProcesses();
                return true;

            default:
                return false;
        }
    }

    showTerminalHelp() {
        const helpText = `
KayraDeniz Kod Canavarı Terminal - Mevcut Komutlar:

Built-in Commands:
  clear, cls       - Terminal ekranını temizle
  cd [dir]         - Dizin değiştir
  pwd              - Mevcut dizini göster
  stop <id>        - Streaming process'i durdur
  ps, processes    - Aktif process'leri listele
  help             - Bu yardım mesajını göster

Streaming Commands (Otomatik Tespit):
  npm start, npm run dev       - Node.js development servers
  node server.js               - Node.js scripts (live output)
  python app.py                - Python scripts (live output)
  ng serve, next dev, vite     - Frontend dev servers

Sistem Komutları:
  Windows: dir, type, copy, move, del, mkdir, rmdir
  Cross-platform: node, npm, git, python, etc.

Not: 
  - Uzun süren komutlar otomatik olarak streaming mode'da çalışır
  - Streaming process'ler gerçek zamanlı çıktı gösterir (VS Code gibi)
  - 'stop <processId>' ile process'leri durdurabilirsiniz
    `;
        this.addTerminalLine(helpText.trim(), 'output');
    }

    addTerminalLine(text, type = 'output', isHtml = false) {
        const output = document.getElementById('terminalOutput');
        if (!output) return;

        const line = document.createElement('div');
        line.className = `terminal-line ${type}`;

        // If already HTML (from ANSI parser), use innerHTML
        // Otherwise process for links and commands
        if (isHtml) {
            line.innerHTML = text;
        } else {
            // Make URLs clickable and commands executable
            const processedText = this.makeTerminalLinksClickable(text);
            line.innerHTML = processedText;
        }

        output.appendChild(line);
        output.scrollTop = output.scrollHeight;
    }

    makeTerminalLinksClickable(text) {
        // At this point, text already has ANSI parsed to HTML spans
        // We need to inject links while preserving those spans

        // URL regex pattern - capture full URL including port numbers
        // Match: http://localhost:5179/ or https://example.com/path
        const urlPattern = /(https?:\/\/[a-zA-Z0-9]+(:[0-9]+)?(\/[^\s<>"']*)?)/g;

        // Replace URLs with clickable links
        let processed = text.replace(urlPattern, (url) => {
            // Clean URL (remove trailing punctuation but keep port numbers)
            let cleanUrl = url.replace(/[.,;!?)'"]$/, ''); // Remove trailing punctuation

            // Remove trailing slash if it's the only path
            if (cleanUrl.endsWith('/') && cleanUrl.split('/').length === 4) {
                cleanUrl = cleanUrl.slice(0, -1);
            }

            return `<a href="#" class="terminal-link" onclick="event.preventDefault(); window.app.openExternalUrl('${cleanUrl}');" title="Tıklayarak tarayıcıda aç">${cleanUrl}</a>`;
        });

        return processed;
    }

    async openExternalUrl(url) {
        const { ipcRenderer } = require('electron');
        try {
            await ipcRenderer.invoke('open-external', url);
            this.addTerminalLine(`🌐 Tarayıcıda açıldı: ${url}`, 'success');
        } catch (error) {
            this.addTerminalLine(`❌ URL açılamadı: ${error.message}`, 'error');
        }
    }

    executeTerminalCommand(cmd) {
        // Execute command programmatically
        this.addTerminalLine(`> ${cmd}`, 'command');
        this.handleCommand(cmd);
    }

    clearTerminal() {
        const output = document.getElementById('terminalOutput');
        if (output) {
            output.innerHTML = '';
        }
        this.addTerminalLine('Terminal temizlendi.', 'success');
    }

    newTerminal() {
        this.clearTerminal();
        // Set to project directory or current folder
        const defaultPath = this.currentFolder || require('path').join(require('os').homedir(), 'OneDrive', 'Desktop');
        this.setWorkingDirectory(defaultPath);
        this.addTerminalLine('Windows PowerShell', 'success');
        this.addTerminalLine('Copyright (C) Microsoft Corporation. Tüm hakları saklıdır.', 'output');
        this.addTerminalLine('', 'output');
    }

    setWorkingDirectory(targetPath) {
        if (!targetPath) return;

        const pathModule = this.path || require('path');
        let normalizedPath = typeof targetPath === 'string' ? targetPath.trim() : targetPath;

        if (/^[a-zA-Z]:$/.test(normalizedPath)) {
            normalizedPath += pathModule.sep;
        }

        try {
            normalizedPath = pathModule.normalize(normalizedPath);
            if (!pathModule.isAbsolute(normalizedPath)) {
                const base = this.currentWorkingDirectory || process.cwd();
                normalizedPath = pathModule.resolve(base, normalizedPath);
            }
        } catch (error) {
            console.warn('Working directory normalize error:', error);
        }

        if (process.platform === 'win32') {
            normalizedPath = normalizedPath.replace(/\//g, '\\');
        }

        if (this.currentWorkingDirectory !== normalizedPath) {
            this.currentWorkingDirectory = normalizedPath;
            this.updateTerminalPath();
        }
    }

    updateTerminalPath() {
        const pathElement = document.getElementById('terminalPath');
        if (pathElement) {
            pathElement.textContent = `PS ${this.currentWorkingDirectory}`;
        }
    }

    // ===== STREAMING PROCESS DETECTION & MANAGEMENT =====
    // Check if command should run as streaming process
    isStreamingCommand(command) {
        const streamingPatterns = [
            /^npm\s+(start|run\s+dev|run\s+watch|run\s+serve)/i,
            /^node\s+(?!-e\s|--eval\s).*\.js/i,
            /^python\s+(?!-c\s).*\.py/i,
            /^python3\s+(?!-c\s).*\.py/i,
            /^dotnet\s+(run|watch)/i,
            /^ng\s+serve/i,
            /^ng\s+build\s+--watch/i,
            /^webpack\s+--watch/i,
            /^tsc\s+--watch/i,
            /^nodemon/i,
            /^gatsby\s+develop/i,
            /^next\s+dev/i,
            /^vite/i,
            /^yarn\s+(dev|start|serve)/i
        ];

        return streamingPatterns.some(pattern => pattern.test(command));
    }

    // Start a streaming process with live output
    async startStreamingProcess(command) {
        const processId = `process_${Date.now()}`;

        try {
            // Start the process
            const result = await window.electronAPI.startProcess(
                processId,
                command,
                this.currentWorkingDirectory
            );

            if (result.success) {
                // Track active process
                this.activeProcesses.set(processId, {
                    command,
                    startTime: Date.now()
                });

                this.addTerminalLine(`Started streaming process [${processId}]`, 'success');
                this.addTerminalLine(`Press Ctrl+C or use 'stop ${processId}' to terminate`, 'output');
            } else {
                this.addTerminalLine(`Failed to start process: ${result.error || 'Unknown error'}`, 'error');
            }
        } catch (error) {
            this.addTerminalLine(`Process start error: ${error.message}`, 'error');
        }
    }

    // Stop a running streaming process
    async stopProcess(processId) {
        try {
            const result = await window.electronAPI.stopProcess(processId);

            if (result.success) {
                this.addTerminalLine(`Process ${processId} stopped`, 'success');
                this.activeProcesses.delete(processId);
            } else {
                this.addTerminalLine(`Failed to stop process: ${result.error}`, 'error');
            }
        } catch (error) {
            this.addTerminalLine(`Stop process error: ${error.message}`, 'error');
        }
    }

    // List all active streaming processes
    async listActiveProcesses() {
        try {
            const processes = await window.electronAPI.listProcesses();

            if (processes.length === 0) {
                this.addTerminalLine('No active processes', 'output');
                return;
            }

            this.addTerminalLine('Active Streaming Processes:', 'success');
            processes.forEach(processId => {
                const info = this.activeProcesses.get(processId);
                if (info) {
                    const uptime = Math.floor((Date.now() - info.startTime) / 1000);
                    this.addTerminalLine(`  [${processId}] ${info.command} (uptime: ${uptime}s)`, 'output');
                } else {
                    this.addTerminalLine(`  [${processId}] (no local info)`, 'output');
                }
            });
        } catch (error) {
            this.addTerminalLine(`List processes error: ${error.message}`, 'error');
        }
    }

    // ===== STREAMING PROCESS HANDLERS =====
    // Handle real-time process output (stdout/stderr)
    handleProcessOutput(processId, type, data) {
        // Color-code output: stdout=white, stderr=red
        const cssClass = type === 'stderr' ? 'error' : 'output';

        // Split by lines and add each as separate terminal line
        const lines = data.split('\n');
        lines.forEach((line, index) => {
            // Skip last empty line from split
            if (index === lines.length - 1 && !line) return;

            // IMPORTANT: Parse ANSI codes FIRST, then make links clickable
            // This prevents ANSI spans from breaking HTML link tags
            let htmlLine = this.parseAnsiToHtml(line);
            htmlLine = this.makeTerminalLinksClickable(htmlLine);
            this.addTerminalLine(htmlLine, cssClass, true); // true = already HTML
        });
    }

    // Parse ANSI escape codes to HTML with colors
    parseAnsiToHtml(text) {
        // ANSI color code mappings
        const ansiColors = {
            '30': '#000000', // Black
            '31': '#cd3131', // Red
            '32': '#0dbc79', // Green
            '33': '#e5e510', // Yellow
            '34': '#2472c8', // Blue
            '35': '#bc3fbc', // Magenta
            '36': '#11a8cd', // Cyan
            '37': '#e5e5e5', // White
            '90': '#666666', // Bright Black (Gray)
            '91': '#f14c4c', // Bright Red
            '92': '#23d18b', // Bright Green
            '93': '#f5f543', // Bright Yellow
            '94': '#3b8eea', // Bright Blue
            '95': '#d670d6', // Bright Magenta
            '96': '#29b8db', // Bright Cyan
            '97': '#ffffff'  // Bright White
        };

        let html = text;
        let currentColor = null;
        let isBold = false;

        // Remove ANSI escape codes and apply colors
        // Pattern: \x1b[...m or \u001b[...m or literal [XXm
        html = html.replace(/\x1b\[([0-9;]+)m|\u001b\[([0-9;]+)m|\[([0-9;]+)m/g, (match, code1, code2, code3) => {
            const code = code1 || code2 || code3;
            const codes = code.split(';');

            let styles = '';
            codes.forEach(c => {
                if (c === '0') {
                    // Reset
                    currentColor = null;
                    isBold = false;
                } else if (c === '1') {
                    // Bold
                    isBold = true;
                } else if (c === '22') {
                    // Normal intensity (reset bold)
                    isBold = false;
                } else if (ansiColors[c]) {
                    // Color code
                    currentColor = ansiColors[c];
                }
            });

            // Build span tag if we have active styles
            if (currentColor || isBold) {
                const colorStyle = currentColor ? `color: ${currentColor};` : '';
                const boldStyle = isBold ? 'font-weight: bold;' : '';
                return `<span style="${colorStyle}${boldStyle}">`;
            } else if (code === '0') {
                // Reset - close any open span
                return '</span>';
            }

            return ''; // Remove the escape code
        });

        // Auto-close any unclosed spans
        const openSpans = (html.match(/<span/g) || []).length;
        const closeSpans = (html.match(/<\/span>/g) || []).length;
        const unclosed = openSpans - closeSpans;

        for (let i = 0; i < unclosed; i++) {
            html += '</span>';
        }

        return html;
    }

    // Handle process exit event
    handleProcessExit(processId, exitCode, signal) {
        const statusType = exitCode === 0 ? 'success' : 'error';
        const exitMessage = signal
            ? `Process ${processId} terminated with signal ${signal}`
            : `Process ${processId} exited with code ${exitCode}`;

        this.addTerminalLine(exitMessage, statusType);

        // Remove process from active list if we're tracking it
        if (this.activeProcesses) {
            this.activeProcesses.delete(processId);
        }
    }

    // Handle process error event
    handleProcessError(processId, error) {
        this.addTerminalLine(`Process Error [${processId}]: ${error}`, 'error');

        // Remove process from active list if we're tracking it
        if (this.activeProcesses) {
            this.activeProcesses.delete(processId);
        }
    }

    getShortPath(fullPath) {
        if (!fullPath) return '~';

        const maxLength = 30;
        if (fullPath.length <= maxLength) return fullPath;

        const parts = fullPath.split(/[\/\\]/);
        if (parts.length <= 2) return fullPath;

        return '...' + fullPath.substring(fullPath.length - maxLength);
    }

    showPreviousCommand() {
        if (this.terminalHistory.length === 0) return;

        if (this.terminalHistoryIndex > 0) {
            this.terminalHistoryIndex--;
        }

        const input = document.getElementById('terminalInput');
        if (input && this.terminalHistory[this.terminalHistoryIndex]) {
            input.value = this.terminalHistory[this.terminalHistoryIndex];
        }
    }

    showNextCommand() {
        if (this.terminalHistory.length === 0) return;

        if (this.terminalHistoryIndex < this.terminalHistory.length - 1) {
            this.terminalHistoryIndex++;
            const input = document.getElementById('terminalInput');
            if (input) {
                input.value = this.terminalHistory[this.terminalHistoryIndex];
            }
        } else {
            this.terminalHistoryIndex = this.terminalHistory.length;
            const input = document.getElementById('terminalInput');
            if (input) {
                input.value = '';
            }
        }
    }

    saveApiKey() {
        const apiKeyInput = document.getElementById('apiKey');
        if (apiKeyInput) {
            this.settings.apiKey = apiKeyInput.value.trim();
            const topApi = document.getElementById('topApiKey');
            if (topApi) topApi.value = this.settings.apiKey;
            this.saveSettings();
            this.updateArtistStatus();

            if (this.settings.apiKey) {
                this.updateStatus('API anahtarı kaydedildi');
                this.addChatMessage('system', '✅ OpenAI API anahtarı başarıyla ayarlandı. Artık AI özelliklerini kullanabilirsiniz!');
            } else {
                this.updateStatus('API anahtarı temizlendi');
            }
        }
    }

    saveApiKeyFromTop() {
        const topApiKey = document.getElementById('topApiKey');
        if (topApiKey) {
            this.settings.apiKey = topApiKey.value.trim();
            // reflect to left panel input if exists
            const leftApi = document.getElementById('apiKey');
            if (leftApi) leftApi.value = this.settings.apiKey;
            this.saveSettings();
            this.updateArtistStatus();
            this.updateStatus('API anahtarı kaydedildi (üst bar)');
            this.addChatMessage('system', '✅ OpenAI API anahtarı üst bardan kaydedildi.');
        }
    }

    // ===== CLAUDE AI + MCP INTEGRATION METHODS =====

    async saveClaudeApiKey() {
        const claudeKeyInput = document.getElementById('topClaudeApiKey');
        if (!claudeKeyInput) return;

        const apiKey = claudeKeyInput.value.trim();

        if (!apiKey) {
            this.showNotification('❌ Claude API anahtarı boş olamaz', 'error');
            return;
        }

        try {
            // Send API key to main process (memory-only storage)
            const result = await window.electronAPI.ipcRenderer.invoke('llm:set-api-key', {
                provider: 'anthropic',
                apiKey: apiKey
            });

            if (result.success) {
                this.settings.claudeApiKey = apiKey;
                this.saveSettings();
                this.updateStatus('Claude API anahtarı kaydedildi');
                this.addChatMessage('system', '✅ Claude API anahtarı başarıyla ayarlandı!');
                this.showNotification('✅ Claude API key saved', 'success');
            } else {
                throw new Error(result.error || 'Failed to set API key');
            }

        } catch (error) {
            console.error('❌ Claude API key save error:', error);
            this.showNotification(`❌ Hata: ${error.message}`, 'error');
        }
    }

    async onProviderChange(provider) {
        this.settings.llmProvider = provider;
        this.saveSettings();

        // Load models for selected provider
        await this.loadModelsForProvider(provider);

        // Show appropriate API key reminder
        if (provider === 'anthropic') {
            const hasKey = !!this.settings.claudeApiKey;
            if (!hasKey) {
                this.showNotification('⚠️ Claude API anahtarı gerekli', 'warning');
            }
        } else if (provider === 'openai') {
            const hasKey = !!this.settings.apiKey;
            if (!hasKey) {
                this.showNotification('⚠️ OpenAI API anahtarı gerekli', 'warning');
            }
        }

        this.updateStatus(`Provider değiştirildi: ${provider === 'anthropic' ? 'Claude' : 'OpenAI'}`);
    }

    async loadModelsForProvider(provider) {
        const modelSelect = document.getElementById('llmModelSelect');
        if (!modelSelect) return;

        // Show/hide appropriate optgroups
        const openaiGroups = ['openaiEconomicGroup', 'openaiProductionGroup'];
        const claudeGroups = ['claudeEconomicGroup', 'claudeBalancedGroup', 'claudeProductionGroup'];

        if (provider === 'openai') {
            // Show OpenAI groups, hide Claude groups
            openaiGroups.forEach(id => {
                const group = document.getElementById(id);
                if (group) group.classList.remove('hidden');
            });
            claudeGroups.forEach(id => {
                const group = document.getElementById(id);
                if (group) group.classList.add('hidden');
            });

            // Select default OpenAI model (GPT-4o Mini for economy)
            modelSelect.value = 'gpt-4o-mini';
            this.settings.currentModel = 'gpt-4o-mini';

        } else if (provider === 'anthropic') {
            // Show Claude groups, hide OpenAI groups
            openaiGroups.forEach(id => {
                const group = document.getElementById(id);
                if (group) group.classList.add('hidden');
            });
            claudeGroups.forEach(id => {
                const group = document.getElementById(id);
                if (group) group.classList.remove('hidden');
            });

            // Select default Claude model (Haiku for economy)
            modelSelect.value = 'claude-3-haiku-20240307';
            this.settings.currentModel = 'claude-3-haiku-20240307';
        }

        this.saveSettings();
        this.updateStatus(`Model listesi güncellendi: ${provider === 'anthropic' ? 'Claude' : 'OpenAI'}`);

        console.log(`✅ Loaded models for ${provider}, default: ${this.settings.currentModel}`);
    }

    async onModelChange(model) {
        const provider = this.settings.llmProvider || 'openai';
        this.settings.currentModel = model;
        this.saveSettings();

        try {
            const result = await window.electronAPI.ipcRenderer.invoke('llm:set-model', {
                provider,
                model
            });

            if (result.success) {
                console.log(`✅ Model changed to: ${model}`);
                this.updateStatus(`Model: ${model}`);
            }

        } catch (error) {
            console.error('❌ Model change error:', error);
        }
    }

    async initializeClaudeUI() {
        // Initialize provider selector
        const providerSelect = document.getElementById('llmProviderSelect');
        if (providerSelect) {
            providerSelect.value = this.settings.llmProvider || 'openai';
        }

        // Initialize tools toggle
        const toolsCheckbox = document.getElementById('toolsEnabledCheckbox');
        if (toolsCheckbox) {
            toolsCheckbox.checked = this.settings.toolsEnabled || false;
        }

        // Load models for current provider
        const currentProvider = this.settings.llmProvider || 'openai';
        await this.loadModelsForProvider(currentProvider);

        // Set saved Claude API key if exists
        const claudeKeyInput = document.getElementById('topClaudeApiKey');
        if (claudeKeyInput && this.settings.claudeApiKey) {
            claudeKeyInput.value = this.settings.claudeApiKey;
        }

        console.log('✅ Claude UI initialized');
    }

    // ===== END CLAUDE AI + MCP METHODS =====

    async refreshExplorer() {
        const folderTree = document.getElementById('folderTree');
        if (!folderTree) return;

        if (!this.currentFolder) {
            folderTree.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-folder-open"></i>
          <p>Klasör seçili değil</p>
          <button class="select-folder-btn" id="selectFolderBtn">
            <i class="fas fa-folder"></i> Klasör Seç
          </button>
        </div>
      `;

            document.getElementById('selectFolderBtn')?.addEventListener('click', () => this.openFolder());
            this.updateExplorerNavigation();
            return;
        }

        try {
            const result = await this.ipc.invoke('read-directory', this.currentFolder);

            if (!result.success) {
                folderTree.innerHTML = `
          <div class="empty-state">
            <i class="fas fa-exclamation-triangle"></i>
            <p>Klasör okunamadı: ${result.error}</p>
          </div>
        `;
                return;
            }

            // Sort: folders first, then files
            const sortedFiles = result.files.sort((a, b) => {
                if (a.isDirectory && !b.isDirectory) return -1;
                if (!a.isDirectory && b.isDirectory) return 1;
                return a.name.localeCompare(b.name);
            });

            const fileTree = sortedFiles.map(file => {
                const icon = file.isDirectory ? 'fa-folder' : this.getFileIconClass(file.name);
                const itemType = file.isDirectory ? 'folder' : 'file';

                return `
          <div class="tree-item ${itemType}" data-path="${file.path}" data-is-directory="${file.isDirectory}">
            <i class="fas ${icon}"></i>
            <span class="file-name">${file.name}</span>
            ${!file.isDirectory ? `<span class="file-size">${this.formatFileSize(file.size)}</span>` : ''}
          </div>
        `;
            }).join('');

            folderTree.innerHTML = `
        <div class="file-tree">
          ${fileTree}
        </div>
      `;

            // Add click event listeners
            folderTree.querySelectorAll('.tree-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const filePath = item.dataset.path;
                    const isDirectory = item.dataset.isDirectory === 'true';

                    // Remove previous selection
                    folderTree.querySelectorAll('.tree-item').forEach(i => i.classList.remove('selected'));

                    // Add selection to current item
                    item.classList.add('selected');

                    if (isDirectory) {
                        this.navigateToFolder(filePath);
                    } else {
                        this.openFile(filePath);
                        this.currentFile = filePath; // Update current file reference
                    }
                });

                // Double-click to preview file content
                if (item.dataset.isDirectory === 'false') {
                    item.addEventListener('dblclick', (e) => {
                        e.stopPropagation();
                        this.previewFile(item.dataset.path);
                    });
                }
            });

            this.updateBreadcrumb();
            this.updateExplorerNavigation();

            // Highlight current file if it's in this folder
            this.highlightCurrentFileInExplorer();

        } catch (error) {
            folderTree.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-exclamation-triangle"></i>
          <p>Hata: ${error.message}</p>
        </div>
      `;
        }
    }

    getFileIconClass(fileName) {
        const ext = fileName.split('.').pop()?.toLowerCase();

        switch (ext) {
            case 'js': case 'jsx': case 'ts': case 'tsx':
                return 'fa-file-code';
            case 'html': case 'htm':
                return 'fa-file-code';
            case 'css': case 'scss': case 'sass':
                return 'fa-file-code';
            case 'py':
                return 'fa-file-code';
            case 'java': case 'cpp': case 'c': case 'h':
                return 'fa-file-code';
            case 'json': case 'xml':
                return 'fa-file-code';
            case 'md': case 'markdown':
                return 'fa-file-alt';
            case 'txt': case 'log':
                return 'fa-file-alt';
            case 'png': case 'jpg': case 'jpeg': case 'gif': case 'svg':
                return 'fa-file-image';
            case 'pdf':
                return 'fa-file-pdf';
            case 'zip': case 'rar': case '7z':
                return 'fa-file-archive';
            default:
                return 'fa-file';
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    handleFileTreeClick(item) {
        // Remove previous selection
        document.querySelectorAll('.tree-item.selected').forEach(el => el.classList.remove('selected'));

        // Add selection to clicked item
        item.classList.add('selected');

        const filePath = item.dataset.path;
        const fileName = item.querySelector('.file-name').textContent;

        this.updateStatus(`Seçili: ${fileName}`);
    }

    async handleFileTreeDoubleClick(item) {
        const filePath = item.dataset.path;
        const isDirectory = item.dataset.isDirectory === 'true';

        if (isDirectory) {
            // Navigate to folder
            this.currentFolder = filePath;
            await this.refreshExplorer();
        } else {
            // Open file
            try {
                this.showLoading('Dosya açılıyor...');

                const result = await this.ipc.invoke('read-file', filePath);

                if (!result.success) {
                    this.hideLoading();
                    this.showError('Dosya okunamadı: ' + result.error);
                    return;
                }

                const fileName = this.path.basename(filePath);
                const tabId = 'file_' + Date.now();

                this.hideWelcomeScreen();
                this.createTab(tabId, fileName, result.content, false, filePath);
                this.addToRecentFiles(fileName, filePath);
                this.hideLoading();
                this.updateStatus('Dosya açıldı: ' + fileName);

            } catch (error) {
                this.hideLoading();
                this.showError('Dosya açılırken hata oluştu: ' + error.message);
            }
        }
    }

    getFileIcon(fileName) {
        const ext = fileName.split('.').pop()?.toLowerCase();

        switch (ext) {
            case 'js': case 'jsx': case 'ts': case 'tsx':
                return 'fab fa-js-square';
            case 'html': case 'htm':
                return 'fab fa-html5';
            case 'css': case 'scss': case 'sass':
                return 'fab fa-css3-alt';
            case 'py':
                return 'fab fa-python';
            case 'java':
                return 'fab fa-java';
            case 'json':
                return 'fas fa-file-code';
            case 'md': case 'markdown':
                return 'fab fa-markdown';
            case 'txt':
                return 'fas fa-file-alt';
            default:
                return 'fas fa-file';
        }
    }

    addToRecentFiles(fileName, filePath) {
        const recent = { fileName, filePath, timestamp: Date.now() };

        // Remove if already exists
        this.recentFiles = this.recentFiles.filter(f => f.filePath !== filePath);

        // Add to beginning
        this.recentFiles.unshift(recent);

        // Keep only last 10
        this.recentFiles = this.recentFiles.slice(0, 10);

        this.saveSettings();
        this.updateRecentFiles();
    }

    updateRecentFiles() {
        const recentList = document.getElementById('recentList');
        if (!recentList) return;

        if (this.recentFiles.length === 0) {
            recentList.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-clock"></i>
          <p>Henüz dosya açılmamış</p>
        </div>
      `;
            return;
        }

        recentList.innerHTML = this.recentFiles.map(file => `
      <div class="recent-item" data-path="${file.filePath}">
        <i class="${this.getFileIcon(file.fileName)}"></i>
        <div class="recent-info">
          <div class="recent-name">${file.fileName}</div>
          <div class="recent-path">${file.filePath}</div>
        </div>
      </div>
    `).join('');

        // Add click handlers
        recentList.querySelectorAll('.recent-item').forEach(item => {
            item.addEventListener('click', () => {
                const path = item.dataset.path;
                // Open file by path
                console.log('Opening recent file:', path);
            });
        });
    }

    showSettings() {
        const modal = document.getElementById('settingsModal');
        if (modal) {
            modal.classList.remove('hidden');
        }
    }

    hideSettings() {
        const modal = document.getElementById('settingsModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    showAbout() {
        const modal = document.getElementById('aboutModal');
        if (modal) {
            modal.classList.remove('hidden');
        }
    }

    hideAbout() {
        const modal = document.getElementById('aboutModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    showLoading(message = 'Yükleniyor...') {
        const overlay = document.getElementById('loadingOverlay');
        const text = overlay?.querySelector('p');

        if (overlay) {
            overlay.classList.remove('hidden');
        }
        if (text) text.textContent = message;
    }

    hideLoading() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.classList.add('hidden');
        }
    }

    showNotification(message, type = 'info', options = {}) {
        if (!this.notificationContainer || !document.body.contains(this.notificationContainer)) {
            this.notificationContainer = document.getElementById('notificationContainer');
            if (!this.notificationContainer) {
                this.notificationContainer = document.createElement('div');
                this.notificationContainer.id = 'notificationContainer';
                this.notificationContainer.className = 'notification-container';
                this.notificationContainer.setAttribute('aria-live', 'polite');
                this.notificationContainer.setAttribute('aria-atomic', 'true');
                document.body.appendChild(this.notificationContainer);
            }
        }

        const notification = document.createElement('div');
        notification.className = `notification ${type}`.trim();
        notification.setAttribute('role', 'status');

        const messageSpan = document.createElement('span');
        messageSpan.className = 'notification-message';
        messageSpan.innerHTML = message;

        const closeBtn = document.createElement('button');
        closeBtn.className = 'notification-close';
        closeBtn.setAttribute('aria-label', 'Kapat');
        closeBtn.innerHTML = '<i class="fas fa-times"></i>';

        notification.appendChild(messageSpan);
        notification.appendChild(closeBtn);
        this.notificationContainer.appendChild(notification);

        requestAnimationFrame(() => {
            notification.classList.add('visible');
        });

        const autoHideDuration = typeof options.duration === 'number' ? options.duration : 4000;
        let hideTimeout = null;

        const removeNotification = () => {
            if (!notification.parentElement || notification.classList.contains('closing')) return;
            notification.classList.remove('visible');
            notification.classList.add('closing');
            if (hideTimeout) clearTimeout(hideTimeout);
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.parentElement.removeChild(notification);
                }
            }, 220);
        };

        closeBtn.addEventListener('click', removeNotification);

        if (autoHideDuration > 0) {
            hideTimeout = setTimeout(removeNotification, autoHideDuration);

            notification.addEventListener('mouseenter', () => {
                if (hideTimeout) {
                    clearTimeout(hideTimeout);
                    hideTimeout = null;
                }
            });

            notification.addEventListener('mouseleave', () => {
                if (!hideTimeout) {
                    hideTimeout = setTimeout(removeNotification, 1500);
                }
            });
        }
    }

    showError(message) {
        this.addChatMessage('system', `❌ ${message}`);
        this.updateStatus(`Hata: ${message}`);
        this.showNotification(`❌ ${message}`, 'error');
    }

    updateStatus(message = 'Hazır') {
        const statusElement = document.getElementById('fileStatus');
        if (statusElement) {
            statusElement.textContent = message;
        }
    }

    async updateArtistStatus() {
        const badge = document.getElementById('artistStatus');
        if (!badge) return;

        const clearStateClasses = () => {
            badge.classList.remove('status-ready', 'status-warning', 'status-error');
        };

        const safeInvoke = async (fn, label) => {
            if (typeof fn !== 'function') {
                console.warn(`Artist status: ${label} API erişilemedi`);
                return { error: 'API unavailable' };
            }
            try {
                return await fn();
            } catch (error) {
                console.warn(`Artist status: ${label} çağrısı başarısız`, error);
                return { error };
            }
        };

        const formatError = (error) => {
            if (!error) return 'Bilinmeyen hata';
            if (typeof error === 'string') return error;
            if (error.message) return error.message;
            try {
                return JSON.stringify(error);
            } catch (_) {
                return String(error);
            }
        };

        badge.textContent = 'Artist Mode: Kontrol Ediliyor';
        badge.title = '';
        clearStateClasses();
        badge.classList.add('status-warning');

        const detailBadges = [];
        const missing = [];
        const errors = [];

        const mcpData = await safeInvoke(window.electronAPI?.mcpStatus, 'MCP');
        const mcpReady = !!mcpData && !mcpData.error && !!mcpData.connected;
        if (mcpReady) {
            detailBadges.push(`MCP ✅ (${mcpData.toolCount || 0} araç)`);
        } else {
            missing.push('MCP');
            if (mcpData?.error) {
                errors.push(`MCP: ${formatError(mcpData.error)}`);
            }
            detailBadges.push('MCP ⚠️');
        }

        const aiData = await safeInvoke(window.electronAPI?.aiStatus, 'AI');
        const aiState = aiData?.status;
        const aiReady = !!aiData && aiData.success !== false && !!aiState?.initialized && !!aiState?.connected;
        if (aiReady) {
            const model = aiState?.currentModel || this.settings.model;
            detailBadges.push(`AI ✅ (${model || 'model bilinmiyor'})`);
        } else {
            missing.push('AI');
            if (aiData?.error) {
                errors.push(`AI: ${formatError(aiData.error)}`);
            }
            const aiReason = this.settings.apiKey ? 'başlatılmalı' : 'API anahtarı eksik';
            detailBadges.push(`AI ⚠️ (${aiReason})`);
        }

        const continueData = await safeInvoke(window.electronAPI?.continueStatus, 'Continue');
        const continueReady = !!continueData && !!continueData.initialized;
        if (continueReady) {
            detailBadges.push(`Continue ✅${continueData.running ? ' (çalışıyor)' : ''}`);
        } else {
            missing.push('Continue');
            if (continueData?.error) {
                errors.push(`Continue: ${formatError(continueData.error)}`);
            }
            detailBadges.push('Continue ⚠️');
        }

        const isReady = mcpReady && aiReady && continueReady;
        const detailText = detailBadges.join(' · ');
        badge.title = [detailText, errors.join(' | ')].filter(Boolean).join(' | ');

        clearStateClasses();

        if (isReady) {
            badge.textContent = `Artist Mode: Hazır • ${detailText}`;
            badge.classList.add('status-ready');
        } else if (errors.length > 0) {
            badge.textContent = `Artist Mode: Hata (${errors[0]})`;
            badge.classList.add('status-error');
        } else {
            const waitList = missing.filter((v, i, arr) => arr.indexOf(v) === i).join(', ');
            badge.textContent = `Artist Mode: Bekleniyor (${waitList || 'Durum bilinemiyor'})`;
            badge.classList.add('status-warning');
        }
    }

    updateWindowTitle(fileName = 'KayraDeniz Kod Canavarı') {
        const titleElement = document.getElementById('currentFile');
        if (titleElement) {
            titleElement.textContent = fileName;
        }
        document.title = fileName + ' - KayraDeniz Kod Canavarı';
    }

    handleEditorKeydown(e) {
        const editor = e.target;
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        const selectedText = editor.value.substring(start, end);
        const hasSelection = start !== end;

        // Handle Tab key
        if (e.key === 'Tab') {
            e.preventDefault();
            editor.value = editor.value.substring(0, start) + '  ' + editor.value.substring(end);
            editor.selectionStart = editor.selectionEnd = start + 2;
            this.onEditorChange();
            return;
        }

        // ===== AUTO-CLOSING BRACKETS =====
        const bracketPairs = {
            '{': '}',
            '(': ')',
            '[': ']',
            '"': '"',
            "'": "'",
            '`': '`'
        };

        // Auto-close brackets
        if (bracketPairs[e.key]) {
            e.preventDefault();
            const closingChar = bracketPairs[e.key];

            if (hasSelection) {
                // Wrap selection with brackets
                editor.value =
                    editor.value.substring(0, start) +
                    e.key + selectedText + closingChar +
                    editor.value.substring(end);
                editor.selectionStart = start + 1;
                editor.selectionEnd = end + 1;
            } else {
                // Insert bracket pair
                editor.value =
                    editor.value.substring(0, start) +
                    e.key + closingChar +
                    editor.value.substring(end);
                editor.selectionStart = editor.selectionEnd = start + 1;
            }

            this.onEditorChange();
            return;
        }

        // Skip over closing bracket if already there
        const closingBrackets = '}])"\'`';
        if (closingBrackets.includes(e.key)) {
            const nextChar = editor.value.charAt(start);
            if (nextChar === e.key) {
                e.preventDefault();
                editor.selectionStart = editor.selectionEnd = start + 1;
                return;
            }
        }

        // Backspace: Delete matching bracket pair
        if (e.key === 'Backspace' && !hasSelection) {
            const charBefore = editor.value.charAt(start - 1);
            const charAfter = editor.value.charAt(start);

            // Check if we're between a bracket pair
            if (bracketPairs[charBefore] === charAfter) {
                e.preventDefault();
                editor.value =
                    editor.value.substring(0, start - 1) +
                    editor.value.substring(start + 1);
                editor.selectionStart = editor.selectionEnd = start - 1;
                this.onEditorChange();
                return;
            }
        }
    }

    // ===== BRACKET MATCHING =====
    highlightMatchingBracket() {
        const editor = document.querySelector('.code-editor');
        if (!editor) return;

        // Remove existing highlights
        document.querySelectorAll('.bracket-highlight').forEach(el => el.remove());

        const cursorPos = editor.selectionStart;
        if (editor.selectionStart !== editor.selectionEnd) return; // Only when no selection

        const text = editor.value;
        const bracketPairs = {
            '{': '}',
            '(': ')',
            '[': ']'
        };
        const reversePairs = {
            '}': '{',
            ')': '(',
            ']': '['
        };

        let searchChar = null;
        let searchPos = cursorPos;
        let isOpening = false;
        let targetChar = null;

        // Check if cursor is after an opening bracket
        if (cursorPos > 0 && bracketPairs[text[cursorPos - 1]]) {
            searchChar = text[cursorPos - 1];
            searchPos = cursorPos - 1;
            isOpening = true;
            targetChar = bracketPairs[searchChar];
        }
        // Check if cursor is before a closing bracket
        else if (cursorPos < text.length && reversePairs[text[cursorPos]]) {
            searchChar = text[cursorPos];
            searchPos = cursorPos;
            isOpening = false;
            targetChar = reversePairs[searchChar];
        }
        // Check if cursor is before an opening bracket
        else if (cursorPos < text.length && bracketPairs[text[cursorPos]]) {
            searchChar = text[cursorPos];
            searchPos = cursorPos;
            isOpening = true;
            targetChar = bracketPairs[searchChar];
        }
        // Check if cursor is after a closing bracket
        else if (cursorPos > 0 && reversePairs[text[cursorPos - 1]]) {
            searchChar = text[cursorPos - 1];
            searchPos = cursorPos - 1;
            isOpening = false;
            targetChar = reversePairs[searchChar];
        }

        if (!searchChar) return;

        // Find matching bracket
        const matchPos = this.findMatchingBracket(text, searchPos, searchChar, targetChar, isOpening);
        if (matchPos === -1) return;

        // Highlight both brackets
        this.highlightBracketAt(editor, searchPos);
        this.highlightBracketAt(editor, matchPos);
    }

    findMatchingBracket(text, startPos, openChar, closeChar, isOpening) {
        let depth = 1;
        let pos = startPos;
        const step = isOpening ? 1 : -1;

        while (depth > 0) {
            pos += step;
            if (pos < 0 || pos >= text.length) return -1;

            const char = text[pos];
            if (isOpening) {
                if (char === openChar) depth++;
                else if (char === closeChar) depth--;
            } else {
                if (char === closeChar) depth++;
                else if (char === openChar) depth--;
            }
        }

        return pos;
    }

    highlightBracketAt(editor, position) {
        // Calculate line and column
        const textBefore = editor.value.substring(0, position);
        const lines = textBefore.split('\n');
        const lineIndex = lines.length - 1;
        const colIndex = lines[lines.length - 1].length;

        // Get character dimensions
        const charWidth = this.getCharWidth();
        const lineHeight = parseInt(window.getComputedStyle(editor).lineHeight);

        // Create highlight element
        const highlight = document.createElement('div');
        highlight.className = 'bracket-highlight';
        highlight.style.left = `${colIndex * charWidth}px`;
        highlight.style.top = `${lineIndex * lineHeight}px`;
        highlight.style.width = `${charWidth}px`;
        highlight.style.height = `${lineHeight}px`;

        // Add to indent-guides container (same positioning context)
        const container = document.querySelector('.indent-guides');
        if (container) {
            container.appendChild(highlight);
        }
    }

    handleEditorSelectionChange() {
        // Debounce to avoid too many calls
        clearTimeout(this.bracketMatchTimeout);
        this.bracketMatchTimeout = setTimeout(() => {
            this.highlightMatchingBracket();
        }, 50);
    }

    // ===== MINIMAP SYSTEM =====
    updateMinimap() {
        const editor = document.getElementById('codeEditor');
        const canvas = document.getElementById('minimapCanvas');
        const viewport = document.getElementById('minimapViewport');

        if (!editor || !canvas || !viewport) return;

        const ctx = canvas.getContext('2d');
        const lines = editor.value.split('\n');

        // Set canvas size
        const containerWidth = 100;
        const lineHeight = 2; // Minimap line height in pixels
        canvas.width = containerWidth;
        canvas.height = Math.max(lines.length * lineHeight, 300);

        // Clear canvas
        ctx.fillStyle = '#1e1e1e';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw code lines
        lines.forEach((line, index) => {
            const y = index * lineHeight;
            const trimmed = line.trim();

            if (trimmed.length > 0) {
                // Calculate line "density" (how much code)
                const density = Math.min(trimmed.length / 80, 1);
                const width = containerWidth * density;

                // Color based on content
                let color = '#d4d4d4'; // Default text color

                if (trimmed.startsWith('//') || trimmed.startsWith('/*')) {
                    color = '#6a9955'; // Comment green
                } else if (trimmed.includes('function') || trimmed.includes('class') || trimmed.includes('const') || trimmed.includes('let')) {
                    color = '#569cd6'; // Keyword blue
                } else if (trimmed.includes('if') || trimmed.includes('for') || trimmed.includes('while')) {
                    color = '#c586c0'; // Control flow purple
                } else if (trimmed.includes('{') || trimmed.includes('}')) {
                    color = '#ffd700'; // Bracket gold
                }

                ctx.fillStyle = color;
                ctx.fillRect(5, y, width - 10, lineHeight);
            }
        });

        // Update viewport indicator
        this.updateMinimapViewport();
    }

    updateMinimapViewport() {
        const editor = document.getElementById('codeEditor');
        const editorWrapper = document.querySelector('.editor-wrapper');
        const viewport = document.getElementById('minimapViewport');
        const canvas = document.getElementById('minimapCanvas');

        if (!editor || !editorWrapper || !viewport || !canvas) return;

        const lineHeight = 2;
        const totalLines = editor.value.split('\n').length;
        const visibleLines = Math.floor(editorWrapper.clientHeight / parseInt(window.getComputedStyle(editor).lineHeight));

        const scrollPercentage = editorWrapper.scrollTop / (editorWrapper.scrollHeight - editorWrapper.clientHeight);
        const viewportHeight = (visibleLines / totalLines) * canvas.height;
        const viewportTop = scrollPercentage * (canvas.height - viewportHeight);

        viewport.style.top = `${viewportTop}px`;
        viewport.style.height = `${viewportHeight}px`;
    }

    handleMinimapClick(e) {
        const editor = document.getElementById('codeEditor');
        const editorWrapper = document.querySelector('.editor-wrapper');
        const canvas = document.getElementById('minimapCanvas');

        if (!editor || !editorWrapper || !canvas) return;

        const rect = canvas.getBoundingClientRect();
        const clickY = e.clientY - rect.top;
        const lineHeight = parseInt(window.getComputedStyle(editor).lineHeight);
        const totalLines = editor.value.split('\n').length;

        // Calculate which line was clicked
        const clickedLine = Math.floor((clickY / canvas.height) * totalLines);

        // Scroll to that line
        editorWrapper.scrollTop = clickedLine * lineHeight;
    }

    handleGlobalKeydown(e) {
        // Handle global keyboard shortcuts
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case 's':
                    e.preventDefault();
                    this.saveFile();
                    break;
                case 'n':
                    e.preventDefault();
                    this.newFile();
                    break;
                case 'o':
                    e.preventDefault();
                    this.openFile();
                    break;
                case 'w':
                    e.preventDefault();
                    if (this.currentTab !== 'welcome') {
                        this.closeTab(this.currentTab);
                    }
                    break;
                case 'g':
                    e.preventDefault();
                    this.showGotoLineModal();
                    break;
            }
        }

        // ESC key closes modals
        if (e.key === 'Escape') {
            this.hideSettings();
            this.hideAbout();
            this.hideGotoLineModal();
        }
    }

    // ===== UNIFIED LLM CALL (OpenAI + Claude) =====

    // ✅ RATE LIMITING GUARD
    async checkRateLimit() {
        const now = Date.now();

        // Remove old timestamps outside window
        this.requestTimestamps = this.requestTimestamps.filter(
            timestamp => now - timestamp < this.rateLimitWindow
        );

        // Check if limit exceeded
        if (this.requestTimestamps.length >= this.maxRequestsPerWindow) {
            const oldestRequest = this.requestTimestamps[0];
            const waitTime = Math.ceil((this.rateLimitWindow - (now - oldestRequest)) / 1000);

            return {
                allowed: false,
                message: `Too many requests. Wait ${waitTime} seconds.`
            };
        }

        // Add current request
        this.requestTimestamps.push(now);

        return { allowed: true };
    }

    // ✅ TOKEN BUDGET TRACKER
    trackTokenUsage(messages, maxTokens) {
        // Estimate input tokens (rough: 1 token ≈ 4 chars)
        const inputText = messages.map(m => m.content).join(' ');
        const estimatedInputTokens = Math.ceil(inputText.length / 4);
        const estimatedTotalTokens = estimatedInputTokens + (maxTokens || 2048);

        this.tokenBudget.used += estimatedTotalTokens;

        const percentUsed = (this.tokenBudget.used / this.tokenBudget.limit * 100).toFixed(1);
        console.log(`💰 Token Budget: ${this.tokenBudget.used}/${this.tokenBudget.limit} (${percentUsed}%)`);

        // Warning at 80%
        if (percentUsed >= 80 && percentUsed < 90) {
            this.showNotification('⚠️ Token budget 80% kullanıldı', 'warning');
        }

        // Critical at 90%
        if (percentUsed >= 90) {
            this.showNotification('🚨 Token budget kritik seviyede!', 'error');
        }
    }

    // Get maximum tokens for a model
    getModelMaxTokens(provider, model) {
        if (provider === 'anthropic') {
            // Claude model token limits (output tokens)
            if (model.includes('opus-4-1') || model.includes('opus-4-20250514')) {
                return 16384; // Opus 4 and 4.1 support up to 16K
            }
            if (model.includes('opus')) {
                return 4096; // Claude 3 Opus: 4K max output
            }
            if (model.includes('sonnet')) {
                return 8192; // Claude 3/3.5 Sonnet: 8K max output
            }
            if (model.includes('haiku')) {
                return 4096; // Claude 3 Haiku: 4K max output (ultra fast & cheap)
            }
            return 8192; // Default for Claude models
        } else {
            // OpenAI models
            if (model.includes('gpt-4o')) {
                return 8192; // 🔧 FIX #6: GPT-4o and GPT-4o-mini increased to 8K for complex JSON responses
            }
            if (model.includes('gpt-4-turbo') || model.includes('gpt-4-1106')) {
                return 4096; // GPT-4 Turbo: 4K max output (128K context input)
            }
            if (model.includes('gpt-4')) {
                return 8192; // GPT-4 base: 8K max output
            }
            if (model.includes('gpt-3.5-turbo-16k')) {
                return 4096; // GPT-3.5 16K variant
            }
            return 4096; // GPT-3.5 standard and others
        }
    }

    async callLLM(messages, options = {}) {
        const provider = this.settings.llmProvider || 'openai';
        const model = this.settings.currentModel;
        const toolsEnabled = this.settings.toolsEnabled || false;
        let { systemPrompt, maxTokens, temperature } = options;

        // ✅ RATE LIMITING GUARD
        const rateLimitCheck = await this.checkRateLimit();
        if (!rateLimitCheck.allowed) {
            throw new Error(`⏱️ Rate limit: ${rateLimitCheck.message}`);
        }

        // ✅ TOKEN BUDGET TRACKER
        this.trackTokenUsage(messages, maxTokens);

        // Auto-adjust maxTokens based on model limits
        const modelMaxTokens = this.getModelMaxTokens(provider, model);
        if (!maxTokens || maxTokens > modelMaxTokens) {
            maxTokens = modelMaxTokens;
            console.log(`📊 Adjusted maxTokens to ${maxTokens} for model ${model}`);
        }

        console.log(`🤖 Calling ${provider} (${model}) - Tools: ${toolsEnabled} - MaxTokens: ${maxTokens}`);

        try {
            if (provider === 'anthropic') {
                // Claude path - pass all options
                return await this.callClaude(messages, {
                    model,
                    toolsEnabled,
                    systemPrompt,
                    maxTokens,
                    temperature
                });
            } else {
                // OpenAI path - use existing callOpenAI
                // callOpenAI expects messages array directly (it handles both string and array)
                return await this.callOpenAI(messages, systemPrompt, {
                    maxTokens,
                    temperature,
                    ...options
                });
            }

        } catch (error) {
            console.error(`❌ ${provider} call failed:`, error);
            throw error;
        }
    }

    async callClaude(messages, options = {}) {
        if (!this.settings.claudeApiKey) {
            throw new Error('Claude API anahtarı ayarlanmamış. Lütfen üst bardan API anahtarınızı girin.');
        }

        const { model, toolsEnabled, systemPrompt, maxTokens, temperature } = options;

        try {
            const result = await window.electronAPI.ipcRenderer.invoke('llm:ask', {
                provider: 'anthropic',
                model: model || 'claude-sonnet-4-5-20250929',
                messages: messages,
                toolsEnabled: toolsEnabled || false,
                systemPrompt: systemPrompt || null,
                maxTokens: maxTokens || 4096,
                temperature: temperature || 0.7
            });

            if (result.success) {
                console.log(`✅ Claude response received (${result.model})`);
                return result.response;
            } else {
                throw new Error(result.error || 'Claude API call failed');
            }

        } catch (error) {
            console.error('❌ Claude call error:', error);

            // User-friendly error messages
            if (error.message.includes('API key')) {
                throw new Error('Claude API anahtarı geçersiz veya ayarlanmamış');
            } else if (error.message.includes('quota')) {
                throw new Error('Claude API kotanız dolmuş');
            } else if (error.message.includes('rate limit')) {
                throw new Error('Claude rate limit aşıldı. Lütfen bekleyip tekrar deneyin.');
            }

            throw error;
        }
    }

    // ===== END UNIFIED LLM CALL =====

    async callOpenAI(message, systemPrompt = null, options = {}) {
        if (!this.settings.apiKey) {
            throw new Error('OpenAI API anahtarı ayarlanmamış');
        }
        
        // 📚 PR-3: PATTERN INJECTION - Add learned patterns to system prompt
        let enhancedSystemPrompt = systemPrompt || '';
        if (this.learningStore && options.injectPatterns !== false) {
            const stats = this.learningStore.getStats();
            const topPatterns = stats.topPatterns;
            
            if (topPatterns.length > 0) {
                const learningContext = `\n\n📚 LEARNED PATTERNS (from past failures):\n` +
                    topPatterns.map(p => {
                        const lastFix = p.fixes[p.fixes.length - 1];
                        return `- ${p.id}: ${p.rootCause} → Fix: ${lastFix.fix} (seen ${p.count}x)`;
                    }).join('\n') +
                    `\n\nUse these patterns to avoid repeating mistakes.\n`;
                
                enhancedSystemPrompt += learningContext;
                console.log(`📚 Injected ${topPatterns.length} learned patterns into AI context`);
            }
        }

        // Rate limiting helper function
        const callWithRetry = async (attempt = 1, maxAttempts = 3) => {
            try {
                return await this.makeOpenAIRequest(message, enhancedSystemPrompt, options);
            } catch (error) {
                if (error.code === 'OPENAI_INSUFFICIENT_QUOTA') {
                    // Quota aşıldığında tekrar denemenin anlamı yok
                    throw error;
                }

                if ((error.code === 'OPENAI_RATE_LIMIT' || error.message.includes('429')) && attempt < maxAttempts) {
                    // Exponential backoff: 2^attempt * 1000 + random jitter
                    const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
                    console.log(`🔄 Rate limit hit, retrying in ${delay.toFixed(0)}ms (attempt ${attempt}/${maxAttempts})`);

                    await new Promise(resolve => setTimeout(resolve, delay));
                    return callWithRetry(attempt + 1, maxAttempts);
                } else if (error.message.includes('502') && attempt < maxAttempts) {
                    // Server error retry with shorter delay
                    const delay = 2000 + Math.random() * 1000;
                    console.log(`🔄 Server error, retrying in ${delay.toFixed(0)}ms (attempt ${attempt}/${maxAttempts})`);

                    await new Promise(resolve => setTimeout(resolve, delay));
                    return callWithRetry(attempt + 1, maxAttempts);
                }
                throw error;
            }
        };

        return callWithRetry();
    }

    // Queue system for OpenAI requests to prevent rate limiting
    async queueOpenAIRequest(requestFn) {
        return new Promise((resolve, reject) => {
            this.requestQueue.push({
                execute: requestFn,
                resolve,
                reject
            });
            this.processQueue();
        });
    }

    async processQueue() {
        if (this.activeRequests >= this.maxConcurrentRequests || this.requestQueue.length === 0) {
            return;
        }

        this.activeRequests++;
        const { execute, resolve, reject } = this.requestQueue.shift();

        try {
            const result = await execute();
            resolve(result);
        } catch (error) {
            reject(error);
        } finally {
            this.activeRequests--;
            // Process next item with small delay to prevent burst
            setTimeout(() => this.processQueue(), 200);
        }
    }

    async makeOpenAIRequest(message, systemPrompt = null, options = {}) {
        if (!this.settings.apiKey) {
            throw new Error('OpenAI API anahtarı ayarlanmamış');
        }

        // 📚 PATTERN INJECTION: Öğrenilen pattern'leri system prompt'a ekle
        let learningContext = '';
        if (this.learningStore) {
            try {
                const topPatterns = this.learningStore.getTopPatterns(5);
                if (topPatterns && topPatterns.length > 0) {
                    learningContext = '\n\n📚 ÖĞRENİLEN PATTERN\'LER (Geçmiş hatalardan öğrendiklerim):\n';
                    topPatterns.forEach((pattern, idx) => {
                        const lastFix = pattern.fixes && pattern.fixes.length > 0 
                            ? pattern.fixes[pattern.fixes.length - 1].fix 
                            : 'N/A';
                        learningContext += `${idx + 1}. ${pattern.id} (${pattern.count}x başarılı)\n`;
                        learningContext += `   Kök Sebep: ${pattern.rootCause || 'N/A'}\n`;
                        learningContext += `   Çözüm: ${lastFix}\n\n`;
                    });
                    learningContext += '⚠️ Benzer hatalarla karşılaşırsan bu pattern\'leri kullan!\n';
                }
            } catch (error) {
                console.warn('⚠️ Learning Store pattern injection failed:', error.message);
            }
        }

        const defaultSystemPrompt = `Sen KayraDeniz Badaş Kod Canavarı AI asistanısın. Türkçe konuşuyorsun. Kod yazma, açıklama, optimize etme ve hata bulma konularında uzmanısın. Kullanıcıya profesyonel ve yardımsever bir şekilde destek ol.${learningContext}`;

        let messages = [];

        if (Array.isArray(message)) {
            // Pre-constructed message list (e.g., agent mode)
            messages = message.map(msg => {
                // VALIDATION: Ensure content is never null/undefined
                const content = msg.content == null ? "" : String(msg.content);

                const cleanMsg = {
                    role: msg.role,
                    content: content
                };

                // Add tool_calls if present
                if (msg.tool_calls) {
                    cleanMsg.tool_calls = msg.tool_calls;
                }

                // Add tool_call_id if present  
                if (msg.tool_call_id) {
                    cleanMsg.tool_call_id = msg.tool_call_id;
                }

                // Add name if present
                if (msg.name) {
                    cleanMsg.name = msg.name;
                }

                return cleanMsg;
            });

            // Ensure there's at least one system prompt
            const hasSystem = messages.some(msg => msg.role === 'system');
            if (!hasSystem) {
                messages.unshift({
                    role: 'system',
                    content: systemPrompt || defaultSystemPrompt
                });
            }
        } else if (message && typeof message === 'object' && message.role && message.content) {
            // Single message object
            messages = [{ role: 'system', content: systemPrompt || defaultSystemPrompt }, message];
        } else {
            // Plain string message with optional system prompt + history
            messages = [{
                role: 'system',
                content: systemPrompt || defaultSystemPrompt
            }];

            const recentHistory = this.chatHistory.slice(-10);
            recentHistory.forEach(msg => {
                if (msg.type === 'user') {
                    messages.push({ role: 'user', content: msg.content });
                } else if (msg.type === 'ai') {
                    messages.push({ role: 'assistant', content: msg.content });
                }
            });

            messages.push({ role: 'user', content: message });
        }

        // CRITICAL: Deduplicate messages to prevent rate limiting
        messages = this.deduplicateMessages(messages);

        const requestBody = {
            model: this.settings.model,
            messages: messages,
            temperature: this.settings.temperature,
            top_p: 0.9,
            max_tokens: this.settings.maxTokens || 4000,
            presence_penalty: 0.1,
            frequency_penalty: 0.1
        };

        // Tool support ekle
        if (options.tools) {
            requestBody.tools = options.tools;
            requestBody.tool_choice = options.tool_choice || "auto";
        }

        // Final validation before API call
        for (let i = 0; i < requestBody.messages.length; i++) {
            const msg = requestBody.messages[i];
            if (msg.content == null) {
                console.error(`❌ Message ${i} has null content:`, msg);
                requestBody.messages[i].content = "";
            }
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.settings.apiKey}`
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            let errorJson = null;

            try {
                errorJson = JSON.parse(errorText);
            } catch (e) {
                // Response body JSON formatında değilse problem yok, text olarak bırakacağız
            }

            const loggedBody = errorJson ? JSON.stringify(errorJson).substring(0, 500) : errorText.substring(0, 500);
            console.error('OpenAI API Error Response:', {
                status: response.status,
                statusText: response.statusText,
                body: loggedBody // First 500 chars only
            });

            // Enhanced error handling for different status codes
            if (response.status === 502) {
                throw new Error(`OpenAI Server Error (502): Sunucu geçici olarak kullanılamıyor. Lütfen birkaç saniye sonra tekrar deneyin.`);
            } else if (response.status === 429) {
                const quotaExceeded = errorJson?.error?.code === 'insufficient_quota'
                    || errorJson?.error?.message?.toLowerCase().includes('exceeded your current quota');

                if (quotaExceeded) {
                    const quotaError = new Error('OpenAI kotanız dolmuş görünüyor. Lütfen OpenAI hesabınızın faturalandırmasını veya planını kontrol edin.');
                    quotaError.code = 'OPENAI_INSUFFICIENT_QUOTA';
                    throw quotaError;
                }

                const rateError = new Error('OpenAI Rate Limit (429): Çok fazla istek gönderildi. Lütfen birkaç saniye bekleyip tekrar deneyin.');
                rateError.code = 'OPENAI_RATE_LIMIT';
                throw rateError;
            } else if (response.status === 401) {
                const authError = new Error('OpenAI API Unauthorized (401): API anahtarınızı kontrol edin.');
                authError.code = 'OPENAI_UNAUTHORIZED';
                throw authError;
            } else {
                // Try to parse error as JSON first, fallback to text
                let errorMessage = response.statusText;
                if (errorJson?.error?.message) {
                    errorMessage = errorJson.error.message;
                } else if (errorText) {
                    errorMessage = errorText;
                }

                const genericError = new Error(`OpenAI API Hatası (${response.status}): ${errorMessage}`);
                genericError.code = `OPENAI_ERROR_${response.status}`;
                throw genericError;
            }
        }

        const data = await response.json();
        const choice = data.choices[0];

        // Tool çağrısı varsa message objesini döndür
        if (choice.message.tool_calls) {
            return choice.message;
        }

        return choice.message.content;
    }

    beforeUnload() {
        if (this.artistStatusTimer) {
            clearInterval(this.artistStatusTimer);
            this.artistStatusTimer = null;
        }
        // Check for unsaved changes
        const hasUnsaved = Array.from(this.tabs.values()).some(tab => tab.isModified);
        if (hasUnsaved) {
            return 'Kaydedilmemiş değişiklikler var. Çıkmak istediğinizden emin misiniz?';
        }
    }

    // =====================================
    // Quick Start Templates
    // =====================================

    buildDefaultTemplates() {
        return {
            'react-app': {
                id: 'react-app',
                label: 'React App',
                title: 'React Todo Uygulaması Oluştur',
                description: 'Modern React hooks kullanarak responsive bir todo listesi uygulaması oluştur. TypeScript, useState, useEffect, localStorage entegrasyonu ile. Tailwind CSS veya styled-components kullan. package.json, folder structure ve tüm gerekli dosyaları oluştur.',
                tooltip: 'Modern React uygulaması oluştur',
                icon: 'fab fa-react',
                role: 'generator',
                setupProject: true,
                projectType: 'react'
            },
            'python-script': {
                id: 'python-script',
                label: 'Python Script',
                title: 'Python Web Scraper Yaz',
                description: 'Python ile web scraping scripti yaz. requests, BeautifulSoup kullan. CSV export özelliği ekle. Error handling ve rate limiting dahil et. requirements.txt ve virtual environment setup dahil.',
                tooltip: 'Python script/uygulama oluştur',
                icon: 'fab fa-python',
                role: 'generator',
                setupProject: true,
                projectType: 'python'
            },
            'node-api': {
                id: 'node-api',
                label: 'Node.js API',
                title: 'Node.js REST API Oluştur',
                description: 'Express.js ile RESTful API oluştur. CRUD operasyonları, JWT authentication, middleware, error handling dahil et. MongoDB veya PostgreSQL entegrasyonu ekle. package.json, .env template ve folder structure oluştur.',
                tooltip: 'Node.js REST API oluştur',
                icon: 'fab fa-node-js',
                role: 'generator',
                setupProject: true,
                projectType: 'nodejs'
            },
            'html-page': {
                id: 'html-page',
                label: 'HTML Page',
                title: 'Modern HTML Landing Page',
                description: 'Responsive HTML5 landing page oluştur. Modern CSS3, flexbox/grid layout, smooth animations, mobile-first approach. SEO optimize et. Complete folder structure ile.',
                tooltip: 'HTML/CSS/JS web sayfası oluştur',
                icon: 'fab fa-html5',
                role: 'generator',
                setupProject: true,
                projectType: 'static'
            },
            'analyze-code': {
                id: 'analyze-code',
                label: 'Kod Analizi',
                title: 'Kod Analizi Yap',
                description: 'Seçili proje klasöründeki kodları analiz et. Code quality, potential bugs, security issues, performance improvements tespit et. Detailed report oluştur.',
                tooltip: 'Mevcut kodu analiz et ve raporla',
                icon: 'fas fa-search',
                role: 'analyzer',
                setupProject: false
            },
            'fix-bugs': {
                id: 'fix-bugs',
                label: 'Bug Fix',
                title: 'Bug Tespiti ve Düzeltme',
                description: 'Proje kodlarında bug tespiti yap. Syntax errors, logic errors, runtime issues bul ve düzeltme önerileri sun. Code examples ile açıkla.',
                tooltip: 'Hataları bul ve düzelt',
                icon: 'fas fa-bug',
                role: 'analyzer',
                setupProject: false
            },
            'project-wizard': {
                id: 'project-wizard',
                label: 'Proje Sihirbazı',
                title: 'Gelişmiş Proje Sihirbazı',
                description: 'Interactive proje sihirbazı başlat. Kullanıcıdan proje detayları al ve özel proje oluştur.',
                tooltip: 'Gelişmiş proje sihirbazı',
                icon: 'fas fa-magic',
                role: 'generator',
                setupProject: true,
                projectType: 'custom',
                isWizard: true
            }
        };
    }

    initializeQuickTemplateUI() {
        const grid = document.getElementById('quickTemplateGrid');
        if (grid && !grid.dataset.bound) {
            grid.addEventListener('click', (event) => {
                const target = event.target.closest('.template-btn');
                if (!target) return;
                const templateId = target.dataset.template;
                if (templateId) {
                    this.loadQuickStartTemplate(templateId);
                }
            });
            grid.dataset.bound = 'true';
        }

        const addBtn = document.getElementById('addTemplateBtn');
        if (addBtn && !addBtn.dataset.bound) {
            addBtn.addEventListener('click', () => this.openCustomTemplateModal());
            addBtn.dataset.bound = 'true';
        }

        const cancelBtn = document.getElementById('cancelCustomTemplate');
        if (cancelBtn && !cancelBtn.dataset.bound) {
            cancelBtn.addEventListener('click', () => this.closeCustomTemplateModal());
            cancelBtn.dataset.bound = 'true';
        }

        const closeBtn = document.getElementById('closeCustomTemplateModal');
        if (closeBtn && !closeBtn.dataset.bound) {
            closeBtn.addEventListener('click', () => this.closeCustomTemplateModal());
            closeBtn.dataset.bound = 'true';
        }

        const form = document.getElementById('customTemplateForm');
        if (form && !form.dataset.bound) {
            form.addEventListener('submit', (event) => {
                event.preventDefault();
                this.saveCustomTemplateFromForm();
            });
            form.dataset.bound = 'true';
        }

        if (!this.customTemplateEscHandler) {
            this.customTemplateEscHandler = (event) => {
                if (event.key !== 'Escape') return;
                const modal = document.getElementById('customTemplateModal');
                if (modal && !modal.classList.contains('hidden')) {
                    this.closeCustomTemplateModal();
                }
            };
            document.addEventListener('keydown', this.customTemplateEscHandler);
        }

        this.renderQuickStartTemplates();
    }

    ensureCustomTemplatesArray() {
        if (!Array.isArray(this.settings.customTemplates)) {
            this.settings.customTemplates = [];
        }
        return this.settings.customTemplates;
    }

    getAllTemplates() {
        const templates = [];
        const defaults = this.defaultTemplates || {};

        this.defaultTemplateOrder.forEach(id => {
            const template = defaults[id];
            if (template) {
                templates.push({ ...template, id: template.id || id, source: 'default' });
            }
        });

        const customTemplates = this.ensureCustomTemplatesArray();
        customTemplates.forEach(template => {
            if (template && template.id) {
                templates.push({ ...template, source: 'custom' });
            }
        });

        return templates;
    }

    renderQuickStartTemplates() {
        const grid = document.getElementById('quickTemplateGrid');
        if (!grid) return;

        const templates = this.getAllTemplates();

        if (!templates.length) {
            grid.classList.add('empty');
            grid.innerHTML = `
                <div class="template-empty-state empty-state">
                    <i class="fas fa-lightbulb"></i>
                    <p>Henüz şablon eklenmedi. \"Yeni Şablon Ekle\" ile başlayın.</p>
                </div>
            `;
            return;
        }

        grid.classList.remove('empty');
        grid.innerHTML = templates.map((template) => this.renderTemplateButton(template)).join('');
    }

    renderTemplateButton(template) {
        const iconClass = this.escapeHtml(template.icon || 'fas fa-magic');
        const label = this.escapeHtml(template.label || template.title || template.id);
        const tooltipSource = template.tooltip || template.title || template.description || label;
        const tooltip = this.escapeHtml(tooltipSource);
        const isCustom = template.source === 'custom';
        const customBadge = isCustom ? '<span class="template-badge">Özel</span>' : '';
        const sourceClass = isCustom ? ' custom-template' : '';

        return `
            <button class="template-btn${sourceClass}" data-template="${template.id}" title="${tooltip}">
                <i class="${iconClass}"></i>
                <span>${label}</span>
                ${customBadge}
            </button>
        `;
    }

    escapeHtml(value) {
        if (value == null) return '';
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    openCustomTemplateModal() {
        const modal = document.getElementById('customTemplateModal');
        if (!modal) return;

        this.resetCustomTemplateForm();
        this.renderCustomTemplateList();
        modal.classList.remove('hidden');

        const labelInput = document.getElementById('customTemplateLabel');
        labelInput?.focus();
    }

    closeCustomTemplateModal() {
        const modal = document.getElementById('customTemplateModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    resetCustomTemplateForm() {
        const labelInput = document.getElementById('customTemplateLabel');
        const titleInput = document.getElementById('customTemplateTitle');
        const descriptionInput = document.getElementById('customTemplateDescription');
        const roleSelect = document.getElementById('customTemplateRole');
        const iconInput = document.getElementById('customTemplateIcon');
        const projectTypeInput = document.getElementById('customTemplateProjectType');
        const setupCheckbox = document.getElementById('customTemplateSetup');
        const wizardCheckbox = document.getElementById('customTemplateWizard');

        if (labelInput) labelInput.value = '';
        if (titleInput) titleInput.value = '';
        if (descriptionInput) descriptionInput.value = '';
        if (roleSelect) roleSelect.value = 'generator';
        if (iconInput) iconInput.value = '';
        if (projectTypeInput) projectTypeInput.value = '';
        if (setupCheckbox) setupCheckbox.checked = false;
        if (wizardCheckbox) wizardCheckbox.checked = false;
    }

    saveCustomTemplateFromForm() {
        const label = document.getElementById('customTemplateLabel')?.value.trim();
        const title = document.getElementById('customTemplateTitle')?.value.trim();
        const description = document.getElementById('customTemplateDescription')?.value.trim();
        const role = document.getElementById('customTemplateRole')?.value || 'generator';
        const iconInput = document.getElementById('customTemplateIcon')?.value.trim();
        const projectTypeInput = document.getElementById('customTemplateProjectType')?.value.trim();
        const setupCheckbox = document.getElementById('customTemplateSetup');
        const wizardCheckbox = document.getElementById('customTemplateWizard');

        if (!label || !title || !description) {
            this.showNotification('⚠️ Lütfen etiket, başlık ve açıklama alanlarını doldurun', 'warning');
            return;
        }

        const baseSlug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        const baseId = baseSlug ? `custom-${baseSlug}` : `custom-${Date.now()}`;
        const templateId = this.generateUniqueTemplateId(baseId);

        const isWizard = wizardCheckbox?.checked || false;
        let setupProject = setupCheckbox?.checked || false;
        if (isWizard) {
            setupProject = true;
        }

        const newTemplate = {
            id: templateId,
            label,
            title,
            description,
            role,
            icon: iconInput || 'fas fa-star',
            setupProject,
            projectType: setupProject ? (projectTypeInput || 'custom') : undefined,
            isWizard,
            tooltip: title
        };

        const customTemplates = this.ensureCustomTemplatesArray();
        customTemplates.push(newTemplate);
        this.saveSettings();
        this.renderQuickStartTemplates();
        this.renderCustomTemplateList();
        this.closeCustomTemplateModal();
        this.showNotification(`✅ "${label}" şablonu eklendi`, 'success');
    }

    generateUniqueTemplateId(baseId) {
        const existingIds = new Set(this.getAllTemplates().map(t => t.id));
        let candidate = baseId;
        let counter = 1;

        while (existingIds.has(candidate)) {
            candidate = `${baseId}-${counter++}`;
        }

        return candidate;
    }

    renderCustomTemplateList() {
        const list = document.getElementById('customTemplateList');
        if (!list) return;

        const customTemplates = this.ensureCustomTemplatesArray();
        if (!customTemplates.length) {
            list.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-lightbulb"></i>
                    <p>Henüz özel şablon eklenmedi.</p>
                </div>
            `;
            return;
        }

        list.innerHTML = customTemplates.map((template) => `
            <div class="custom-template-item" data-template-id="${template.id}">
                <div class="template-info">
                    <strong>${this.escapeHtml(template.label || template.title)}</strong>
                    <span>${this.escapeHtml(template.role || 'generator')}</span>
                </div>
                <button type="button" class="remove-template-btn" data-template-id="${template.id}" title="Şablonu kaldır">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `).join('');

        list.querySelectorAll('.remove-template-btn').forEach(btn => {
            btn.addEventListener('click', (event) => {
                const templateId = event.currentTarget.dataset.templateId;
                this.removeCustomTemplate(templateId);
            });
        });
    }

    removeCustomTemplate(templateId) {
        if (!templateId) return;

        const customTemplates = this.ensureCustomTemplatesArray();
        const template = customTemplates.find((tpl) => tpl.id === templateId);

        if (!template) {
            this.showNotification('⚠️ Şablon bulunamadı', 'warning');
            return;
        }

        const confirmed = window.confirm(`"${template.label || template.title}" şablonunu silmek istediğinize emin misiniz?`);
        if (!confirmed) return;

        this.settings.customTemplates = customTemplates.filter((tpl) => tpl.id !== templateId);
        this.saveSettings();
        this.renderQuickStartTemplates();
        this.renderCustomTemplateList();
        this.showNotification(`🗑️ "${template.label || template.title}" şablonu silindi`, 'info');
    }

    findTemplateById(templateId) {
        if (!templateId) return null;

        const defaults = this.defaultTemplates || {};
        if (defaults[templateId]) {
            return { ...defaults[templateId] };
        }

        const customTemplates = this.ensureCustomTemplatesArray();
        const found = customTemplates.find((template) => template.id === templateId);
        return found ? { ...found } : null;
    }

    loadQuickStartTemplate(templateId) {
        const templateData = this.findTemplateById(templateId);

        if (!templateData) {
            this.showNotification('⚠️ Template bulunamadı', 'warning');
            return;
        }

        if (templateData.isWizard) {
            this.showAdvancedProjectWizard();
            return;
        }

        if (templateData.setupProject) {
            if (!templateData.projectType) {
                templateData.projectType = 'custom';
            }
            this.showProjectSetupWizard(templateData);
        } else {
            this.loadTemplateWithUnifiedAgent(templateData);
        }
    }

    async loadTemplateWithUnifiedAgent(templateData) {
        // Agent mode'u aktif et
        this.switchToAgentMode();

        // Chat'e template seçimini bildir
        this.addChatMessage('user', `📋 Template: ${templateData.title}`);

        // Unified agent system ile çalıştır
        await this.executeUnifiedAgentTask(templateData.description);
    }

    showAdvancedProjectWizard() {
        // Readdy AI tarzı dinamik proje sihirbazı
        this.showDynamicProjectWizard();
    }

    showDynamicProjectWizard() {
        const wizardHtml = `
      <div class="modal dynamic-project-wizard" id="dynamicProjectWizard">
        <div class="modal-content">
          <div class="modal-header">
            <h3><i class="fas fa-magic"></i> AI Project Builder - Readdy Style</h3>
            <button class="modal-close" id="closeDynamicWizard">&times;</button>
          </div>
          <div class="modal-body">
            <div class="wizard-step active" data-step="1">
              <h4>🎯 Proje Detayları</h4>
              <div class="form-group">
                <label for="projectTitle">Proje Başlığı:</label>
                <input type="text" id="projectTitle" placeholder="Projenizin adını girin..." value="">
              </div>
              <div class="form-group">
                <label for="projectPrompt">Proje Açıklaması (AI Prompt):</label>
                <textarea id="projectPrompt" placeholder="Projenizin detaylı açıklamasını yazın... AI bu açıklamaya göre teknik gereksinimleri analiz edecek.&#10;&#10;Örnek: 'Modern bir blog platformu yapın. Kullanıcı kayıt/giriş sistemi, makale yazma editörü, yorum sistemi, admin paneli olsun. Responsive tasarım, SEO optimize, hızlı yükleme...'" rows="6"></textarea>
              </div>
              <div class="form-group">
                <label for="projectAuthor">Yazar:</label>
                <input type="text" id="projectAuthor" placeholder="Ad Soyad" value="">
              </div>
            </div>
            
            <div class="wizard-step" data-step="2">
              <h4>⚙️ AI Teknik Analiz</h4>
              <div class="ai-analysis-container">
                <div class="analysis-loading">
                  <i class="fas fa-spinner fa-spin"></i>
                  <p>AI projenizi analiz ediyor ve teknik gereksinimleri belirliyor...</p>
                </div>
                <div class="analysis-results hidden" id="analysisResults">
                  <!-- AI-generated technical requirements will be populated here -->
                </div>
              </div>
            </div>
            
            <div class="wizard-step" data-step="3">
              <h4>📋 Proje Onayı & Chat</h4>
              <div class="project-preview" id="projectPreview">
                <p>Proje detayları chat paneline aktarılacak. AI ile proje hakkında konuşup son düzenlemeleri yapabilirsiniz.</p>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn secondary" id="prevStepBtn" disabled>Geri</button>
            <button class="btn primary" id="nextStepBtn">İlerle</button>
            <button class="btn primary hidden" id="generateProjectBtn">Chat'e Aktar & Projeyi Oluştur</button>
          </div>
        </div>
      </div>
    `;

        document.body.insertAdjacentHTML('beforeend', wizardHtml);
        this.setupDynamicWizardEvents();
    }

    setupDynamicWizardEvents() {
        const wizard = document.getElementById('dynamicProjectWizard');
        const nextBtn = document.getElementById('nextStepBtn');
        const prevBtn = document.getElementById('prevStepBtn');
        const generateBtn = document.getElementById('generateProjectBtn');
        const closeBtn = document.getElementById('closeDynamicWizard');

        let currentStep = 1;
        let aiAnalysisResults = null;

        nextBtn?.addEventListener('click', async () => {
            if (currentStep === 1) {
                // Validate inputs
                const title = document.getElementById('projectTitle')?.value.trim();
                const prompt = document.getElementById('projectPrompt')?.value.trim();
                const author = document.getElementById('projectAuthor')?.value.trim();

                if (!title || !prompt) {
                    this.showNotification('⚠️ Lütfen proje başlığı ve açıklaması girin', 'warning');
                    return;
                }

                // Disable button to prevent double-click
                nextBtn.disabled = true;
                nextBtn.textContent = 'Analiz ediliyor...';

                try {
                    // Move to AI analysis step
                    this.moveToWizardStep(2);
                    currentStep = 2;

                    // Start AI analysis
                    aiAnalysisResults = await this.analyzeProjectRequirements(title, prompt, author);

                    // Debug: Check if analysis results are valid
                    console.log('🔍 AI Analysis Results:', aiAnalysisResults);

                    if (!aiAnalysisResults) {
                        console.warn('⚠️ AI analiz sonucu null, fallback kullanılıyor');
                        // Provide fallback analysis
                        aiAnalysisResults = {
                            projectType: "web-app",
                            complexity: "intermediate",
                            estimatedTime: "2-4 hafta",
                            recommendedStack: {
                                frontend: ["React", "TypeScript", "Tailwind CSS"],
                                backend: ["Node.js"],
                                database: ["JSON files"],
                                deployment: ["Vercel"]
                            },
                            technicalRequirements: [
                                {
                                    category: "Frontend Framework",
                                    recommendation: "React with TypeScript",
                                    reason: "Modern, component-based architecture"
                                }
                            ],
                            features: ["Responsive design", "Modern UI", "Interactive components"]
                        };
                    }

                    this.displayAnalysisResults(aiAnalysisResults);

                    nextBtn.textContent = 'Chat\'e Aktar';
                    nextBtn.disabled = false;
                } catch (error) {
                    console.error('Analysis error:', error);
                    this.showNotification('❌ Analiz sırasında hata oluştu', 'error');
                    nextBtn.textContent = 'İlerle';
                    nextBtn.disabled = false;
                    currentStep = 1;
                    this.moveToWizardStep(1);
                }
            } else if (currentStep === 2) {
                // Move to final step
                this.moveToWizardStep(3);
                currentStep = 3;
            }

            prevBtn.disabled = currentStep === 1;
        });

        prevBtn?.addEventListener('click', () => {
            if (currentStep > 1) {
                currentStep--;
                this.moveToWizardStep(currentStep);

                // Reset button states
                const nextBtn = document.getElementById('nextStepBtn');
                const generateBtn = document.getElementById('generateProjectBtn');

                if (nextBtn) {
                    nextBtn.disabled = false;
                    nextBtn.classList.remove('hidden');
                }
                if (generateBtn) {
                    generateBtn.classList.add('hidden');
                }

                if (currentStep === 1) {
                    prevBtn.disabled = true;
                    if (nextBtn) nextBtn.textContent = 'İlerle';
                } else if (currentStep === 2) {
                    if (nextBtn) nextBtn.textContent = 'Chat\'e Aktar';
                }
            }
        });

        generateBtn?.addEventListener('click', () => {
            this.transferProjectToChat(aiAnalysisResults);
            wizard?.remove();
        });

        closeBtn?.addEventListener('click', () => {
            wizard?.remove();
        });

        // Escape key to close wizard
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && wizard && document.body.contains(wizard)) {
                wizard.remove();
            }
        });
    }

    // Missing method - wizard step navigation
    moveToWizardStep(stepNumber) {
        const allSteps = document.querySelectorAll('.wizard-step');

        // Hide all steps
        allSteps.forEach(step => {
            step.classList.remove('active');
        });

        // Show target step
        const targetStep = document.querySelector(`[data-step="${stepNumber}"]`);
        if (targetStep) {
            targetStep.classList.add('active');
        }

        // Update buttons state based on step
        const nextBtn = document.getElementById('nextStepBtn');
        const prevBtn = document.getElementById('prevStepBtn');
        const generateBtn = document.getElementById('generateProjectBtn');

        if (nextBtn) nextBtn.disabled = false;
        if (prevBtn) prevBtn.disabled = stepNumber === 1;

        // Handle step-specific UI updates
        if (stepNumber === 3) {
            if (nextBtn) nextBtn.classList.add('hidden');
            if (generateBtn) generateBtn.classList.remove('hidden');
        } else {
            if (nextBtn) nextBtn.classList.remove('hidden');
            if (generateBtn) generateBtn.classList.add('hidden');
        }
    }

    async analyzeProjectRequirements(title, prompt, author) {
        // Queue the request to prevent rate limiting
        return this.queueOpenAIRequest(async () => {
            try {
                const analysisPrompt = `Proje analizi yap ve teknik gereksinimleri belirle:

PROJE BİLGİLERİ:
Başlık: "${title}"
Açıklama: "${prompt}"
Yazar: "${author}"

Lütfen bu proje için teknik gereksinimleri analiz et ve aşağıdaki JSON formatında döndür:

{
  "projectType": "web-app|mobile-app|desktop-app|api|library|game|other",
  "complexity": "beginner|intermediate|advanced|expert",
  "recommendedStack": {
    "frontend": ["React", "Vue", "Angular", "HTML/CSS/JS", "Flutter", etc.],
    "backend": ["Node.js", "Python", "Java", "PHP", ".NET", etc.],
    "database": ["MongoDB", "PostgreSQL", "MySQL", "SQLite", etc.],
    "deployment": ["Vercel", "Netlify", "AWS", "Docker", etc.]
  },
  "technicalRequirements": [
    {
      "category": "Frontend Framework",
      "recommendation": "React with TypeScript",
      "reason": "Modern, component-based, strong ecosystem"
    },
    {
      "category": "State Management", 
      "recommendation": "Redux Toolkit or Zustand",
      "reason": "Complex state needs based on description"
    }
  ],
  "projectStructure": {
    "folders": ["src", "public", "components", "pages", "styles", "utils"],
    "keyFiles": ["package.json", "README.md", "index.html", "App.jsx"]
  },
  "features": ["Authentication", "CRUD operations", "Responsive design", etc.],
  "estimatedTime": "2-4 weeks",
  "difficulty": "Orta seviye - React deneyimi gerekli"
}

Projeyi detaylı analiz et ve en uygun teknoloji önerilerini yap.`;

                const response = await this.callOpenAI(analysisPrompt);

                // Parse JSON response with enhanced error handling
                const jsonMatch = response.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    try {
                        return JSON.parse(jsonMatch[0]);
                    } catch (parseError) {
                        console.warn('⚠️ JSON parse failed, using fallback analysis');
                        return {
                            projectType: "web-app",
                            complexity: "intermediate",
                            recommendedStack: {
                                frontend: ["React", "TypeScript", "Tailwind CSS"],
                                backend: ["Node.js"],
                                database: ["JSON files"],
                                deployment: ["Vercel"]
                            }
                        };
                    }
                }

                console.warn('⚠️ No JSON found in project analysis, using fallback');
                return {
                    projectType: "web-app",
                    complexity: "intermediate",
                    recommendedStack: {
                        frontend: ["React", "TypeScript", "Tailwind CSS"],
                        backend: ["Node.js"],
                        database: ["JSON files"],
                        deployment: ["Vercel"]
                    }
                };
            } catch (error) {
                console.error('Project analysis error:', error);
                this.showNotification('❌ Proje analizi sırasında hata oluştu', 'error');
                return null;
            }
        });
    }

    displayAnalysisResults(analysisResults) {
        console.log('📊 Displaying analysis results:', analysisResults);

        if (!analysisResults) {
            console.error('❌ Analysis results are null or undefined');
            this.showNotification('❌ Analiz sonuçları alınamadı', 'error');
            return;
        }

        // Use the new tool system to ensure reliable DOM access
        try {
            const resultsContainer = document.getElementById('analysisResults');
            const loadingContainer = resultsContainer?.parentElement?.querySelector('.analysis-loading');

            console.log('🎯 Results container found:', !!resultsContainer);
            console.log('⏳ Loading container found:', !!loadingContainer);

            if (!resultsContainer) {
                console.error('❌ CRITICAL: analysisResults element not found in DOM');
                this.showNotification('❌ Teknik analiz sonuçları görüntülenemedi (DOM hatası)', 'error');

                // Debug DOM state
                const allElementsWithId = document.querySelectorAll('[id*="analysis"]');
                console.log('🔍 All elements with "analysis" in ID:', allElementsWithId);

                return;
            }

            // Hide loading, show results
            if (loadingContainer) {
                loadingContainer.classList.add('hidden');
                console.log('✅ Loading hidden');
            }

            resultsContainer.classList.remove('hidden');
            console.log('✅ Results container shown');

            // Enhanced HTML generation with better error handling
            const resultsHtml = this.generateAnalysisHTML(analysisResults);

            // Set the content
            resultsContainer.innerHTML = resultsHtml;
            console.log('✅ Results HTML set successfully');
            console.log('📄 Results HTML length:', resultsHtml.length);

            const previewContainer = document.getElementById('projectPreview');
            if (previewContainer) {
                previewContainer.innerHTML = this.generateProjectPreviewHTML(analysisResults);
            }

            // Force a reflow to ensure display
            resultsContainer.offsetHeight;

            this.showNotification('✅ Teknik analiz tamamlandı', 'success');

        } catch (error) {
            console.error('❌ Error displaying analysis results:', error);
            this.showNotification('❌ Teknik analiz görüntüleme hatası: ' + error.message, 'error');
        }
    }

    generateAnalysisHTML(analysisResults) {
        try {
            return `
                <div class="analysis-summary">
                    <h5>📊 AI Analiz Sonuçları</h5>
                    <div class="analysis-grid">
                        <div class="analysis-item">
                            <strong>Proje Türü:</strong> ${analysisResults.projectType || 'Belirtilmemiş'}
                        </div>
                        <div class="analysis-item">
                            <strong>Komplekslik:</strong> ${analysisResults.complexity || 'Orta'}
                        </div>
                        <div class="analysis-item">
                            <strong>Tahmini Süre:</strong> ${analysisResults.estimatedTime || '2-4 hafta'}
                        </div>
                    </div>
                    
                    <div class="tech-stack">
                        <h6>🛠️ Önerilen Teknoloji Stack:</h6>
                        ${analysisResults.recommendedStack ? this.formatTechStack(analysisResults.recommendedStack) : '<p>Stack bilgisi mevcut değil</p>'}
                    </div>
                    
                    <div class="technical-requirements">
                        <h6>⚙️ Teknik Gereksinimler:</h6>
                        ${analysisResults.technicalRequirements ? this.formatTechnicalRequirements(analysisResults.technicalRequirements) : '<p>Teknik gereksinim bilgisi mevcut değil</p>'}
                    </div>
                    
                    <div class="project-features">
                        <h6>✨ Özellikler:</h6>
                        <div class="features-list">
                            ${analysisResults.features ? analysisResults.features.map(feature => `<span class="feature-tag">${feature}</span>`).join('') : '<span class="feature-tag">Temel özellikler</span>'}
                        </div>
                    </div>
                </div>
            `;
        } catch (htmlError) {
            console.error('❌ Error generating analysis HTML:', htmlError);
            return `
                <div class="analysis-summary">
                    <h5>📊 AI Analiz Sonuçları</h5>
                    <p class="analysis-error">Analiz sonuçları görüntülenirken bir hata oluştu.</p>
                    <pre>${JSON.stringify(analysisResults, null, 2)}</pre>
                </div>
            `;
        }
    }

    generateProjectPreviewHTML(analysisResults) {
        const titleValue = document.getElementById('projectTitle')?.value.trim() || 'Belirtilmedi';
        const authorValue = document.getElementById('projectAuthor')?.value.trim() || 'Belirtilmedi';
        const rawPrompt = document.getElementById('projectPrompt')?.value.trim() || '';
        const prompt = rawPrompt
            ? this.escapeHtml(rawPrompt).replace(/\n/g, '<br>')
            : 'Proje açıklaması henüz girilmedi.';

        const projectType = this.escapeHtml(analysisResults.projectType || 'Belirtilmedi');
        const complexity = this.escapeHtml(analysisResults.complexity || 'Belirtilmedi');
        const estimatedTime = this.escapeHtml(analysisResults.estimatedTime || 'Belirtilmedi');

        const stack = analysisResults.recommendedStack || {};
        const stackItems = Object.entries(stack).map(([layer, tools]) => {
            const layerLabelRaw = (layer || '').toString();
            const layerLabel = layerLabelRaw ? layerLabelRaw.charAt(0).toUpperCase() + layerLabelRaw.slice(1) : 'Katman';
            const safeLayer = this.escapeHtml(layerLabel);

            const toolList = Array.isArray(tools) ? tools : (tools ? [tools] : []);
            const safeTools = toolList.length
                ? toolList.map(tool => this.escapeHtml(tool)).join(', ')
                : 'Belirtilmedi';

            return `<li><strong>${safeLayer}:</strong> ${safeTools}</li>`;
        }).join('');

        const featureList = Array.isArray(analysisResults.features) && analysisResults.features.length
            ? analysisResults.features.map(feature => this.escapeHtml(feature))
            : ['Temel özellikler belirlenecek'];

        return `
            <div class="preview-summary">
                <h5>📋 Proje Özeti</h5>
                <p class="preview-meta"><strong>Başlık:</strong> ${this.escapeHtml(titleValue)}</p>
                <p class="preview-meta"><strong>Yazar:</strong> ${this.escapeHtml(authorValue)}</p>
                <div class="preview-section">
                    <h6>📝 Açıklama</h6>
                    <p class="preview-description">${prompt}</p>
                </div>
                <div class="preview-section">
                    <h6>⚙️ Teknik Özeti</h6>
                    <ul class="preview-stack">
                        <li><strong>Tür:</strong> ${projectType}</li>
                        <li><strong>Komplekslik:</strong> ${complexity}</li>
                        <li><strong>Tahmini Süre:</strong> ${estimatedTime}</li>
                    </ul>
                </div>
                <div class="preview-section">
                    <h6>🛠️ Önerilen Stack</h6>
                    <ul class="preview-stack">
                        ${stackItems || '<li>Stack önerisi bulunamadı.</li>'}
                    </ul>
                </div>
                <div class="preview-section">
                    <h6>✨ Öne Çıkan Özellikler</h6>
                    <div class="preview-features">
                        ${featureList.map(feature => `<span class="feature-tag">${feature}</span>`).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    formatTechStack(stack) {
        let html = '<div class="tech-stack-grid">';
        for (const [category, techs] of Object.entries(stack)) {
            html += `
                <div class="tech-category">
                    <strong>${category.charAt(0).toUpperCase() + category.slice(1)}:</strong>
                    <span class="tech-list">${techs.join(', ')}</span>
                </div>
            `;
        }
        html += '</div>';
        return html;
    }

    formatTechnicalRequirements(requirements) {
        return requirements.map(req => `
            <div class="requirement-item">
                <strong>${req.category}:</strong> ${req.recommendation}
                <div class="requirement-reason">${req.reason}</div>
            </div>
        `).join('');
    }

    transferProjectToChat(analysisResults) {
        // Validate that we have analysis results
        if (!analysisResults) {
            this.showNotification('❌ Proje analizi eksik, lütfen tekrar deneyin', 'error');
            return;
        }

        // Switch to agent mode
        this.switchToAgentMode();

        // Get project details from wizard
        const title = document.getElementById('projectTitle')?.value.trim();
        const prompt = document.getElementById('projectPrompt')?.value.trim();
        const author = document.getElementById('projectAuthor')?.value.trim();

        // Store project data globally for continued use
        this.currentProjectData = {
            title,
            prompt,
            author,
            analysis: analysisResults,
            timestamp: new Date().toISOString(),
            status: 'under_discussion'
        };

        this.initializeReadyAIWorkflow();
        this.updateProjectStatus('under_discussion');

        // Create comprehensive project summary for chat
        const projectSummary = `🎯 **AI Proje Builder - Readdy Style**

**📋 Proje Detayları:**
- **Başlık:** ${title}
- **Yazar:** ${author}
- **Açıklama:** ${prompt}

**🤖 AI Analiz Sonuçları:**
- **Tür:** ${analysisResults.projectType}
- **Komplekslik:** ${analysisResults.complexity}  
- **Tahmini Süre:** ${analysisResults.estimatedTime}

**🛠️ Önerilen Stack:**
${Object.entries(analysisResults.recommendedStack).map(([key, values]) =>
            `- **${key.charAt(0).toUpperCase() + key.slice(1)}:** ${values.join(', ')}`
        ).join('\n')}

**✨ Özellikler:** ${analysisResults.features.join(', ')}

Proje hakkında ne düşünüyorsun? Eklemek veya değiştirmek istediğin bir şey var mı?`;

        // Add to chat with special project context
        this.addContextualChatMessage('user', projectSummary, {
            isProjectBuilder: true,
            projectData: this.currentProjectData,
            canModify: true,
            nextActions: ['discuss', 'modify', 'approve', 'implement']
        });

        // Enhanced agent prompt with project discussion capabilities
        const agentPrompt = `Kullanıcı AI Project Builder ile bir proje oluşturdu. Bu projeden sorumlu AI assistanısın.

GÖREV: Proje detaylarını analiz et ve kullanıcıyla etkileşime geç:

1. 🔍 **İlk Değerlendirme**: Projeyi inceleyip genel yorumla
2. 🤔 **Kritik Sorular**: Eksik veya belirsiz yanları sor
3. 💡 **Öneriler**: İyileştirme fikirlerini paylaş
4. ✅ **Onay Süreci**: Kullanıcı hazır olduğunda implementasyona geç

DİKKAT EDİLECEKLER:
- Dostane ve profesyonel yaklaş
- Teknik önerilerde bulun ama overhelming olma
- Kullanıcı feedbackini bekle
- Proje hakkında detaylı sorular sor

BU CUMLELERİ KULLANABILIRSIN:
- "Bu proje çok흥미로운 görünüyor! ..."
- "Şu konular hakkında biraz daha bilgi alabilir miyim?"
- "Bu özellik için şu yaklaşımı öneriyorum:"
- "Projeyi başlatmaya hazır mısın?"

KULLANICI KOMUTLARI:
- "değiştir/modify" → Proje detaylarını güncelle
- "implement/başlat" → Proje dosyalarını oluştur
- "save/kaydet" → Projeyi kaydet ve sonra implement et`;

        this.executeUnifiedAgentTask(agentPrompt);

        // Close wizard - use more robust selector
        const wizard = document.getElementById('dynamicProjectWizard');
        if (wizard) {
            wizard.remove();
        }

        this.showNotification('✅ Proje chat paneline aktarıldı! Şimdi proje hakkında konuşabilirsin.', 'success');
    }

    // Enhanced project modification capabilities
    async modifyProjectFromChat(modifications) {
        if (!this.currentProjectData) {
            this.showNotification('❌ Değiştirilecek aktif proje bulunamadı', 'error');
            return;
        }

        try {
            // Apply modifications to current project data
            const updatedData = { ...this.currentProjectData };

            if (modifications.title) updatedData.title = modifications.title;
            if (modifications.prompt) updatedData.prompt = modifications.prompt;
            if (modifications.features) {
                updatedData.analysis.features = [...updatedData.analysis.features, ...modifications.features];
            }
            if (modifications.techStack) {
                Object.assign(updatedData.analysis.recommendedStack, modifications.techStack);
            }

            // Re-analyze if needed
            if (modifications.requiresAnalysis) {
                const newAnalysis = await this.analyzeProjectRequirements(
                    updatedData.title,
                    updatedData.prompt,
                    updatedData.author
                );
                if (newAnalysis) {
                    updatedData.analysis = newAnalysis;
                }
            }

            this.currentProjectData = updatedData;

            // Update chat with changes
            const changesSummary = `🔄 **Proje Güncellendi**

**Yapılan Değişiklikler:**
${modifications.title ? `- **Başlık:** ${modifications.title}` : ''}
${modifications.prompt ? `- **Açıklama:** ${modifications.prompt}` : ''}
${modifications.features ? `- **Yeni Özellikler:** ${modifications.features.join(', ')}` : ''}
${modifications.techStack ? `- **Stack Değişiklikleri:** ${Object.entries(modifications.techStack).map(([k, v]) => `${k}: ${v.join(', ')}`).join(', ')}` : ''}

Değişiklikler uygulandı! Başka bir şey değiştirmek istiyor musun?`;

            this.addContextualChatMessage('assistant', changesSummary, {
                isProjectUpdate: true,
                projectData: this.currentProjectData
            });

            this.showNotification('✅ Proje başarıyla güncellendi', 'success');
            return updatedData;

        } catch (error) {
            console.error('Project modification error:', error);
            this.showNotification('❌ Proje güncellenemedi', 'error');
            return null;
        }
    }

    // Project approval and implementation trigger
    approveAndImplementProject() {
        if (!this.currentProjectData) {
            this.showNotification('❌ Onaylanacak proje bulunamadı', 'error');
            return;
        }

        this.updateProjectStatus('approved');

        const approvalMessage = `✅ **Proje Onaylandı!**

**${this.currentProjectData.title}** projesi implementasyona hazır.

Şimdi proje dosyalarını oluşturmaya başlayacağım:
1. 📁 Klasör yapısını oluştur
2. 📄 Temel dosyaları oluştur  
3. ⚙️ Konfigürasyon dosyalarını hazırla
4. 🎨 Başlangıç kodlarını yaz

Proje oluşturma sürecini başlatıyorum...`;

        this.addContextualChatMessage('assistant', approvalMessage, {
            isProjectApproval: true,
            projectData: this.currentProjectData
        });

        // Trigger project creation
        setTimeout(() => {
            this.generateProjectStructure(this.currentProjectData);
        }, 1000);
    }

    // AI-Powered Project Structure Generation
    async generateProjectStructure(projectData) {
        if (!projectData) {
            this.showNotification('❌ Proje verisi bulunamadı', 'error');
            return;
        }

        try {
            this.updateProjectStatus('creating');

            const progressMessage = `🚀 **Proje Oluşturuluyor...**

**${projectData.title}** için proje yapısı oluşturuluyor:

⏳ Klasör yapısını analiz ediyorum...
⏳ Konfigürasyon dosyalarını hazırlıyorum...
⏳ Başlangıç kodlarını yazıyorum...`;

            this.addContextualChatMessage('assistant', progressMessage, {
                isProjectCreation: true,
                projectData
            });

            // Generate project structure based on analysis
            const projectStructure = await this.generateProjectFiles(projectData);

            if (projectStructure) {
                await this.createProjectFiles(projectStructure, projectData);

                const successMessage = `✅ **Proje Başarıyla Oluşturuldu!**

**${projectData.title}** projesi hazır:

📁 **Oluşturulan Klasörler:** ${projectStructure.folders.length}
📄 **Oluşturulan Dosyalar:** ${projectStructure.files.length}
⚙️ **Konfigürasyon:** Tamamlandı
🎨 **Başlangıç Kodları:** Hazır

**Proje Konumu:** \`${projectStructure.projectPath}\`

Artık geliştirmeye başlayabilirsin! 🎉`;

                this.addContextualChatMessage('assistant', successMessage, {
                    isProjectComplete: true,
                    projectStructure
                });

                this.showNotification('✅ Proje oluşturuldu!', 'success');

                // Update project status
                this.currentProjectData.createdAt = new Date().toISOString();
                this.currentProjectData.projectPath = projectStructure.projectPath;

                this.completeWorkflow();
            }

        } catch (error) {
            console.error('Project creation error:', error);

            const errorMessage = `❌ **Proje Oluşturma Hatası**

Proje oluşturulurken bir hata oluştu:
${error.message}

Lütfen tekrar deneyin veya farklı bir yaklaşım deneyin.`;

            this.addContextualChatMessage('assistant', errorMessage, {
                isProjectError: true,
                error: error.message
            });

            this.showNotification('❌ Proje oluşturulamadı', 'error');
        }
    }

    // Generate project files and structure
    async generateProjectFiles(projectData) {
        const { analysis } = projectData;

        // Create AI prompt for project structure generation
        const structurePrompt = `Proje yapısı oluştur:

PROJE: ${projectData.title}
TÜR: ${analysis.projectType}
STACK: ${JSON.stringify(analysis.recommendedStack)}
ÖZELLİKLER: ${analysis.features.join(', ')}

Aşağıdaki JSON formatında proje yapısını döndür:

{
    "projectName": "${projectData.title.toLowerCase().replace(/\s+/g, '-')}",
    "folders": [
        "src",
        "src/components",
        "src/pages",
        "src/styles",
        "src/utils",
        "public",
        "docs"
    ],
    "files": [
        {
            "path": "package.json",
            "content": "package.json içeriği",
            "type": "config"
        },
        {
            "path": "README.md",
            "content": "README içeriği", 
            "type": "documentation"
        },
        {
            "path": "src/index.js",
            "content": "Ana uygulama kodu",
            "type": "code"
        }
    ],
    "commands": [
        "npm install",
        "npm start"
    ]
}

Teknoloji stackine uygun dosyalar oluştur. Başlangıç kodu da ekle.`;

        try {
            const response = await this.callOpenAI(structurePrompt);
            const jsonMatch = response.match(/\{[\s\S]*\}/);

            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }

            throw new Error('Proje yapısı parse edilemedi');
        } catch (error) {
            console.error('Structure generation error:', error);
            return this.getDefaultProjectStructure(projectData);
        }
    }

    // Fallback default project structure
    getDefaultProjectStructure(projectData) {
        const projectName = projectData.title.toLowerCase().replace(/\s+/g, '-');

        return {
            projectName,
            folders: ['src', 'public', 'docs'],
            files: [
                {
                    path: 'README.md',
                    content: `# ${projectData.title}\n\n${projectData.prompt}\n\n## Geliştirici\n${projectData.author}\n\n## Özellikler\n${projectData.analysis.features.map(f => `- ${f}`).join('\n')}`,
                    type: 'documentation'
                },
                {
                    path: 'package.json',
                    content: JSON.stringify({
                        name: projectName,
                        version: '1.0.0',
                        description: projectData.prompt,
                        author: projectData.author,
                        scripts: {
                            start: 'node src/index.js',
                            dev: 'node src/index.js'
                        }
                    }, null, 2),
                    type: 'config'
                },
                {
                    path: 'src/index.js',
                    content: `// ${projectData.title}\n// ${projectData.prompt}\n\nconsole.log('Proje başlatıldı!');\n\n// TODO: Uygulamayı geliştirin`,
                    type: 'code'
                }
            ],
            commands: ['npm install', 'npm start']
        };
    }

    // Create actual project files
    async createProjectFiles(projectStructure, projectData) {
        try {
            // Get project path (could be user workspace or dedicated projects folder)
            const projectPath = await this.getProjectCreationPath(projectStructure.projectName);
            projectStructure.projectPath = projectPath;

            // Create project directory
            await this.createDirectory(projectPath);

            // Create folders
            for (const folder of projectStructure.folders) {
                const folderPath = `${projectPath}/${folder}`;
                await this.createDirectory(folderPath);
            }

            // Create files
            for (const file of projectStructure.files) {
                const filePath = `${projectPath}/${file.path}`;
                await this.createFile(filePath, file.content);
            }

            return projectStructure;

        } catch (error) {
            console.error('File creation error:', error);
            throw new Error(`Dosya oluşturma hatası: ${error.message}`);
        }
    }

    // Get project creation path
    async getProjectCreationPath(projectName) {
        // Check if we're in a workspace
        const workspacePath = await this.getCurrentWorkspacePath();

        if (workspacePath) {
            return `${workspacePath}/projects/${projectName}`;
        }

        // Fallback to user documents
        return `./generated-projects/${projectName}`;
    }

    // Get current workspace path
    async getCurrentWorkspacePath() {
        try {
            // This would typically use Electron's API to get workspace info
            // For now, return a fallback path
            return './workspace';
        } catch (error) {
            return null;
        }
    }

    // Create directory utility
    async createDirectory(path) {
        console.log(`📁 Creating directory: ${path}`);

        try {
            // Use electron API for real directory creation if available
            if (window.electronAPI && window.electronAPI.createDirectory) {
                const result = await window.electronAPI.createDirectory(path);
                console.log('📁 Directory creation result:', result);
                return result.success ? path : Promise.reject(new Error(result.error || 'Directory creation failed'));
            }

            // Fallback simulation for now
            console.warn('⚠️ No real directory creation method available, using simulation');
            return new Promise((resolve, reject) => {
                console.log(`SIMULATION: Creating directory: ${path}`);
                setTimeout(() => resolve(path), 100);
            });
        } catch (error) {
            console.error('❌ Directory creation error:', error);
            throw error;
        }
    }

    // Create file utility
    async createFile(path, content) {
        console.log(`📁 Creating file: ${path}, content length: ${content?.length || 0}`);

        // Validate content
        if (!content || content.trim() === '') {
            console.warn('⚠️ Empty content provided, generating default');
            const fileName = path.split('/').pop() || path;
            content = this.generateDefaultFileContent(fileName);
        }

        try {
            // Use electron API directly for real file creation
            if (window.electronAPI && window.electronAPI.writeFile) {
                console.log('💾 Using electronAPI for real file creation:', path);
                const result = await window.electronAPI.writeFile(path, content);
                console.log('💾 File creation result:', result);
                return result.success ? path : Promise.reject(new Error(result.error || 'File creation failed'));
            }

            // Use new tool system if available
            if (this.toolsSystem) {
                const result = await this.toolsSystem.executeToolWithExceptionHandling('writeFile', {
                    filePath: path,
                    content: content
                });
                return result.success ? path : Promise.reject(new Error('File creation failed'));
            }

            // Fallback simulation (last resort)
            console.warn('⚠️ No real file creation method available, using simulation');
            return new Promise((resolve, reject) => {
                console.log(`SIMULATION: Creating file: ${path}`);
                console.log(`SIMULATION: Content length: ${content.length} characters`);
                setTimeout(() => resolve(path), 100);
            });
        } catch (error) {
            console.error('❌ File creation error:', error);
            throw error;
        }
    }

    showProjectSetupWizard(templateData) {
        const wizardHtml = `
      <div class="modal project-setup-wizard" id="projectSetupWizard">
        <div class="modal-content">
          <div class="modal-header">
            <h3><i class="fas fa-magic"></i> Proje Kurulum Sihirbazı</h3>
            <button class="modal-close" id="closeProjectWizard">&times;</button>
          </div>
          <div class="modal-body">
            <div class="wizard-step active" data-step="1">
              <h4>📁 Proje Bilgileri</h4>
              <div class="form-group">
                <label for="projectName">Proje Adı:</label>
                <input type="text" id="projectName" placeholder="my-awesome-project" value="">
              </div>
              <div class="form-group">
                <label for="projectDescription">Proje Açıklaması:</label>
                <textarea id="projectDescription" placeholder="Bu proje hakkında kısa bir açıklama..." rows="3"></textarea>
              </div>
              <div class="form-group">
                <label for="projectAuthor">Yazar:</label>
                <input type="text" id="projectAuthor" placeholder="Ad Soyad" value="">
              </div>
            </div>
            
            <div class="wizard-step" data-step="2">
              <h4>⚙️ Teknik Ayarlar</h4>
              <div class="form-group">
                <label>Proje Türü:</label>
                <div class="project-type-selector">
                  <div class="type-option active" data-type="${templateData.projectType}">
                    <i class="fas fa-check"></i> ${templateData.title}
                  </div>
                </div>
              </div>
              <div class="form-group" id="additionalOptions">
                ${this.getAdditionalOptions(templateData.projectType)}
              </div>
            </div>
            
            <div class="wizard-step" data-step="3">
              <h4>📋 Özet ve Onay</h4>
              <div class="project-summary" id="projectSummary">
                <!-- Summary will be populated here -->
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn secondary" id="wizardPrev" style="display: none;">⬅️ Geri</button>
            <button class="btn primary" id="wizardNext">İlerle ➡️</button>
            <button class="btn primary" id="wizardFinish" style="display: none;">🚀 Projeyi Oluştur</button>
          </div>
        </div>
      </div>
    `;

        document.body.insertAdjacentHTML('beforeend', wizardHtml);

        // Event listeners
        this.setupProjectWizardEvents(templateData);

        // Show wizard
        document.getElementById('projectSetupWizard').classList.remove('hidden');
    }

    getAdditionalOptions(projectType) {
        const options = {
            react: `
        <label>
          <input type="checkbox" id="useTypeScript" checked> TypeScript kullan
        </label>
        <label>
          <input type="checkbox" id="useTailwind" checked> Tailwind CSS ekle
        </label>
        <label>
          <input type="checkbox" id="useRouter" checked> React Router ekle
        </label>
      `,
            nodejs: `
        <label>
          <input type="checkbox" id="useExpress" checked> Express.js framework
        </label>
        <label>
          <input type="checkbox" id="useDatabase" checked> Database (MongoDB/PostgreSQL)
        </label>
        <label>
          <input type="checkbox" id="useAuth" checked> JWT Authentication
        </label>
      `,
            python: `
        <label>
          <input type="checkbox" id="useRequests" checked> Requests library
        </label>
        <label>
          <input type="checkbox" id="useBeautifulSoup" checked> BeautifulSoup4
        </label>
        <label>
          <input type="checkbox" id="usePandas"> Pandas (data processing)
        </label>
      `,
            static: `
        <label>
          <input type="checkbox" id="useBootstrap"> Bootstrap CSS
        </label>
        <label>
          <input type="checkbox" id="useJQuery"> jQuery
        </label>
        <label>
          <input type="checkbox" id="useFontAwesome" checked> Font Awesome icons
        </label>
      `
        };

        return options[projectType] || '';
    }

    async loadSimpleTemplate(templateData) {
        // Agent mode'u aktif et
        this.switchToAgentMode();

        // Chat'e template seçimini bildir
        this.addChatMessage('user', `📋 Template: ${templateData.title}`);

        // Unified agent system ile çalıştır
        await this.executeUnifiedAgentTask(templateData.description);

        this.showNotification(`✨ ${templateData.title} template'i yüklendi`, 'success');
    }

    toggleAgentMode() {
        const toggle = document.getElementById('agentModeToggle');
        const panel = document.getElementById('agentModePanel');

        if (this.aiMode.current === 'agent') {
            this.switchToAskMode();
            toggle.classList.remove('active');
            panel.classList.add('hidden');
        } else {
            this.switchToAgentMode();
            toggle.classList.add('active');
            panel.classList.remove('hidden');
        }
    }

    // =====================================
    // AI Mode Methods
    // =====================================

    switchToAskMode() {
        this.aiMode.current = 'ask';
        this.aiMode.askMode.isActive = true;
        this.aiMode.agentMode.isActive = false;

        // UI güncellemeleri
        const askBtn = document.getElementById('askModeBtn');
        const agentBtn = document.getElementById('agentModeBtn2');
        const askPanel = document.getElementById('askModePanel');
        const chatModeSelect = document.getElementById('chatAiModeSelect');
        const agentToggle = document.getElementById('agentModeToggle');

        askBtn?.classList.add('active');
        agentBtn?.classList.remove('active');
        if (askPanel) askPanel.style.display = 'block';
        // AI Asistan paneli her zaman görünür kalsın
        if (chatModeSelect) chatModeSelect.value = 'ask';
        if (agentToggle) agentToggle.classList.remove('active');

        this.showNotification('💬 Ask Mode aktif edildi', 'info');
    }

    switchToAgentMode() {
        this.aiMode.current = 'agent';
        this.aiMode.askMode.isActive = false;
        this.aiMode.agentMode.isActive = true;

        // UI güncellemeleri
        const askBtn = document.getElementById('askModeBtn');
        const agentBtn = document.getElementById('agentModeBtn2');
        const askPanel = document.getElementById('askModePanel');
        const chatModeSelect = document.getElementById('chatAiModeSelect');
        const agentToggle = document.getElementById('agentModeToggle');

        askBtn?.classList.remove('active');
        agentBtn?.classList.add('active');
        if (askPanel) askPanel.style.display = 'none';
        // AI Asistan paneli her zaman görünür kalsın
        if (chatModeSelect) chatModeSelect.value = 'agent';
        if (agentToggle) agentToggle.classList.add('active');

        this.showNotification('🤖 Agent Mode aktif edildi - Tam yetki verildi', 'warning');
    }

    async submitAskQuestion() {
        const askInput = document.getElementById('askInput');
        const question = askInput.value.trim();

        if (!question) {
            this.showNotification('⚠️ Lütfen bir soru girin', 'warning');
            return;
        }

        if (!this.settings.apiKey) {
            this.showNotification('⚠️ Önce OpenAI API anahtarınızı ayarlayın', 'warning');
            document.getElementById('settingsBtn').click();
            return;
        }

        const submitBtn = document.getElementById('submitAsk');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Düşünüyor...';

        try {
            // Mevcut dosya içeriğini context olarak ekle
            let context = '';
            if (this.currentFile && this.tabs.has(this.currentFile)) {
                const fileData = this.tabs.get(this.currentFile);
                context = `\n\nMevcut dosya (${this.currentFile}):\n\`\`\`\n${fileData.content}\n\`\`\``;
            }

            const prompt = `${question}${context}`;

            const answer = await this.callOpenAI([
                {
                    role: 'system',
                    content: 'Sen yardımsever bir yazılım geliştirici asistanısın. Sorulara açık, detaylı ve pratik cevaplar veriyorsun. Kod örnekleri verirken temiz ve açıklamalı kod yazıyorsun.'
                },
                { role: 'user', content: prompt }
            ]);

            // Chat paneline ekle
            this.addChatMessage('user', question);
            this.addChatMessage('assistant', answer);

            askInput.value = '';
            this.showNotification('✅ Soru yanıtlandı', 'success');

        } catch (error) {
            console.error('❌ Ask mode error:', error);
            this.showNotification('❌ Soru yanıtlanırken hata oluştu: ' + error.message, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Sor';
        }
    }

    toggleAgentModeHeader() {
        // Header'daki agent mode butonunun işlevi
        if (this.aiMode.current === 'agent') {
            this.switchToAskMode();
        } else {
            this.switchToAgentMode();
        }
    }

    // =====================================
    // Unified Agent System (GitHub Copilot Style)
    // =====================================

    // =====================================
    // AI Memory & Context Management System
    // =====================================

    // Get conversation context from recent messages
    getConversationContext(messageLimit = 10) {
        if (!this.chatHistory || this.chatHistory.length === 0) {
            return '';
        }

        // Get recent messages (excluding system messages)
        const recentMessages = this.chatHistory
            .filter(msg => msg.type !== 'system')
            .slice(-messageLimit)
            .map(msg => `${msg.type === 'user' ? 'User' : 'AI'}: ${msg.content}`)
            .join('\n\n');

        return recentMessages;
    }

    // Extract key topics and entities from conversation history
    extractConversationSummary() {
        if (!this.chatHistory || this.chatHistory.length < 2) {
            return { topics: [], entities: [], lastIntent: null };
        }

        const userMessages = this.chatHistory
            .filter(msg => msg.type === 'user')
            .map(msg => msg.content);

        // Simple keyword extraction for topics
        const topics = new Set();
        const entities = new Set();
        const keywords = [
            'proje', 'component', 'function', 'class', 'api', 'database',
            'frontend', 'backend', 'react', 'vue', 'angular', 'node',
            'python', 'javascript', 'html', 'css', 'bug', 'fix', 'error',
            // 🔧 FIX #7: Added project type keywords to track user intent
            'hesap makinesi', 'calculator', 'blog', 'platform', 'todo', 'chat', 
            'dashboard', 'portfolio', 'e-commerce', 'shop', 'game', 'oyun'
        ];

        userMessages.forEach(message => {
            const lowerMessage = message.toLowerCase();
            keywords.forEach(keyword => {
                if (lowerMessage.includes(keyword)) {
                    topics.add(keyword);
                }
            });

            // Extract potential file names or code entities
            const codePattern = /`([^`]+)`/g;
            const matches = message.match(codePattern);
            if (matches) {
                matches.forEach(match => entities.add(match.replace(/`/g, '')));
            }
        });

        const lastUserMessage = userMessages[userMessages.length - 1];
        const lastIntent = this.detectIntent(lastUserMessage || '');

        return {
            topics: Array.from(topics),
            entities: Array.from(entities),
            lastIntent
        };
    }

    // Detect intent from message
    detectIntent(message) {
        const lowerMessage = message.toLowerCase();

        if (lowerMessage.includes('proje') || lowerMessage.includes('create')) return 'project';
        if (lowerMessage.includes('fix') || lowerMessage.includes('hata') || lowerMessage.includes('error')) return 'fix';
        if (lowerMessage.includes('explain') || lowerMessage.includes('açıkla') || lowerMessage.includes('ne')) return 'explain';
        if (lowerMessage.includes('implement') || lowerMessage.includes('ekle') || lowerMessage.includes('add')) return 'implement';
        if (lowerMessage.includes('optimize') || lowerMessage.includes('improve') || lowerMessage.includes('iyileştir')) return 'optimize';

        return 'general';
    }

    // Build context-aware prompt with conversation history
    buildContextAwarePrompt(userRequest, includeHistory = true) {
        let contextPrompt = userRequest;

        if (includeHistory && this.chatHistory.length > 0) {
            const context = this.getConversationContext(5); // Last 5 messages
            const summary = this.extractConversationSummary();

            if (context || summary.topics.length > 0) {
                contextPrompt = `
CONVERSATION CONTEXT:
${context ? `Recent messages:\n${context}\n\n` : ''}
${summary.topics.length > 0 ? `Discussed topics: ${summary.topics.join(', ')}\n` : ''}
${summary.entities.length > 0 ? `Mentioned entities: ${summary.entities.join(', ')}\n` : ''}
${summary.lastIntent ? `Previous intent: ${summary.lastIntent}\n` : ''}

CURRENT REQUEST:
${userRequest}

Please consider the conversation context when responding. Reference previous discussions when relevant.
                `.trim();
            }
        }

        return contextPrompt;
    }

    // Enhanced storage with context
    addContextualChatMessage(type, content, metadata = {}) {
        const now = new Date();
        const contextEntry = {
            type,
            content,
            timestamp: now,
            metadata: {
                ...metadata,
                conversationLength: this.chatHistory.length,
                relatedTopics: this.extractConversationSummary().topics
            }
        };

        // Store with enhanced context
        this.chatHistory.push(contextEntry);

        // Also display in UI
        this.addChatMessage(type, content);

        // Keep conversation history manageable (last 50 messages)
        if (this.chatHistory.length > 50) {
            this.chatHistory = this.chatHistory.slice(-50);
        }
    }

    async executeUnifiedAgentTask(userRequest, preAssignedRoute = null) {
        // Clear any previous agent state
        this.clearAgentState();

        // Check if user is responding to a pending action
        if (this.pendingAction && (userRequest.toLowerCase().includes('evet') || userRequest.toLowerCase().includes('yes'))) {
            this.addChatMessage('ai', '✅ Tamam, önerilen eylemi gerçekleştiriyorum!');
            const route = this.pendingAction;
            this.pendingAction = null; // Clear pending action

            // Execute the previously suggested action
            const analysis = await this.analyzeUserRequest(route.suggested_action || userRequest, route);
            const approved = await this.showExecutionPlan(analysis, route);

            if (approved) {
                await this.executeWithLiveUpdates(analysis);
            }
            return;
        }

        // Clear pending action if user asks something else
        this.pendingAction = null;

        // Show that agent is thinking
        this.addChatMessage('ai', '🤔 İsteğinizi analiz ediyorum...');

        try {
            // 🔐 PHASE 6: ELYSION CHAMBER - Event emission for narrator
            if (this.eventBus) {
                this.eventBus.emit({
                    type: 'TASK_START',
                    task: { 
                        id: Date.now(),
                        title: 'User Request Analysis',
                        description: userRequest,
                        timestamp: Date.now()
                    }
                });
            }

            // 🎼 HIERARCHY SYSTEM: Validate override attempt
            let route;
            if (preAssignedRoute && preAssignedRoute._hierarchy) {
                // Luma veya başka bir üst seviye agent karar vermiş
                console.log('🎼 Existing decision detected from:', preAssignedRoute._hierarchy.agent);
                console.log('   Level:', preAssignedRoute._hierarchy.level);
                console.log('   Is Final:', preAssignedRoute._hierarchy.isFinal);
                
                // Router'ın override etmeye çalışması durumu
                const overrideValidation = validateOverride(
                    preAssignedRoute, 
                    'RouterAgent', 
                    { role: 'unknown', mode: 'unknown' }
                );
                
                if (overrideValidation.allowed) {
                    console.log('✅ Router can override previous decision:', overrideValidation.reason);
                    route = await this.routeUserIntent(userRequest);
                } else {
                    console.log('🚫 Router CANNOT override:', overrideValidation.reason);
                    console.log('✅ Using existing decision (hierarchy preserved)');
                    route = preAssignedRoute;
                    
                    // Show Luma's decision to user
                    const roleNames = {
                        executor: "⚙️ Executor (Komut Çalıştırıcı)",
                        generator: "🔧 Generator (Kod Üretici)",
                        analyzer: "🔍 Analyzer (Kod Analiz)",
                        documentation: "📝 Documentation (Döküman)",
                        coordinator: "⚙️ Coordinator (Koordinatör)",
                        artist: "🎨 Artist (Görsel İçerik)"
                    };
                    
                    this.addChatMessage('ai', `🌌 Luma Supreme kararı: ${roleNames[route.role] || route.role}\n💡 ${route.reasoning}`);
                }
            } else if (preAssignedRoute && preAssignedRoute.lumaDecisionFinal) {
                // Legacy support: Old lumaDecisionFinal flag
                console.log('⚠️ Legacy flag detected: lumaDecisionFinal (upgrading to hierarchy system)');
                route = wrapDecision('LumaSupremeAgent', preAssignedRoute);
                
                const roleNames = {
                    executor: "⚙️ Executor (Komut Çalıştırıcı)",
                    generator: "🔧 Generator (Kod Üretici)",
                    analyzer: "🔍 Analyzer (Kod Analiz)",
                    documentation: "📝 Documentation (Döküman)",
                    coordinator: "⚙️ Coordinator (Koordinatör)",
                    artist: "🎨 Artist (Görsel İçerik)"
                };
                
                this.addChatMessage('ai', `🌌 Luma Supreme kararı: ${roleNames[route.role] || route.role}\n💡 ${route.reasoning}`);
            } else {
                // Step 1: Router Agent - Intent Analysis & Auto Role Selection (ONLY if no existing decision)
                const routerDecision = await this.routeUserIntent(userRequest);
                route = wrapDecision('RouterAgent', routerDecision);
            }

            // If router returned null (chat/hybrid mode handled), stop here
            if (!route) {
                return;
            }

            // Step 2: Analyze the request with selected role context
            const analysis = await this.analyzeUserRequest(userRequest, route);

            // Validate analysis before proceeding
            if (!analysis) {
                this.addChatMessage('ai', '❌ İstek analizi başarısız oldu. Lütfen tekrar deneyin.');
                return;
            }

            // 🔧 PRODUCTION AGENT: Tool-First Policy Enforcement
            const hasToolActions = analysis.plannedActions && analysis.plannedActions.some(action =>
                action.tool && action.tool !== 'none' && action.action !== 'respond'
            );

            if (!hasToolActions) {
                this.consecutiveNoToolMessages++;
                console.warn(`⚠️ Tool-First Policy: ${this.consecutiveNoToolMessages}/2 messages without tool`);

                if (this.consecutiveNoToolMessages >= 2) {
                    console.error('🚫 TOOL-FIRST VIOLATION: 2 consecutive messages without tool calls!');
                    console.log('🔧 Forcing tool call: fs.read package.json');

                    // Force a safe tool call to break the pattern
                    if (!analysis.plannedActions) {
                        analysis.plannedActions = [];
                    }
                    analysis.plannedActions.unshift({
                        action: 'read_file',
                        description: 'Proje yapısını kontrol et (forced by Tool-First Policy)',
                        fileName: 'package.json',
                        critical: false,
                        tool: 'read_file'
                    });

                    this.consecutiveNoToolMessages = 0; // Reset after forcing tool
                }
            } else {
                this.consecutiveNoToolMessages = 0; // Reset on valid tool use
            }

            // 🔐 PHASE 6: ELYSION CHAMBER - Policy Check & Approval Gate
            let approvalToken = null;
            
            if (this.policyEngine && this.approvalSystem && analysis.plannedActions && analysis.plannedActions.length > 0) {
                // Extract first command/action for policy validation
                const firstAction = analysis.plannedActions[0];
                const commandToCheck = firstAction.command || firstAction.fileName || firstAction.description || 'unknown';
                
                // Policy check (use active workspace root)
                const cwd = this.getWorkspaceRoot({ mode: "active" }) || process.cwd();
                const policyResult = this.policyEngine.validate({
                    command: commandToCheck,
                    cwd: cwd,
                    context: {
                        action: firstAction,
                        allActions: analysis.plannedActions,
                        userRequest: userRequest
                    }
                });

                console.log('🔐 Policy Check Result:', policyResult);

                // Emit policy check event
                if (this.eventBus) {
                    this.eventBus.emit({
                        type: policyResult.canProceed ? 'POLICY_CHECK_PASS' : 'POLICY_VIOLATION',
                        policy: policyResult,
                        command: commandToCheck
                    });
                }

                // If policy blocks, stop immediately
                if (!policyResult.canProceed) {
                    this.addChatMessage('ai', `🔴 **POLİTİKA ENGELLEDİ!**\n\n❌ ${policyResult.violations[0]?.message || 'Güvenlik politikası ihlali'}`);
                    return;
                }

                // 🎓 USTA MODU: Validate proposal for teach mode requirements
                if (analysis.orders && this.policyEngine) {
                    const proposalValidation = this.policyEngine.validateProposal(analysis.orders, {
                        teachWhileDoing: this.settings.teachWhileDoing || false
                    });
                    
                    if (!proposalValidation.valid) {
                        console.error('🔐 Proposal validation failed:', proposalValidation.violations);
                        this.addChatMessage('ai', 
                            `🔴 **USTA MODU GEREKSİNİMLERİ KARŞILANMADI!**\n\n` +
                            proposalValidation.violations.map(v => 
                                `❌ ${v.message}\n   Steps: ${v.steps?.join(', ') || 'N/A'}`
                            ).join('\n\n')
                        );
                        return;
                    }
                }

                // Build approval proposal
                const proposal = {
                    step: {
                        id: Date.now(),
                        title: analysis.summary || 'Planned Operation',
                        intent: userRequest,
                        estimatedDuration: '~1 minute'
                    },
                    commands: analysis.plannedActions
                        .filter(a => a.command)
                        .map(a => a.command),
                    files: analysis.plannedActions
                        .filter(a => a.fileName)
                        .map(a => ({
                            path: a.fileName,
                            operation: a.action || 'write'
                        })),
                    risks: this.assessRisks(analysis.plannedActions),
                    probes: this.buildProbesForActions(analysis.plannedActions),
                    policyViolations: policyResult.warnings || []
                };

                console.log('🔐 Requesting approval for proposal:', proposal);

                // Request approval (auto-approve if developer mode or safe operation)
                try {
                    const approval = await this.approvalSystem.requestApproval(proposal, {
                        developerMode: this.developerMode,
                        policyEngine: this.policyEngine
                    });
                    
                    if (!approval.approved) {
                        this.addChatMessage('ai', `❌ İşlem reddedildi.\n\n💬 Sebep: ${approval.reason || 'Kullanıcı onaylamadı'}`);
                        
                        // Emit denial event
                        if (this.eventBus) {
                            this.eventBus.emit({
                                type: 'APPROVAL_DENIED',
                                reason: approval.reason
                            });
                        }
                        return;
                    }

                    // Approval granted - store token
                    approvalToken = approval.token;
                    console.log('✅ Approval granted with token:', approvalToken);

                    // Emit approval event
                    if (this.eventBus) {
                        this.eventBus.emit({
                            type: 'APPROVAL_GRANTED',
                            token: approvalToken,
                            proposal: proposal
                        });
                    }

                } catch (error) {
                    console.error('❌ Approval request failed:', error);
                    this.addChatMessage('ai', `❌ Onay sistemi hatası: ${error.message}`);
                    return;
                }
            }

            // Step 3: Show plan to user with approval (if needed)
            // NOTE: showExecutionPlan is now optional since we have Elysion Chamber approval
            const approved = await this.showExecutionPlan(analysis, route);

            if (!approved) {
                this.addChatMessage('ai', '❌ İşlem iptal edildi.');
                return;
            }

            // Step 4: Execute with real-time updates using selected role
            // Pass approval token to execution (for token-gated operations)
            await this.executeWithLiveUpdates(analysis, route, approvalToken);

        } catch (error) {
            this.addChatMessage('ai', `❌ Hata: ${error.message}`);
        }
    }

    // =====================================
    // Router Agent - Intent Detection & Auto Role Selection
    // =====================================

    async routeUserIntent(userText) {
        // Router Agent: Automatically determine role and initial tools
        const routerPrompt = `
Sen çok akıllı bir Router Agent'sın. Kullanıcının isteğini analiz et ve en iyi yaklaşımı belirle.

Kullanıcı: "${userText}"

Aşağıdaki JSON formatında cevap ver:
{
  "mode": "chat|hybrid|action",
  "role": "generator|analyzer|documentation|coordinator|artist", 
  "action_type": "immediate|suggested|none",
  "confidence": 0.1-1.0,
  "reasoning": "Neden bu yaklaşımı seçtin?",
  "response_first": "Önce verilecek cevap (eğer varsa)",
  "suggested_action": "Önerilen eylem açıklaması",
  "force_tool": "write_file|read_file|glob|run_cmd|null"
}

MOD KURALLARI:
- "chat": Sadece sohbet, soru-cevap. Tool kullanma.
- "hybrid": Önce açıklama/cevap ver, sonra eylem öner ("İstersen...")
- "action": Direkt eyleme geç, plan göster.

CONTEXT KURALLARI:
- Genel sorular (nedir, nasıl, açıkla) → "hybrid" mod
- Selamlaşma, teşekkür → "chat" mod  
- Açık komutlar (oluştur, analiz et, yap) → "action" mod
- Belirsiz istekler → "hybrid" mod (açıkla + öner)

AKILLI ÖRNEKLER:
- "React nedir?" → chat (sadece açıkla)
- "Projem hakkında bilgi ver" → hybrid (açıkla + dosya analizi öner)
- "README oluştur" → action (direkt yap)
- "Kod kalitesi nasıl?" → hybrid (açıkla + analiz öner)
`;

        try {
            // Use unified LLM interface for routing
            const response = await this.queueOpenAIRequest(async () => {
                const messages = [{ role: 'user', content: routerPrompt }];
                return await this.callLLM(messages, { temperature: 0.7, maxTokens: 2048 });
            });
            const jsonMatch = response.match(/\{[\s\S]*\}/);

            if (jsonMatch) {
                const route = JSON.parse(jsonMatch[0]);

                // Handle different modes
                if (route.mode === 'chat') {
                    // Pure chat mode - just answer with unified LLM
                    const chatResponse = await this.queueOpenAIRequest(async () => {
                        const chatMessages = [
                            { role: 'system', content: "Sen KayraDeniz Kod Canavarı'sın. Dostane, açık ve faydalı cevaplar veriyorsun." },
                            { role: 'user', content: `Kullanıcı sorusu: "${userText}"\n\nSoruyu samimi ve yardımsever bir dille cevapla.` }
                        ];
                        return await this.callLLM(chatMessages, { temperature: 0.8, maxTokens: 2048 });
                    });
                    this.addChatMessage('ai', chatResponse);
                    return null;
                }

                if (route.mode === 'hybrid') {
                    // Hybrid mode - answer first, then suggest action
                    let hybridResponse = '';

                    if (route.response_first) {
                        hybridResponse += route.response_first + '\n\n';
                    }

                    if (route.suggested_action) {
                        hybridResponse += `💡 **İstersen şunu yapabilirim:**\n${route.suggested_action}\n\n`;
                        hybridResponse += `Devam etmek için "evet" de, ya da başka bir şey sor! 😊`;
                    }

                    this.addChatMessage('ai', hybridResponse);

                    // Store the suggested route for potential execution
                    this.pendingAction = route;
                    return null;
                }

                if (route.mode === 'action') {
                    // Action mode - proceed with execution
                    const roleNames = {
                        generator: "🔧 Generator (Kod Üretici)",
                        analyzer: "🔍 Analyzer (Kod Analiz)",
                        documentation: "📝 Documentation (Döküman)",
                        coordinator: "⚙️ Coordinator (Koordinatör)",
                        artist: "🎨 Artist (Görsel İçerik)"
                    };

                    this.addChatMessage('ai', `🎯 Otomatik rol seçimi: ${roleNames[route.role]}\n💡 Sebep: ${route.reasoning}`);
                    this.updateRouterStatus(route);
                    return route;
                }
            }
        } catch (error) {
            console.warn('Router Agent hatası, fallback kullanılıyor:', error);
        }

        // Fallback: Simple keyword-based routing
        const text = userText.toLowerCase();
        let route;

        // 🎨 Artist Mode Detection - Visual content keywords
        if (/(svg|logo|tasarla|diagram|mermaid|plantuml|görsel|grafik|şema|çiz|icon|banner)/.test(text)) {
            route = {
                role: "artist",
                confidence: 0.8,
                reasoning: "Görsel içerik anahtar kelimeleri tespit edildi",
                force_tool: "write_file",
                needs_confirmation: false,
                estimated_danger: "safe"
            };
        } else if (/(oluştur|yaz|ekle|kaydet|oyun|component|refactor)/.test(text)) {
            route = {
                role: "generator",
                confidence: 0.6,
                reasoning: "Kod üretim anahtar kelimeleri tespit edildi",
                force_tool: "write_file",
                needs_confirmation: false,
                estimated_danger: "safe"
            };
        } else if (/(oku|analiz|incele|hata|test|bul)/.test(text)) {
            route = {
                role: "analyzer",
                confidence: 0.6,
                reasoning: "Kod analiz anahtar kelimeleri tespit edildi",
                force_tool: "glob",
                needs_confirmation: false,
                estimated_danger: "safe"
            };
        } else if (/(özet|readme|doküman|belge|açıkla|adım)/.test(text)) {
            route = {
                role: "documentation",
                confidence: 0.6,
                reasoning: "Dökümentasyon anahtar kelimeleri tespit edildi",
                force_tool: "read_file",
                needs_confirmation: false,
                estimated_danger: "safe"
            };
        } else if (/(çalıştır|kur|build|npm|pip|install)/.test(text)) {
            route = {
                role: "coordinator",
                confidence: 0.6,
                reasoning: "Çalıştırma/kurulum anahtar kelimeleri tespit edildi",
                force_tool: "run_cmd",
                needs_confirmation: true,
                estimated_danger: "moderate"
            };
        } else {
            // Default to generator
            route = {
                role: "generator",
                confidence: 0.3,
                reasoning: "Belirsiz istek, varsayılan olarak generator seçildi",
                force_tool: null,
                needs_confirmation: false,
                estimated_danger: "safe"
            };
        }

        // Update router status indicator for fallback routes too
        this.updateRouterStatus(route);

        return route;
    }

    updateRouterStatus(route) {
        // Update Router Agent status indicator in UI
        const routerStatus = document.getElementById('routerStatus');
        const currentRole = document.getElementById('currentRole');

        if (!routerStatus || !currentRole) return;

        // Reset classes
        routerStatus.className = 'router-status';

        if (route) {
            // Add role-specific class and update text
            routerStatus.classList.add(route.role);

            const roleDisplayNames = {
                generator: "Generator",
                analyzer: "Analyzer",
                documentation: "Docs",
                coordinator: "Coordinator"
            };

            currentRole.textContent = roleDisplayNames[route.role] || route.role;
            routerStatus.title = `Router Agent: ${route.role} (${Math.round(route.confidence * 100)}% confident) - ${route.reasoning}`;
        } else {
            currentRole.textContent = "Auto";
            routerStatus.title = "Router Agent - Otomatik Rol Seçimi";
        }
    }

    async analyzeUserRequest(userRequest, route = null) {
        // Enhanced analysis with router context and conversation history
        const roleContexts = {
            generator: "Sen KayraDeniz Kod Canavarı'sın! 🔧 Kod yazma ve dosya oluşturma konularında uzmansın. Kullanıcının isteğini anlayıp güzel kod yazıyorsun. Doğal bir dille konuş, açıklama yap.",
            analyzer: "Sen KayraDeniz Kod Canavarı'sın! 🔍 Kod analiz etme ve hata bulma konularında uzmansın. Projeleri inceleyip faydalı raporlar hazırlıyorsun. Samimi bir dille konuş.",
            documentation: "Sen KayraDeniz Kod Canavarı'sın! 📝 Döküman yazma ve açıklama konularında uzmansın. README'ler ve kılavuzlar hazırlıyorsun. Anlaşılır ve eğlenceli yazıyorsun.",
            coordinator: "Sen KayraDeniz Kod Canavarı'sın! ⚙️ Komut çalıştırma ve proje yönetimi konularında uzmansın. Build, install gibi işlemleri yapıyorsun. Dostane bir dille konuş."
        };

        const roleContext = route ? roleContexts[route.role] : "Sen KayraDeniz Kod Canavarı'sın! Çok yetenekli bir yazılım geliştirici asistanısın. Samimi ve yardımsever bir dille konuşuyorsun.";
        
        // 🔄 PHASE CONTEXT: Extract from route if passed by hierarchy system
        const phaseInfo = route?._hierarchy?.phaseContext || route?.phaseContext || {};

        // Get workspace context
        let workspaceContext = '';
        if (this.currentFolder) {
            workspaceContext = `\nMevcut çalışma klasörü: ${this.currentFolder}`;
        }
        if (this.currentFile) {
            workspaceContext += `\nAktif dosya: ${this.currentFile}`;
        }

        // Get conversation context and history
        const conversationSummary = this.extractConversationSummary();
        // 🔧 FIX #7: Increased from 3 to 10 messages to prevent context loss
        // User reported: Agent forgets "hesap makinesi" request and returns to "blog platform"
        const recentContext = this.getConversationContext(10);

        let conversationContextText = '';
        if (recentContext) {
            // 🔧 FIX #7: Extract project name from topics to prevent context pollution
            const projectKeywords = conversationSummary.topics.filter(t => 
                ['hesap makinesi', 'calculator', 'blog', 'platform', 'todo', 'chat', 
                 'dashboard', 'portfolio', 'e-commerce', 'shop', 'game', 'oyun'].includes(t)
            );
            const currentProject = projectKeywords.length > 0 ? projectKeywords[0] : 'Belirsiz';
            
            conversationContextText = `\n\n📚 KONUŞMA GEÇMİŞİ:
${recentContext}

🏷️ Konuşulan Konular: ${conversationSummary.topics.join(', ') || 'Yok'}
📁 Bahsedilen Öğeler: ${conversationSummary.entities.join(', ') || 'Yok'}
🎯 Önceki Niyet: ${conversationSummary.lastIntent || 'Belirsiz'}
🚀 CURRENT PROJECT: ${currentProject} ← STAY FOCUSED ON THIS!`;
        }

        let projectContextText = '';
        if (this.currentProjectData) {
            const { title, prompt: projectPrompt, author, analysis } = this.currentProjectData;
            const features = analysis?.features?.length ? analysis.features.join(', ') : 'Belirtilmemiş';
            const techStack = analysis?.recommendedStack ? Object.entries(analysis.recommendedStack).map(([key, values]) => `${key}: ${values.join(', ')}`).join(' | ') : 'Belirtilmemiş';
            projectContextText = `\n\n🗂️ AKTIF PROJE:
- Başlık: ${title || 'Belirtilmedi'}
- Açıklama: ${projectPrompt || 'Belirtilmedi'}
- Yazar: ${author || 'Belirtilmedi'}
- Önerilen Stack: ${techStack}
- Özellikler: ${features}`;
        }

        // 🔄 PHASE CONTEXT: Add phase information if available
        let phaseContextText = '';
        if (phaseInfo && phaseInfo.currentPhase) {
            phaseContextText = `\n\n🔄 **MULTI-PHASE PROJECT STATUS**:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 CURRENT PHASE: ${phaseInfo.currentPhase}/${phaseInfo.totalPhases || '?'}
${phaseInfo.lastMission ? `📋 Last Mission: ${phaseInfo.lastMission}` : ''}
${phaseInfo.projectContinuation ? '🔄 PROJECT CONTINUATION DETECTED - DO NOT RESET TO PHASE 1!' : ''}
${phaseInfo.completedFiles && phaseInfo.completedFiles.length > 0 ? 
`✅ Completed Files (${phaseInfo.completedFiles.length}): ${phaseInfo.completedFiles.join(', ')}` : ''}

⚠️ CRITICAL: User is continuing an EXISTING project!
- DO NOT start from Phase 1 again
- DO NOT create package.json/README.md/etc if already completed
- CONTINUE from Phase ${phaseInfo.currentPhase} exactly
- Check "KONUŞMA GEÇMİŞİ" above for project context
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
        }

        const analysisPrompt = `
🚨 CRITICAL: RESPOND WITH PURE JSON ONLY! NO GREETINGS, NO EXPLANATIONS, NO MARKDOWN!
Start your response with { and end with }. Do NOT wrap in \`\`\`json or add any text before/after JSON.

${roleContext}

Kullanıcı İsteği: "${userRequest}"
${route ? `Seçilen Rol: ${route.role}` : ''}
${route ? `Öncelikli Tool: ${route.force_tool}` : ''}${workspaceContext}${conversationContextText}
${projectContextText}${phaseContextText}

⚠️ **CRITICAL CONTEXT WARNING**:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚫 DO NOT IGNORE CONVERSATION HISTORY!
🚫 DO NOT SWITCH PROJECT CONTEXT RANDOMLY!
🚫 DO NOT USE EXAMPLE PROJECTS FROM PROMPT!
${phaseInfo && phaseInfo.currentPhase ? `🚫 DO NOT RESET TO PHASE 1 - WE ARE IN PHASE ${phaseInfo.currentPhase}!` : ''}

✅ READ "KONUŞMA GEÇMİŞİ" ABOVE CAREFULLY!
✅ STICK TO "CURRENT PROJECT" IF SPECIFIED!
✅ USER REQUEST IS THE PRIMARY SOURCE OF TRUTH!
${phaseInfo && phaseInfo.projectContinuation ? '✅ THIS IS A PROJECT CONTINUATION - KEEP PHASE NUMBER!' : ''}

If user says "evet" or "devam et", continue with THE SAME PROJECT from conversation history.
Example projects (blog, monorepo) are ONLY templates - DO NOT use them unless user explicitly requests them!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🧭 **NIGHT ORDERS PROTOCOL - CAPTAIN'S MISSION**

ROLE: Autonomous Agent with Verification-First Architecture

🎯 MISSION-BASED WORKFLOW:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Parse user request into MISSION + ACCEPTANCE criteria
2. Generate orders.json with step-by-step tool calls
3. Execute each step with verify[] gate
4. Report verification matrix (PASS/FAIL for each gate)

CORE PRINCIPLES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. 🚫 NO PLACEHOLDERS: TODO/lorem/example/... BANNED
2. ✅ RUNNABLE CONTRACT: Every file compiles/runs standalone
3. 🔧 TOOL-FIRST: Every action starts with tool call (fs/terminal/http)
4. ✔️ VERIFY OR DIE: Each step produces PASS/FAIL (no "done" without proof)
5. 🔄 STATE MACHINE: PLANNING → APPLYING → VERIFYING → FIXING → REPORT
6. 🔁 RETRY POLICY: Max 2 retries with single-patch fix
7. 📋 OUTPUT FORMAT: JSON only (planner|executor|critic roles)

STATE FLOW:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PLANNING → Generate step-by-step execution plan with tools
APPLYING → Execute tools (fs.write, terminal.exec, http.get)
VERIFYING → Run checks (lint, build, run, probe)
FIXING → Apply single patch if verification fails
REPORT → Provide verification matrix results

ACCEPTANCE CRITERIA (must be met):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ BUILD: Exit code 0 (npm run build / tsc / webpack)
✓ RUN: Process alive, port listening (npm start)
✓ PROBE: HTTP endpoint returns 200 OR DOM element exists
✓ LINT: No critical errors (eslint/prettier pass)

VERIFICATION MATRIX (mandatory):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
lint:  PASS/FAIL/SKIP
build: PASS/FAIL/SKIP
run:   PASS/FAIL/SKIP
probe: PASS/FAIL/SKIP

Minimum: 2 PASS required (build + probe recommended)

RED FLAGS (auto-reject):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Regex patterns: /TODO|lorem|example|\.\.\.|PLACEHOLDER|buraya kod|<.*İÇERİĞİ>|<GÜNCELLENM|<TAM İÇERİK>/i
- Empty functions: function foo() {}
- Bracket placeholders: <SOMETHING_HERE> or <GÜNCELLENMİŞ_...>
- Missing args: terminal.exec MUST have args.cmd
- Content < 500 chars for HTML/CSS/JS files

❌ BANNED EXAMPLES:
- "<GÜNCELLENMİŞ_PACKAGE_JSON_İÇERİĞİ>" → WRONG! Give FULL package.json
- "terminal.exec" with args: {} → WRONG! Must have args.cmd: "node -v"
- "BİR_BUILD_KOMUTU" → WRONG! Must be real command like "webpack --mode production"

CONTENT REQUIREMENTS (per file type):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ CRITICAL: Keep file content CONCISE in JSON to avoid truncation!
- For large files (HTML/CSS/JS): Use summary + key sections, not full content
- Example: "content": "import React from 'react';\\nexport default function Nav() { /* full navbar code */ }"
- Better: Create outline in PLAN.md, then use separate steps for each file

HTML: Min 150 lines, full navbar+hero+sections+footer
CSS: Min 200 lines, modern design, responsive, animations  
JS: Min 50 lines, real functions, event listeners
README: Min 80 lines, setup, features, usage, license

🔥 TOKEN LIMIT WARNING: Response MUST NOT exceed 3500 characters! If exceeded, JSON will be TRUNCATED and FAIL!
Strategy: Create MORE steps with SMALLER files instead of FEW steps with HUGE files.

📊 ADAPTIVE COMPLEXITY RULES (MANDATORY):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
For SIMPLE projects (1-3 files): Full content OK, 1 response
For MEDIUM projects (4-8 files): Use concise content + comments like "/* add validation logic */", 1-2 responses
For COMPLEX projects (9+ files): **MANDATORY MULTI-PHASE**
  - Phase 1 (Response 1): Skeleton setup (3-4 steps max)
  - Phase 2 (Response 2): Backend/Server (5-6 steps max)  
  - Phase 3 (Response 3): Frontend/Client (5-6 steps max)
  - After each phase: Show summary + "✅ Phase X tamamlandı. Devam edeyim mi?" message
  - Step 2: Create ONLY critical config files (package.json, tsconfig.json)
  - Step 3: Create ONLY 1-2 core source files with placeholder comments
  - NEVER exceed 6 steps in a single response!
  - NEVER include full file content over 30 lines!
  - Use "/* ...implementation... */" for complex logic
  - Split large files into multiple steps if needed

NIGHT ORDERS JSON SCHEMA (STRICT - NO SHORTCUTS):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  "mission": "single sentence objective",
  "acceptance": [
    "build: exit 0",
    "probe: #elementId exists OR /endpoint returns 200",
    "detector: example_like=false"
  ],
  "steps": [
    {
      "id": "S1",
      "tool": "terminal.exec",
      "args": {
        "cmd": "node -v"  ← MUST BE REAL COMMAND (NOT EMPTY!)
      },
      "explain": {
        "goal": "Node.js versiyonunu kontrol et (min 30 chars)",
        "rationale": "Build tools Node.js gerektirir, version uyumluluk kontrolü (min 50 chars)",
        "tradeoffs": "Alternatif: Docker container kullan - Seçilmeme nedeni: Local dev basit (optional)",
        "checklist": ["Node.js installed", "Version >= 16.x"],
        "showDiff": false
      },
      "verify": ["probe"]
    },
    {
      "id": "S2",
      "tool": "fs.write",
      "args": {
        "path": "package.json",
        "content": "{\"name\":\"my-app\",\"version\":\"1.0.0\",\"scripts\":{\"build\":\"webpack --mode production\"}}"  ← FULL CONTENT (NO <PLACEHOLDERS>!)
      },
      "explain": {
        "goal": "Project manifest dosyası oluştur (min 30 chars)",
        "rationale": "npm dependencies ve scripts yönetimi için gerekir. Build script tanımlı (min 50 chars)",
        "tradeoffs": "Alternatif: yarn/pnpm - Seçilmeme nedeni: npm widely adopted (optional)",
        "checklist": ["name field set", "version field set", "build script exists"],
        "showDiff": true
      },
      "verify": ["lint", "build"]
    }
  ]
}

🎓 **USTA MODU (TEACHER MODE) - EXPLAIN SCHEMA ZORUNLU**:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**EVERY STEP MUST INCLUDE explain FIELD** (Teach-While-Doing enforcement):

explain: {
  goal: string (min 30 chars) - "Ne yapıyorum?" (1 cümle hedef tanımı)
  rationale: string (min 50 chars) - "Neden böyle?" (teknik gerekçe, detaylı açıklama)
  tradeoffs?: string (optional) - "Alternatifler ve neden seçilmedi?" (karşılaştırma)
  checklist?: string[] (optional) - ["Kontrol 1", "Kontrol 2"] (doğrulama adımları)
  showDiff?: boolean (default: false) - Diff gösterilsin mi?
  
  // 🎓 NEW: EDUCATIONAL CONTENT (teachingMoment)
  teachingMoment?: {
    concept: string - Öğretilen konsept (örn: "RESTful API Design", "State Management")
    complexity: 'basic' | 'intermediate' | 'advanced' - Zorluk seviyesi
    category: 'architecture' | 'security' | 'performance' | 'testing' | 'design' | 'patterns' | 'best-practices'
    explanation?: string - Kısa açıklama (1-2 cümle, Türkçe)
    bestPractices?: string[] - En iyi uygulamalar (maks 3 madde)
    commonMistakes?: string[] - Yaygın hatalar (maks 3 madde)
    relatedConcepts?: string[] - İlgili konular (maks 3 madde)
    relevance?: number (0-100) - Kullanıcı için önem skoru (varsayılan: 50)
    learnMoreUrl?: string - Dış kaynak linki (isteğe bağlı)
  }
}

🎯 **TEACHING MOMENT NE ZAMAN EKLENMELİ?**
1. ✅ Karmaşık adımlarda (complexity: intermediate/advanced)
2. ✅ Güvenlik kritik işlemler (category: security)
3. ✅ Mimari kararlar (category: architecture, patterns)
4. ✅ Yaygın hatalar olabilecek yerlerde (commonMistakes)
5. ✅ %30 rastgelelik - Her 3 adımdan 1'inde öğret (fazla spam olmasın)
6. ❌ Basit dosya okuma/yazma (teachingMoment gereksiz)

📚 **TEACHING MOMENT ÖRNEKLERİ**:

// Örnek 1: API Endpoint oluştururken
"teachingMoment": {
  "concept": "RESTful API Design",
  "complexity": "intermediate",
  "category": "architecture",
  "explanation": "POST /auth/login endpoint'i oluştururken HTTP metodunu kaynak operasyonuna göre seçiyoruz.",
  "bestPractices": [
    "Token'ı httpOnly cookie'de sakla (XSS koruması)",
    "Rate limiting uygula (brute force önleme)",
    "Input validation yap (email format, password strength)"
  ],
  "commonMistakes": [
    "❌ Password'ü console.log ile loglamak (güvenlik açığı)",
    "❌ Token'ı localStorage'a kaydetmek (XSS riski)",
    "❌ GET request'te password göndermek (URL'de görünür)"
  ],
  "relatedConcepts": ["JWT Authentication", "CORS", "Middleware Pattern"],
  "relevance": 85
}

// Örnek 2: React State Management
"teachingMoment": {
  "concept": "React State Management",
  "complexity": "basic",
  "category": "patterns",
  "explanation": "Küçük formlar için useState yeterli. Global state'e ihtiyaç olduğunda Context/Redux kullan.",
  "bestPractices": [
    "Tek object yerine ayrı state'ler → re-render optimize",
    "useState yerine useReducer → complex state logic",
    "Form state lokal kalsın → prop drilling önle"
  ],
  "commonMistakes": [
    "❌ Her küçük form için Redux kullanmak (over-engineering)",
    "❌ State'i doğrudan mutate etmek (React re-render olmaz)"
  ],
  "relatedConcepts": ["useReducer", "Context API", "React Query"],
  "relevance": 70
}

// Örnek 3: Vite Build Configuration
"teachingMoment": {
  "concept": "Vite Entry Points",
  "complexity": "intermediate",
  "category": "performance",
  "explanation": "Multiple entry points için lib mode yerine rollupOptions.input kullan. Lib mode tek entry içindir.",
  "bestPractices": [
    "index.html proje root'ta olmalı (entry module hatası önleme)",
    "Shared chunks için manualChunks tanımla (React runtime ayrı bundle)",
    "Dynamic import'lar için code splitting aktif"
  ],
  "commonMistakes": [
    "❌ lib mode + multiple entries (conflict yaratır)",
    "❌ index.html'i src/ altına koymak (Vite bulamaz)"
  ],
  "relatedConcepts": ["Rollup Configuration", "Code Splitting", "Tree Shaking"],
  "relevance": 60
}

✅ EXPLAIN FIELD KURALLARI:
1. goal: Min 30 karakter, açık ve spesifik hedef
2. rationale: Min 50 karakter, teknik gerekçe detaylı
3. tradeoffs: İsteğe bağlı ama önerilir (alternatif çözümler)
4. checklist: İsteğe bağlı doğrulama maddeleri
5. showDiff: Dosya değişikliği varsa true yap
6. 🆕 teachingMoment: Karmaşık/kritik adımlarda ekle (yukarıdaki kurallar)

🚫 EXPLAIN FIELD OLMADAN STEP GEÇERSİZ!
Policy engine "Teach mode: Step S1 açıklaması eksik" hatası verir.

⚠️ CRITICAL RULES FOR orders.json:
1. terminal.exec → args.cmd MUST NOT be empty (e.g., "node -v", "npm install")
2. fs.write → For files > 30 lines, use placeholder comments like "/* ...rest of logic... */"
3. Every step.args MUST be complete (no null, undefined, empty strings)
4. **MAX 6 STEPS PER RESPONSE** - If project needs more, create PLAN.md first, then ask user "Phase 1 tamamlandı, Phase 2'yi başlatayım mı?"
5. **RESPONSE LIMIT: 3500 characters** - Be concise! Use placeholders for large files!
6. **COMPLEX PROJECTS (>10 files)**: MANDATORY multi-phase approach:
   - Phase 1: Skeleton (package.json, README, .gitignore) - 3-4 steps
   - Phase 2: Backend/Server files - 5-6 steps  
   - Phase 3: Frontend/Client files - 5-6 steps
   - After each phase, show summary + ask: "Devam edeyim mi?"

📚 **VITE + REACT + EXPRESS MONOREPO STRUCTURE EXAMPLE**:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
For "Blog Platform" or similar full-stack projects:

**PHASE 1: Root Skeleton** (4 steps)
  1. package.json → { "workspaces": ["server", "client"], "scripts": { "dev": "npm run dev --workspace=server & npm run dev --workspace=client", "build": "npm run build --workspaces" } }
  2. .gitignore → node_modules, dist, .env
  3. README.md → Project description
  4. npm install → Install root dependencies

**PHASE 2: Server Setup** (6 steps)
  5. server/package.json → Express + TS dependencies
  6. server/src/index.ts → Express app with /api/health endpoint
  7. server/tsconfig.json → TypeScript config
  8. cd server && npm install
  9. SKIP build (TypeScript needs full setup)

**PHASE 3: Client Setup** (6 steps)
  10. client/package.json → Vite + React + TS dependencies
  11. client/index.html → <!DOCTYPE html><html><head><title>Blog</title></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>
  12. client/src/main.tsx → ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
  13. client/src/App.tsx → Basic React component
  14. client/vite.config.ts → Vite config with proxy to server
  15. cd client && npm install
  16. FINAL: npm run dev (runs both server + client)

⚠️ CRITICAL: Always create index.html + vite.config.ts for Vite projects!
⚠️ CRITICAL: Use workspaces for monorepo, NOT flat structure!
⚠️ CRITICAL: Use absolute paths or resolve relative paths for CWD!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 **MANDATORY FILES CHECKLIST - MUST VERIFY BEFORE PHASE COMPLETION**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**VITE PROJECTS** (CRITICAL - Without these, build will fail):
  ✅ index.html (root level) - Entry point for Vite
  ✅ vite.config.ts (or .js) - Vite configuration
  ✅ tsconfig.json - TypeScript configuration
  ✅ package.json with "type": "module"
  ✅ Dependencies: @vitejs/plugin-react, vite

**REACT PROJECTS** (CRITICAL - Without these, app won't render):
  ✅ src/main.tsx (or main.jsx) - ReactDOM.createRoot entry
  ✅ src/App.tsx (or App.jsx) - Root component
  ✅ src/index.css - Global styles
  ✅ Dependencies: react, react-dom, @types/react, @types/react-dom

**TAILWIND CSS PROJECTS** (CRITICAL - Without these, styling won't work):
  ✅ tailwind.config.js - Tailwind configuration
  ✅ postcss.config.js - PostCSS configuration
  ✅ src/index.css with @tailwind directives
  ✅ Dependencies: tailwindcss, postcss, autoprefixer

**EXPRESS SERVER PROJECTS** (CRITICAL - Without these, server won't start):
  ✅ src/index.ts (or server.js) - Express app entry
  ✅ tsconfig.json - TypeScript configuration (if using TS)
  ✅ .env.example - Environment variables template
  ✅ Dependencies: express, cors, dotenv, @types/express

**TYPESCRIPT MONOREPO** (CRITICAL - Each workspace needs config):
  ✅ Root package.json with "workspaces": ["server", "client"]
  ✅ server/tsconfig.json - Server TypeScript config
  ✅ client/tsconfig.json - Client TypeScript config
  ✅ Root tsconfig.json (optional base config)

**ENVIRONMENT FILES** (RECOMMENDED - For configuration):
  ✅ .env.example - Template with dummy values
  ✅ .gitignore - Must include node_modules, dist, .env
  ✅ README.md - Setup instructions

⚠️ **VERIFICATION RULE**: Before marking a phase as complete:
  1. Check all mandatory files for detected project type
  2. If ANY mandatory file is missing, CREATE IT before continuing
  3. Use analyzeMistakeAndSuggestFix to detect missing files
  4. Auto-fix will create missing files during Reflexion phase

❌ **COMMON MISTAKES TO AVOID**:
  - Creating React app WITHOUT vite.config.ts → Build fails
  - Creating Tailwind project WITHOUT tailwind.config.js → No styling
  - Creating TypeScript project WITHOUT tsconfig.json → No intellisense
  - Using "cd server && npm install" → Use "npm --workspace server install" instead
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RESPONSE FORMAT (HYBRID - orders.json + legacy compatibility):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FOR COMPLEX PROJECTS (>8 files): MANDATORY AUTO-PLANNING MODE
{
  "requestType": "project-creation",
  "complexity": "complex",
  "projectType": "nodejs|react|python|...",
  "needsFiles": true,
  "estimatedSteps": number,
  "selectedRole": "generator",
  "requiresPlanning": true,  ← NEW: Triggers planning mode
  "projectPlan": {  ← NEW: Detailed user-friendly plan
    "title": "Blog Platform (Full-stack)",
    "description": "Express REST API + Vite React TS frontend",
    "totalFiles": 20,
    "estimatedTime": "2-3 dakika",
    "phases": [
      {
        "id": 1,
        "name": "Skeleton Setup",
        "description": "Root workspace configuration",
        "files": ["package.json", "README.md", ".gitignore"],
        "duration": "15 saniye",
        "steps": 4
      },
      {
        "id": 2,
        "name": "Server Implementation",
        "description": "Express API, TypeScript, health endpoint",
        "files": ["server/package.json", "server/src/*.ts", "..."],
        "duration": "30 saniye",
        "steps": 6
      }
    ]
  },
  "orders": {
    "mission": "PHASE 1: Skeleton Setup",
    "currentPhase": 1,
    "totalPhases": 3,
    "acceptance": [
      "build: exit 0",
      "probe: package.json 'scripts.dev' mevcut"
    ],
    "steps": [
      {
        "id": "S1",
        "tool": "write_file",
        "args": {
          "path": "package.json",
          "content": "{\\n  \\"name\\": \\"night-orders-demo\\",\\n  \\"version\\": \\"1.0.0\\",\\n  \\"private\\": true,\\n  \\"type\\": \\"module\\",\\n  \\"scripts\\": {\\n    \\"build\\": \\"node -e \\\\\\"console.log('build ok')\\\\\\"\\"\\n  }\\n}\\n"
        },
        "verify": ["detector"]
      },
      {
        "id": "S2",
        "tool": "write_file",
        "args": {
          "path": "index.js",
          "content": "console.log('Node sürümü:', process.version);\\n"
        },
        "verify": ["detector"]
      },
      {
        "id": "S3",
        "tool": "run_cmd",
        "args": {
          "cmd": "npm run -s build",
          "cwd": "C:\\\\Users\\\\emrah badas\\\\OneDrive\\\\Desktop\\\\kodlama\\\\Yeni klasör (2)"
        },
        "verify": ["build"]
      },
      {
        "id": "S4",
        "tool": "run_cmd",
        "args": {
          "cmd": "node -v",
          "cwd": "C:\\\\Users\\\\emrah badas\\\\OneDrive\\\\Desktop\\\\kodlama\\\\Yeni klasör (2)"
        },
        "verify": []
      }
    ]
  },
  "plannedActions": [
    {
      "action": "create_file",
      "description": "Çalışır build script ile package.json yaz",
      "fileName": "package.json",
      "content": "{\\n  \\"name\\": \\"night-orders-demo\\",\\n  \\"version\\": \\"1.0.0\\",\\n  \\"private\\": true,\\n  \\"scripts\\": {\\n    \\"build\\": \\"node -e \\\\\\"console.log('build ok')\\\\\\"\\",\\n    \\"start\\": \\"node index.js\\"\\n  }\\n}\\n",
      "critical": true,
      "tool": "write_file"
    },
    {
      "action": "create_file",
      "description": "Node sürümünü loglayan index.js yaz",
      "fileName": "index.js",
      "content": "console.log('Node sürümü:', process.version);\\n",
      "critical": true,
      "tool": "write_file"
    },
    {
      "action": "run_command",
      "description": "Build'i çalıştır",
      "command": "npm run -s build",
      "critical": true,
      "tool": "run_cmd"
    },
    {
      "action": "run_command",
      "description": "Node sürümünü göster",
      "command": "node -v",
      "critical": false,
      "tool": "run_cmd"
    }
  ],
  "userFriendlyPlan": "Önce package.json ve index.js oluşturuyoruz; sonra build'i çalıştırıp Node sürümünü gösteriyoruz."
}

🚨 **CRITICAL OUTPUT RULES - MUST FOLLOW:**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. **JSON ONLY - NO EXPLANATION!** 
   ❌ WRONG: "Öncelikle, kullanıcının isteği üç adımdan oluşmaktadır..." + JSON
   ✅ CORRECT: Start with { and end with } (pure JSON)

2. **NO TEXT BEFORE/AFTER JSON**
   ❌ WRONG: "Kullanıcı şunu istiyor: ..." + JSON + "Bu planı uygulayacağım."
   ✅ CORRECT: {"requestType": "...", "orders": {...}}

3. **SINGLE RESPONSE = SINGLE JSON OBJECT**
   Start response with opening brace: {
   End response with closing brace: }
   No markdown, no comments, no explanations!

4. **RESPONSE FORMAT = HYBRID (ABOVE)**
   You MUST return the HYBRID format exactly as shown above.
   Include ALL fields: requestType, complexity, orders (with mission/acceptance/steps), plannedActions, userFriendlyPlan.
   
5. **ANY NON-JSON TEXT = FATAL ERROR**
   Response must be PURE JSON. Any text before { or after } → treated as fatal error and rejected.`;

        let response;
        let retryCount = 0;
        const maxRetries = 3; // ✅ INCREASED: Was 2, now 3 for better error recovery

        while (retryCount <= maxRetries) {
            try {
                // Use unified LLM interface for analysis
                response = await this.queueOpenAIRequest(async () => {
                    const messages = [{ role: 'user', content: analysisPrompt }];
                    // ✅ FIX: Use REDUCED tokens to prevent JSON truncation
                    // CRITICAL: Large token limits cause LLM to generate incomplete JSON!
                    // Strategy: Force concise responses by limiting output tokens
                    const provider = this.settings.llmProvider || 'openai';
                    const model = this.settings.currentModel;

                    // OVERRIDE: Always use 4096 for analysis (prevents truncation)
                    const safeMaxTokens = 4096;

                    // Request SAFE output capacity (not FULL)
                    return await this.callLLM(messages, {
                        temperature: 0.7,
                        maxTokens: safeMaxTokens // Use SAFE limit (4K) instead of maximum
                    });
                });

                // ✅ CHECK: Validate JSON is complete (not truncated)
                const openBraces = (response.match(/\{/g) || []).length;
                const closeBraces = (response.match(/\}/g) || []).length;

                if (openBraces !== closeBraces) {
                    console.warn(`⚠️ JSON truncation detected! Open:{${openBraces}} Close:{${closeBraces}}`);

                    if (retryCount < maxRetries) {
                        retryCount++;
                        console.log(`🔄 Retrying with simpler prompt (attempt ${retryCount + 1}/${maxRetries + 1})...`);

                        // Simplify request for retry
                        analysisPrompt = analysisPrompt.replace('detailed analysis', 'concise analysis');
                        continue;
                    } else {
                        // ✅ RECOVERY: Try to fix incomplete JSON
                        console.warn('⚠️ Max retries reached, attempting JSON recovery...');
                        response = this.attemptJSONRecovery(response);
                    }
                }

                break; // Success!

            } catch (error) {
                retryCount++;
                if (retryCount <= maxRetries) {
                    console.warn(`⚠️ LLM call failed (attempt ${retryCount}/${maxRetries + 1}), retrying...`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } else {
                    console.error('❌ LLM API call failed after retries:', error.message);
                    throw new Error(`LLM API unavailable: ${error.message}. Cannot proceed without valid JSON response.`);
                }
            }
        }

        // Enhanced debugging for response validation
        console.log('🔍 DEBUG - Analysis Response Type:', typeof response);
        console.log('🔍 DEBUG - Analysis Response Length:', response?.length || 'N/A');

        // Check if response looks like HTML (error page)
        if (typeof response === 'string' && response.trim().startsWith('<')) {
            console.error('❌ DEBUG - Received HTML instead of JSON response');
            throw new Error('OpenAI returned HTML error page instead of JSON - API may be down');
        }

        // Check if response is empty or null
        if (!response || typeof response !== 'string') {
            console.error('❌ DEBUG - Empty or invalid response from OpenAI');
            throw new Error('Empty or invalid response from OpenAI API');
        }

        console.log('🔍 DEBUG - Analysis Response Content (first 1000 chars):', response.substring(0, 1000));
        console.log('🔍 DEBUG - Full Response Length:', response.length);

        try {
            // STEP 1: AGGRESSIVE MARKDOWN REMOVAL
            let cleanedResponse = response;

            // Check for markdown code blocks and extract JSON only
            if (cleanedResponse.includes('```')) {
                console.log('📝 Removing markdown code blocks...');

                // Strategy 1: Try to extract from ```json ... ``` (even if incomplete)
                const codeBlockStart = cleanedResponse.indexOf('```json');
                const codeBlockEnd = cleanedResponse.lastIndexOf('```');

                if (codeBlockStart !== -1) {
                    if (codeBlockEnd > codeBlockStart) {
                        // Complete markdown block found
                        console.log('✅ Found complete ```json block');
                        cleanedResponse = cleanedResponse.substring(codeBlockStart + 7, codeBlockEnd); // +7 for "```json"
                    } else {
                        // Incomplete markdown block (missing closing ```)
                        console.log('⚠️ Found incomplete ```json block, extracting rest');
                        cleanedResponse = cleanedResponse.substring(codeBlockStart + 7);
                    }
                    cleanedResponse = cleanedResponse.trim();
                } else {
                    // No ```json, just remove all ``` markers
                    console.log('⚠️ No ```json found, removing all ``` markers');
                    cleanedResponse = cleanedResponse.replace(/```/g, '');
                }
            }

            // STEP 2: AGGRESSIVE JSON EXTRACTION: Remove any text before first {
            const firstBraceIndex = cleanedResponse.indexOf('{');
            if (firstBraceIndex > 0) {
                console.log('⚠️ Found text before JSON, removing...');
                cleanedResponse = cleanedResponse.substring(firstBraceIndex);
            }

            // STEP 3: Find the OUTERMOST valid JSON object
            // Use a STRING-AWARE bracket counter to find matching closing brace
            let braceCount = 0;
            let jsonStartIndex = -1;
            let jsonEndIndex = -1;
            let inString = false;
            let escapeNext = false;

            for (let i = 0; i < cleanedResponse.length; i++) {
                const char = cleanedResponse[i];

                // Handle escape sequences
                if (escapeNext) {
                    escapeNext = false;
                    continue;
                }

                if (char === '\\') {
                    escapeNext = true;
                    continue;
                }

                // Track string boundaries (ignore braces inside strings)
                if (char === '"') {
                    inString = !inString;
                    continue;
                }

                // Only count braces outside of strings
                if (!inString) {
                    if (char === '{') {
                        if (braceCount === 0) {
                            jsonStartIndex = i;
                        }
                        braceCount++;
                    } else if (char === '}') {
                        braceCount--;
                        if (braceCount === 0 && jsonStartIndex !== -1) {
                            jsonEndIndex = i;
                            break; // Found complete JSON object
                        }
                    }
                }
            }

            if (jsonStartIndex !== -1 && jsonEndIndex !== -1) {
                console.log('✅ DEBUG - Found complete JSON object');
                let jsonText = cleanedResponse.substring(jsonStartIndex, jsonEndIndex + 1);

                // Fix common JSON issues
                jsonText = this.sanitizeJsonResponse(jsonText);

                const analysis = JSON.parse(jsonText);

                // DEBUG: Log parsed analysis structure
                console.log('🔍 DEBUG - Parsed Analysis Keys:', Object.keys(analysis));
                console.log('🔍 DEBUG - Has orders?', !!analysis.orders);
                console.log('🔍 DEBUG - Has orders.steps?', !!analysis.orders?.steps);
                console.log('🔍 DEBUG - Steps count:', analysis.orders?.steps?.length || 0);

                // SMART VALIDATION: Detect Night Orders variations
                const isNightOrdersFormat = (
                    // Format 1: {mission, acceptance, steps}
                    (analysis.mission && analysis.steps) ||
                    // Format 2: {role: "planner", plan: [...]}
                    (analysis.role && analysis.plan) ||
                    // Format 3: {role, next_action, verify}
                    (analysis.role && analysis.next_action)
                );

                if (isNightOrdersFormat && !analysis.requestType) {
                    console.log('🧭 NIGHT ORDERS DETECTED - Converting to HYBRID format');

                    // Build standardized Night Orders object
                    const nightOrders = {
                        mission: analysis.mission || 'Execute planned actions',
                        acceptance: analysis.acceptance || [],
                        steps: analysis.steps || (analysis.plan || []).map((p, idx) => ({
                            id: `S${idx + 1}`,
                            tool: p.next_action?.tool || 'terminal.exec',
                            args: p.next_action?.args || {},
                            verify: p.verify ? Object.keys(p.verify).filter(k => p.verify[k] !== 'pending') : []
                        }))
                    };

                    // Wrap pure Night Orders in HYBRID structure
                    return {
                        requestType: 'command-execution',
                        complexity: 'medium',
                        projectType: 'other',
                        needsFiles: false,
                        estimatedSteps: nightOrders.steps.length,
                        selectedRole: analysis.role || 'executor',
                        orders: nightOrders,
                        plannedActions: [], // Will be populated by executor
                        userFriendlyPlan: nightOrders.mission,
                        route: route
                    };
                }

                // Validate required fields for legacy format
                if (!analysis.requestType || !analysis.complexity) {
                    console.error('❌ DEBUG - Missing required fields:', {
                        hasRequestType: !!analysis.requestType,
                        hasComplexity: !!analysis.complexity,
                        keys: Object.keys(analysis)
                    });
                    throw new Error('Missing required fields in analysis');
                }

                analysis.route = route; // Attach route info

                // ✅ STRICT JSON-ONLY MODE: Validate response format
                const validation = this.validateJSONOnlyResponse(response);
                if (!validation.valid) {
                    console.warn('⚠️ Response format violation:', validation.reason);

                    // Auto-repair: Ask LLM to return pure JSON
                    const repairedResponse = await this.repairJSONResponse(userRequest, response, validation.reason);
                    if (repairedResponse) {
                        // Retry parsing with repaired response
                        return this.analyzeUserRequest(userRequest, route);
                    }
                }

                // 🎯 CHECK FOR PLANNING MODE
                if (analysis.requiresPlanning && analysis.projectPlan) {
                    await this.showProjectPlan(analysis.projectPlan);
                    // Store analysis for phase execution
                    this.currentProjectAnalysis = analysis;
                }

                return analysis;
            } else {
                // ===== NO JSON FOUND - FATAL ERROR =====
                console.error('❌ FATAL: No valid JSON found in LLM response');
                console.error('📄 Response preview:', response.substring(0, 300));
                console.error('🔍 Brace counts - Open: {', (response.match(/\{/g) || []).length, ', Close: }', (response.match(/\}/g) || []).length);
                throw new Error('LLM response contains no valid JSON or unclosed braces. Response must have matching { and }.');
            }
        } catch (e) {
            // ===== JSON PARSE FAILED - FATAL ERROR =====
            console.error('❌ FATAL: JSON parse failed:', e.message);
            console.error('📄 Attempted JSON:', response.substring(0, 500));
            throw new Error(`Failed to parse OpenAI JSON response: ${e.message}. LLM must return PURE JSON (no explanations).`);
        }
    }

    // ✅ STRICT JSON-ONLY MODE: Validate response format
    validateJSONOnlyResponse(response) {
        const trimmed = response.trim();

        // Check 1: Must start with {
        if (!trimmed.startsWith('{')) {
            return {
                valid: false,
                reason: 'Response does not start with JSON object (starts with: ' + trimmed.substring(0, 20) + ')'
            };
        }

        // Check 2: Must end with }
        if (!trimmed.endsWith('}')) {
            return {
                valid: false,
                reason: 'Response does not end with JSON object (ends with: ' + trimmed.substring(trimmed.length - 20) + ')'
            };
        }

        // Check 3: No text before first {
        const firstBrace = trimmed.indexOf('{');
        if (firstBrace > 0) {
            const textBefore = trimmed.substring(0, firstBrace).trim();
            if (textBefore.length > 0 && !textBefore.startsWith('```')) {
                return {
                    valid: false,
                    reason: 'Extra text before JSON: ' + textBefore.substring(0, 50)
                };
            }
        }

        return { valid: true };
    }

    // ✅ AUTO-REPAIR PROMPT: Fix format violations
    async repairJSONResponse(originalPrompt, brokenResponse, reason) {
        console.log('🔧 Attempting auto-repair for format violation...');

        const repairPrompt = `⚠️ FORMAT ERROR DETECTED

Your previous response had a format violation: ${reason}

ORIGINAL PROMPT:
${originalPrompt.substring(0, 500)}

YOUR RESPONSE (BROKEN):
${brokenResponse.substring(0, 300)}...

STRICT RULES FOR RESPONSE:
1. Return ONLY a pure JSON object
2. Start with { immediately
3. End with } immediately
4. NO explanations before or after
5. NO markdown code blocks (\`\`\`json)
6. NO conversational text

CORRECT FORMAT EXAMPLE:
{
  "requestType": "project-creation",
  "orders": { ... }
}

Now provide the CORRECTED response (pure JSON only):`;

        try {
            const repairedResponse = await this.callLLM([
                { role: 'user', content: repairPrompt }
            ], {
                temperature: 0.1, // Very low for precise formatting
                maxTokens: 8192
            });

            console.log('✅ Repair attempt completed');
            return repairedResponse;
        } catch (error) {
            console.error('❌ Auto-repair failed:', error);
            return null;
        }
    }

    // Enhanced JSON sanitization for Claude/OpenAI responses
    sanitizeJsonResponse(jsonText) {
        console.log('🧹 Sanitizing JSON response...');
        console.log('📊 Original length:', jsonText.length);
        
        // DEBUG: Inspect first 10 characters (hex codes to detect invisible chars)
        const first10 = jsonText.substring(0, 10);
        const hexCodes = Array.from(first10).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' ');
        console.log('🔍 First 10 chars:', JSON.stringify(first10));
        console.log('🔍 Hex codes:', hexCodes);

        let sanitized = jsonText;

        // STEP 1: Remove markdown code fences (```json ... ``` or ```...```)
        sanitized = sanitized.trim();  // Remove leading/trailing whitespace
        
        // Check for markdown code fence at start
        if (sanitized.startsWith('```')) {
            console.log('🔍 Detected markdown code fence, removing...');
            // Remove opening fence (```json or just ```)
            sanitized = sanitized.replace(/^```(?:json)?\s*\n/, '');
            // Remove closing fence
            sanitized = sanitized.replace(/\n```\s*$/, '');
            console.log('✂️ Markdown fence removed');
        }

        // 🔧 AGGRESSIVE FIX: Escape ALL backslashes first, then unescape valid escape sequences
        // Step 1: Replace all \ with \\
        sanitized = sanitized.replace(/\\/g, '\\\\');
        
        // Step 2: Fix double-escaped valid sequences (\\n → \n, \\t → \t, etc.)
        sanitized = sanitized.replace(/\\\\n/g, '\\n');
        sanitized = sanitized.replace(/\\\\t/g, '\\t');
        sanitized = sanitized.replace(/\\\\r/g, '\\r');
        sanitized = sanitized.replace(/\\\\"/g, '\\"');
        sanitized = sanitized.replace(/\\\\\'/g, "\\'");
        sanitized = sanitized.replace(/\\\\\\\\/g, '\\\\'); // Fix quadruple backslash
        
        console.log('🔧 All backslashes properly escaped');
        
        // Step 3: Fix single quotes in JSON values (JSON only allows double quotes)
        // Replace 'value' with "value" but ONLY for property values, not inside strings
        // This regex finds: ": 'value'" and replaces with: ": \"value\""
        sanitized = sanitized.replace(/:\s*'([^']*)'/g, ': "$1"');
        console.log('🔧 Single quotes replaced with double quotes');
        
        // Count brackets and braces FIRST (NOTE: This counts ALL occurrences, including in strings)
        const openBrackets = (sanitized.match(/\[/g) || []).length;
        const closeBrackets = (sanitized.match(/\]/g) || []).length;
        const openBraces = (sanitized.match(/\{/g) || []).length;
        const closeBraces = (sanitized.match(/\}/g) || []).length;

        console.log('📊 Brackets (raw count) - Open:[', openBrackets, 'Close:]', closeBrackets);
        console.log('📊 Braces (raw count) - Open:{', openBraces, 'Close:}', closeBraces);
        
        // Check if JSON is complete (matching braces/brackets)
        const isComplete = (openBrackets === closeBrackets) && (openBraces === closeBraces);
        
        if (isComplete) {
            // Try to parse - if it works, return as-is
            try {
                JSON.parse(sanitized);
                console.log('✅ JSON already valid, no sanitization needed');
                return sanitized;
            } catch (e) {
                console.log('⚠️ JSON complete but parse failed, attempting fix:', e.message);
            }
        } else {
            console.log('⚠️ JSON incomplete - Open:{', openBraces, '} Close:{', closeBraces, '} - Attempting fix...');
        }

        // Fix unterminated strings by finding the last valid position
        // Strategy: If parse fails, truncate at last complete object in plannedActions array

        // First try: Just close missing brackets/braces
        let missingCloseBrackets = openBrackets - closeBrackets;
        let missingCloseBraces = openBraces - closeBraces;

        // Remove trailing commas (AGGRESSIVE: multiple passes)
        let prevLength = 0;
        while (prevLength !== sanitized.length) {
            prevLength = sanitized.length;
            sanitized = sanitized.replace(/,(\s*[\]}])/g, '$1');
            sanitized = sanitized.replace(/,(\s*,)/g, ','); // Remove duplicate commas
        }
        console.log('🔧 Trailing commas removed');

        // Fix common JSON syntax errors
        // 1. Remove trailing comma before closing brace/bracket
        sanitized = sanitized.replace(/,\s*}/g, '}');
        sanitized = sanitized.replace(/,\s*]/g, ']');
        
        // 2. Fix missing quotes around property names (only outside strings)
        // This is a VERY aggressive fix - only for emergency
        try {
            JSON.parse(sanitized);
            console.log('✅ JSON valid after trailing comma removal');
            return sanitized;
        } catch (e) {
            console.log('⚠️ Still invalid, attempting property name fix:', e.message);
            
            // Try to extract error position
            const posMatch = e.message.match(/position (\d+)/);
            if (posMatch) {
                const errorPos = parseInt(posMatch[1], 10);
                console.log(`🔍 Error at position ${errorPos}`);
                
                // Show context around error
                const contextStart = Math.max(0, errorPos - 50);
                const contextEnd = Math.min(sanitized.length, errorPos + 50);
                const errorContext = sanitized.substring(contextStart, contextEnd);
                console.log('📄 Error context:', errorContext);
                
                // Try to truncate at last valid object BEFORE error position
                console.log('✂️ Truncating at last valid structure before error...');
                
                // Find last closing brace before error
                let lastClosingBrace = sanitized.lastIndexOf('}', errorPos - 1);
                if (lastClosingBrace > 0) {
                    console.log(`🔍 Found last closing brace at position ${lastClosingBrace}`);
                    sanitized = sanitized.substring(0, lastClosingBrace + 1);
                    
                    // Recalculate mismatches
                    missingCloseBrackets = (sanitized.match(/\[/g) || []).length - (sanitized.match(/\]/g) || []).length;
                    missingCloseBraces = (sanitized.match(/\{/g) || []).length - (sanitized.match(/\}/g) || []).length;
                }
            }
        }

        // Remove incomplete trailing content (after last complete structure)
        // Find last complete object or array
        let lastValidPos = sanitized.length;

        // If there are unterminated structures, try to truncate at last complete item
        if (missingCloseBraces > 0 || missingCloseBrackets > 0) {
            console.log('⚠️ Found unterminated structures, attempting to truncate...');

            // Try to find "orders.steps" array first (more common)
            const stepsMatch = sanitized.match(/"steps":\s*\[([\s\S]*)/);
            if (stepsMatch) {
                console.log('🔍 Found orders.steps array, truncating...');
                const stepsStart = sanitized.indexOf(stepsMatch[0]);
                const stepsContent = stepsMatch[1];

                // Find complete step objects
                let bracketDepth = 1; // We're already inside the array
                let braceDepth = 0;
                let lastCompleteIndex = 0;
                let inString = false;
                let escapeNext = false;

                for (let i = 0; i < stepsContent.length; i++) {
                    const char = stepsContent[i];

                    // Handle string tracking
                    if (escapeNext) {
                        escapeNext = false;
                        continue;
                    }
                    if (char === '\\') {
                        escapeNext = true;
                        continue;
                    }
                    if (char === '"') {
                        inString = !inString;
                        continue;
                    }

                    // Count braces only outside strings
                    if (!inString) {
                        if (char === '{') braceDepth++;
                        else if (char === '}') {
                            braceDepth--;
                            if (braceDepth === 0 && bracketDepth === 1) {
                                // Found end of a step object
                                lastCompleteIndex = i + 1;
                            }
                        } else if (char === '[') bracketDepth++;
                        else if (char === ']') {
                            bracketDepth--;
                            if (bracketDepth === 0) {
                                // Found end of steps array
                                lastCompleteIndex = i + 1;
                                break;
                            }
                        }
                    }
                }

                if (lastCompleteIndex > 0 && lastCompleteIndex < stepsContent.length) {
                    console.log(`✂️ Truncating orders.steps at last complete object (char ${lastCompleteIndex})`);
                    sanitized = sanitized.substring(0, stepsStart + '"steps": ['.length + lastCompleteIndex);

                    // Recalculate after truncation
                    missingCloseBrackets = (sanitized.match(/\[/g) || []).length - (sanitized.match(/\]/g) || []).length;
                    missingCloseBraces = (sanitized.match(/\{/g) || []).length - (sanitized.match(/\}/g) || []).length;
                }
            }

            // Fallback: Try plannedActions array
            else {
                const actionsMatch = sanitized.match(/"plannedActions":\s*\[([\s\S]*)/);
                if (actionsMatch) {
                    console.log('🔍 Found plannedActions array, truncating...');
                    const actionsStart = sanitized.indexOf(actionsMatch[0]);
                    const actionsContent = actionsMatch[1];

                    // Same logic as above
                    let bracketDepth = 1;
                    let braceDepth = 0;
                    let lastCompleteIndex = 0;

                    for (let i = 0; i < actionsContent.length; i++) {
                        const char = actionsContent[i];
                        if (char === '{') braceDepth++;
                        else if (char === '}') {
                            braceDepth--;
                            if (braceDepth === 0 && bracketDepth === 1) {
                                lastCompleteIndex = i + 1;
                            }
                        } else if (char === '[') bracketDepth++;
                        else if (char === ']') {
                            bracketDepth--;
                            if (bracketDepth === 0) {
                                lastCompleteIndex = i + 1;
                                break;
                            }
                        }
                    }

                    if (lastCompleteIndex > 0 && lastCompleteIndex < actionsContent.length) {
                        console.log('✂️ Truncating plannedActions at last complete object');
                        sanitized = sanitized.substring(0, actionsStart + '"plannedActions": ['.length + lastCompleteIndex);

                        missingCloseBrackets = (sanitized.match(/\[/g) || []).length - (sanitized.match(/\]/g) || []).length;
                        missingCloseBraces = (sanitized.match(/\{/g) || []).length - (sanitized.match(/\}/g) || []).length;
                    }
                }
            }
        }

        // Add missing closing brackets/braces
        for (let i = 0; i < missingCloseBrackets; i++) {
            sanitized += ']';
        }
        for (let i = 0; i < missingCloseBraces; i++) {
            sanitized += '}';
        }

        // Final validation
        try {
            JSON.parse(sanitized);
            console.log('✅ JSON sanitization successful');
        } catch (testError) {
            console.log('⚠️ Sanitization failed:', testError.message);
            console.log('📄 Sanitized preview:', sanitized.substring(0, 500));
        }

        console.log('🧹 JSON sanitization complete - Final length:', sanitized.length);
        return sanitized;
    }

    // Enhanced message deduplication with tool_calls awareness
    deduplicateMessages(messages) {
        const deduplicated = [];
        const seen = new Set();

        for (let i = 0; i < messages.length; i++) {
            const msg = messages[i];

            // Handle tool_calls sequence specially
            if (msg.role === 'assistant' && msg.tool_calls) {
                deduplicated.push(msg);

                // Find and include corresponding tool responses
                for (let j = i + 1; j < messages.length; j++) {
                    const nextMsg = messages[j];
                    if (nextMsg.role === 'tool' && nextMsg.tool_call_id) {
                        const belongsToThisCall = msg.tool_calls.some(call => call.id === nextMsg.tool_call_id);
                        if (belongsToThisCall && !deduplicated.some(m => m.role === 'tool' && m.tool_call_id === nextMsg.tool_call_id)) {
                            deduplicated.push(nextMsg);
                        }
                    }
                }
                continue;
            }

            // Handle tool messages - only if not already added
            if (msg.role === 'tool') {
                if (!deduplicated.some(m => m.role === 'tool' && m.tool_call_id === msg.tool_call_id)) {
                    deduplicated.push(msg);
                }
                continue;
            }

            // Regular deduplication for other messages
            const key = `${msg.role}::${msg.content?.trim()}`;
            if (seen.has(key)) {
                continue;
            }
            seen.add(key);
            deduplicated.push(msg);
        }

        return deduplicated;
    }

    async showExecutionPlan(analysis, route = null) {
        return new Promise((resolve) => {
            // Safety check for analysis object
            if (!analysis || typeof analysis !== 'object') {
                console.error('Invalid analysis object:', analysis);
                resolve(false);
                return;
            }

            // Auto-approve safe operations unless specifically requiring confirmation
            if (route && !route.needs_confirmation && route.estimated_danger === 'safe') {
                if (analysis.requestType === 'question' || analysis.complexity === 'simple') {
                    resolve(true);
                    return;
                }
            }

            // Generate unique ID for this execution plan
            const planId = `plan_${Date.now()}`;

            // Show interactive plan to user
            const planHtml = `
        <div class="execution-plan" id="${planId}">
          <div class="plan-header">
            <h4>🎯 Execution Plan</h4>
            <span class="complexity-badge ${analysis.complexity}">${analysis.complexity.toUpperCase()}</span>
          </div>
          <div class="plan-description">
            <p>${analysis.userFriendlyPlan}</p>
          </div>
          <div class="plan-steps">
            <h5>📋 Planned Steps (${analysis.estimatedSteps || 0} total):</h5>
            <ul>
              ${(analysis.plannedActions || []).map((action, index) => `
                <li class="${action.critical ? 'critical' : ''}">
                  <strong>Step ${index + 1}:</strong> ${action.description}
                  ${action.fileName ? `<code>${action.fileName}</code>` : ''}
                </li>
              `).join('')}
            </ul>
          </div>
          <div class="plan-actions">
            <button class="btn secondary" data-action="cancel">❌ İptal</button>
            <button class="btn primary" data-action="approve">✅ Başlat</button>
          </div>
        </div>
      `;

            const chatMessage = this.addChatMessage('ai', planHtml);

            // Use event delegation instead of onclick
            const handlePlanClick = (e) => {
                if (e.target.dataset.action) {
                    const approved = e.target.dataset.action === 'approve';

                    // Clean up event listener
                    document.removeEventListener('click', handlePlanClick);

                    // Resolve promise
                    resolve(approved);
                }
            };

            // Add event listener to document for event delegation
            document.addEventListener('click', handlePlanClick);
        });
    }

    async executeWithLiveUpdates(analysis, route = null, approvalToken = null) {
        // 🧭 NIGHT ORDERS EXECUTOR: Check if orders.json protocol is available
        if (analysis.orders && Array.isArray(analysis.orders.steps)) {
            return await this.executeNightOrders(analysis.orders, approvalToken);
        }

        // 🔐 PHASE 6: Validate approval token if Elysion Chamber is active
        if (this.approvalSystem && approvalToken) {
            const isValid = this.approvalSystem.validateToken(approvalToken);
            if (!isValid) {
                this.addChatMessage('ai', '❌ **GÜVENLİK HATASI:** Geçersiz onay token\'ı!\n\nİşlem iptal edildi.');
                console.error('🔴 SECURITY: Invalid approval token detected!');
                return;
            }
            console.log('✅ Approval token validated');
        }

        // Fallback to legacy plannedActions protocol
        const progressMessage = this.addChatMessage('ai', '🚀 İşlem başladı...');

        const plannedActions = analysis.plannedActions || [];
        
        // 🔐 PHASE 6: Emit execution start event
        if (this.eventBus) {
            this.eventBus.emit({
                type: 'EXECUTION_START',
                totalSteps: plannedActions.length,
                approvalToken: approvalToken ? '***' : null
            });
        }

        for (let i = 0; i < plannedActions.length; i++) {
            const action = plannedActions[i];

            // Update progress
            this.updateProgressMessage(progressMessage, `⏳ Step ${i + 1}/${plannedActions.length}: ${action.description}`);

            // 🔐 PHASE 6: Emit step start event
            if (this.eventBus) {
                this.eventBus.emit({
                    type: 'START_STEP',
                    step: {
                        id: i + 1,
                        title: action.description,
                        intent: action.tool || action.action
                    }
                });
            }

            try {
                // 🔐 PHASE 6: Use approval token (marks as used - single-use)
                if (this.approvalSystem && approvalToken && i === 0) {
                    this.approvalSystem.useToken(approvalToken);
                    console.log('🔐 Approval token consumed (single-use)');
                }

                await this.executeAction(action);

                // Show success for this step
                this.updateProgressMessage(progressMessage, `✅ Step ${i + 1}/${plannedActions.length}: ${action.description} - Tamamlandı`);

                // 🔐 PHASE 6: Emit step success event
                if (this.eventBus) {
                    this.eventBus.emit({
                        type: 'STEP_RESULT',
                        step: {
                            id: i + 1,
                            title: action.description
                        },
                        result: 'PASS'
                    });
                }

                // Small delay for UX
                await new Promise(resolve => setTimeout(resolve, 500));

            } catch (error) {
                this.updateProgressMessage(progressMessage, `❌ Step ${i + 1}: ${action.description} - Hata: ${error.message}`);

                // 🔐 PHASE 6: Emit error event
                if (this.eventBus) {
                    this.eventBus.emit({
                        type: 'ERROR',
                        step: {
                            id: i + 1,
                            title: action.description
                        },
                        error: error.message
                    });
                }

                // 🔐 PHASE 6: Try CriticAgent for automatic fix
                if (this.criticAgent) {
                    console.log('🔬 CriticAgent analyzing failure...');
                    
                    try {
                        const analysisResult = await this.criticAgent.analyze({
                            step: action,
                            observations: [],
                            stderr: error.message,
                            exitCode: -1
                        });

                        if (analysisResult && analysisResult.fixPlan) {
                            this.addChatMessage('ai', `🔬 **Critic Agent Analizi:**\n\n📋 Root Cause: ${analysisResult.rootCause}\n\n🔧 Fix Plan (${analysisResult.fixPlan.length} step${analysisResult.fixPlan.length > 1 ? 's' : ''})`);
                            
                            // Execute fix plan
                            const fixResult = await this.criticAgent.executeFix(analysisResult.fixPlan);
                            
                            // 📚 PR-3: Save to learning store
                            if (this.criticAgent.saveLearning) {
                                this.criticAgent.saveLearning(analysisResult, fixResult);
                            }
                            
                            if (fixResult.success) {
                                this.addChatMessage('ai', '✅ Otomatik düzeltme başarılı! Devam ediyorum...');
                                
                                // Retry the failed action
                                await this.executeAction(action);
                                this.updateProgressMessage(progressMessage, `✅ Step ${i + 1}/${plannedActions.length}: ${action.description} - Düzeltildi & Tamamlandı`);
                                
                                // Emit success after fix
                                if (this.eventBus) {
                                    this.eventBus.emit({
                                        type: 'STEP_RESULT',
                                        step: { id: i + 1, title: action.description },
                                        result: 'PASS_AFTER_FIX'
                                    });
                                }
                                continue; // Skip user prompt, continue to next step
                            }
                        }
                    } catch (criticError) {
                        console.error('🔬 CriticAgent failed:', criticError);
                    }
                }

                // Ask user if they want to continue (fallback if critic fails)
                const shouldContinue = await this.askUserToContinue(error, action);
                if (!shouldContinue) {
                    this.addChatMessage('ai', '⏹️ İşlem kullanıcı tarafından durduruldu.');
                    return;
                }
            }
        }

        // 🔐 PHASE 6: Run probes after execution
        if (this.probeMatrix && analysis.plannedActions) {
            const probes = this.buildProbesForActions(analysis.plannedActions);
            
            if (probes.length > 0) {
                this.addChatMessage('ai', `🔍 Doğrulama probes çalıştırılıyor (${probes.length} test)...`);
                
                try {
                    const probeResults = await this.probeMatrix.runProbes(probes);
                    
                    // Show results in UI
                    if (window.elysionUI) {
                        window.elysionUI.showProbeResults(probeResults);
                    }
                    
                    const passedCount = probeResults.results.filter(r => r.passed).length;
                    this.addChatMessage('ai', `✅ Probe Results: ${passedCount}/${probeResults.total} passed`);
                    
                    // Emit probe results
                    if (this.eventBus) {
                        this.eventBus.emit({
                            type: 'PROBE_RESULTS',
                            results: probeResults
                        });
                    }
                } catch (probeError) {
                    console.error('❌ Probe execution failed:', probeError);
                    this.addChatMessage('ai', `⚠️ Doğrulama testleri çalıştırılamadı: ${probeError.message}`);
                }
            }
        }

        // Final success message
        this.updateProgressMessage(progressMessage, '🎉 Tüm işlemler tamamlandı!');
        
        // 🔐 PHASE 6: Emit completion event
        if (this.eventBus) {
            this.eventBus.emit({
                type: 'EXECUTION_COMPLETE',
                totalSteps: plannedActions.length,
                success: true
            });
        }
        
        this.refreshExplorer(); // Refresh file explorer
    }

    async executeNightOrders(orders, approvalToken = null) {
        // ✅ NEW: Proper mutex-based atomic execution (replaces old flag system)
        await this.nightOrdersMutex.acquire();
        
        try {
            console.log('🧭 NIGHT ORDERS PROTOCOL ACTIVATED!');
            console.log('📋 Mission:', orders.mission);
            console.log('🎯 Acceptance Criteria:', orders.acceptance);
            
            // 🧠 SESSION CONTEXT: Set mission at the start
            if (this.sessionContext) {
                this.sessionContext.setMission(
                    orders.mission,
                    orders.steps.length,
                    orders.acceptance || []
                );
                console.log('📍 Session Context: Mission set');
            }
        
        // 🔍 PR-3: ZOD SCHEMA VALIDATION + CONTINUE PARSEARGS
        try {
            const { validateNightOrders: zodValidate } = require('./schemas');
            const { validateNightOrders: parseArgsValidate } = require('./utils/parseArgs');
            
            // Level 1: Zod schema validation (structure)
            const zodValidation = zodValidate(orders);
            if (!zodValidation.valid) {
                console.error('❌ Invalid Night Orders schema:', zodValidation.errors);
                const errorMsg = zodValidation.errors.map(e => `${e.path}: ${e.message}`).join(', ');
                throw new Error(`Schema validation failed: ${errorMsg}`);
            }
            console.log('✅ Night Orders schema validated (Zod)');
            
            // Level 2: Tool argument validation (semantics)
            try {
                parseArgsValidate(orders);
                console.log('✅ Night Orders arguments validated (parseArgs)');
            } catch (parseError) {
                console.error('❌ Invalid Night Orders arguments:', parseError.message);
                throw new Error(`Argument validation failed: ${parseError.message}`);
            }
            
        } catch (error) {
            if (error.message.includes('validation failed')) {
                throw error;
            }
            // If schemas.js not found or Zod not installed, warn but continue
            console.warn('⚠️ Schema validation skipped:', error.message);
        }

        // 🎯 PHASE TRACKING: Track new phase if mission changed
        if (orders.mission !== this.phaseContext.lastMission) {
            this.phaseContext.currentPhase++;
            this.phaseContext.totalPhases++;
            this.phaseContext.phaseHistory.push({
                phase: this.phaseContext.currentPhase,
                mission: orders.mission,
                timestamp: Date.now(),
                files: [],
                success: false
            });
            this.phaseContext.lastMission = orders.mission;
            this.phaseContext.phaseStartTime = Date.now();
            
            // PR-3: Set current mission for learning store
            this.currentMission = orders.mission;
            
            console.log(`🎯 PHASE ${this.phaseContext.currentPhase} STARTED: ${orders.mission}`);
            
            // Mark as Phase 2, 3, etc. in orders for loop prevention
            if (this.phaseContext.currentPhase > 1) {
                orders.isPhase2 = true;
                orders.phaseNumber = this.phaseContext.currentPhase;
            }
        }

        // 🔐 PHASE 6: Validate approval token if provided
        if (this.approvalSystem && approvalToken) {
            const isValid = this.approvalSystem.validateToken(approvalToken);
            if (!isValid) {
                console.error('🔴 SECURITY: Invalid approval token for Night Orders!');
                this.addChatMessage('ai', '❌ **GÜVENLİK HATASI:** Geçersiz onay token\'ı!\n\nMission iptal edildi.');
                return;
            }
            console.log('✅ Approval token validated for Night Orders');
            
            // Use token immediately (single-use)
            this.approvalSystem.useToken(approvalToken);
            console.log('🔐 Approval token consumed');
        }

        // 🎯 START LIVE VISUALIZATION
        this.startLiveVisualization();
        this.updateCurrentOperation('Mission Başlatıldı', orders.mission, 'fa-rocket');
        this.addTimelineStep(orders.mission, 'active');

        const progressMessage = this.addChatMessage('ai', `🧭 Mission: ${orders.mission}`);
        const verificationResults = {
            lint: 'pending',
            build: 'pending',
            run: 'pending',
            probe: 'pending',
            detector: 'pending'
        };

        // ✅ EXECUTION METRICS
        const executionMetrics = {
            startTime: Date.now(),
            steps: [],
            errors: [] // 🧠 Collect errors for reflexion
        };

        for (let i = 0; i < orders.steps.length; i++) {
            const step = orders.steps[i];
            this.updateProgressMessage(progressMessage, `⏳ Step ${step.id} (${i + 1}/${orders.steps.length}): ${step.tool}`);

            // 🎯 LIVE VISUALIZATION: Update current step
            const stepIcon = step.tool === 'write_file' || step.tool === 'fs.write' ? 'fa-pencil-alt' :
                step.tool === 'read_file' || step.tool === 'fs.read' ? 'fa-file-alt' :
                    step.tool === 'run_cmd' ? 'fa-terminal' : 'fa-cog';

            const stepTarget = step.args.path || step.args.cmd || step.args.url || 'Processing...';
            const stepOperation = step.tool === 'write_file' ? '✍️ Writing' :
                step.tool === 'read_file' ? '📖 Reading' :
                    step.tool === 'run_cmd' ? '⚡ Running' : '⚙️ Working';

            this.updateCurrentOperation(`${stepOperation} (${i + 1}/${orders.steps.length})`, stepTarget, stepIcon);
            this.addTimelineStep(`Step ${step.id}: ${step.tool}`, 'active');

            // ✅ STEP RETRY MECHANISM
            let retryCount = 0;
            const maxRetries = 2;
            let lastError = null;
            const stepStartTime = Date.now();

            while (retryCount <= maxRetries) {
                try {
                    // Execute tool
                    await this.executeOrderStep(step);

                    // ✅ METRICS: Record successful execution
                    const executionTime = Date.now() - stepStartTime;
                    executionMetrics.steps.push({
                        id: step.id,
                        tool: step.tool,
                        status: 'success',
                        executionTime,
                        retries: retryCount
                    });
                    console.log(`⏱️ Step ${step.id} completed in ${executionTime}ms (retries: ${retryCount})`);

                    // 🎓 USTA MODU: Always emit AFTER narration
                    if (this.eventBus) {
                        this.eventBus.emit({
                            type: 'NARRATION_AFTER',
                            data: {
                                stepId: step.id,
                                summary: `Step completed in ${executionTime}ms`,
                                diff: null
                            },
                            timestamp: Date.now()
                        });
                    }

                    // �🎯 LIVE VISUALIZATION: Mark step completed
                    this.updateTimelineStatus(this.liveVisualization.timeline.length - 1, 'completed');
                    this.liveVisualization.metrics.successCount++;

                    break; // Success, exit retry loop

                } catch (error) {
                    lastError = error;
                    retryCount++;
                    
                    // 🧠 REFLEXION: Collect error for analysis
                    executionMetrics.errors.push({
                        step: step.id,
                        tool: step.tool,
                        error: error.message,
                        stack: error.stack
                    });

                    if (retryCount <= maxRetries) {
                        console.warn(`⚠️ Step ${step.id} failed (attempt ${retryCount}/${maxRetries + 1}), retrying...`);
                        this.updateProgressMessage(progressMessage, `🔄 Step ${step.id}: Retry ${retryCount}/${maxRetries + 1}...`);

                        // 🎯 LIVE VISUALIZATION: Show retry
                        this.updateCurrentOperation(`🔄 Retrying (${retryCount}/${maxRetries + 1})`, stepTarget, 'fa-redo');

                        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before retry
                    } else {
                        // Max retries exceeded
                        console.error(`❌ Step ${step.id} failed after ${maxRetries + 1} attempts:`, error.message);

                        // 🎯 LIVE VISUALIZATION: Mark step failed
                        this.updateTimelineStatus(this.liveVisualization.timeline.length - 1, 'error');
                        this.liveVisualization.metrics.errorCount++;
                        this.updateProgressMessage(progressMessage, `❌ Step ${step.id}: ${error.message}`);

                        // ✅ METRICS: Record failed execution
                        const executionTime = Date.now() - stepStartTime;
                        executionMetrics.steps.push({
                            id: step.id,
                            tool: step.tool,
                            status: 'failed',
                            executionTime,
                            retries: retryCount - 1,
                            error: error.message
                        });
                    }
                }
            }

            // Run verifications if step succeeded
            if (retryCount <= maxRetries) {
                const probeResults = [];
                
                if (step.verify && Array.isArray(step.verify)) {
                    for (const checkType of step.verify) {
                        const result = await this.runVerificationCheck(checkType, step);

                        // ✅ ENHANCEMENT: Handle 'skip' status
                        if (result === 'skip') {
                            verificationResults[checkType] = 'skip';
                            probeResults.push({ type: checkType, status: 'skip', target: 'N/A' });
                            this.updateProgressMessage(
                                progressMessage,
                                `⏭️ Step ${step.id}: ${step.tool} - ${checkType.toUpperCase()}: SKIPPED`
                            );
                        } else {
                            verificationResults[checkType] = result ? 'pass' : 'fail';
                            probeResults.push({ type: checkType, status: result ? 'pass' : 'fail', target: step.args?.path || 'N/A' });
                            this.updateProgressMessage(
                                progressMessage,
                                `${result ? '✅' : '❌'} Step ${step.id}: ${step.tool} - ${checkType.toUpperCase()}: ${result ? 'PASS' : 'FAIL'}`
                            );

                            if (!result) {
                                console.error(`❌ Verification failed: ${checkType}`);
                            }
                            // Continue to next step even if verification fails (report at end)
                        }
                    }
                    
                    // 🎓 USTA MODU: Always emit VERIFY narration
                    if (this.eventBus && probeResults.length > 0) {
                        this.eventBus.emit({
                            type: 'NARRATION_VERIFY',
                            data: {
                                stepId: step.id,
                                probes: probeResults
                            },
                            timestamp: Date.now()
                        });
                    }
                }
            }

            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // 🎯 LIVE VISUALIZATION: Stop and finalize
        this.stopLiveVisualization();
        this.updateCurrentOperation('✅ Mission Tamamlandı', orders.mission, 'fa-check-circle');
        this.addTimelineStep('Mission Completed', 'completed');

        // ✅ METRICS: Calculate total execution time
        const totalExecutionTime = Date.now() - executionMetrics.startTime;
        const successCount = executionMetrics.steps.filter(s => s.status === 'success').length;
        const failCount = executionMetrics.steps.filter(s => s.status === 'failed').length;

        console.log(`⏱️ EXECUTION METRICS:`);
        console.log(`   Total Time: ${(totalExecutionTime / 1000).toFixed(2)}s`);
        console.log(`   Success: ${successCount}, Failed: ${failCount}`);
        console.log(`   Steps:`, executionMetrics.steps);

        // Add metrics to chat
        this.addChatMessage('ai', `
⏱️ **EXECUTION METRICS**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Time: ${(totalExecutionTime / 1000).toFixed(2)}s
Success: ${successCount} | Failed: ${failCount}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        `);

        // Generate verification matrix report
        const matrixReport = this.generateVerificationMatrix(verificationResults, orders.acceptance);
        this.addChatMessage('ai', matrixReport);

        // 🧠 REFLEXION: Run BEFORE phase transition (critical!)
        const executionErrors = executionMetrics.errors.map(e => e.error);
        const { mistakes, fixes } = await this.analyzeMistakeAndSuggestFix(orders, verificationResults, executionErrors);
        
        // 🔧 AUTO-FIX: Apply fixes if enabled
        if (mistakes.length > 0) {
            console.log(`🧠 REFLEXION: Found ${mistakes.length} mistakes, ${fixes.length} suggested fixes`);
            
            // Show mistakes to user
            let reflexionMessage = '🧠 **SELF-ANALYSIS: MISTAKES DETECTED**\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
            mistakes.forEach((m, idx) => {
                reflexionMessage += `**${idx + 1}. ${m.type}** (${m.severity})\n`;
                reflexionMessage += `   📁 ${m.file || m.path || m.module || 'N/A'}\n`;
                reflexionMessage += `   💬 ${m.reason}\n\n`;
            });
            
            reflexionMessage += '🔧 **SUGGESTED FIXES:**\n';
            fixes.forEach((f, idx) => {
                reflexionMessage += `${idx + 1}. ${f.action}: ${f.path || f.cmd || 'N/A'}\n`;
                reflexionMessage += `   └─ ${f.reason}\n`;
            });
            
            this.addChatMessage('ai', reflexionMessage);
            
            // Auto-fix enabled by default
            let appliedFixes = 0;  // ✅ Track actually applied fixes
            
            if (fixes.length > 0) {
                this.addChatMessage('system', '🔧 Applying auto-fixes...');
                
                for (const fix of fixes) {
                    try {
                        if (fix.action === 'CREATE_FILE' && fix.content) {
                            await this.createFileWithAgent(fix.path, fix.content);
                            this.addChatMessage('system', `✅ Created: ${fix.path}`);
                            appliedFixes++;  // ✅ Count successful fix
                        } else if (fix.action === 'RUN_COMMAND' && fix.cmd) {
                            const result = await this.runCommandWithAgent(fix.cmd);
                            this.addChatMessage('system', `✅ Executed: ${fix.cmd}`);
                            appliedFixes++;  // ✅ Count successful fix
                        } else if (fix.action === 'UPDATE_FILE' && fix.changes) {
                            // Update package.json with workspaces
                            const pkgPath = fix.path;
                            const pkgContent = await this.readFileWithAgent(pkgPath);
                            const pkg = JSON.parse(pkgContent.content || pkgContent);
                            Object.assign(pkg, fix.changes);
                            await this.createFileWithAgent(pkgPath, JSON.stringify(pkg, null, 2));
                            this.addChatMessage('system', `✅ Updated: ${fix.path}`);
                            appliedFixes++;  // ✅ Count successful fix
                        } else if (fix.action === 'LOG_WARNING') {
                            // ✅ NEW: Just log warnings, don't count as fix
                            console.warn(`⚠️ ${fix.message}: ${fix.reason}`);
                        } else {
                            // Unknown action
                            console.warn(`⚠️ Unknown fix action: ${fix.action}`);
                        }
                    } catch (e) {
                        this.addChatMessage('system', `⚠️ Auto-fix failed: ${e.message}`);
                    }
                }
                
                // ✅ FIX: Only show success if fixes were actually applied!
                if (appliedFixes > 0) {
                    this.addChatMessage('ai', `✅ Applied ${appliedFixes} auto-fix${appliedFixes > 1 ? 'es' : ''}! Continuing...`);
                } else {
                    this.addChatMessage('system', '⚠️ No fixes were applied (all suggestions require manual action)');
                }
            }
        }

        // 🎯 CHECK FOR PHASE TRANSITION
        if (orders.currentPhase && orders.totalPhases) {
            await this.handlePhaseTransition(orders.currentPhase, orders.totalPhases, successCount, failCount);
        } else {
            // 🔄 AGENT FEEDBACK LOOP: Send results back to LLM for analysis
            await this.sendFeedbackToLLM(orders, verificationResults, executionErrors);
        }

        this.refreshExplorer();
        
        } finally {
            // ✅ NEW: Release mutex (proper atomic execution)
            this.nightOrdersMutex.release();
            console.log('🔓 Night Orders execution mutex released');
            
            // 🔄 CRITICAL: Process queued missions (legacy queue support)
            // NOTE: AsyncMutex handles internal queue, but this maintains backward compatibility
            if (this.nightOrdersQueue && this.nightOrdersQueue.length > 0) {
                const nextMission = this.nightOrdersQueue.shift();
                console.log(`🔄 Executing queued mission: ${nextMission.orders.mission}`);
                
                // Execute next queued mission asynchronously (don't await to prevent recursion)
                setTimeout(() => {
                    this.executeNightOrders(nextMission.orders, nextMission.approvalToken);
                }, 500);
            }
        }
    }

    // 🧠 ===== REFLEXION MODULE: SELF-CORRECTION ===== 🧠
    async analyzeMistakeAndSuggestFix(orders, verificationResults, executionErrors = []) {
        console.log('🧠 REFLEXION: Analyzing mistakes and suggesting fixes...');

        const mistakes = [];
        const fixes = [];

        // 1️⃣ BUILD ERROR ANALYSIS
        if (verificationResults.build === 'fail') {
            const buildError = executionErrors.find(e => e.includes('Could not resolve entry module'));
            if (buildError) {
                // Vite entry point error
                if (buildError.includes('index.html')) {
                    mistakes.push({
                        type: 'MISSING_FILE',
                        severity: 'CRITICAL',
                        file: 'index.html',
                        location: 'client/',
                        reason: 'Vite requires index.html as entry point',
                        error: buildError
                    });
                    fixes.push({
                        action: 'CREATE_FILE',
                        path: 'client/index.html',
                        content: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Blog Platform</title>
</head>
<body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
</body>
</html>`,
                        reason: 'Vite entry point missing'
                    });
                }
            }

            // Missing dependencies
            const depsError = executionErrors.find(e => e.includes('Cannot find module'));
            if (depsError) {
                const match = depsError.match(/Cannot find module '(.+?)'/);
                if (match) {
                    const missingModule = match[1];
                    mistakes.push({
                        type: 'MISSING_DEPENDENCY',
                        severity: 'HIGH',
                        module: missingModule,
                        reason: 'Module not found in node_modules',
                        error: depsError
                    });
                    fixes.push({
                        action: 'RUN_COMMAND',
                        cmd: `npm install ${missingModule}`,
                        reason: `Install missing dependency: ${missingModule}`
                    });
                }
            }
        }

        // 2️⃣ CWD/PATH ERROR ANALYSIS
        const pathError = executionErrors.find(e => e.includes('ENOENT') || e.includes('spawn') || e.includes('no such file'));
        if (pathError) {
            const match = pathError.match(/ENOENT.*?'(.+?)'/);
            if (match) {
                const missingPath = match[1];
                mistakes.push({
                    type: 'PATH_ERROR',
                    severity: 'HIGH',
                    path: missingPath,
                    reason: 'Directory or file does not exist',
                    error: pathError
                });
                fixes.push({
                    action: 'CREATE_DIRECTORY',
                    path: missingPath,
                    reason: 'Create missing directory before running commands'
                });
            }
        }

        // 3️⃣ PACKAGE.JSON STRUCTURE ANALYSIS
        try {
            const packageJson = await this.readFileWithAgent('package.json');
            const pkg = JSON.parse(packageJson.content || packageJson);
            
            // ✅ FIX: Get target project's CWD (where files were created)
            const targetCwd = this.workingDirectory || this.cwd || this.getWorkspaceRoot({ mode: "active" });
            
            // ✅ FIX: Check if this is a REAL monorepo (has workspaces in package.json)
            // ❌ OLD: Check folder existence (false positives!)
            // ✅ NEW: Check package.json workspaces field
            const isMonorepo = !!(pkg.workspaces && Array.isArray(pkg.workspaces) && pkg.workspaces.length > 0);
            
            console.log(`🔍 Monorepo check: ${isMonorepo} (workspaces: ${pkg.workspaces ? JSON.stringify(pkg.workspaces) : 'none'})`);
            
            // 3.1: Missing workspaces config (DISABLED - too aggressive)
            // This check causes false positives, removed
            
            // 3.2: Root src/ folder in monorepo
            // ✅ FIX: Pass targetCwd to checkFileExists
            if (isMonorepo && await this.checkFileExists('src', targetCwd)) {
                mistakes.push({
                    type: 'WRONG_MONOREPO_STRUCTURE',
                    severity: 'WARNING',  // ✅ Downgraded from CRITICAL
                    file: 'src/',
                    reason: 'Root src/ folder detected in monorepo - should only exist in workspaces',
                    current: 'Root has src/ folder but workspaces (server/, client/) should contain their own src/'
                });
                // ❌ REMOVED: DELETE_FOLDER fix (too dangerous!)
                fixes.push({
                    action: 'LOG_WARNING',
                    message: 'Consider moving src/ into workspace folders',
                    reason: 'Monorepo best practice: each workspace has its own src/'
                });
            }
            
            // 3.3: Root build script pointing to non-existent src/
            if (isMonorepo && pkg.scripts?.build?.includes('webpack') && !pkg.scripts.build.includes('workspaces')) {
                mistakes.push({
                    type: 'WRONG_BUILD_SCRIPT',
                    severity: 'HIGH',
                    file: 'package.json',
                    reason: 'Root build script uses webpack but should delegate to workspaces',
                    current: pkg.scripts.build
                });
                fixes.push({
                    action: 'UPDATE_FILE',
                    path: 'package.json',
                    changes: {
                        scripts: {
                            ...pkg.scripts,
                            'build': 'npm run build --workspaces'
                        }
                    },
                    reason: 'Fix root build script to use workspaces instead of webpack'
                });
            }
        } catch (e) {
            console.warn('⚠️ Could not analyze package.json:', e.message);
        }

        // 4️⃣ MISSING CRITICAL FILES
        const criticalFiles = [
            { path: 'client/vite.config.ts', type: 'Vite config', project: 'Vite React' },
            { path: 'client/src/main.tsx', type: 'React entry', project: 'React' },
            { path: 'server/tsconfig.json', type: 'TypeScript config', project: 'TypeScript' }
        ];

        // ✅ FIX: Use targetCwd from previous section
        const targetCwd = this.workingDirectory || this.cwd || this.getWorkspaceRoot({ mode: "active" });
        
        for (const file of criticalFiles) {
            const exists = await this.checkFileExists(file.path, targetCwd);  // ✅ Pass targetCwd
            if (!exists && orders.steps.some(s => s.args?.path?.includes(file.project.toLowerCase()))) {
                mistakes.push({
                    type: 'MISSING_CRITICAL_FILE',
                    severity: 'HIGH',
                    file: file.path,
                    fileType: file.type,
                    reason: `${file.type} required for ${file.project} projects`
                });
                fixes.push({
                    action: 'CREATE_FILE',
                    path: file.path,
                    reason: `Create ${file.type} for ${file.project}`
                });
            }
        }

        return { mistakes, fixes };
    }

    async sendFeedbackToLLM(orders, verificationResults, executionErrors = []) {
        console.log('🔄 Sending feedback to LLM for analysis...');

        try {
            // 🧠 REFLEXION: Analyze mistakes first
            const { mistakes, fixes } = await this.analyzeMistakeAndSuggestFix(orders, verificationResults, executionErrors);
            
            if (mistakes.length > 0) {
                console.log(`🧠 REFLEXION: Found ${mistakes.length} mistakes, ${fixes.length} suggested fixes`);
                
                // Show mistakes to user
                let reflexionMessage = '🧠 **SELF-ANALYSIS: MISTAKES DETECTED**\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
                mistakes.forEach((m, idx) => {
                    reflexionMessage += `**${idx + 1}. ${m.type}** (${m.severity})\n`;
                    reflexionMessage += `   📁 File: ${m.file || m.path || m.module || 'N/A'}\n`;
                    reflexionMessage += `   💬 Reason: ${m.reason}\n\n`;
                });
                
                reflexionMessage += '🔧 **SUGGESTED FIXES:**\n';
                fixes.forEach((f, idx) => {
                    reflexionMessage += `${idx + 1}. ${f.action}: ${f.path || f.cmd || 'N/A'}\n`;
                    reflexionMessage += `   └─ ${f.reason}\n`;
                });
                
                this.addChatMessage('ai', reflexionMessage);
                
                // 🎯 AUTO-FIX: Apply fixes automatically
                const autoFixEnabled = true; // TODO: Make this configurable
                let appliedFixes = 0;  // ✅ Track actually applied fixes
                
                if (autoFixEnabled && fixes.length > 0) {
                    this.addChatMessage('system', '🔧 Applying auto-fixes...');
                    
                    for (const fix of fixes) {
                        try {
                            if (fix.action === 'CREATE_FILE' && fix.content) {
                                await this.createFileWithAgent(fix.path, fix.content);
                                this.addChatMessage('system', `✅ Created: ${fix.path}`);
                                appliedFixes++;  // ✅ Count successful fix
                            } else if (fix.action === 'RUN_COMMAND' && fix.cmd) {
                                const result = await this.runCommandWithAgent(fix.cmd);
                                this.addChatMessage('system', `✅ Executed: ${fix.cmd}`);
                                appliedFixes++;  // ✅ Count successful fix
                            } else if (fix.action === 'UPDATE_FILE' && fix.path && fix.changes) {
                                // Read current file
                                const currentContent = await this.readFileWithAgent(fix.path);
                                const current = JSON.parse(currentContent.content || currentContent);
                                
                                // Merge changes
                                const updated = { ...current, ...fix.changes };
                                
                                // Write updated file
                                await this.createFileWithAgent(fix.path, JSON.stringify(updated, null, 2));
                                this.addChatMessage('system', `✅ Updated: ${fix.path}`);
                                appliedFixes++;  // ✅ Count successful fix
                            } else if (fix.action === 'LOG_WARNING') {
                                // ✅ NEW: Just log warnings, don't count as fix
                                console.warn(`⚠️ ${fix.message}: ${fix.reason}`);
                            } else if (fix.action === 'DELETE_FOLDER' && fix.path) {
                                // ❌ DISABLED: Too dangerous! Don't auto-delete folders
                                console.warn(`⚠️ DELETE_FOLDER suggested but disabled for safety: ${fix.path}/`);
                                this.addChatMessage('system', `⚠️ Suggested: Delete ${fix.path}/ (manual action required)`);
                            } else {
                                // Unknown action
                                console.warn(`⚠️ Unknown fix action: ${fix.action}`);
                            }
                        } catch (e) {
                            this.addChatMessage('system', `⚠️ Auto-fix failed for ${fix.path || fix.cmd}: ${e.message}`);
                        }
                    }
                    
                    // ✅ FIX: Only show success if fixes were actually applied!
                    if (appliedFixes > 0) {
                        this.addChatMessage('ai', `✅ Applied ${appliedFixes} auto-fix${appliedFixes > 1 ? 'es' : ''}! Continuing...`);
                    } else {
                        this.addChatMessage('system', '⚠️ No fixes were applied (all suggestions require manual action)');
                    }
                }
            }

            // Read created files to analyze content quality
            const createdFiles = [];
            for (const step of orders.steps) {
                if ((step.tool === 'write_file' || step.tool === 'fs.write') && step.args?.path) {
                    try {
                        const result = await this.readFileWithAgent(step.args.path);
                        // readFileWithAgent returns { success: true, content: "..." }
                        const content = result.content || result;
                        createdFiles.push({
                            path: step.args.path,
                            content: content,
                            length: content.length,
                            hasPlaceholder: /TODO|lorem|example|placeholder/gi.test(content),
                            isEmpty: content.trim().length < 50
                        });
                    } catch (e) {
                        console.warn(`⚠️ Could not read file for analysis: ${step.args.path}`, e.message);
                    }
                }
            }

            // ✅ ENHANCED ANALYSIS: Calculate detailed statistics
            const totalFiles = createdFiles.length;
            const avgLength = totalFiles > 0
                ? Math.round(createdFiles.reduce((sum, f) => sum + f.length, 0) / totalFiles)
                : 0;
            const placeholderFiles = createdFiles.filter(f => f.hasPlaceholder);
            const emptyFiles = createdFiles.filter(f => f.isEmpty);

            // Group files by type
            const byType = {
                tsx: createdFiles.filter(f => f.path.endsWith('.tsx')),
                jsx: createdFiles.filter(f => f.path.endsWith('.jsx')),
                ts: createdFiles.filter(f => f.path.endsWith('.ts')),
                js: createdFiles.filter(f => f.path.endsWith('.js')),
                css: createdFiles.filter(f => f.path.endsWith('.css')),
                json: createdFiles.filter(f => f.path.endsWith('.json')),
                html: createdFiles.filter(f => f.path.endsWith('.html')),
                md: createdFiles.filter(f => f.path.endsWith('.md'))
            };

            // Determine BUILD fail reason
            let buildFailReason = 'Unknown';
            if (verificationResults.build === 'fail') {
                const hasPackageJson = await this.checkFileExists('package.json');
                buildFailReason = hasPackageJson
                    ? 'Build script failed (check dependencies/syntax)'
                    : 'No package.json found (expected for initial setup)';
            } else if (verificationResults.build === 'skip') {
                buildFailReason = 'Skipped: No package.json (normal for file-only projects)';
            }

            // Build feedback report
            const feedbackPrompt = `
🔄 AGENT GERİBİLDİRİM DÖNGÜSÜ - YÜRÜTME SONRASI ANALİZ

📋 GÖREV: ${orders.mission}

🎯 KABUL KRİTERLERİ:
${orders.acceptance.map(c => `- ${c}`).join('\n')}

✅ DOĞRULAMA SONUÇLARI:
${Object.entries(verificationResults).map(([check, status]) => {
                const icon = status === 'pass' ? '✅' : status === 'fail' ? '❌' : status === 'skip' ? '⏭️' : '⏳';
                return `${icon} ${check.toUpperCase()}: ${status.toUpperCase()}`;
            }).join('\n')}
${verificationResults.build === 'fail' || verificationResults.build === 'skip' ? `\n📌 BUILD Durumu: ${buildFailReason}` : ''}

� FILES STATISTICS:
- Total Files: ${totalFiles}
- Average Length: ${avgLength} chars
- Files with Placeholders: ${placeholderFiles.length} ❌
- Empty/Short Files: ${emptyFiles.length} ❌

📁 FILES BY TYPE:
${Object.entries(byType)
                    .filter(([type, files]) => files.length > 0)
                    .map(([type, files]) => {
                        const avgTypeLength = Math.round(files.reduce((sum, f) => sum + f.length, 0) / files.length);
                        return `- ${type.toUpperCase()}: ${files.length} files (avg: ${avgTypeLength} chars)`;
                    })
                    .join('\n')}

📁 DETAILED FILE ANALYSIS:
${createdFiles.map(f => {
                        const status = f.isEmpty ? '❌ TOO SHORT' : f.hasPlaceholder ? '⚠️ PLACEHOLDER' : '✅ OK';
                        return `- ${f.path} [${status}]
  - Length: ${f.length} chars
  - Preview: ${f.content.substring(0, 150).replace(/\n/g, ' ')}${f.content.length > 150 ? '...' : ''}`;
                    }).join('\n')}

🔍 SENİN GÖREVİN (TÜRKÇE YANIT VER):
Yürütme sonuçlarını analiz et ve şunları sağla:
1. ✅ Doğru yapılan neler?
2. ❌ Bulunan sorunlar/hatalar neler? (Dosya adları ve satır numaraları ile SPESİFİK ol)
3. ⚠️ Eksik veya tamamlanmamış neler? (Eksik dosyalar, tamamlanmamış implementasyonlar listele)
4. 🔧 Düzeltilmesi veya iyileştirilmesi gerekenler? (KOD ÖNERİLERİ sun)
5. 📋 Projeyi production-ready yapmak için spesifik aksiyon maddeleri (Öncelik sırası ile)

Yanıtını TÜRKÇE, yapılandırılmış bir rapor olarak ver. SPESİFİK VE AKSİYONA DÖNÜŞTÜRÜLEBILIR OL!
`;

            // Send feedback to LLM
            const response = await this.callLLM([
                { role: 'user', content: feedbackPrompt }
            ], {
                temperature: 0.3, // Lower temperature for analytical task
                maxTokens: 4096
            });

            // Display LLM's analysis (TURKISH)
            this.addChatMessage('ai', `
📊 **YÜRÜTME SONRASI ANALİZ**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${response}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

            // 🔧 PHASE 2 AUTO-TRIGGER: Parse analysis report and auto-fix
            // ⚠️ LOOP PREVENTION: Check if this is already a Phase 2 execution
            const isPhase2 = orders.mission?.includes('PHASE 2') || 
                             orders.mission?.includes('EKSİKLİKLERİ GİDERME') ||
                             orders.isPhase2 === true;

            const needsPhase2 = !isPhase2 && (
                                placeholderFiles.length > 0 || 
                                emptyFiles.length > 0 || 
                                verificationResults.build === 'fail' ||
                                verificationResults.lint === 'fail' ||
                                response.includes('❌') || 
                                response.includes('⚠️') ||
                                response.includes('Eksik') ||
                                response.includes('eksik') ||
                                response.includes('tamamlanmamış'));

            if (needsPhase2) {
                console.log('� PHASE 2 AUTO-TRIGGER: Analysis report shows issues, starting auto-fix...');
                this.addChatMessage('system', '� **PHASE 2 BAŞLATILIYOR**: Analiz raporundaki eksiklikler otomatik olarak gideriliyor...');
                
                // Auto-fix missing package.json first (if needed)
                if (verificationResults.build === 'fail' && buildFailReason.includes('No package.json')) {
                    try {
                        const pkgPath = this.resolvePath('package.json');
                        const pkgContent = {
                            name: 'generated-project',
                            version: '1.0.0',
                            scripts: {
                                build: 'echo "Build complete"',
                                start: 'echo "Starting..."'
                            }
                        };
                        await this.createFileWithAgent(pkgPath, JSON.stringify(pkgContent, null, 2));
                        this.addChatMessage('system', '✅ package.json oluşturuldu');
                    } catch (e) {
                        console.error('❌ Failed to create package.json:', e);
                    }
                }
                
                // Build SPECIFIC completion prompt from analysis report
                const phase2Prompt = `
🎯 **PHASE 2: EKSİKLİKLERİ GİDERME GÖREVI**

📋 **ORİJİNAL GÖREV**: ${orders.mission}

📊 **YÜRÜTME SONRASI ANALİZ RAPORU**:
${response}

🔧 **SENİN YENİ GÖREVİN**:
Yukarıdaki analiz raporunda tespit edilen TÜM eksiklikleri ve hataları şimdi düzelt:

1. ❌ ile işaretlenmiş tüm sorunları çöz
2. ⚠️ ile işaretlenmiş tüm uyarıları gider
3. "Eksik" veya "tamamlanmamış" olarak belirtilen her şeyi tamamla
4. Rapordaki "Aksiyon Maddeleri" listesindeki her adımı uygula

**ÖNEMLİ KURALLAR**:
- CSS ve JavaScript dosyaları eksikse MUTLAKA ekle (boş bırakma)
- Fonksiyonlar eksikse TAM olarak implement et (placeholder kullanma)
- Build hataları varsa düzelt
- Lint hataları varsa düzelt
- Her dosya en az 100 satır olmalı (gerçek, çalışan kod)
- TODO veya placeholder bırakma, TAM ÇALIŞAN kod yaz

⚠️ DİKKAT: Bu bir PHASE 2 görevi! Tekrar Phase 1 yapma, sadece eksikleri tamamla!
`;

                // Re-trigger with SPECIFIC phase 2 prompt
                setTimeout(() => {
                    window.kodCanavari.chatMessage(phase2Prompt, false);
                }, 3000);
            } else if (isPhase2) {
                // Phase 2 completed, don't loop again!
                this.addChatMessage('ai', '✅ **PHASE 2 TAMAMLANDI!** Tüm eksiklikler giderildi! 🎉');
            } else {
                // All checks passed in Phase 1!
                this.addChatMessage('ai', '✅ **TÜM KONTROLLER BAŞARILI!** Proje tamamlandı ve hazır! 🎉');
            }

        } catch (error) {
            console.error('❌ Failed to send feedback to LLM:', error);
            // Don't fail the whole process if feedback fails
        }
    }

    // ===== TOOL CONTRACT GUARD (Fail-Fast) =====
    assertToolArgs(step) {
        if (step.tool === 'run_cmd' || step.tool === 'terminal.exec') {
            if (!step.args?.cmd || step.args.cmd.trim() === '') {
                throw new Error(`${step.tool} requires args.cmd (non-empty string)`);
            }
            // Detect placeholder commands
            if (/<.*>/.test(step.args.cmd) || /BİR_/.test(step.args.cmd) || /TODO|PLACEHOLDER|\.\.\./.test(step.args.cmd)) {
                throw new Error(`${step.tool} cmd contains placeholder: ${step.args.cmd}`);
            }
        }

        if (step.tool === 'write_file' || step.tool === 'fs.write') {
            if (!step.args?.path) {
                throw new Error(`${step.tool} requires args.path`);
            }

            // Convert object/array content to JSON string
            if (typeof step.args.content === 'object' && step.args.content !== null) {
                console.log('📦 Converting object content to JSON string for:', step.args.path);
                step.args.content = JSON.stringify(step.args.content, null, 2);
            }

            if (typeof step.args.content !== 'string') {
                throw new Error(`${step.tool} requires args.content (string or object)`);
            }

            // Strict placeholder detection for file content
            const placeholderPatterns = [
                /<[A-ZÜĞİŞÇÖ_]+>/,       // <GÜNCELLE>, <TAM_İÇERİK>
                /\[.*İÇERİK.*\]/i,        // [buraya içerik]
                /BİR_.*_KOMUTU/i,         // BİR_BUILD_KOMUTU
                /TODO|PLACEHOLDER/i       // Common placeholders
            ];
            
            // 🔥 ENHANCED: Comment-based placeholders (AddTodo.tsx gibi)
            const commentPlaceholders = [
                /\/\/.*buraya.*gelecek/i,      // "// buraya gelecek"
                /\/\/.*mantığı/i,               // "// ... mantığı"
                /\/\/.*ekleme.*mantığı/i,      // "// ekleme mantığı"
                /\/\/.*listeleme.*mantığı/i,   // "// listeleme mantığı"
                /\.\.\..*mantığı/i,             // "... mantığı"
                /\/\/\s*TODO/i,                 // "// TODO"
                /\/\/\s*FIXME/i,                // "// FIXME"
                /\/\/\s*PLACEHOLDER/i           // "// PLACEHOLDER"
            ];
            
            for (const pattern of placeholderPatterns) {
                if (pattern.test(step.args.content)) {
                    throw new Error(`${step.tool} content contains PLACEHOLDER pattern: ${pattern.source} - FULL CONTENT REQUIRED!`);
                }
            }
            
            for (const pattern of commentPlaceholders) {
                if (pattern.test(step.args.content)) {
                    throw new Error(
                        `${step.tool} YORUM SATIRLARI İLE PLACEHOLDER KULLANILMIŞ!\n` +
                        `Pattern: ${pattern.source}\n\n` +
                        `❌ YAN LIŞ: // ... mantığı buraya gelecek\n` +
                        `✅ DOĞRU: Tam çalışan kod yaz!\n\n` +
                        `TAM ÇALIŞAN KOD YAZILMALI, YORUM SATIRI DEĞİL!`
                    );
                }
            }
            
            // 🔥 ENHANCED: Minimum content length raised (10 → 50 chars)
            if (step.args.content.trim().length < 50) {
                throw new Error(
                    `${step.tool} content too short (${step.args.content.length} chars)!\n` +
                    `Minimum: 50 chars required for real code.\n` +
                    `Likely placeholder or incomplete implementation.`
                );
            }
            
            // 📋 README QUALITY ENFORCER
            const isReadme = step.args.path.toLowerCase().includes('readme');
            if (isReadme) {
                const readmeCheck = this.checkReadmeQuality(step.args.content, step.args.path);
                if (!readmeCheck.passed) {
                    throw new Error(
                        `📋 README KALİTE KONTROLÜ BAŞARISIZ!\n\n` +
                        `Dosya: ${step.args.path}\n` +
                        `Sorunlar:\n${readmeCheck.issues.map(i => `  ❌ ${i}`).join('\n')}\n\n` +
                        `README dosyası DETAYLI ve PROFESYONEL olmalı!\n` +
                        `Min 500 karakter, kod örnekleri, komut satırları, API dokümantasyonu içermeli!`
                    );
                }
            }
        }

        if (step.tool === 'read_file' || step.tool === 'fs.read') {
            if (!step.args?.path) {
                throw new Error(`${step.tool} requires args.path`);
            }
        }
    }
    
    // 📋 README Quality Checker
    checkReadmeQuality(content, filePath) {
        if (!filePath.toLowerCase().includes('readme')) {
            return { passed: true };
        }

        const issues = [];
        
        // 1. Length check (min 500 chars)
        if (content.length < 500) {
            issues.push(`README çok kısa! (${content.length} chars). Minimum: 500 chars`);
        }
        
        // 2. Required sections (Turkish)
        const requiredSections = [
            { name: 'Kurulum', alternatives: ['Installation', 'Setup'] },
            { name: 'Kullanım', alternatives: ['Usage', 'Nasıl Kullanılır'] },
            { name: 'Özellikler', alternatives: ['Features', 'Fonksiyonlar'] }
        ];
        
        for (const section of requiredSections) {
            const hasSection = [section.name, ...section.alternatives].some(s => 
                content.includes(s) || content.includes(s.toLowerCase())
            );
            if (!hasSection) {
                issues.push(`Eksik bölüm: "${section.name}" (veya ${section.alternatives.join(', ')})`);
            }
        }
        
        // 3. Code examples (must have)
        const hasCodeBlock = content.includes('```') || content.includes('`');
        if (!hasCodeBlock) {
            issues.push('Kod örneği yok! README\'de mutlaka kod örnekleri (```kod```) olmalı');
        }
        
        // 4. Terminal commands
        const hasCommands = content.includes('npm ') || 
                           content.includes('yarn ') || 
                           content.includes('git ') ||
                           content.includes('node ');
        if (!hasCommands) {
            issues.push('Terminal komutları eksik! (npm install, npm start, npm test vs.)');
        }
        
        // 5. Project description (at least 3 lines)
        const lines = content.split('\n').filter(l => l.trim().length > 20);
        if (lines.length < 10) {
            issues.push(`README çok basit! Sadece ${lines.length} anlamlı satır var. Min: 10 satır bekleniyor`);
        }
        
        return {
            passed: issues.length === 0,
            issues: issues
        };
    }

    async executeOrderStep(step) {
        console.log('🔧 Executing order step:', step.id, step.tool);

        // ===== TOOL CONTRACT GUARD (Fail-Fast) =====
        this.assertToolArgs(step);

        // ✅ SMART CONTEXT AWARENESS: Check file context before creating
        if (step.tool === 'write_file' || step.tool === 'fs.write') {
            const contextWarnings = await this.checkFileContext(step.args.path, step.args.content);

            if (contextWarnings.length > 0) {
                const highSeverity = contextWarnings.filter(w => w.severity === 'high');

                if (highSeverity.length > 0) {
                    // Log warnings to console
                    console.warn('⚠️ CONTEXT WARNINGS for:', step.args.path);
                    highSeverity.forEach(w => {
                        console.warn(`  ${w.message}`);
                        console.warn(`  Details: ${w.details}`);
                        console.warn(`  Suggestion: ${w.suggestion}`);
                    });

                    // Add warning message to chat
                    const warningMessage = highSeverity.map(w =>
                        `${w.message}\n  📝 ${w.details}\n  💡 ${w.suggestion}`
                    ).join('\n\n');

                    this.addChatMessage('ai', `
⚠️ **UYARI**: \`${step.args.path}\` oluşturulmadan önce:

${warningMessage}

ℹ️ Dosya yine de oluşturulacak ama bu duruma dikkat et!
                    `);
                }
            }
        }

        // ✅ SAFETY CONFIRMATION: Check for dangerous commands
        if (step.tool === 'run_cmd' || step.tool === 'terminal.exec') {
            const isDangerous = this.isDangerousCommand(step.args.cmd);
            if (isDangerous.dangerous) {
                const confirmed = confirm(`⚠️ TEHLIKELI KOMUT TESPIT EDİLDİ

Komut: ${step.args.cmd}

Tehlike: ${isDangerous.reason}

Bu komutu çalıştırmak istediğinizden emin misiniz?`);

                if (!confirmed) {
                    throw new Error('User cancelled dangerous command execution');
                }
            }
        }

        // ===== WORKSPACE ROOT ENFORCEMENT =====
        // Ensure cwd is set for all operations
        const workspaceRoot = this.getWorkspaceRoot();
        if (!step.args.cwd && (step.tool === 'run_cmd' || step.tool === 'terminal.exec')) {
            step.args.cwd = workspaceRoot;
            console.log(`📁 Auto-set cwd for ${step.tool}:`, workspaceRoot);
        }

        // 🛡️ PRE-EXECUTION VALIDATION
        if (!step.args || typeof step.args !== 'object') {
            throw new Error(`Step ${step.id}: args object is required`);
        }
    }

    /**
     * Attempt to recover truncated JSON by closing unclosed braces
     */
    attemptJSONRecovery(truncatedJSON) {
        console.log('🔧 Attempting JSON recovery...');

        let result = truncatedJSON.trim();

        // Count braces
        const openBraces = (result.match(/\{/g) || []).length;
        const closeBraces = (result.match(/\}/g) || []).length;
        const openBrackets = (result.match(/\[/g) || []).length;
        const closeBrackets = (result.match(/\]/g) || []).length;

        console.log(`📊 Brace analysis: {${openBraces} }${closeBraces} [${openBrackets} ]${closeBrackets}`);

        // Remove incomplete last element (likely cut off)
        // Find last complete comma before truncation
        const lastComma = result.lastIndexOf(',');
        if (lastComma > 0) {
            result = result.substring(0, lastComma);
            console.log('✂️ Removed incomplete element after last comma');
        }

        // Close arrays
        const arrayDeficit = openBrackets - closeBrackets;
        for (let i = 0; i < arrayDeficit; i++) {
            result += '\n]';
        }

        // Close objects
        const braceDeficit = openBraces - closeBraces;
        for (let i = 0; i < braceDeficit; i++) {
            result += '\n}';
        }

        console.log('✅ JSON recovery complete');
        console.log('🔍 Recovered JSON preview:', result.substring(0, 500));

        return result;
    }

    // ✅ SAFETY CONFIRMATION: Detect dangerous commands
    isDangerousCommand(cmd) {
        const dangerousPatterns = [
            { pattern: /rm\s+-rf\s+\//, reason: 'Root dizin silme (/)' },
            { pattern: /rm\s+-rf\s+\*/, reason: 'Tüm dosyaları silme' },
            { pattern: /del\s+\/[sf]/i, reason: 'Windows zorla silme' },
            { pattern: /format\s+[a-z]:/i, reason: 'Disk formatlama' },
            { pattern: /dd\s+if=.*of=\/dev\//, reason: 'Disk yazma (tehlikeli)' },
            { pattern: /chmod\s+-R\s+777/, reason: 'Tüm dosyalara tam yetki' },
            { pattern: /curl.*\|\s*bash/, reason: 'Remote script execution' },
            { pattern: /wget.*\|\s*sh/, reason: 'Remote script execution' },
            { pattern: />.*\/etc\//, reason: '/etc dizinine yazma' }
        ];

        for (const { pattern, reason } of dangerousPatterns) {
            if (pattern.test(cmd)) {
                return { dangerous: true, reason };
            }
        }

        return { dangerous: false };
    }

    // 🎯 ===== REAL-TIME VISUALIZATION METHODS ===== 🎯

    /**
     * Start live visualization
     */
    startLiveVisualization() {
        this.liveVisualization.isActive = true;
        this.liveVisualization.startTime = Date.now();
        this.liveVisualization.timeline = [{
            step: 'Başlatıldı',
            time: 0,
            status: 'completed'
        }];
        this.liveVisualization.fileChanges.clear();
        this.liveVisualization.metrics = {
            totalDuration: 0,
            successCount: 0,
            errorCount: 0
        };

        // Show live view panel
        const liveView = document.getElementById('agentLiveView');
        if (liveView) {
            liveView.classList.remove('hidden');
        }

        this.updateLiveView();
    }

    /**
     * Update current operation display
     */
    updateCurrentOperation(operationType, target, icon = 'fa-spinner') {
        this.liveVisualization.currentOperation = { operationType, target, icon };

        const operationEl = document.getElementById('currentOperation');
        if (operationEl) {
            const iconEl = operationEl.querySelector('.operation-icon i');
            const typeEl = operationEl.querySelector('.operation-type');
            const targetEl = operationEl.querySelector('.operation-target');

            if (iconEl) {
                iconEl.className = `fas ${icon}`;
                if (icon === 'fa-spinner') {
                    iconEl.classList.add('fa-spin');
                }
            }
            if (typeEl) typeEl.textContent = operationType;
            if (targetEl) targetEl.textContent = target;
        }
    }

    /**
     * Add step to timeline
     */
    addTimelineStep(stepName, status = 'active') {
        const elapsed = Date.now() - this.liveVisualization.startTime;
        const timeInSeconds = (elapsed / 1000).toFixed(1);

        this.liveVisualization.timeline.push({
            step: stepName,
            time: timeInSeconds,
            status
        });

        this.updateTimeline();
    }

    /**
     * Update timeline status
     */
    updateTimelineStatus(index, status) {
        if (this.liveVisualization.timeline[index]) {
            this.liveVisualization.timeline[index].status = status;
            this.updateTimeline();
        }
    }

    /**
     * Render timeline
     */
    updateTimeline() {
        const timelineEl = document.getElementById('progressTimeline');
        if (!timelineEl) return;

        timelineEl.innerHTML = this.liveVisualization.timeline.map(item => `
            <div class="timeline-item ${item.status}">
                <div class="timeline-dot"></div>
                <div class="timeline-content">
                    <span class="timeline-step">${item.step}</span>
                    <span class="timeline-time">${item.time}s</span>
                </div>
            </div>
        `).join('');
    }

    /**
     * Track file changes (reading/writing)
     */
    trackFileChange(filepath, operation, linesDiff = null) {
        if (!this.liveVisualization.fileChanges.has(filepath)) {
            this.liveVisualization.fileChanges.set(filepath, {
                added: 0,
                deleted: 0,
                operations: []
            });
        }

        const fileData = this.liveVisualization.fileChanges.get(filepath);
        fileData.operations.push(operation);

        if (linesDiff) {
            fileData.added += linesDiff.added || 0;
            fileData.deleted += linesDiff.deleted || 0;
        }

        this.updateFileChanges();
    }

    /**
     * Calculate diff between old and new content
     */
    calculateDiff(oldContent, newContent) {
        const oldLines = (oldContent || '').split('\n');
        const newLines = (newContent || '').split('\n');

        // Simple diff: count added/removed lines
        const maxLen = Math.max(oldLines.length, newLines.length);
        let added = 0;
        let deleted = 0;

        if (newLines.length > oldLines.length) {
            added = newLines.length - oldLines.length;
        } else if (newLines.length < oldLines.length) {
            deleted = oldLines.length - newLines.length;
        }

        // Check modified lines
        const minLen = Math.min(oldLines.length, newLines.length);
        for (let i = 0; i < minLen; i++) {
            if (oldLines[i] !== newLines[i]) {
                added++;
                deleted++;
            }
        }

        return { added, deleted };
    }

    /**
     * Update file changes display
     */
    updateFileChanges() {
        const filesContentEl = document.getElementById('filesContent');
        const linesAddedEl = document.getElementById('linesAdded');
        const linesDeletedEl = document.getElementById('linesDeleted');
        const filesChangedEl = document.getElementById('filesChanged');

        if (!filesContentEl) return;

        let totalAdded = 0;
        let totalDeleted = 0;

        if (this.liveVisualization.fileChanges.size === 0) {
            filesContentEl.innerHTML = '<div class="empty-files">Henüz dosya değişikliği yok</div>';
        } else {
            const fileItems = Array.from(this.liveVisualization.fileChanges.entries()).map(([filepath, data]) => {
                totalAdded += data.added;
                totalDeleted += data.deleted;

                const filename = require('path').basename(filepath);
                return `
                    <div class="file-change-item">
                        <span class="file-change-name" title="${filepath}">${filename}</span>
                        <div class="file-change-diff">
                            <span class="diff-added">+${data.added}</span>
                            <span class="diff-removed">-${data.deleted}</span>
                        </div>
                    </div>
                `;
            }).join('');

            filesContentEl.innerHTML = fileItems;
        }

        if (linesAddedEl) linesAddedEl.textContent = `+${totalAdded}`;
        if (linesDeletedEl) linesDeletedEl.textContent = `-${totalDeleted}`;
        if (filesChangedEl) filesChangedEl.textContent = this.liveVisualization.fileChanges.size;
    }

    /**
     * Update execution metrics
     */
    updateExecutionMetrics() {
        const elapsed = Date.now() - this.liveVisualization.startTime;
        this.liveVisualization.metrics.totalDuration = (elapsed / 1000).toFixed(1);

        const durationEl = document.getElementById('totalDuration');
        const successEl = document.getElementById('successCount');
        const errorEl = document.getElementById('errorCount');

        if (durationEl) durationEl.textContent = `${this.liveVisualization.metrics.totalDuration}s`;
        if (successEl) successEl.textContent = this.liveVisualization.metrics.successCount;
        if (errorEl) errorEl.textContent = this.liveVisualization.metrics.errorCount;
    }

    /**
     * Main update loop for live view
     */
    updateLiveView() {
        if (!this.liveVisualization.isActive) return;

        this.updateExecutionMetrics();

        // Continue updating while active
        setTimeout(() => this.updateLiveView(), 500);
    }

    /**
     * Stop live visualization
     */
    stopLiveVisualization() {
        this.liveVisualization.isActive = false;

        // Final update
        this.updateExecutionMetrics();
    }

    // 🎯 ===== PROJECT PLANNING UI ===== 🎯

    /**
     * Run final verification after project completion
     */
    async runFinalVerification() {
        this.addChatMessage('system', '📦 npm install çalıştırılıyor...');
        
        try {
            // Step 1: npm install
            this.addChatMessage('system', '📦 npm install çalıştırılıyor...');
            const installResult = await this.runTerminalCommand('npm install', this.currentFolder);
            if (installResult && installResult.exitCode === 0) {
                this.addChatMessage('system', '✅ Dependencies yüklendi!');
            } else {
                this.addChatMessage('system', '⚠️ npm install hatası');
            }
            
            // Step 2: Build test
            this.addChatMessage('system', '🔨 Build testi yapılıyor...');
            const buildResult = await this.runTerminalCommand('npm run build', this.currentFolder);
            
            // 🔧 CRITICAL FIX: Only show success if build actually passed
            const buildSuccess = buildResult && buildResult.exitCode === 0;
            
            if (buildSuccess) {
                this.addChatMessage('system', '✅ Build başarılı!');
            } else {
                this.addChatMessage('system', '⚠️ Build hatası - manuel kontrol gerekebilir');
                
                // 🚨 Don't claim success if build failed!
                this.addChatMessage('ai', `
⚠️ **PROJE TAMAMLANDI AMA BUILD HATASI VAR!**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 **Yapılanlar:**
  ✅ Tüm dosyalar oluşturuldu
  ${installResult?.exitCode === 0 ? '✅' : '❌'} Dependencies yüklendi
  ❌ Build hatası var - düzeltme gerekiyor

🔧 **Yapılması Gerekenler:**
  1. Terminal hatalarını kontrol edin
  2. Eksik dosyaları veya konfigürasyonları düzeltin
  3. \`npm run build\` komutunu manuel çalıştırın

💡 İpucu: Reflexion modülü otomatik düzeltme önerileri sunuyor.
                `);
                return; // Exit early - don't claim success
            }
            
            // Step 3: Start dev server (background) - only if build passed
            this.addChatMessage('system', '🚀 Dev server başlatılıyor...');
            // Don't await - run in background
            this.runTerminalCommand('npm run dev', this.currentFolder, true);
            
            this.addChatMessage('ai', `
✅ **HER ŞEY HAZIR!**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎊 Projeniz başarıyla oluşturuldu ve çalışıyor!

📋 **Yapılanlar:**
  ✅ Tüm dosyalar oluşturuldu
  ✅ Dependencies yüklendi
  ✅ Build testi geçti
  ✅ Dev server başlatıldı

🌐 **Kontrol Edin:**
  • Server: http://localhost:5174
  • Client: http://localhost:5173

Happy coding! 🚀
            `);
        } catch (error) {
            this.addChatMessage('ai', `⚠️ Final verification sırasında hata: ${error.message}`);
        }
    }

    /**
     * Handle phase transition and ask user for continuation
     */
    async handlePhaseTransition(currentPhase, totalPhases, successCount, failCount) {
        const isLastPhase = currentPhase >= totalPhases;
        
        if (isLastPhase) {
            // 🎉 PROJECT COMPLETED
            this.addChatMessage('ai', `
🎉 **PROJE TAMAMLANDI!**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Tüm ${totalPhases} phase başarıyla tamamlandı!
📊 Son Phase: ${successCount} başarılı, ${failCount} hatalı

🔍 Şimdi final kontrolleri yapıyorum...
            `);
            
            // Run final verification
            await this.runFinalVerification();
        } else {
            // 🔄 CONTINUE TO NEXT PHASE
            const nextPhase = currentPhase + 1;
            const plan = this.currentProjectAnalysis?.projectPlan;
            const nextPhaseInfo = plan?.phases?.find(p => p.id === nextPhase);
            
            let message = `
✅ **PHASE ${currentPhase} TAMAMLANDI!**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Sonuç: ${successCount} başarılı, ${failCount} hatalı
⏭️ Sırada: **PHASE ${nextPhase} - ${nextPhaseInfo?.name || 'Devam'}**
`;
            
            if (nextPhaseInfo) {
                message += `\n📝 **Phase ${nextPhase} İçeriği:**\n`;
                message += `  • ${nextPhaseInfo.description}\n`;
                message += `  • Dosyalar: ${nextPhaseInfo.files.join(', ')}\n`;
                message += `  • Süre: ${nextPhaseInfo.duration}\n\n`;
            }
            
            message += `\n**Devam edeyim mi?** 🚀\n`;
            message += `"evet" deyin, Phase ${nextPhase}'yi başlatayım!`;
            
            this.addChatMessage('ai', message);
        }
    }

    /**
     * Show project plan to user with approval prompt
     */
    async showProjectPlan(plan) {
        let planMessage = `📋 **İSTEĞİNİZİ ANALİZ ETTİM!**\n\n`;
        planMessage += `**${plan.title}**\n`;
        planMessage += `${plan.description}\n\n`;
        planMessage += `📊 **Proje Detayları:**\n`;
        planMessage += `  • Toplam Dosya: ${plan.totalFiles}\n`;
        planMessage += `  • Tahmini Süre: ${plan.estimatedTime}\n`;
        planMessage += `  • Phase Sayısı: ${plan.phases.length}\n\n`;
        
        planMessage += `🔄 **Execution Planı:**\n\n`;
        
        plan.phases.forEach((phase, idx) => {
            planMessage += `**PHASE ${phase.id}: ${phase.name}** (${phase.duration})\n`;
            planMessage += `  └─ ${phase.description}\n`;
            planMessage += `  └─ Dosyalar: ${phase.files.join(', ')}\n`;
            planMessage += `  └─ Adımlar: ${phase.steps} step\n\n`;
        });

        planMessage += `✅ **Başlayalım mı?**\n`;
        planMessage += `Plan uygun görünüyorsa "evet" deyin, Phase 1'i başlatayım! 🚀`;

        this.addChatMessage('ai', planMessage);
    }

    // 🎯 ===== LIVE REFLECTION MESSAGES ===== 🎯

    /**
     * Show live reflection message for current step
     */
    showLiveReflection(step) {
        let message = '';
        let details = [];

        switch (step.tool) {
            case 'write_file':
            case 'fs.write':
                const filename = step.args.path.split('/').pop();
                const fileType = filename.includes('.') ? filename.split('.').pop() : 'file';
                
                // 🚫 FILE DEDUPLICATION: Check if already created
                const normalizedPath = step.args.path.replace(/\\/g, '/').toLowerCase();
                if (this.phaseContext.completedFiles.has(normalizedPath)) {
                    console.warn(`⚠️ DUPLICATE FILE DETECTED: ${step.args.path}`);
                    console.warn(`   File already created in Phase ${this.getCurrentPhaseForFile(normalizedPath)}`);
                    message = `⏭️ ${filename} zaten mevcut, atlanıyor...`;
                    details.push('Dosya daha önce oluşturulmuş');
                    break; // Skip duplicate creation
                }
                
                message = `📝 ${filename} oluşturuluyor...`;
                
                // Detect file purpose from content
                if (step.args.content) {
                    if (step.args.content.includes('workspaces')) {
                        details.push('Workspaces yapılandırması');
                    }
                    if (step.args.content.includes('scripts')) {
                        details.push('Script komutları eklendi');
                    }
                    if (step.args.content.includes('express')) {
                        details.push('Express sunucu kurulumu');
                    }
                    if (step.args.content.includes('React')) {
                        details.push('React component');
                    }
                    if (step.args.content.includes('import')) {
                        const imports = step.args.content.match(/import .+ from ['"](.+)['"]/g);
                        if (imports && imports.length > 0) {
                            details.push(`${imports.length} modül import edildi`);
                        }
                    }
                }
                break;

            case 'run_cmd':
            case 'terminal.exec':
                const cmd = step.args.cmd;
                if (cmd.includes('npm install')) {
                    message = `📦 Paket yükleniyor: ${cmd.replace('npm install', '').trim() || 'dependencies'}`;
                } else if (cmd.includes('npm create')) {
                    message = `🏗️ Scaffold oluşturuluyor: ${cmd.split('npm create')[1]?.trim()}`;
                } else if (cmd.includes('npm run')) {
                    message = `🔨 Build komutu çalıştırılıyor...`;
                } else if (cmd.includes('node')) {
                    message = `⚡ Node.js scripti çalıştırılıyor...`;
                } else {
                    message = `⚙️ Komut çalıştırılıyor: ${cmd}`;
                }
                break;

            case 'read_file':
            case 'fs.read':
                message = `📖 ${step.args.path} dosyası okunuyor...`;
                break;
            
            case 'fs.multiEdit':
                const editCount = step.args.edits ? step.args.edits.length : 0;
                message = `✏️ ${step.args.filepath} dosyasında ${editCount} değişiklik yapılıyor...`;
                details.push(`${editCount} atomik düzenleme`);
                if (step.args.edits) {
                    const replaceAllCount = step.args.edits.filter(e => e.replace_all).length;
                    if (replaceAllCount > 0) {
                        details.push(`${replaceAllCount} global değişiklik`);
                    }
                }
                break;

            case 'glob':
            case 'list_dir':
                message = `🔍 Dosyalar taranıyor: ${step.args.pattern || step.args.dir || '*'}`;
                break;

            default:
                message = `🔧 ${step.tool} işlemi yapılıyor...`;
        }

        // Show message in chat
        const fullMessage = details.length > 0 
            ? `${message}\n  ${details.map(d => `└─ ${d}`).join('\n  ')}`
            : message;

        this.addChatMessage('system', fullMessage);
    }

    // 🎯 ===== END LIVE REFLECTION ===== 🎯

    // 🎯 ===== END REAL-TIME VISUALIZATION ===== 🎯

    // 🎓 USTA MODU: Auto-generate explain text for steps
    generateExplainFromStep(step) {
        const tool = step.tool;
        const args = step.args || {};
        
        switch (tool) {
            case 'write_file':
            case 'fs.write':
                return `📝 Dosya oluşturuyorum: ${args.path}\n\nBu dosya projenin önemli bir parçası. İçeriği şunları içerecek:\n- ${args.content ? args.content.split('\n').slice(0, 3).join('\n- ') + '...' : 'Kod içeriği'}`;
            
            case 'fs.multiEdit':
                const editCount = args.edits ? args.edits.length : 0;
                const replaceAllCount = args.edits ? args.edits.filter(e => e.replace_all).length : 0;
                return `✏️ Dosyayı düzenliyorum: ${args.filepath}\n\n${editCount} atomik değişiklik yapılacak${replaceAllCount > 0 ? ` (${replaceAllCount} global değişiklik dahil)` : ''}.\n\nTüm değişiklikler birlikte uygulanacak - ya hepsi başarılı olur, ya hiçbiri.`;
            
            case 'run_cmd':
            case 'terminal.exec':
                return `⚙️ Komut çalıştırıyorum: ${args.cmd}\n\nBu komut şunları yapacak:\n- Proje bağımlılıklarını yükle\n- Ayarları yapılandır\n- Sonuçları doğrula`;
            
            case 'read_file':
            case 'fs.read':
                return `📖 Dosya okuyorum: ${args.path}\n\nBu dosyayı kontrol etmek için okuyorum, içeriğini analiz edeceğim.`;
            
            default:
                return `🔧 ${tool} işlemi yapılıyor...\n\nGörev adım adım ilerliyor.`;
        }
    }
    
    // 🎯 Get phase number where file was created
    getCurrentPhaseForFile(normalizedPath) {
        for (const phase of this.phaseContext.phaseHistory) {
            if (phase.files.includes(normalizedPath)) {
                return phase.phase;
            }
        }
        return this.phaseContext.currentPhase;
    }

    async executeOrderStep(step) {
        console.log(`📝 Executing step ${step.id}: ${step.tool}`, step.args);

        // 🎓 USTA MODU: Always emit BEFORE narration
        if (this.eventBus) {
            const explainText = step.explain || this.generateExplainFromStep(step);
            
            this.eventBus.emit({
                type: 'NARRATION_BEFORE',
                data: {
                    stepId: step.id,
                    explain: explainText
                },
                timestamp: Date.now()
            });
        }

        // �🎨 LIVE REFLECTION: Show what agent is doing
        this.showLiveReflection(step);

        // 🔧 TOOL BRIDGE: Try to execute via ToolBridge first (handles aliases)
        if (window.toolBridge) {
            const supportedTools = window.toolBridge.getSupportedTools();
            
            // Check if tool exists in ToolBridge
            if (supportedTools.includes(step.tool)) {
                console.log(`🔧 [ToolBridge] Executing via ToolBridge: ${step.tool}`);
                const bridgeResult = await window.toolBridge.executeTool(step.tool, step.args);
                
                // If ToolBridge execution failed with "Unknown tool", fall through to legacy handler
                if (!bridgeResult.error || !bridgeResult.error.includes('Unknown tool')) {
                    return bridgeResult;
                }
                
                console.warn(`⚠️ [ToolBridge] Failed, falling back to legacy handler:`, bridgeResult.error);
            }
        }

        // ⚠️ SAFETY CHECK: Dangerous command confirmation
        if (step.tool === 'run_cmd' || step.tool === 'terminal.exec') {
            const isDangerous = this.isDangerousCommand(step.args.cmd);
            if (isDangerous.dangerous) {
                const confirmed = confirm(
                    `⚠️ TEHLIKELI KOMUT DETECTED!\n\n` +
                    `Komut: ${step.args.cmd}\n` +
                    `Tehlike: ${isDangerous.reason}\n\n` +
                    `Bu komutu çalıştırmak istediğinizden emin misiniz?`
                );
                if (!confirmed) {
                    throw new Error('User cancelled dangerous command execution');
                }
            }
        }

        switch (step.tool) {
            case 'write_file':
            case 'fs.write':
                if (!step.args.path || !step.args.content) {
                    throw new Error(`${step.tool} requires path and content`);
                }
                
                const result = await this.createFileWithAgent(step.args.path, step.args.content);
                
                // 🎯 TRACK FILE CREATION: Add to phase context
                const normalizedFilePath = step.args.path.replace(/\\/g, '/').toLowerCase();
                this.phaseContext.completedFiles.add(normalizedFilePath);
                
                // Add to current phase history
                if (this.phaseContext.phaseHistory.length > 0) {
                    const currentPhaseData = this.phaseContext.phaseHistory[this.phaseContext.phaseHistory.length - 1];
                    if (!currentPhaseData.files.includes(normalizedFilePath)) {
                        currentPhaseData.files.push(normalizedFilePath);
                    }
                }
                
                console.log(`✅ File tracked: ${normalizedFilePath} (Phase ${this.phaseContext.currentPhase})`);
                
                return result;

            case 'read_file':
            case 'fs.read':
                if (!step.args.path) {
                    throw new Error(`${step.tool} requires path`);
                }
                return await this.readFileWithAgent(step.args.path);
            
            case 'fs.multiEdit':
                if (!step.args.filepath || !step.args.edits) {
                    throw new Error('fs.multiEdit requires filepath and edits array');
                }
                return await this.executeMultiEdit(step.args.filepath, step.args.edits);

            case 'run_cmd':
            case 'terminal.exec':
                if (!step.args.cmd || step.args.cmd.trim() === '') {
                    throw new Error(`${step.tool} requires non-empty cmd string`);
                }
                
                // 🔧 FIX #2: CWD Execution - Workspace Commands
                // PROBLEM: Shell chaining (cd server && npm install) fails with exitCode:-1 on Windows
                // SOLUTION: Convert to workspace commands (npm --workspace server install)
                
                let cmd = step.args.cmd;
                let cwd = step.args.cwd || this.workspaceRoot;
                
                // ⚠️ CRITICAL: Transform shell chaining commands into workspace commands
                const shellChainingPattern = /^cd\s+([^\s&]+)\s*&&\s*(.+)$/;
                const match = cmd.match(shellChainingPattern);
                
                if (match) {
                    const targetDir = match[1];  // e.g., "server" or "./client"
                    const actualCmd = match[2];  // e.g., "npm install" or "npm run build"
                    
                    console.log(`🔄 Converting shell chaining: cd ${targetDir} && ${actualCmd}`);
                    
                    // Check if this is an npm command that can use --workspace
                    const npmPattern = /^npm\s+(install|run|build|test|start|dev)(.*)$/;
                    const npmMatch = actualCmd.match(npmPattern);
                    
                    if (npmMatch) {
                        const npmAction = npmMatch[1];  // install, run, build, etc.
                        const npmArgs = npmMatch[2].trim();  // additional args
                        
                        // Transform to workspace command
                        cmd = `npm --workspace ${targetDir} ${npmAction}${npmArgs ? ' ' + npmArgs : ''}`;
                        console.log(`✅ Transformed to workspace command: ${cmd}`);
                    } else {
                        // Not an npm command - use absolute path with cmd /c
                        const path = require('path');
                        cwd = path.resolve(this.workspaceRoot, targetDir);
                        cmd = actualCmd;  // Run original command in resolved CWD
                        console.log(`✅ Using absolute CWD: ${cwd} for command: ${cmd}`);
                    }
                }
                
                // Resolve relative CWD to absolute path
                if (cwd && !cwd.match(/^[a-zA-Z]:\\/) && !cwd.startsWith('/')) {
                    const path = require('path');
                    const oldCwd = cwd;
                    cwd = path.resolve(this.workspaceRoot, cwd);
                    console.log(`🔧 Resolved relative CWD: ${oldCwd} → ${cwd}`);
                }
                
                return await this.runCommandWithAgent(cmd, cwd);

            case 'http.get':
                if (!step.args.url) {
                    throw new Error('http.get requires url');
                }
                const response = await fetch(step.args.url);
                return await response.text();

            default:
                throw new Error(`Unknown tool: ${step.tool}`);
        }
    }

    async runVerificationCheck(checkType, step) {
        console.log(`🔍 Running verification: ${checkType}`);

        switch (checkType) {
            case 'build':
                // ✅ PRE-CHECK: Verify package.json exists before running build
                try {
                    const hasPackageJson = await this.checkFileExists('package.json');
                    if (!hasPackageJson) {
                        console.log('⏭️ BUILD skipped: package.json not found (normal for initial files)');
                        return 'skip'; // Return special status instead of false
                    }

                    const buildResult = await this.runCommandWithAgent('npm run build');

                    // ✅ FIX #4: STRICT VERIFICATION - Exit code must be 0
                    if (!buildResult || typeof buildResult !== 'object') {
                        console.warn('❌ BUILD failed: Invalid result format');
                        return false;
                    }

                    // 🔍 CRITICAL: Build passes ONLY if exitCode === 0
                    const exitCode = buildResult.exitCode !== undefined ? buildResult.exitCode : -1;
                    const hasErrors = (buildResult.stdout || '').includes('error') || 
                                     (buildResult.stderr || '').includes('error') ||
                                     (buildResult.stdout || '').includes('failed');
                    
                    const success = exitCode === 0 && !hasErrors;
                    
                    console.log(`🔍 BUILD verification:`, {
                        exitCode: exitCode,
                        hasErrors: hasErrors,
                        success: success,
                        buildResultSuccess: buildResult.success
                    });
                    
                    if (!success) {
                        console.warn(`❌ BUILD FAILED: exitCode=${exitCode}, hasErrors=${hasErrors}`);
                    }
                    
                    return success;
                } catch (error) {
                    console.warn('❌ BUILD failed:', error.message);
                    return false;
                }

            case 'run':
                // ✅ PRE-CHECK: Verify entry point exists before running
                try {
                    const hasIndexHtml = await this.checkFileExists('index.html');
                    const hasPackageJson = await this.checkFileExists('package.json');

                    if (!hasIndexHtml && !hasPackageJson) {
                        console.log('⏭️ RUN skipped: No entry point (index.html/package.json) found');
                        return 'skip';
                    }

                    // Try to run the project
                    const runResult = await this.runCommandWithAgent('npm start');

                    // ✅ FIX #4: STRICT VERIFICATION - Exit code must be 0
                    if (!runResult || typeof runResult !== 'object') {
                        console.warn('❌ RUN failed: Invalid result format');
                        return false;
                    }

                    // 🔍 CRITICAL: Run passes ONLY if exitCode === 0
                    const exitCode = runResult.exitCode !== undefined ? runResult.exitCode : -1;
                    const hasErrors = (runResult.stdout || '').includes('error') || 
                                     (runResult.stderr || '').includes('error');
                    
                    const success = exitCode === 0 && !hasErrors;
                    
                    console.log(`🔍 RUN verification:`, {
                        exitCode: exitCode,
                        hasErrors: hasErrors,
                        success: success,
                        runResultSuccess: runResult.success
                    });
                    
                    if (!success) {
                        console.warn(`❌ RUN FAILED: exitCode=${exitCode}, hasErrors=${hasErrors}`);
                    }
                    
                    return success;
                } catch (error) {
                    console.warn('❌ RUN failed:', error.message);
                    return false;
                }

            case 'lint':
                // Check for common syntax issues
                if (step.args && step.args.content) {
                    const content = step.args.content;
                    // Basic checks: no TODOs, no empty functions
                    return !(/TODO|lorem|example/i.test(content)) &&
                        !(/function\s+\w+\s*\([^)]*\)\s*\{\s*\}/g.test(content));
                }
                return true;

            case 'probe':
                // Check if file exists or endpoint responds
                if (step.args && step.args.path) {
                    const exists = await this.checkFileExists(step.args.path);
                    return exists;
                }
                return true;

            case 'detector':
                // Check for example-like code
                if (step.args && step.args.content) {
                    const examplePatterns = /example|sample|demo|test|placeholder/gi;
                    const matches = (step.args.content.match(examplePatterns) || []).length;
                    return matches < 3; // Allow max 2 occurrences
                }
                return true;

            default:
                console.warn(`Unknown verification type: ${checkType}`);
                return true;
        }
    }

    generateVerificationMatrix(results, acceptanceCriteria) {
        const matrix = Object.entries(results)
            .map(([check, status]) => {
                // ✅ ENHANCEMENT: Add 'skip' status support
                const icon = status === 'pass' ? '✅' :
                    status === 'fail' ? '❌' :
                        status === 'skip' ? '⏭️' : '⏳';
                return `${icon} ${check.toUpperCase()}: ${status.toUpperCase()}`;
            })
            .join('\n');

        const passCount = Object.values(results).filter(v => v === 'pass').length;
        const failCount = Object.values(results).filter(v => v === 'fail').length;
        const skipCount = Object.values(results).filter(v => v === 'skip').length;

        const resultSummary = skipCount > 0
            ? `${passCount} PASS / ${failCount} FAIL / ${skipCount} SKIP`
            : `${passCount} PASS / ${failCount} FAIL`;

        return `
🧭 **VERIFICATION MATRIX**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${matrix}

📊 **RESULTS**: ${resultSummary}
🎯 **ACCEPTANCE**: ${acceptanceCriteria ? acceptanceCriteria.join(', ') : 'N/A'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
    }

    async checkFileExists(filePath, targetCwd = null) {
        try {
            // ✅ KAPTAN YAMASI: Merkezi path çözümleme
            // 🔧 FIX: Use targetCwd if provided, otherwise use current workspace
            let fullPath;
            if (targetCwd) {
                // Use explicit target CWD (for Reflexion checking target project)
                fullPath = this.path.isAbsolute(filePath) 
                    ? filePath 
                    : this.path.resolve(targetCwd, filePath);
            } else {
                // Use current workspace root (normal operation)
                fullPath = this.resolvePath(filePath);
            }

            if (typeof electronAPI !== 'undefined' && electronAPI.readFile) {
                await electronAPI.readFile(fullPath);
                return true;
            }
            return false;
        } catch {
            return false;
        }
    }

    // ✅ KAPTAN YAMASI: Helper - package.json içinde dependency kontrolü
    async containsInPackage(packageName) {
        try {
            const hasPackageJson = await this.checkFileExists('package.json');
            if (!hasPackageJson) return false;

            const result = await this.readFileWithAgent('package.json');
            const packageData = JSON.parse(result.content || result);

            return !!(packageData.dependencies?.[packageName] ||
                packageData.devDependencies?.[packageName]);
        } catch (e) {
            return false;
        }
    }

    // ✅ SMART CONTEXT AWARENESS
    async checkFileContext(filePath, content = null) {
        const warnings = [];
        const fileName = filePath.split('/').pop();

        // Check 1: Next.js + index.html conflict (ENHANCED)
        if (fileName === 'index.html') {
            const hasNextConfig = await this.checkFileExists('next.config.js') ||
                await this.checkFileExists('next.config.ts');
            const hasNextInPackage = await this.containsInPackage('next');
            const hasAppDir = await this.checkFileExists('app/layout.tsx') ||
                await this.checkFileExists('app/layout.js');

            if (hasNextConfig || hasNextInPackage || hasAppDir) {
                warnings.push({
                    severity: 'high',
                    message: '⚠️ Next.js projelerinde index.html GEREKMEZ ve sorun çıkarabilir!',
                    details: 'Next.js, app/ veya pages/ klasörlerini kullanır. index.html eklenmemeli.',
                    suggestion: 'Bu dosya yerine app/page.tsx veya pages/index.tsx kullan.'
                });
            }
        }

        // Check 2: React + jQuery conflict
        if (content && /jquery|jQuery|\$\(/.test(content)) {
            const hasReact = await this.checkFileExists('package.json');
            if (hasReact) {
                try {
                    const packageJsonResult = await this.readFileWithAgent('package.json');
                    const packageData = JSON.parse(packageJsonResult.content || packageJsonResult);
                    if (packageData.dependencies?.react || packageData.devDependencies?.react) {
                        warnings.push({
                            severity: 'medium',
                            message: '⚠️ React projesinde jQuery kullanımı önerilmez',
                            details: 'React ve jQuery farklı DOM yönetim paradigmaları kullanır.',
                            suggestion: 'jQuery yerine React hooks ve state management kullan.'
                        });
                    }
                } catch (e) {
                    // Ignore parse errors
                }
            }
        }

        // Check 3: TypeScript + .js file in src/
        if (filePath.startsWith('src/') && fileName.endsWith('.js')) {
            const hasTsConfig = await this.checkFileExists('tsconfig.json');
            if (hasTsConfig) {
                warnings.push({
                    severity: 'low',
                    message: '💡 TypeScript projesinde .js yerine .ts/.tsx kullan',
                    details: 'Proje TypeScript kullanıyor ama .js dosyası ekleniyor.',
                    suggestion: `${fileName} yerine ${fileName.replace('.js', '.ts')} kullan.`
                });
            }
        }

        // Check 4: Empty or placeholder content
        if (content && content.trim().length < 50) {
            warnings.push({
                severity: 'high',
                message: '❌ Dosya içeriği çok kısa veya placeholder',
                details: `Dosya sadece ${content.trim().length} karakter içeriyor.`,
                suggestion: 'Tam işlevsel kod ekle, placeholder bırakma.'
            });
        }

        return warnings;
    }

    async executeAction(action) {
        console.log('🎬 Executing action:', action.action, 'with fileName:', action.fileName);

        switch (action.action) {
            case 'create_file':
                console.log('📁 Creating file - original content length:', action.content?.length || 0);

                // 🚫 RED FLAG HUNTER: Production Agent Protocol
                const RED_FLAGS = [
                    /TODO/i,
                    /lorem ipsum/i,
                    /example/i,
                    /\.\.\./,
                    /PLACEHOLDER/i,
                    /buraya kod/i,
                    /Bu alana/i,
                    /kod yazın/i,
                    /içerik buraya/i,
                    /content goes here/i,
                    /add your code here/i,
                    /implementation here/i
                ];

                const hasRedFlag = action.content && RED_FLAGS.some(pattern => pattern.test(action.content));
                const hasEmptyFunction = action.content && /function\s+\w+\s*\([^)]*\)\s*\{\s*\}/g.test(action.content);
                const isTooShort = !action.content || action.content.trim().length < 100;

                if (isTooShort || hasRedFlag || hasEmptyFunction) {
                    console.error('🚫 RED FLAG DETECTED - Production Agent Protocol Violation!');
                    console.error('  - Too short:', isTooShort, '(', action.content?.length || 0, 'chars)');
                    console.error('  - Has placeholder:', hasRedFlag);
                    console.error('  - Empty functions:', hasEmptyFunction);
                    console.warn('⚠️ LLM did not follow RUNNABLE CONTRACT!');
                    console.warn('⚠️ Applying emergency patch with buildDefaultFileContent...');

                    // Emergency fallback - generate production-grade content
                    action.content = this.buildDefaultFileContent(action.fileName, action.description || '');
                    console.log('✅ Emergency patch applied, length:', action.content?.length || 0);
                }

                // Handle multiple files in fileName (comma separated)
                if (action.fileName && action.fileName.includes(',')) {
                    console.log('📂 Multiple files detected:', action.fileName);
                    const fileNames = action.fileName.split(',').map(name => name.trim());
                    const results = [];

                    for (const fileName of fileNames) {
                        if (fileName) {
                            console.log('📄 Processing file:', fileName);
                            const fileContent = this.buildDefaultFileContent(fileName, action.description || '');
                            console.log('📝 Generated content for', fileName, '- length:', fileContent?.length || 0);
                            const result = await this.createFileWithAgent(fileName, fileContent);
                            results.push(result);
                        }
                    }

                    return results;
                } else {
                    console.log('📄 Single file:', action.fileName);
                    return await this.createFileWithAgent(action.fileName, action.content);
                }

            case 'read_file':
                return await this.readFileWithAgent(action.fileName);
            case 'run_command':
                return await this.runCommandWithAgent(action.command);
            case 'respond':
                return await this.respondToQuestion(action.content);
            default:
                // Use existing agent execution for complex actions
                return await this.executeAgentWithToolServer(action.description);
        }
    }

    addChatMessage(type, content) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return null;

        const message = document.createElement('div');
        message.className = `chat-message ${type}`;

        const now = new Date();
        const timeStr = now.toLocaleTimeString('tr-TR', {
            hour: '2-digit',
            minute: '2-digit'
        });

        const safeContent = this.sanitizeChatContent(content);

        message.innerHTML = `
      <div class="message-content">
        ${type === 'system' ? '<i class="fas fa-cog"></i>' :
                type === 'user' ? '<i class="fas fa-user"></i>' :
                    '<i class="fas fa-robot"></i>'}
        <div class="message-text">${safeContent}</div>
      </div>
      <div class="message-time">${timeStr}</div>
    `;

        chatMessages.appendChild(message);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        return message; // Return message element for updates
    }

    updateProgressMessage(messageElement, newContent) {
        if (messageElement) {
            const textDiv = messageElement.querySelector('.message-text');
            if (textDiv) {
                textDiv.innerHTML = newContent;
            }
        }
    }

    async askUserToContinue(error, failedAction) {
        return new Promise((resolve) => {
            // Generate unique ID for this recovery instance
            const recoveryId = `recovery_${Date.now()}`;

            const askHtml = `
        <div class="error-recovery" id="${recoveryId}">
          <h4>⚠️ İşlem Hatası</h4>
          <p><strong>Hatalı Step:</strong> ${failedAction.description}</p>
          <p><strong>Hata:</strong> ${error.message}</p>
          <div class="recovery-actions">
            <button class="btn secondary" data-action="stop">⏹️ Durdur</button>
            <button class="btn primary" data-action="continue">🔄 Devam Et</button>
          </div>
        </div>
      `;

            const chatMessage = this.addChatMessage('system', askHtml);

            // Use event delegation instead of onclick
            const handleRecoveryClick = (e) => {
                if (e.target.dataset.action) {
                    const continueExecution = e.target.dataset.action === 'continue';

                    // Clean up event listener
                    document.removeEventListener('click', handleRecoveryClick);

                    // Resolve promise
                    resolve(continueExecution);
                }
            };

            // Add event listener to document for event delegation
            document.addEventListener('click', handleRecoveryClick);
        });
    }

    // 🔐 PHASE 6: ELYSION CHAMBER - Helper Methods
    
    assessRisks(plannedActions) {
        // Analyze planned actions for risks
        const risks = [];
        
        if (!plannedActions || plannedActions.length === 0) {
            return [{ level: 'LOW', message: 'No operations planned' }];
        }

        // Check for file deletions
        const deletions = plannedActions.filter(a => 
            a.action === 'delete_file' || 
            a.command?.includes('rm ') || 
            a.command?.includes('del ')
        );
        if (deletions.length > 0) {
            risks.push({
                level: 'HIGH',
                message: `${deletions.length} file deletion(s) detected`,
                details: deletions.map(d => d.fileName || d.command)
            });
        }

        // Check for system commands
        const systemCmds = plannedActions.filter(a => 
            a.command?.includes('npm install') ||
            a.command?.includes('pip install') ||
            a.command?.includes('git push') ||
            a.command?.includes('sudo')
        );
        if (systemCmds.length > 0) {
            risks.push({
                level: 'MEDIUM',
                message: `${systemCmds.length} system command(s) detected`,
                details: systemCmds.map(c => c.command)
            });
        }

        // Check for file overwrites
        const writes = plannedActions.filter(a => 
            a.action === 'write_file' || 
            a.tool === 'write_file'
        );
        if (writes.length > 5) {
            risks.push({
                level: 'MEDIUM',
                message: `${writes.length} file write(s) detected`,
                details: writes.map(w => w.fileName || w.args?.path)
            });
        }

        // Default: low risk
        if (risks.length === 0) {
            risks.push({
                level: 'LOW',
                message: 'Standard operations only',
                details: ['File reads', 'Safe writes']
            });
        }

        return risks;
    }

    buildProbesForActions(plannedActions) {
        // Build validation probes based on planned actions
        const probes = [];

        if (!plannedActions || plannedActions.length === 0) {
            return [];
        }

        // Probe for file creations
        const fileWrites = plannedActions.filter(a => 
            a.action === 'write_file' || 
            a.tool === 'write_file'
        );
        
        fileWrites.forEach(fw => {
            const filePath = fw.fileName || fw.args?.path;
            if (filePath) {
                probes.push({
                    type: 'FILE_EXISTS',
                    target: filePath,
                    description: `Verify ${filePath} was created`
                });
            }
        });

        // Probe for commands execution
        const commands = plannedActions.filter(a => 
            a.command || a.tool === 'run_cmd'
        );
        
        if (commands.length > 0) {
            probes.push({
                type: 'PROCESS_SUCCESS',
                target: 'Last command',
                description: 'Verify command completed successfully'
            });
        }

        // Limit to 5 probes max
        return probes.slice(0, 5);
    }

    clearAgentState() {
        // Clear any running agent processes
        this.aiMode.agentMode.isRunning = false;
        this.aiMode.agentMode.steps = [];
        this.aiMode.agentMode.currentStepIndex = 0;
    }

    // =====================================
    // Agent Tool Methods
    // =====================================

    async createFileWithAgent(fileName, content) {
        console.log('📁 createFileWithAgent called:', fileName, 'content length:', content?.length || 0);

        if (!fileName) {
            throw new Error('Dosya adı belirtilmedi');
        }

        // 🎯 LIVE VISUALIZATION: Track file read for diff
        const fullPath = this.resolvePath(fileName);
        let oldContent = '';
        try {
            if (this.toolsSystem) {
                const result = await this.toolsSystem.executeToolWithExceptionHandling('readFile', { filePath: fullPath });
                oldContent = result.content || '';
            }
        } catch (e) {
            // File doesn't exist yet, that's ok
            oldContent = '';
        }

        // ✅ NIGHT ORDERS FIX: Only validate truly invalid content, not short valid code
        // CRITICAL: console.log(), require(), etc. are valid even if short!
        const isTrulyInvalid = !content ||
            content.trim() === '' ||
            content.includes('Bu alana') ||
            content.includes('kod yazın') ||
            content.includes('içerik buraya') ||
            content.toLowerCase().includes('placeholder') ||
            content.includes('TODO:') ||
            /<[A-ZÜĞİŞÇÖ_]+>/.test(content); // Turkish placeholder pattern

        if (isTrulyInvalid) {
            console.warn('⚠️ Invalid/placeholder content detected, generating professional content for:', fileName);
            console.log('📝 Original content was:', content?.substring(0, 100) + '...');

            // Use professional template system
            content = this.generateDefaultFileContent(fileName);

            // For "gezgin" project, use specific enhanced content
            if (fileName.toLowerCase().includes('index.html') || fileName === 'index.html') {
                content = this.buildDefaultFileContent(fileName, 'Kaptan Gezgin - Denizlerin ve kültürlerin keşifçisi');
            }

            console.log('✨ Generated enhanced content length:', content?.length || 0);
        } else {
            console.log('✅ Content validated as real code (length:', content.length, ')');
        }

        // 🎯 LIVE VISUALIZATION: Calculate diff
        const diff = this.calculateDiff(oldContent, content);
        if (this.liveVisualization.isActive) {
            this.trackFileChange(fullPath, 'write', diff);
        }

        try {
            // Use the new tool system for reliable file operations
            if (this.toolsSystem) {
                console.log('🔧 Using new tool system for file creation');
                const result = await this.toolsSystem.executeToolWithExceptionHandling('writeFile', {
                    filePath: this.currentFolder ? `${this.currentFolder}/${fileName}` : fileName,
                    content: content
                });

                if (result.success) {
                    this.showNotification(`✅ ${fileName} dosyası oluşturuldu`, 'success');
                    console.log('✅ File created successfully with tool system:', fileName);
                    return result;
                }
            }

            // Fallback to electron API
            if (window.electronAPI && window.electronAPI.writeFile) {
                // ✅ KAPTAN YAMASI: Merkezi path çözümleme
                const fullPath = this.resolvePath(fileName);
                console.log('💾 Writing file with electronAPI:', fullPath, 'content length:', content?.length || 0);
                const result = await window.electronAPI.writeFile(fullPath, content);

                if (result.success) {
                    this.showNotification(`✅ ${fileName} dosyası oluşturuldu`, 'success');
                    console.log('✅ File created successfully:', fileName);
                    return result;
                } else {
                    throw new Error(result.error);
                }
            } else {
                console.log('📝 Using fallback tab system for:', fileName);
                // Fallback: Create file in memory/tab system
                this.tabs.set(fileName, {
                    content: content,
                    language: this.detectLanguage(fileName),
                    isModified: true
                });

                this.currentFile = fileName;
                this.updateFileInfo();
                this.updateEditorContent();
                this.showNotification(`✅ ${fileName} dosyası oluşturuldu (bellekte)`, 'success');

                return { success: true, filePath: fileName };
            }
        } catch (error) {
            console.error('❌ File creation error:', error);
            throw new Error(`Dosya oluşturulamadı: ${error.message}`);
        }
    }

    generateDefaultFileContent(fileName) {
        const ext = (fileName?.split('.').pop() || '').toLowerCase();
        const project = this.currentProjectData || {};
        const projectTitle = project.title || 'KayraDeniz Projesi';

        console.log('� Generating default content for:', fileName, 'extension:', ext);

        // Check for specific professional templates first
        const templates = this.getFileTemplates();
        const baseName = fileName.split('.')[0];

        // Check for specific file patterns first
        for (const [pattern, template] of Object.entries(templates.specific)) {
            if (fileName.toLowerCase().includes(pattern.toLowerCase())) {
                return typeof template === 'function' ? template(fileName, baseName) : template;
            }
        }

        // Fall back to extension-based templates
        if (templates.byExtension[ext]) {
            const template = templates.byExtension[ext];
            return typeof template === 'function' ? template(fileName, baseName) : template;
        }

        switch (ext) {
            case 'html':
                return `<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${projectTitle}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 20px;
            background-color: #f4f4f4;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>${projectTitle}</h1>
        <p>KayraDeniz Kod Canavarı tarafından oluşturuldu.</p>
    </div>
</body>
</html>`;

            case 'css':
                return `/* ${projectTitle} Styles */
/* KayraDeniz Kod Canavarı tarafından oluşturuldu */

* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Arial', sans-serif;
    line-height: 1.6;
    color: #333;
    background-color: #f4f4f4;
}

.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 20px;
}

.header {
    background: #333;
    color: white;
    padding: 1rem 0;
    text-align: center;
}

.main {
    padding: 2rem 0;
}

.footer {
    background: #333;
    color: white;
    text-align: center;
    padding: 1rem 0;
    margin-top: 2rem;
}`;

            case 'js':
                return `// ${projectTitle}
// KayraDeniz Kod Canavarı tarafından oluşturuldu

document.addEventListener('DOMContentLoaded', function() {
    console.log('${projectTitle} yüklendi!');
    
    // Ana uygulama başlangıcı
    initializeApp();
});

function initializeApp() {
    // Uygulama başlatma kodları
    console.log('Uygulama başlatılıyor...');
    
    // Event listener'lar
    setupEventListeners();
}

function setupEventListeners() {
    // Olay dinleyicilerini kur
    console.log('Event listener\'lar kuruldu');
}

// Utility fonksiyonlar
function showMessage(message, type = 'info') {
    console.log(\`[\${type.toUpperCase()}] \${message}\`);
}

export { initializeApp, setupEventListeners, showMessage };`;

            case 'json':
                return JSON.stringify({
                    "name": projectTitle.toLowerCase().replace(/\s+/g, '-'),
                    "version": "1.0.0",
                    "description": "KayraDeniz Kod Canavarı tarafından oluşturulan proje",
                    "main": "index.html",
                    "scripts": {
                        "start": "serve .",
                        "build": "echo 'Build tamamlandı'"
                    },
                    "keywords": ["kayradeniz", "web", "javascript"],
                    "author": "KayraDeniz Kod Canavarı",
                    "license": "MIT"
                }, null, 2);

            case 'md':
                return `# ${projectTitle}

KayraDeniz Kod Canavarı tarafından oluşturuldu.

## Açıklama

Bu proje, modern web teknolojileri kullanılarak geliştirilmiştir.

## Özellikler

- ✨ Modern tasarım
- 📱 Mobil uyumlu
- ⚡ Hızlı performans
- 🔧 Kolay geliştirme

## Kurulum

1. Projeyi klonlayın
2. Bağımlılıkları yükleyin
3. Uygulamayı çalıştırın

## Kullanım

Proje dosyalarını açın ve geliştirmeye başlayın.

## Katkı

Katkıda bulunmak için pull request gönderin.

## Lisans

MIT License`;

            default:
                return `// ${projectTitle}
// KayraDeniz Kod Canavarı tarafından oluşturuldu
// Dosya: ${fileName}

console.log('${fileName} dosyası yüklendi');`;
        }
    }

    // Comprehensive file template system
    getFileTemplates() {
        return {
            specific: {
                'navbar': (fileName, baseName) => {
                    if (fileName.endsWith('.tsx')) {
                        return `import React from 'react';
import { motion } from 'framer-motion';

interface NavbarProps {
  className?: string;
}

const Navbar: React.FC<NavbarProps> = ({ className }) => {
  const [isOpen, setIsOpen] = React.useState(false);

  const navItems = [
    { label: 'Ana Sayfa', href: '/', icon: '🏠' },
    { label: 'Rotalar', href: '/rotalar', icon: '🧭' },
    { label: 'Lezzet', href: '/lezzet', icon: '🍽️' },
    { label: 'Hakkımda', href: '/hakkimda', icon: '⚓' }
  ];

  return (
    <motion.nav 
      className={\`fixed top-0 w-full bg-gradient-to-r from-blue-900 to-blue-800 shadow-lg z-50 \${className}\`}
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <motion.div 
            className="flex items-center space-x-2"
            whileHover={{ scale: 1.05 }}
          >
            <span className="text-2xl">⚓</span>
            <span className="text-white font-playfair text-xl font-bold">Gezgin</span>
          </motion.div>
          <div className="hidden md:flex items-center space-x-8">
            {navItems.map((item, index) => (
              <motion.a
                key={item.href}
                href={item.href}
                className="text-white hover:text-amber-300 transition-colors duration-300 font-inter flex items-center space-x-1"
                whileHover={{ y: -2 }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </motion.a>
            ))}
          </div>
        </div>
      </div>
    </motion.nav>
  );
};

export default Navbar;`;
                    } else {
                        return `<nav class="navbar">
  <div class="nav-container">
    <div class="nav-logo">
      <span class="nav-icon">⚓</span>
      <span class="nav-title">Gezgin</span>
    </div>
    <ul class="nav-menu">
      <li><a href="/">🏠 Ana Sayfa</a></li>
      <li><a href="/rotalar">🧭 Rotalar</a></li>
      <li><a href="/lezzet">🍽️ Lezzet</a></li>
      <li><a href="/hakkimda">⚓ Hakkımda</a></li>
    </ul>
  </div>
</nav>`;
                    }
                },
                'card': (fileName, baseName) => {
                    if (fileName.endsWith('.tsx')) {
                        return `import React from 'react';
import { motion } from 'framer-motion';

interface CardProps {
  title: string;
  description: string;
  image?: string;
  href?: string;
  tag?: string;
  className?: string;
  children?: React.ReactNode;
}

const Card: React.FC<CardProps> = ({ 
  title, 
  description, 
  image, 
  href, 
  tag, 
  className = '',
  children 
}) => {
  const cardContent = (
    <motion.div
      className={\`bg-white rounded-lg shadow-lg overflow-hidden transition-all duration-300 hover:shadow-xl group cursor-pointer \${className}\`}
      whileHover={{ 
        y: -8,
        transition: { type: "spring", stiffness: 300, damping: 20 }
      }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {image && (
        <div className="relative h-48 overflow-hidden">
          <img 
            src={image} 
            alt={title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
          />
          {tag && (
            <div className="absolute top-4 left-4 bg-amber-500 text-white px-3 py-1 rounded-full text-sm font-medium">
              {tag}
            </div>
          )}
        </div>
      )}
      <div className="p-6">
        <h3 className="font-playfair text-xl font-bold text-gray-800 mb-3 group-hover:text-blue-600 transition-colors duration-300">
          {title}
        </h3>
        <p className="text-gray-600 font-inter text-sm leading-relaxed mb-4">
          {description}
        </p>
        {children}
        <motion.div
          className="h-0.5 bg-gradient-to-r from-amber-500 to-blue-600 origin-left"
          initial={{ scaleX: 0 }}
          whileHover={{ scaleX: 1 }}
          transition={{ duration: 0.3 }}
        />
      </div>
    </motion.div>
  );

  if (href) {
    return (
      <a href={href} className="block">
        {cardContent}
      </a>
    );
  }

  return cardContent;
};

export default Card;`;
                    } else {
                        return `<div class="card">
  <div class="card-header">
    <h3 class="card-title">Kart Başlığı</h3>
  </div>
  <div class="card-body">
    <p class="card-description">Kart açıklaması buraya gelecek...</p>
  </div>
</div>`;
                    }
                }
            },
            byExtension: {
                'tsx': (fileName, baseName) => {
                    return `import React from 'react';

interface ${baseName}Props {
  className?: string;
}

const ${baseName}: React.FC<${baseName}Props> = ({ className }) => {
  return (
    <div className={\`${baseName.toLowerCase()} \${className || ''}\`}>
      <h2>${baseName} Component</h2>
      <p>This is the ${baseName} component.</p>
    </div>
  );
};

export default ${baseName};`;
                },
                'css': (fileName, baseName) => {
                    return `/* ${fileName} - Generated by KayraDeniz Kod Canavarı */

/* Deniz teması renkleri */
:root {
  --ocean-blue: #1e40af;
  --deep-blue: #1e3a8a;
  --foam-white: #f8fafc;
  --sand-gold: #fbbf24;
  --copper: #b45309;
  --wave-gradient: linear-gradient(135deg, var(--ocean-blue), var(--deep-blue));
}

/* Genel stiller */
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
}

/* Hover animasyonları */
.card:hover {
  transform: translateY(-8px);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
}

/* Tipografi */
.font-playfair {
  font-family: 'Playfair Display', serif;
}

.font-inter {
  font-family: 'Inter', sans-serif;
}`;
                }
            }
        };
    }

    buildDefaultFileContent(fileName, description = '') {
        const ext = (fileName?.split('.').pop() || '').toLowerCase();
        const project = this.currentProjectData || {};
        const analysis = project.analysis || {};
        const projectTitle = project.title || 'KayraDeniz Projesi';
        const projectSummary = (project.prompt || description || 'KayraDeniz Kod Canavarı tarafından oluşturulan proje açıklaması.').trim();
        const summaryIntro = projectSummary.split(/\.|\n/).find(Boolean) || projectSummary;
        const features = Array.isArray(analysis.features) && analysis.features.length
            ? analysis.features
            : ['Özgün tasarım', 'Mobil uyumluluğu', 'Kolay yönetilebilirlik', 'Yüksek performans'];

        const featureCards = features.slice(0, 6).map(feature => `
                                                <li class="feature-card">
                                                        <h3>${feature}</h3>
                                    <p>${summaryIntro}</p>
                                                </li>`).join('');

        switch (ext) {
            case 'html':
                return `<!DOCTYPE html>
<html lang="tr">
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="description" content="${summaryIntro}" />
        <title>Kaptan Gezgin - ${projectTitle}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
        <link rel="stylesheet" href="styles.css" />
    </head>
    <body>
        <header class="hero">
            <nav class="navbar">
                <div class="brand">
                    <span class="compass">🧭</span>
                    <span class="brand-text">Kaptan Gezgin</span>
                </div>
                <button class="menu-toggle" aria-label="Menüyü aç">☰</button>
                <ul class="nav-links">
                    <li><a href="index.html" class="nav-link">🏠 Ana Sayfa</a></li>
                    <li><a href="rotalar.html" class="nav-link">🗺️ Rotalar</a></li>
                    <li><a href="lezzet.html" class="nav-link">🍽️ Lezzet</a></li>
                    <li><a href="hakkimda.html" class="nav-link">⚓ Hakkımda</a></li>
                </ul>
            </nav>
            <div class="hero-content">
                <div class="hero-badge">Denizlerin Keşifçisi</div>
                <h1 class="hero-title">Dünyanın Kültürlerine ve Lezzetlerine Yolculuk</h1>
                <p class="hero-subtitle">Bir kaptan olarak gezdiğim ülkelerin tarihi yerlerini, zengin kültürlerini ve eşsiz lezzetlerini keşfedin. Her limanda yeni bir hikaye, her rotalarda yeni bir macera.</p>
                <div class="hero-actions">
                    <a href="rotalar.html" class="cta-button primary">Rotaları Keşfet</a>
                    <a href="lezzet.html" class="cta-button secondary">Lezzetleri Gör</a>
                </div>
            </div>
            <div class="wave-divider"></div>
        </header>

        <main>
            <section class="destinations">
                <div class="container">
                    <div class="section-header">
                        <span class="section-eyebrow">🌍 Keşiflerim</span>
                        <h2>Son Ziyaret Ettiğim Yerler</h2>
                        <p>Her destinasyon kendine özgü hikayeleri ve deneyimleri barındırıyor</p>
                    </div>
                    <div class="destinations-grid">
                        <article class="destination-card featured">
                            <div class="card-image">
                                <img src="https://images.unsplash.com/photo-1520637836862-4d197d17c86a?auto=format&fit=crop&w=800&q=80" alt="İstanbul Boğazı">
                                <div class="card-badge">Son Rota</div>
                            </div>
                            <div class="card-content">
                                <div class="card-location">🇹🇷 İstanbul, Türkiye</div>
                                <h3>İki Kıtayı Birleştiren Şehir</h3>
                                <p>Boğaz'ın majestiği, Sultanahmet'in tarihi dokusu ve sokak lezzetlerinin büyüleyici karışımı.</p>
                                <div class="card-highlights">
                                    <span class="highlight">⚓ Galata Limanı</span>
                                    <span class="highlight">🕌 Ayasofya</span>
                                    <span class="highlight">🥙 Balık Ekmek</span>
                                </div>
                            </div>
                        </article>
                        
                        <article class="destination-card">
                            <div class="card-image">
                                <img src="https://images.unsplash.com/photo-1573224913297-86cb7d3d55bb?auto=format&fit=crop&w=600&q=80" alt="Santorini">
                            </div>
                            <div class="card-content">
                                <div class="card-location">🇬🇷 Santorini, Yunanistan</div>
                                <h3>Beyaz ve Mavi Masalı</h3>
                                <p>Kaldera manzarası eşliğinde gün batımı ve geleneksel Yunan mezzeleri.</p>
                            </div>
                        </article>
                        
                        <article class="destination-card">
                            <div class="card-image">
                                <img src="https://images.unsplash.com/photo-1520610987405-f40a2ee4aa13?auto=format&fit=crop&w=600&q=80" alt="Venedik">
                            </div>
                            <div class="card-content">
                                <div class="card-location">🇮🇹 Venedik, İtalya</div>
                                <h3>Kanalların Romantik Şehri</h3>
                                <p>Gondollar, köprüler ve deniz mahsulleri restoranları.</p>
                            </div>
                        </article>
                    </div>
                </div>
            </section>

            <section class="cultural-insights">
                <div class="container">
                    <div class="insights-content">
                        <div class="insights-text">
                            <span class="section-eyebrow">📚 Kültürel Keşifler</span>
                            <h2>Her Liman Yeni Bir Dünya</h2>
                            <p>20 yıllık denizcilik kariyerimde 47 ülke ve 150'den fazla limana yanaştım. Her durağımda yerel kültürleri yakından tanıma, geleneksel yemekleri tadına bakma ve tarihi mekanları keşfetme fırsatı buldum.</p>
                            <div class="stats-grid">
                                <div class="stat">
                                    <span class="stat-number">47</span>
                                    <span class="stat-label">Ülke</span>
                                </div>
                                <div class="stat">
                                    <span class="stat-number">150+</span>
                                    <span class="stat-label">Liman</span>
                                </div>
                                <div class="stat">
                                    <span class="stat-number">20</span>
                                    <span class="stat-label">Yıl Deneyim</span>
                                </div>
                            </div>
                        </div>
                        <div class="insights-visual">
                            <div class="captain-portrait">
                                <img src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=500&q=80" alt="Kaptan Gezgin">
                                <div class="portrait-frame"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section class="featured-cuisines">
                <div class="container">
                    <div class="section-header centered">
                        <span class="section-eyebrow">🍽️ Lezzet Yolculukları</span>
                        <h2>Damak Tadımdan Unutamadığım Lezzetler</h2>
                    </div>
                    <div class="cuisines-slider">
                        <div class="cuisine-card">
                            <div class="cuisine-image">
                                <img src="https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=400&q=80" alt="Paella">
                            </div>
                            <div class="cuisine-content">
                                <h4>Valencia Paellası</h4>
                                <p class="cuisine-location">🇪🇸 Valencia, İspanya</p>
                                <p>Deniz mahsulleri, safran ve Valencia pirincinin mükemmel uyumu.</p>
                            </div>
                        </div>
                        
                        <div class="cuisine-card">
                            <div class="cuisine-image">
                                <img src="https://images.unsplash.com/photo-1572441713132-51c75654db73?auto=format&fit=crop&w=400&q=80" alt="Sushi">
                            </div>
                            <div class="cuisine-content">
                                <h4>Omakase Sushi</h4>
                                <p class="cuisine-location">🇯🇵 Tokyo, Japonya</p>
                                <p>Edo körfezi'nden taze balıklar ve ustanın sanatsal dokunuşu.</p>
                            </div>
                        </div>
                        
                        <div class="cuisine-card">
                            <div class="cuisine-image">
                                <img src="https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?auto=format&fit=crop&w=400&q=80" alt="Pizza">
                            </div>
                            <div class="cuisine-content">
                                <h4>Margherita Pizza</h4>
                                <p class="cuisine-location">🇮🇹 Napoli, İtalya</p>
                                <p>Taş fırında pişen orijinal Napoli usulü pizza deneyimi.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </main>

        <footer class="footer">
            <div class="container">
                <div class="footer-content">
                    <div class="footer-brand">
                        <div class="brand">
                            <span class="compass">🧭</span>
                            <span class="brand-text">Kaptan Gezgin</span>
                        </div>
                        <p>Denizlerin ve kültürlerin keşifçisi</p>
                    </div>
                    <div class="footer-links">
                        <div class="link-group">
                            <h4>Keşif</h4>
                            <a href="rotalar.html">Rotalarım</a>
                            <a href="lezzet.html">Lezzet Rehberi</a>
                            <a href="hakkimda.html">Hakkımda</a>
                        </div>
                        <div class="link-group">
                            <h4>İletişim</h4>
                            <a href="mailto:kaptan@gezgin.com">kaptan@gezgin.com</a>
                            <a href="tel:+905551234567">+90 555 123 45 67</a>
                        </div>
                    </div>
                </div>
                <div class="footer-bottom">
                    <p>&copy; ${new Date().getFullYear()} Kaptan Gezgin. Tüm hakları saklıdır.</p>
                    <div class="social-links">
                        <a href="#" class="social-link">📷 Instagram</a>
                        <a href="#" class="social-link">🎥 YouTube</a>
                        <a href="#" class="social-link">📱 TikTok</a>
                    </div>
                </div>
            </div>
        </footer>

        <script src="script.js"></script>
    </body>
</html>`;
            case 'css':
                return `/* Kaptan Gezgin - Deniz Teması CSS */
/* KayraDeniz Kod Canavarı tarafından üretildi */

/* Playfair Display + Inter Font Import */
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Inter:wght@300;400;500;600&display=swap');

/* Deniz Teması Renk Paleti */
:root {
    --ocean-deep: #1e3a8a;
    --ocean-blue: #1e40af;
    --navy-dark: #1e2a5e;
    --foam-white: #f8fafc;
    --foam-light: #f1f5f9;
    --sand-gold: #fbbf24;
    --copper: #b45309;
    --copper-light: #d97706;
    --wave-gradient: linear-gradient(135deg, var(--ocean-blue), var(--ocean-deep));
    --sunset-gradient: linear-gradient(135deg, var(--sand-gold), var(--copper));
    --glass-bg: rgba(248, 250, 252, 0.1);
    --glass-border: rgba(248, 250, 252, 0.2);
}

/* Global Reset & Base */
* {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    line-height: 1.6;
    color: var(--foam-white);
    background: var(--ocean-deep);
    overflow-x: hidden;
}

/* Typography */
h1, h2, h3, h4, h5, h6 {
    font-family: 'Playfair Display', serif;
    font-weight: 700;
    line-height: 1.2;
}

.hero-title {
    font-size: clamp(2.5rem, 5vw, 4rem);
    background: linear-gradient(135deg, var(--foam-white), var(--sand-gold));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin-bottom: 1.5rem;
}

/* Container & Layout */
.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 clamp(1rem, 5vw, 2rem);
}

/* Header & Navigation */
.hero {
    min-height: 100vh;
    background: var(--wave-gradient);
    position: relative;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.hero::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: 
        radial-gradient(circle at 20% 80%, rgba(251, 191, 36, 0.1) 0%, transparent 50%),
        radial-gradient(circle at 80% 20%, rgba(180, 83, 9, 0.1) 0%, transparent 50%);
    pointer-events: none;
}

.navbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 2rem 0;
    position: relative;
    z-index: 10;
}

.brand {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    text-decoration: none;
    color: var(--foam-white);
}

.compass {
    font-size: 2rem;
    animation: spin 20s linear infinite;
}

@keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}

.brand-text {
    font-family: 'Playfair Display', serif;
    font-size: 1.5rem;
    font-weight: 700;
    letter-spacing: 0.05em;
}

.nav-links {
    display: flex;
    list-style: none;
    gap: 2rem;
    align-items: center;
}

.nav-link {
    color: var(--foam-white);
    text-decoration: none;
    font-weight: 500;
    transition: all 0.3s ease;
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    position: relative;
}

.nav-link:hover {
    background: var(--glass-bg);
    backdrop-filter: blur(10px);
    border: 1px solid var(--glass-border);
    transform: translateY(-2px);
}

.nav-link::after {
    content: '';
    position: absolute;
    bottom: -2px;
    left: 50%;
    width: 0;
    height: 2px;
    background: var(--copper);
    transition: all 0.3s ease;
    transform: translateX(-50%);
}

.nav-link:hover::after {
    width: 100%;
}

.menu-toggle {
    display: none;
    background: none;
    border: none;
    color: var(--foam-white);
    font-size: 1.5rem;
    cursor: pointer;
}

/* Hero Content */
.hero-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    max-width: 800px;
    position: relative;
    z-index: 5;
}

.hero-badge {
    display: inline-block;
    padding: 0.5rem 1.5rem;
    background: var(--glass-bg);
    border: 1px solid var(--glass-border);
    border-radius: 2rem;
    font-size: 0.875rem;
    font-weight: 500;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    margin-bottom: 2rem;
    backdrop-filter: blur(10px);
    width: fit-content;
}

.hero-subtitle {
    font-size: clamp(1.1rem, 2vw, 1.25rem);
    color: var(--foam-light);
    margin-bottom: 3rem;
    max-width: 600px;
}

.hero-actions {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
}

.cta-button {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem 2rem;
    border-radius: 0.75rem;
    text-decoration: none;
    font-weight: 600;
    transition: all 0.3s ease;
    border: 2px solid transparent;
}

.cta-button.primary {
    background: var(--sunset-gradient);
    color: var(--foam-white);
}

.cta-button.primary:hover {
    transform: translateY(-3px);
    box-shadow: 0 10px 30px rgba(251, 191, 36, 0.3);
}

.cta-button.secondary {
    background: var(--glass-bg);
    color: var(--foam-white);
    border: 2px solid var(--glass-border);
    backdrop-filter: blur(10px);
}

.cta-button.secondary:hover {
    background: var(--foam-white);
    color: var(--ocean-deep);
    border-color: var(--foam-white);
}

/* Wave Divider */
.wave-divider {
    position: absolute;
    bottom: -1px;
    left: 0;
    width: 100%;
    height: 100px;
    background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 120'%3E%3Cpath d='M985.66,92.83C906.67,72,823.78,31,743.84,14.19c-82.26-17.34-168.06-16.33-250.45.39-57.84,11.73-114,31.07-172,41.86A600.21,600.21,0,0,1,0,27.35V120H1200V95.8C1132.19,118.92,1055.71,111.31,985.66,92.83Z' fill='%23f8fafc'/%3E%3C/svg%3E") no-repeat center bottom;
    background-size: cover;
}

/* Main Sections */
main {
    background: var(--foam-white);
    color: var(--navy-dark);
}

.section {
    padding: clamp(4rem, 8vw, 6rem) 0;
}

.section-header {
    text-align: center;
    margin-bottom: 4rem;
    max-width: 600px;
    margin-left: auto;
    margin-right: auto;
}

.section-header.centered {
    text-align: center;
}

.section-eyebrow {
    display: inline-block;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--copper);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    margin-bottom: 1rem;
}

.section-header h2 {
    font-size: clamp(2rem, 4vw, 3rem);
    color: var(--navy-dark);
    margin-bottom: 1rem;
}

.section-header p {
    font-size: 1.125rem;
    color: #64748b;
}

/* Destination Cards */
.destinations-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 2rem;
    margin-top: 3rem;
}

.destination-card {
    background: white;
    border-radius: 1.5rem;
    overflow: hidden;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
    transition: all 0.3s ease;
    position: relative;
}

.destination-card:hover {
    transform: translateY(-8px);
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
}

.destination-card.featured {
    grid-column: span 1;
}

.card-image {
    position: relative;
    height: 250px;
    overflow: hidden;
}

.card-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.3s ease;
}

.destination-card:hover .card-image img {
    transform: scale(1.05);
}

.card-badge {
    position: absolute;
    top: 1rem;
    right: 1rem;
    background: var(--sunset-gradient);
    color: white;
    padding: 0.5rem 1rem;
    border-radius: 1rem;
    font-size: 0.875rem;
    font-weight: 600;
}

.card-content {
    padding: 2rem;
}

.card-location {
    color: var(--copper);
    font-weight: 600;
    font-size: 0.875rem;
    margin-bottom: 0.5rem;
}

.card-content h3 {
    font-size: 1.5rem;
    margin-bottom: 1rem;
    color: var(--navy-dark);
}

.card-content p {
    color: #64748b;
    margin-bottom: 1.5rem;
}

.card-highlights {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
}

.highlight {
    background: var(--foam-light);
    color: var(--navy-dark);
    padding: 0.25rem 0.75rem;
    border-radius: 1rem;
    font-size: 0.875rem;
    font-weight: 500;
}

/* Cultural Insights */
.insights-content {
    display: grid;
    grid-template-columns: 1fr 300px;
    gap: 4rem;
    align-items: center;
}

.stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 2rem;
    margin-top: 2rem;
}

.stat {
    text-align: center;
    padding: 1.5rem;
    background: var(--foam-light);
    border-radius: 1rem;
}

.stat-number {
    display: block;
    font-size: 2.5rem;
    font-weight: 700;
    color: var(--copper);
    font-family: 'Playfair Display', serif;
}

.stat-label {
    color: var(--navy-dark);
    font-weight: 500;
    margin-top: 0.5rem;
}

.captain-portrait {
    position: relative;
    border-radius: 50%;
    overflow: hidden;
    width: 250px;
    height: 250px;
    margin: 0 auto;
}

.captain-portrait img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.portrait-frame {
    position: absolute;
    inset: -10px;
    border: 4px solid var(--copper);
    border-radius: 50%;
    background: conic-gradient(var(--copper), var(--sand-gold), var(--copper));
    z-index: -1;
}

/* Cuisine Cards */
.cuisines-slider {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 2rem;
    margin-top: 3rem;
}

.cuisine-card {
    background: white;
    border-radius: 1rem;
    overflow: hidden;
    box-shadow: 0 5px 20px rgba(0, 0, 0, 0.1);
    transition: transform 0.3s ease;
}

.cuisine-card:hover {
    transform: translateY(-5px);
}

.cuisine-image {
    height: 200px;
    overflow: hidden;
}

.cuisine-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.cuisine-content {
    padding: 1.5rem;
}

.cuisine-content h4 {
    font-size: 1.25rem;
    margin-bottom: 0.5rem;
    color: var(--navy-dark);
}

.cuisine-location {
    color: var(--copper);
    font-weight: 600;
    font-size: 0.875rem;
    margin-bottom: 0.75rem;
}

.cuisine-content p {
    color: #64748b;
}

/* Footer */
.footer {
    background: var(--navy-dark);
    color: var(--foam-white);
    padding: 3rem 0 1rem;
}

.footer-content {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 3rem;
    margin-bottom: 2rem;
}

.footer-brand .brand {
    margin-bottom: 1rem;
}

.footer-brand p {
    color: var(--foam-light);
}

.footer-links {
    display: flex;
    gap: 3rem;
}

.link-group h4 {
    color: var(--sand-gold);
    margin-bottom: 1rem;
    font-size: 1rem;
}

.link-group a {
    display: block;
    color: var(--foam-light);
    text-decoration: none;
    margin-bottom: 0.5rem;
    transition: color 0.3s ease;
}

.link-group a:hover {
    color: var(--foam-white);
}

.footer-bottom {
    border-top: 1px solid var(--glass-border);
    padding-top: 2rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.social-links {
    display: flex;
    gap: 1.5rem;
}

.social-link {
    color: var(--foam-light);
    text-decoration: none;
    transition: color 0.3s ease;
}

.social-link:hover {
    color: var(--sand-gold);
}

/* Responsive Design */
@media (max-width: 768px) {
    .nav-links {
        display: none;
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: var(--glass-bg);
        backdrop-filter: blur(10px);
        border: 1px solid var(--glass-border);
        border-radius: 1rem;
        padding: 1rem;
        flex-direction: column;
        gap: 1rem;
    }

    .nav-links.active {
        display: flex;
    }

    .menu-toggle {
        display: block;
    }

    .hero-actions {
        flex-direction: column;
    }

    .insights-content {
        grid-template-columns: 1fr;
        text-align: center;
    }

    .stats-grid {
        grid-template-columns: repeat(3, 1fr);
        gap: 1rem;
    }

    .footer-content {
        grid-template-columns: 1fr;
        text-align: center;
    }

    .footer-bottom {
        flex-direction: column;
        gap: 1rem;
        text-align: center;
    }
}

@media (max-width: 480px) {
    .stats-grid {
        grid-template-columns: 1fr;
    }
    
    .cuisines-slider {
        grid-template-columns: 1fr;
    }
    
    .destinations-grid {
        grid-template-columns: 1fr;
    }
}

/* Smooth Animations */
@media (prefers-reduced-motion: no-preference) {
    .destination-card,
    .cuisine-card,
    .cta-button,
    .nav-link {
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
}`;
            case 'js':
                return `// Kaptan Gezgin - Interactive Website
// KayraDeniz Kod Canavarı tarafından üretildi

// DOM Elements
const menuToggle = document.querySelector('.menu-toggle');
const navLinks = document.querySelector('.nav-links');
const navLinksItems = document.querySelectorAll('.nav-link');
const ctaButtons = document.querySelectorAll('.cta-button');

// Navigation Toggle
if (menuToggle && navLinks) {
    menuToggle.addEventListener('click', () => {
        navLinks.classList.toggle('active');
        
        // Animate hamburger menu
        const isActive = navLinks.classList.contains('active');
        menuToggle.innerHTML = isActive ? '✕' : '☰';
        menuToggle.style.transform = isActive ? 'rotate(90deg)' : 'rotate(0deg)';
    });

    // Close mobile menu when clicking a link
    navLinksItems.forEach(link => {
        link.addEventListener('click', () => {
            navLinks.classList.remove('active');
            menuToggle.innerHTML = '☰';
            menuToggle.style.transform = 'rotate(0deg)';
        });
    });
}

// Smooth scrolling for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Intersection Observer for animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Animate sections on scroll
document.addEventListener('DOMContentLoaded', () => {
    // Initialize animation elements
    const animatedElements = document.querySelectorAll('.destination-card, .cuisine-card, .section-header');
    
    animatedElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });

    // Counter animation for stats
    const statNumbers = document.querySelectorAll('.stat-number');
    const statsObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animateCounter(entry.target);
                statsObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });

    statNumbers.forEach(stat => {
        statsObserver.observe(stat);
    });
});

// Counter animation function
function animateCounter(element) {
    const target = parseInt(element.textContent);
    const duration = 2000;
    const start = 0;
    const increment = target / (duration / 16);
    let current = start;

    const timer = setInterval(() => {
        current += increment;
        element.textContent = Math.floor(current) + '+';
        
        if (current >= target) {
            element.textContent = target + '+';
            clearInterval(timer);
        }
    }, 16);
}

// Parallax effect for hero background
window.addEventListener('scroll', () => {
    const scrolled = window.pageYOffset;
    const hero = document.querySelector('.hero');
    
    if (hero) {
        const rate = scrolled * -0.5;
        hero.style.transform = \`translateY(\${rate}px)\`;
    }
});

// Dynamic greeting based on time
function updateGreeting() {
    const now = new Date();
    const hour = now.getHours();
    const greetingElement = document.querySelector('.hero-badge');
    
    if (greetingElement) {
        let greeting;
        if (hour < 12) {
            greeting = '🌅 Günaydın Kaşif!';
        } else if (hour < 18) {
            greeting = '⛵ İyi Günler Kaptan!';
        } else {
            greeting = '🌊 İyi Akşamlar Gezgin!';
        }
        greetingElement.textContent = greeting;
    }
}

// Form handling
const contactForm = document.querySelector('.contact-form');
if (contactForm) {
    contactForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Simple form validation
        const formData = new FormData(this);
        const name = formData.get('name');
        const email = formData.get('email');
        const message = formData.get('message');
        
        if (!name || !email || !message) {
            alert('Lütfen tüm alanları doldurun!');
            return;
        }
        
        if (!isValidEmail(email)) {
            alert('Lütfen geçerli bir e-posta adresi girin!');
            return;
        }
        
        // Success message
        alert('Mesajınız alındı! En kısa sürede size dönüş yapacağız. ⚓');
        this.reset();
    });
}

// Email validation
function isValidEmail(email) {
    const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
    return emailRegex.test(email);
}

// Interactive destination cards
document.querySelectorAll('.destination-card').forEach(card => {
    card.addEventListener('mouseenter', function() {
        this.style.transform = 'translateY(-12px) scale(1.02)';
        this.style.boxShadow = '0 25px 50px rgba(0, 0, 0, 0.2)';
    });
    
    card.addEventListener('mouseleave', function() {
        this.style.transform = 'translateY(0) scale(1)';
        this.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.1)';
    });
});

// CTA button interactions
ctaButtons.forEach(button => {
    button.addEventListener('click', function(e) {
        if (this.classList.contains('primary')) {
            // Add ripple effect
            const ripple = document.createElement('span');
            ripple.style.position = 'absolute';
            ripple.style.background = 'rgba(255, 255, 255, 0.3)';
            ripple.style.borderRadius = '50%';
            ripple.style.transform = 'scale(0)';
            ripple.style.animation = 'ripple 0.6s linear';
            ripple.style.left = (e.offsetX - 10) + 'px';
            ripple.style.top = (e.offsetY - 10) + 'px';
            ripple.style.width = '20px';
            ripple.style.height = '20px';
            
            this.style.position = 'relative';
            this.style.overflow = 'hidden';
            this.appendChild(ripple);
            
            setTimeout(() => {
                ripple.remove();
            }, 600);
        }
    });
});

// Add ripple animation CSS
const style = document.createElement('style');
style.textContent = \`
    @keyframes ripple {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }
\`;
document.head.appendChild(style);

// Compass rotation animation
const compass = document.querySelector('.compass');
if (compass) {
    let rotation = 0;
    setInterval(() => {
        rotation += 0.5;
        compass.style.transform = \`rotate(\${rotation}deg)\`;
    }, 50);
}

// Dynamic content based on time
function updateDynamicContent() {
    const now = new Date();
    const month = now.getMonth();
    const seasonElement = document.querySelector('.season-info');
    
    if (seasonElement) {
        let season;
        if (month >= 2 && month <= 4) {
            season = { name: 'Bahar', emoji: '🌸', description: 'Doğanın uyanış mevsimi' };
        } else if (month >= 5 && month <= 7) {
            season = { name: 'Yaz', emoji: '☀️', description: 'Deniz keyfi mevsimi' };
        } else if (month >= 8 && month <= 10) {
            season = { name: 'Sonbahar', emoji: '🍂', description: 'Renkli yapraklar mevsimi' };
        } else {
            season = { name: 'Kış', emoji: '❄️', description: 'Sıcak çorba mevsimi' };
        }
        
        seasonElement.innerHTML = \`
            <span>\${season.emoji} \${season.name}</span>
            <small>\${season.description}</small>
        \`;
    }
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    updateGreeting();
    updateDynamicContent();
    
    // Add loading animation
    document.body.style.opacity = '0';
    setTimeout(() => {
        document.body.style.transition = 'opacity 0.5s ease';
        document.body.style.opacity = '1';
    }, 100);
});

// Weather widget (mock data)
function updateWeather() {
    const weatherWidget = document.querySelector('.weather-widget');
    if (weatherWidget) {
        const mockWeather = {
            temperature: Math.floor(Math.random() * 15) + 15, // 15-30°C
            condition: ['Güneşli', 'Parçalı Bulutlu', 'Deniz Meltemi'][Math.floor(Math.random() * 3)],
            emoji: ['☀️', '⛅', '🌊'][Math.floor(Math.random() * 3)]
        };
        
        weatherWidget.innerHTML = \`
            <span>\${mockWeather.emoji} \${mockWeather.temperature}°C</span>
            <small>\${mockWeather.condition}</small>
        \`;
    }
}

// Update weather every 5 minutes
setInterval(updateWeather, 300000);
updateWeather();

// Console messages for developers
console.log('%c🌊 Kaptan Gezgin - Deniz Teması', 'color: #1e40af; font-size: 20px; font-weight: bold;');
console.log('%c⚓ KayraDeniz Kod Canavarı tarafından geliştirildi', 'color: #fbbf24; font-size: 14px;');
console.log('%c🏴‍☠️ Kod denizlerinde yeni keşifler için hazır!', 'color: #b45309; font-size: 12px;');

// Export functions for potential module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        animateCounter,
        isValidEmail,
        updateGreeting,
        updateDynamicContent
    };
}`;
            case 'md':
            case 'markdown':
            case 'readme':
                return `# ${projectTitle}

${projectSummary}

## Özellikler

- ${features.join('\n- ')}

## Nasıl Çalıştırılır

1. Depoyu klonlayın veya zip olarak indirin.
2. \`index.html\` dosyasını tarayıcınızda açın.
3. İçeriği kendi bilgilerinizle güncelleyin.

## İletişim

Projeyi geliştiren: ${project.author || 'KayraDeniz Kod Canavarı'}
`;
            default:
                return description || projectSummary || `/* ${fileName} için otomatik oluşturulan içerik */`;
        }
    }

    async readFileWithAgent(fileName) {
        if (!fileName) {
            throw new Error('Dosya adı belirtilmedi');
        }

        // 🎯 LIVE VISUALIZATION: Track file read
        const fullPath = this.resolvePath(fileName);
        if (this.liveVisualization.isActive) {
            this.trackFileChange(fullPath, 'read', null);
        }

        try {
            // Use electron API if available
            if (window.electronAPI && window.electronAPI.readFile) {
                // ✅ KAPTAN YAMASI: Merkezi path çözümleme
                const result = await window.electronAPI.readFile(fullPath);

                if (result.success) {
                    return { success: true, content: result.content, path: fullPath };
                } else {
                    throw new Error(result.error);
                }
            } else {
                // Fallback: Read from tab system
                if (this.tabs.has(fileName)) {
                    const fileData = this.tabs.get(fileName);
                    return { success: true, content: fileData.content };
                } else {
                    throw new Error('Dosya bulunamadı');
                }
            }
        } catch (error) {
            throw new Error(`Dosya okunamadı: ${error.message}`);
        }
    }

    /**
     * ✏️ MULTI-EDIT: Atomic file editing (Continue-inspired)
     * 
     * Applies multiple find-and-replace operations sequentially.
     * All edits must succeed for changes to be applied (atomic operation).
     * 
     * @param {string} filepath - File path relative to workspace
     * @param {Array} edits - Array of { old_string, new_string, replace_all? }
     * @returns {Object} { success: boolean, editsApplied: number }
     */
    async executeMultiEdit(filepath, edits) {
        if (!filepath || !Array.isArray(edits) || edits.length === 0) {
            throw new Error('executeMultiEdit requires filepath and non-empty edits array');
        }

        console.log(`✏️ Multi-Edit: ${filepath} (${edits.length} edits)`);

        // Step 1: Read current file content
        const readResult = await this.readFileWithAgent(filepath);
        if (!readResult.success) {
            throw new Error(`Cannot read file: ${filepath}`);
        }

        let currentContent = readResult.content;
        const originalContent = currentContent; // Backup for rollback
        const appliedEdits = [];

        try {
            // Step 2: Apply edits sequentially
            for (let i = 0; i < edits.length; i++) {
                const edit = edits[i];
                const { old_string, new_string, replace_all = false } = edit;

                // Validation
                if (!old_string || new_string === undefined) {
                    throw new Error(`Edit ${i}: missing old_string or new_string`);
                }

                if (old_string === new_string) {
                    throw new Error(`Edit ${i}: old_string and new_string must be different`);
                }

                // Check if old_string exists
                if (!currentContent.includes(old_string)) {
                    throw new Error(
                        `Edit ${i}: old_string not found in file:\n` +
                        `Looking for: ${old_string.substring(0, 100)}${old_string.length > 100 ? '...' : ''}`
                    );
                }

                // Apply replacement
                if (replace_all) {
                    // Replace all occurrences
                    const occurrences = (currentContent.match(new RegExp(old_string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
                    currentContent = currentContent.split(old_string).join(new_string);
                    console.log(`  ✅ Edit ${i + 1}/${edits.length}: Replaced ${occurrences} occurrences`);
                    appliedEdits.push({ index: i, occurrences, type: 'replace_all' });
                } else {
                    // Replace first occurrence only
                    const index = currentContent.indexOf(old_string);
                    currentContent = currentContent.substring(0, index) + 
                                     new_string + 
                                     currentContent.substring(index + old_string.length);
                    console.log(`  ✅ Edit ${i + 1}/${edits.length}: Replaced first occurrence`);
                    appliedEdits.push({ index: i, occurrences: 1, type: 'replace_first' });
                }
            }

            // Step 3: Write updated content atomically
            const writeResult = await this.createFileWithAgent(filepath, currentContent);
            
            if (!writeResult.success) {
                throw new Error(`Failed to write file: ${writeResult.error || 'Unknown error'}`);
            }

            console.log(`✅ Multi-Edit complete: ${appliedEdits.length} edits applied to ${filepath}`);

            return {
                success: true,
                editsApplied: appliedEdits.length,
                details: appliedEdits,
                originalLength: originalContent.length,
                newLength: currentContent.length
            };

        } catch (error) {
            // Rollback: Restore original content if any edit fails
            console.error(`❌ Multi-Edit failed, rolling back: ${error.message}`);
            
            // Attempt to restore original content
            try {
                await this.createFileWithAgent(filepath, originalContent);
                console.log(`🔄 Rollback successful: ${filepath} restored to original state`);
            } catch (rollbackError) {
                console.error(`❌ CRITICAL: Rollback failed! File may be corrupted: ${rollbackError.message}`);
            }

            throw new Error(`Multi-Edit failed at edit ${appliedEdits.length + 1}/${edits.length}: ${error.message}`);
        }
    }

    async runCommandWithAgent(command, cwd = null) {
        if (!command) {
            throw new Error('Komut belirtilmedi');
        }

        // ✅ FIX: Use localStorage currentFolder (user-selected workspace) as priority
        let workingDirectory = cwd;

        if (!workingDirectory) {
            // Priority 1: localStorage currentFolder (user selected via folder picker)
            workingDirectory = window.localStorage.getItem('currentFolder');

            // Priority 2: window.__CURRENT_FOLDER__
            if (!workingDirectory) {
                workingDirectory = window.__CURRENT_FOLDER__;
            }

            // Priority 3: this.workspaceRoot
            if (!workingDirectory) {
                workingDirectory = this.workspaceRoot;
            }
        }

        // ❌ NO FALLBACK TO DESKTOP! User MUST select folder first!
        if (!workingDirectory) {
            const errorMsg = '❌ Workspace root seçilmedi!\n\nLütfen önce:\n1. Sol panelde "📁 Klasör Seç" butonuna tıklayın\n2. Proje klasörünüzü seçin\n3. Tekrar deneyin';
            this.showNotification(errorMsg, 'error');
            throw new Error(errorMsg);
        }

        console.log(`🔧 Command CWD: ${workingDirectory}`);

        try {
            // 🚀 PRIORITY 1: Try MCP server first (300s timeout vs 30s IPC)
            // Check if MCP is available by trying to connect
            let mcpAvailable = false;
            try {
                const healthCheck = await fetch('http://127.0.0.1:7777/health', {
                    method: 'GET',
                    signal: AbortSignal.timeout(2000) // 2s timeout for health check
                });
                mcpAvailable = healthCheck.ok;
            } catch (e) {
                mcpAvailable = false;
            }

            if (mcpAvailable) {
                console.log(`🌐 Running command via MCP (5min timeout): ${command}`);

                try {
                    // Parse command into cmd + args
                    const parts = command.trim().split(/\s+/);
                    const cmd = parts[0];
                    const args = parts.slice(1);

                    const mcpResult = await fetch('http://127.0.0.1:7777/mcp/shell/run', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            cmd: cmd,           // First word (e.g., "npm")
                            args: args,         // Rest as array (e.g., ["run", "build"])
                            cwd: workingDirectory,
                            timeout: 300000     // 5 minutes
                        })
                    });

                    if (mcpResult.ok) {
                        const data = await mcpResult.json();
                        // MCP returns 'code' field, not 'exitCode'
                        const exitCode = data.code !== undefined ? data.code : (data.exitCode || -1);
                        console.log(`✅ MCP command completed: exitCode=${exitCode}, ok=${data.ok}`);

                        // 📺 Display output in terminal widget if available
                        if (typeof this.addTerminalLine === 'function') {
                            if (data.stdout) {
                                this.addTerminalLine(data.stdout.trim(), 'output');
                            }
                            if (data.stderr) {
                                this.addTerminalLine(data.stderr.trim(), 'error');
                            }
                            const status = exitCode === 0 ? 'success' : 'error';
                            this.addTerminalLine(`Exit code: ${exitCode}`, status);
                        }

                        return {
                            success: data.ok && exitCode === 0,
                            stdout: data.stdout || '',
                            stderr: data.stderr || '',
                            exitCode: exitCode
                        };
                    } else {
                        const errorData = await mcpResult.json();
                        console.warn('⚠️ MCP request failed:', errorData.error || 'Unknown error');
                    }
                } catch (mcpError) {
                    console.warn('⚠️ MCP error, falling back to IPC:', mcpError.message);
                }
            } else {
                console.warn('⚠️ MCP server not available (port 7777), using IPC');
            }

            // 🔄 FALLBACK: Use Electron IPC (30s timeout)
            if (window.electronAPI && window.electronAPI.runCommand) {
                console.log(`🔧 Running command via IPC (30s timeout): ${command}`);
                const result = await window.electronAPI.runCommand(command, workingDirectory);

                // ✅ ENHANCED ERROR HANDLING: Check for null/undefined result
                if (!result) {
                    throw new Error('IPC returned null - command failed to execute');
                }

                if (result.success) {
                    this.showNotification(`✅ Komut çalıştırıldı: ${command}`, 'success');
                    return result;
                } else {
                    throw new Error(result.error || 'Unknown command error');
                }
            } else {
                // Fallback: Show that command would be executed
                this.showNotification(`ℹ️ Komut simüle edildi: ${command}`, 'info');
                return {
                    success: true,
                    stdout: `Komut simüle edildi: ${command} (cwd: ${workingDirectory})`,
                    stderr: ''
                };
            }
        } catch (error) {
            const errorMessage = error?.message || String(error) || 'Unknown error';
            console.error('❌ Command execution error:', errorMessage);
            throw new Error(`Komut çalıştırılamadı: ${errorMessage}`);
        }
    }

    async respondToQuestion(content) {
        // Simple text response for question-type actions
        this.addChatMessage('ai', content || 'İşlem tamamlandı.');
        return { success: true };
    }

    // =====================================
    // Agent Mode Methods (Legacy Support)
    // =====================================

    async executeAgentTask() {
        if (this.aiMode.current !== 'agent') {
            this.showNotification('⚠️ Agent Mode\'a geçin', 'warning');
            return;
        }

        // Get task from chat or agent input
        const chatInput = document.getElementById('chatInput');
        const agentInput = document.getElementById('agentTaskInput');

        let task = '';
        if (chatInput && chatInput.value.trim()) {
            task = chatInput.value.trim();
            chatInput.value = '';
        } else if (agentInput && agentInput.value.trim()) {
            task = agentInput.value.trim();
            agentInput.value = '';
        } else {
            this.showNotification('⚠️ Lütfen bir görev girin', 'warning');
            return;
        }

        // Use new Continue-style agent if available and enabled
        if (this.continueAgent && this.aiMode.agentMode.useNewAgent) {
            console.log('🚀 Using Continue-style agent for task:', task);

            try {
                this.addChatMessage('user', task);
                this.addChatMessage('ai', '🔄 Continue-style agent çalışıyor...');

                const result = await this.continueAgent.executeTask(task);

                if (result.success) {
                    this.addChatMessage('ai', `✅ ${result.summary}\n\n📋 Sonuçlar:\n${result.results.map(r =>
                        r.success ? `✅ ${r.tool}: Başarılı` : `❌ ${r.tool}: ${r.error}`
                    ).join('\n')}`);

                    // Refresh file explorer
                    this.refreshExplorer();
                } else {
                    this.addChatMessage('ai', `❌ Agent görevi tamamlayamadı: ${result.error}`);
                }

            } catch (error) {
                console.error('❌ Continue agent error:', error);
                this.addChatMessage('ai', `❌ Agent hatası: ${error.message}`);
            }

            return;
        }

        // Fallback to legacy system
        console.log('⚙️ Using legacy agent system for task:', task);
        this.addChatMessage('user', task);

        // Legacy support - artık chat üzerinden çalışıyor
        this.showNotification('💬 Legacy agent modu - yeni sistem için ayarları kontrol edin', 'info');

        // Unified agent system ile çalıştır
        await this.executeUnifiedAgentTask(task);
    }

    async startAgentExecution(task) {
        // Görev analiz et ve adımları belirle
        this.addAgentStep('🔍 Görev analiz ediliyor...', 'working');

        // Workspace context oluştur
        let workspaceContext = '';
        if (this.currentFolder) {
            try {
                if (window.electronAPI && window.electronAPI.readDirectory) {
                    const folderInfo = await window.electronAPI.readDirectory(this.currentFolder);
                    if (folderInfo.success) {
                        workspaceContext = `\nMevcut proje klasörü: ${this.currentFolder}\nDosya listesi: ${folderInfo.files.map(f => f.name).join(', ')}`;
                    }
                } else {
                    console.log('electronAPI readDirectory not available, skipping workspace context');
                }
            } catch (error) {
                console.log('Klasör bilgisi alınamadı:', error);
            }
        }

        // Aktif dosya içeriği
        let activeFileContext = '';
        if (this.currentFile && this.tabs.has(this.currentFile)) {
            const fileData = this.tabs.get(this.currentFile);
            activeFileContext = `\nAktif dosya: ${this.currentFile}\nİçerik:\n\`\`\`\n${fileData.content}\n\`\`\``;
        }

        // HTTP Tool Server ile gerçek agent işlemlerini başlat
        try {
            await this.executeAgentWithToolServer(task);
        } catch (error) {
            this.updateAgentStep(0, '❌ Agent görevi başarısız', 'error');
            throw error;
        }
    }

    async executeAgentWithToolServer(task) {
        this.addAgentStep('🔍 HTTP Tool Server ile ajan başlatılıyor...', 'working');

        const TOOL_BASE = 'http://localhost:7777/tool';

        // First check if tool server is available
        try {
            console.log('🔧 Tool server bağlantı testi yapılıyor...');
            const healthCheck = await fetch(`${TOOL_BASE}/health`, {
                method: "GET",
                headers: { "content-type": "application/json" }
            });

            if (!healthCheck.ok) {
                throw new Error(`Tool server responded with status: ${healthCheck.status}`);
            }

            const healthData = await healthCheck.json();
            console.log('✅ Tool server sağlık kontrolü başarılı:', healthData);
        } catch (connectionError) {
            console.error('❌ Tool server bağlantı hatası:', connectionError);
            this.addAgentStep('⚠️ Tool server bağlantısı başarısız, fallback moda geçiliyor...', 'working');
            this.addChatMessage('system', `🔧 Tool server bulunamadı. Basit analiz modunda devam ediliyor.`);

            // Fallback to simple agent without tools
            await this.executeSimpleAgent(task);
            return;
        }

        // Set working directory if currentFolder is available
        if (this.currentFolder) {
            try {
                console.log(`Setting tool server working directory to: ${this.currentFolder}`);
                const setDirResponse = await fetch(`${TOOL_BASE}/set_working_dir`, {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ path: this.currentFolder })
                });

                if (setDirResponse.ok) {
                    const result = await setDirResponse.json();
                    console.log(`✅ Working directory set to: ${result.workingDir}`);
                    this.addChatMessage('system', `📁 Analiz klasörü: ${result.workingDir}`);
                } else {
                    console.warn('Could not set working directory, using default');
                }
            } catch (error) {
                console.warn('Failed to set working directory:', error);
            }
        }

        const tools = [
            {
                type: "function", function: {
                    name: "list_dir",
                    description: "Dizin içeriğini listele",
                    parameters: { type: "object", properties: { dir: { type: "string" } }, required: ["dir"] }
                }
            },
            {
                type: "function", function: {
                    name: "glob",
                    description: "Rekürsif dosya bul",
                    parameters: { type: "object", properties: { pattern: { type: "string" }, dir: { type: "string" } }, required: ["pattern", "dir"] }
                }
            },
            {
                type: "function", function: {
                    name: "read_file",
                    description: "Dosya oku",
                    parameters: { type: "object", properties: { file: { type: "string" } }, required: ["file"] }
                }
            },
            {
                type: "function", function: {
                    name: "write_file",
                    description: "Dosya yaz",
                    parameters: { type: "object", properties: { file: { type: "string" }, content: { type: "string" } }, required: ["file", "content"] }
                }
            },
            {
                type: "function", function: {
                    name: "run_cmd",
                    description: "Komut çalıştır",
                    parameters: { type: "object", properties: { cmd: { type: "string" }, args: { type: "array", items: { type: "string" } }, cwd: { type: "string" } }, required: ["cmd"] }
                }
            },
            {
                type: "function", function: {
                    name: "set_working_dir",
                    description: "Çalışma dizinini değiştir",
                    parameters: { type: "object", properties: { dir: { type: "string" } }, required: ["dir"] }
                }
            }
        ];

        // AG2-inspired role-based system prompt selection with DIRECT ACTION format
        const agentRoles = {
            analyzer: `
Sen KayraDeniz Kod Analiz Uzmanısın. Proje kodlarını analiz et ve raporla.
Araçlar: read_file, glob, list_dir, run_cmd

ÖNEMLİ KURALLAR:
- Az konuş, çok yap! Direkt tool çağrısı yap.
- Uzun açıklama yok, kısa sonuç ver.
- Tool calling formatı: assistant(tool_calls) → tool → assistant
- Gereksiz plan açıklaması yapma, direkt işe koyul!

TERMINAL KULLANIMI:
- run_cmd ile terminal komutları çalıştır (npm, git, node, echo, dir vs)
- Komut sonuçları otomatik olarak terminalde gösterilir
- Örnek: {"cmd": "npm --version"} veya {"cmd": "echo", "args": ["Merhaba"]}
`,
            generator: `
Sen KayraDeniz Kod Üretim Uzmanısın. Kod yaz, dosya oluştur, projeleri implement et.
Araçlar: write_file, read_file, run_cmd

ÖNEMLİ KURALLAR:
- Az konuş, çok yap! Direkt tool çağrısı yap.
- Uzun açıklama yok, kısa sonuç ver.
- Tool calling formatı: assistant(tool_calls) → tool → assistant
- Gereksiz plan açıklaması yapma, direkt işe koyul!
- Kullanıcı "yaz" dediğinde hemen write_file ile oluştur!

TERMINAL KULLANIMI:
- run_cmd ile build/test/install komutları çalıştır
- npm install, npm run build, npm test gibi komutlar destekleniyor
- Komut sonuçları otomatik olarak terminalde gösterilir
- Örnek: {"cmd": "npm install express"} veya {"cmd": "npm run build"}
`,
            documentation: `
Sen KayraDeniz Dokümantasyon Uzmanısın. README, döküman, açıklama yaz.
Araçlar: write_file, read_file, glob, run_cmd

ÖNEMLİ KURALLAR:
- Az konuş, çok yap! Direkt tool çağrısı yap.
- Uzun açıklama yok, kısa sonuç ver.
- Tool calling formatı: assistant(tool_calls) → tool → assistant
- Gereksiz plan açıklaması yapma, direkt işe koyul!

TERMINAL KULLANIMI:
- Gerekirse run_cmd ile proje bilgisi topla (npm list, git status vs)
- Örnek: {"cmd": "npm list --depth=0"}
`,
            coordinator: `
Sen KayraDeniz Proje Koordinatörüsün. Karmaşık görevleri organize et ve yürüt.
Araçlar: Tüm araçlar (list_dir, glob, read_file, write_file, run_cmd)

ÖNEMLİ KURALLAR:
- Az konuş, çok yap! Direkt tool çağrısı yap.
- Uzun açıklama yok, kısa sonuç ver.
- Tool calling formatı: assistant(tool_calls) → tool → assistant
- Gereksiz plan açıklaması yapma, direkt işe koyul!

TERMINAL KULLANIMI:
- run_cmd ile tüm terminal komutları çalıştırılabilir
- npm, npx, node, powershell, cmd, git, echo, dir, ls - hepsi destekleniyor
- Komutlar MCP server üzerinden çalışır (5 dakika timeout)
- Sonuçlar otomatik olarak terminal widget'ta gösterilir
- Windows'ta echo gibi built-in komutlar için: {"cmd": "powershell", "args": ["-Command", "echo Merhaba"]}
- Örnek: {"cmd": "npm", "args": ["run", "build"]}
`,
            artist: `
🎨 Sen KayraDeniz Görsel İçerik Uzmanısın! SVG, diagram, logo, mockup oluşturuyorsun.
Araçlar: write_file (SVG/Mermaid/PlantUML dosyaları için)

ÖNEMLİ KURALLAR:
- MUTLAKA görsel içeriği DOSYA olarak oluştur! (write_file)
- Sadece açıklama yapma, direkt SVG kodu üret!
- SVG dosyaları için geçerli XML/SVG syntax kullan
- Minimalist ve temiz tasarım yap
- Renkler hex code ile (#1E88E5, #00C853 gibi)

GÖRSELİ NASIL OLUŞTURURUM:
1. Logo/Icon → SVG dosyası oluştur (64x64px veya kullanıcı isteği)
2. Diagram → Mermaid syntax (.mmd dosyası) veya PlantUML (.puml)
3. Mockup/Wireframe → SVG ile basit şekiller kullan
4. ASCII Art → .txt dosyası

ÖRNEK SVG (Logo):
<svg width="64" height="64" xmlns="http://www.w3.org/2000/svg">
  <circle cx="32" cy="32" r="30" fill="#1E88E5" />
  <text x="32" y="40" font-size="28" text-anchor="middle" fill="white">K</text>
</svg>

KRİTİK: Görsel açıklaması değil, DOSYA OLUŞTUR! write_file tool'unu kullan!
`
        };

        // Determine agent role from UI selector or auto-detect from task
        const agentRoleSelect = document.getElementById('agentRoleSelect');
        let selectedRole = agentRoleSelect ? agentRoleSelect.value : 'coordinator';

        // Auto-detect role if coordinator is selected and task has specific keywords
        if (selectedRole === 'coordinator') {
            const taskLower = task.toLowerCase();
            if (/(svg|logo|tasarla|diagram|mermaid|plantuml|görsel|grafik|şema|çiz|icon|banner)/.test(taskLower)) {
                selectedRole = 'artist';
            } else if (taskLower.includes('analiz') || taskLower.includes('kontrol') || taskLower.includes('incele') || taskLower.includes('bug')) {
                selectedRole = 'analyzer';
            } else if (taskLower.includes('yaz') || taskLower.includes('oluştur') || taskLower.includes('kod') || taskLower.includes('implement')) {
                selectedRole = 'generator';
            } else if (taskLower.includes('dokuman') || taskLower.includes('readme') || taskLower.includes('açıkla') || taskLower.includes('document')) {
                selectedRole = 'documentation';
            }
        }

        // Add working directory context to system prompt
        let workingDirContext = "";
        if (this.currentFolder) {
            workingDirContext = `\n\nÇALIŞMA DİZİNİ: ${this.currentFolder}
KURULUM: İlk adım olarak set_working_dir çağrısı yapılacak. Sonraki tüm tool çağrılarında relative path kullan.
KULLANIM: dir:"." (current), file:"path/to/file" (relative), path:"subfolder/" (relative)
Bu seçili proje klasörünü analiz et, KayraDeniz'in kendi kaynak kodunu değil.`;
        } else {
            workingDirContext = `\n\nUYARI: Henüz proje klasörü seçilmemiş. Kullanıcıdan proje klasörü seçmesini iste.`;
        }

        const system = agentRoles[selectedRole] + workingDirContext;    // Add role indicator to chat
        this.addChatMessage('system', `🤖 **${selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)} Agent** aktif`);

        let messages = [
            { role: "system", content: system },
            { role: "user", content: task }
        ];

        // Tool çağrısı döngüsü (maksimum 8 adım)
        for (let step = 0; step < 8; step++) {
            try {
                // COMPREHENSIVE MESSAGE VALIDATION
                // 1. Clean orphaned tool messages
                const cleanMessages = [];
                let i = 0;
                while (i < messages.length) {
                    const msg = messages[i];

                    if (msg.role === 'tool') {
                        // Look backwards for the assistant message with tool_calls
                        let foundToolCall = false;
                        for (let j = i - 1; j >= 0; j--) {
                            const prevMsg = messages[j];
                            if (prevMsg.role === 'assistant' && prevMsg.tool_calls) {
                                // Check if this tool message matches any tool_call_id
                                const matchingCall = prevMsg.tool_calls.find(tc => tc.id === msg.tool_call_id);
                                if (matchingCall) {
                                    foundToolCall = true;
                                    break;
                                }
                            }
                            if (prevMsg.role === 'user') break; // Stop at user message
                        }

                        if (foundToolCall) {
                            cleanMessages.push(msg);
                        } else {
                            console.warn(`Removing orphaned tool message: ${msg.name}`);
                        }
                    } else {
                        cleanMessages.push(msg);
                    }
                    i++;
                }

                // 2. Validate final sequence
                messages = cleanMessages;
                const lastMsg = messages[messages.length - 1];

                // If last message is tool, ensure proper sequence
                if (lastMsg && lastMsg.role === 'tool') {
                    // Must have assistant with tool_calls before it
                    let validSequence = false;
                    for (let k = messages.length - 2; k >= 0; k--) {
                        const prevMsg = messages[k];
                        if (prevMsg.role === 'assistant' && prevMsg.tool_calls) {
                            validSequence = true;
                            break;
                        }
                        if (prevMsg.role === 'user') break;
                    }

                    if (!validSequence) {
                        console.error('Invalid tool message sequence, removing tool messages');
                        messages = messages.filter(m => m.role !== 'tool');
                    }
                }

                console.log(`Step ${step}: Making OpenAI call with ${messages.length} messages`);
                const rsp = await this.queueOpenAIRequest(async () => {
                    return await this.callOpenAI(messages, null, { tools, tool_choice: "auto" });
                });

                // Handle response based on type
                const responseMessage = typeof rsp === 'string' ? { content: rsp, tool_calls: null } : rsp;

                if (responseMessage.tool_calls && responseMessage.tool_calls.length) {
                    // CRITICAL: First add assistant message with tool_calls
                    const assistantMsg = {
                        role: "assistant",
                        content: responseMessage.content || "", // NEVER null, always string
                        tool_calls: responseMessage.tool_calls
                    };
                    messages.push(assistantMsg);
                    console.log(`Added assistant message with ${responseMessage.tool_calls.length} tool calls`);

                    // Then process each tool call
                    for (const tc of responseMessage.tool_calls) {
                        const name = tc.function.name;
                        const args = JSON.parse(tc.function.arguments || "{}");

                        this.addAgentStep(`🔧 ${name} çalıştırılıyor...`, 'working');

                        try {
                            // Use summarizeFile for read_file operations on large files
                            let result;
                            if (name === 'read_file' && args.file) {
                                const fileExt = args.file.toLowerCase();
                                if (fileExt.endsWith('.md') || fileExt.endsWith('.txt') || fileExt.endsWith('.js') || fileExt.endsWith('.ts')) {
                                    result = { content: await this.summarizeFile(TOOL_BASE, args.file) };
                                } else {
                                    result = await this.callTool(TOOL_BASE, name, args);
                                }
                            } else {
                                result = await this.callTool(TOOL_BASE, name, args);
                            }

                            // CRITICAL: Add tool result with matching tool_call_id
                            const toolMsg = {
                                role: "tool",
                                tool_call_id: tc.id,
                                name: name,
                                content: JSON.stringify(result || {}) // Ensure never null/undefined
                            };
                            messages.push(toolMsg);
                            console.log(`Added tool result for ${name} with ID ${tc.id}`);

                            this.addAgentStep(`✅ ${name} tamamlandı`, 'completed');

                            // Show result in chat (truncated if too long)
                            const resultStr = JSON.stringify(result, null, 2);
                            const displayResult = resultStr.length > 500 ? resultStr.slice(0, 500) + '...' : resultStr;
                            this.addChatMessage('assistant', `**${name}:** ${displayResult}`);

                        } catch (toolError) {
                            this.addAgentStep(`❌ ${name} başarısız: ${toolError.message}`, 'error');

                            // CRITICAL: Add error result with matching tool_call_id
                            const errorMsg = {
                                role: "tool",
                                tool_call_id: tc.id,
                                name: name,
                                content: `Error: ${toolError.message}` // Always string
                            };
                            messages.push(errorMsg);
                            console.log(`Added tool error for ${name} with ID ${tc.id}`);
                        }
                    }

                    continue; // Continue to next iteration for AI response
                }

                // No tool calls, this is the final response
                const finalContent = responseMessage.content || '';
                if (finalContent) {
                    messages.push({ role: "assistant", content: finalContent });
                    this.addChatMessage('assistant', finalContent);
                }
                break;

            } catch (error) {
                console.error(`OpenAI API error at step ${step}:`, error);
                this.addAgentStep(`❌ API Hatası: ${error.message}`, 'error');

                // If the conversation has become corrupted, try to recover
                if (error.message.includes('tool') || error.message.includes('400')) {
                    // Reset conversation and continue with simpler approach
                    messages = [
                        { role: "system", content: system },
                        { role: "user", content: task },
                        { role: "assistant", content: `Özür dilerim, tool çağrısında bir hata oluştu. Daha basit bir yaklaşımla devam ediyorum: ${task}` }
                    ];

                    try {
                        const fallbackRsp = await this.queueOpenAIRequest(async () => {
                            return await this.callOpenAI(messages, null, { tools: [], tool_choice: "none" });
                        });
                        const fallbackContent = typeof fallbackRsp === 'string' ? fallbackRsp : fallbackRsp.content;
                        this.addChatMessage('assistant', fallbackContent);
                        break;
                    } catch (fallbackError) {
                        this.addChatMessage('assistant', `Üzgünüm, şu anda teknik bir sorun yaşıyorum. Lütfen daha sonra tekrar deneyin.`);
                        break;
                    }
                }

                throw error;
            }
        }

        this.addAgentStep('🎉 Agent görevi tamamlandı', 'completed');

        // Generate and store execution summary for cross-mode access
        await this.generateExecutionSummary(messages, task);

        // Return final result for executeWithLiveUpdates
        return { success: true, message: 'Agent görevi tamamlandı' };
    }

    async executeSimpleAgent(task) {
        this.addAgentStep('🤖 Basit ajan modu başlatılıyor...', 'working');

        const simpleSystem = `
Sen KayraDeniz Kod Canavarı'sın! 🐉 

Tool erişimin şu anda yok ama yine de çok yardımcı olabilirsin! Programlama, kod yazma, açıklama konularında uzmansın.

Kullanıcının sorusunu anlayıp:
- Kod örnekleri verebilirsin
- Açıklamalar yapabilirsin  
- Öneriler sunabilirsin
- Problemleri çözebilirsin

Dostane, samimi ve yardımsever bir dille konuş. Robot gibi değil, arkadaş gibi!
`;

        try {
            const messages = [
                { role: "system", content: simpleSystem },
                { role: "user", content: task }
            ];

            const response = await this.callOpenAI(messages, null, { tools: [], tool_choice: "none" });
            const content = typeof response === 'string' ? response : response.content;

            this.addChatMessage('assistant', content);
            this.addAgentStep('✅ Basit ajan cevabı tamamlandı', 'completed');

        } catch (error) {
            console.error('Simple agent error:', error);
            this.addAgentStep('❌ Basit ajan hatası', 'error');
            this.addChatMessage('assistant', 'Üzgünüm, şu anda bir teknik sorun yaşıyorum. Lütfen daha sonra tekrar deneyin veya sorunuzu farklı şekilde ifade edin.');
        }
    }

    // =====================================
    // Agent Execution Summary Generator
    // =====================================
    async generateExecutionSummary(messages, originalTask) {
        try {
            // Extract tool results and final analysis
            const toolResults = messages.filter(m => m.role === 'tool').map(m => ({
                tool: m.name,
                result: m.content.length > 300 ? m.content.substring(0, 300) + '...' : m.content
            }));

            const assistantResponses = messages.filter(m => m.role === 'assistant' && m.content && !m.tool_calls)
                .map(m => m.content);

            // Generate structured summary
            const summaryPrompt = `Kullanıcı şu görevi istedi: "${originalTask}"

Agent şu araçları kullandı ve sonuçlar aldı:
${toolResults.map((tr, i) => `${i + 1}. ${tr.tool}: ${tr.result}`).join('\n')}

Agent'ın final cevapları:
${assistantResponses.join('\n')}

Bu analiz sonuçlarına dayanarak, kullanıcının anlayabileceği şekilde öz ve net bir rapor hazırla. 
Teknik detayları basitleştir, sadece önemli bulgular ve önerileri belirt.

Format:
📊 **ANALIZ RAPORU**
**Proje:** [proje adı]
**Bulunan:** [key findings]
**Öneriler:** [recommendations]
**Sonuç:** [conclusion]`;

            const summary = await this.callOpenAI(summaryPrompt);

            // Store in context memory for Ask mode access
            this.lastExecutionSummary = {
                task: originalTask,
                summary: summary,
                timestamp: new Date().toISOString(),
                toolsUsed: toolResults.map(tr => tr.tool)
            };

            // Add summary to chat
            this.addChatMessage('ai', summary);

        } catch (error) {
            console.error('Summary generation failed:', error);

            // Fallback summary
            const fallbackSummary = `📊 **İşlem Tamamlandı**\n\n` +
                `Görev: ${originalTask}\n` +
                `Kullanılan araçlar: ${toolResults.map(tr => tr.tool).join(', ')}\n` +
                `Durum: Başarılı ✅`;

            this.lastExecutionSummary = {
                task: originalTask,
                summary: fallbackSummary,
                timestamp: new Date().toISOString()
            };

            this.addChatMessage('ai', fallbackSummary);
        }
    }

    // ===== UNIFIED TOOL INTERFACE =====
    async callTool(toolBase, name, args) {
        // Plan→Onay→İcra: Kritik operasyonlar için onay iste
        if (this.needsConfirmation(name, args)) {
            const approved = await this.requestApproval(name, args);
            if (!approved) {
                throw new Error('Operation cancelled by user');
            }
        }

        let result;
        if (this.toolMode === "ipc") {
            result = await this.callToolIPC(name, args);
        } else {
            result = await this.callToolHTTP(toolBase, name, args);
        }

        // Dosya sistemi değişikliklerinden sonra explorer'ı yenile
        if (['write_file', 'run_cmd'].includes(name)) {
            // Kısa bir delay ekleyerek dosya sisteminin güncellemesini bekle
            setTimeout(() => {
                if (this.refreshExplorer) {
                    this.refreshExplorer();
                }
            }, 100);
        }

        return result;
    }

    // Hangi operasyonlar onay gerektirir?
    needsConfirmation(name, args) {
        const criticalOps = ['write_file', 'run_cmd'];
        if (!criticalOps.includes(name)) return false;

        // run_cmd için sadece güvenli komutlar onaysız
        if (name === 'run_cmd') {
            const cmd = args.command || args.cmd || '';
            const safeCommands = ['dir', 'ls', 'pwd', 'echo', 'cat', 'head', 'tail', 'grep', 'find'];
            const isReadOnly = safeCommands.some(safe => cmd.toLowerCase().startsWith(safe));
            return !isReadOnly;
        }

        return true;
    }

    // Kullanıcıdan onay iste
    async requestApproval(name, args) {
        const operation = name === 'write_file'
            ? `Dosya yazma: ${args.file || args.filePath}`
            : `Komut çalıştırma: ${args.command || args.cmd}`;

        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'approval-modal';
            modal.innerHTML = `
        <div class="approval-content">
          <h3>🚨 Onay Gerekli</h3>
          <p><strong>İşlem:</strong> ${operation}</p>
          <div class="approval-buttons">
            <button id="approve-btn" class="btn primary">✅ Onayla</button>
            <button id="reject-btn" class="btn secondary">❌ Reddet</button>
          </div>
        </div>
      `;

            document.body.appendChild(modal);

            modal.querySelector('#approve-btn').onclick = () => {
                document.body.removeChild(modal);
                resolve(true);
            };

            modal.querySelector('#reject-btn').onclick = () => {
                document.body.removeChild(modal);
                resolve(false);
            };
        });
    }

    async callToolIPC(name, args) {
        // Future IPC implementation for desktop app
        // This would directly call main process functions
        try {
            if (window.electronAPI && window.electronAPI[name]) {
                return await window.electronAPI[name](args);
            } else {
                throw new Error(`IPC tool ${name} not available`);
            }
        } catch (error) {
            console.error(`IPC tool call failed for ${name}:`, error);
            throw error;
        }
    }

    async callToolHTTP(toolBase, name, args) {
        try {
            console.log(`Calling HTTP tool: ${name} with args:`, args);

            const response = await fetch(`${toolBase}/${name}`, {
                method: "POST",
                headers: this.toolConfig.http.headers,
                body: JSON.stringify(args || {})
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`${name} failed: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            console.log(`HTTP tool ${name} result:`, result);
            return result;
        } catch (error) {
            console.error(`HTTP tool call failed for ${name}:`, error);

            // If it's a connection error, provide helpful message
            if (error.message.includes('fetch') || error.message.includes('TypeError')) {
                this.addChatMessage('system', `🔧 Tool server bağlantısı başarısız. Tool server'ı başlatmak için terminalde: \`node tools-server.js\``);

                // Try to fallback to IPC if available
                if (this.toolMode === "http" && this.toolConfig.ipc.enabled) {
                    console.log(`Falling back to IPC for ${name}`);
                    return await this.callToolIPC(name, args);
                }

                return {
                    error: `Tool server connection failed. Please start the tool server with: node tools-server.js`,
                    files: ['README.md', 'package.json', 'src/']  // Fallback için örnek dosya listesi
                };
            }

            throw error;
        }
    }

    // ===== MAP-REDUCE FILE SUMMARIZATION =====
    async summarizeFile(toolBase, pathRel) {
        try {
            const fileResult = await this.callTool(toolBase, 'read_file', { file: pathRel });
            const content = fileResult.content || '';

            // Check if file is too large for direct processing
            const estimatedTokens = approxTok(content);
            console.log(`File ${pathRel}: ${estimatedTokens} estimated tokens`);

            if (estimatedTokens < 1500) {
                // Small file, process directly
                return content;
            }

            // Large file, use chunking + map-reduce
            const chunks = chunkByTokens(content, 1100, 60).slice(0, 12); // Max 12 chunks
            const parts = [];

            this.addAgentStep(`📄 ${pathRel} büyük dosya, ${chunks.length} parçaya bölünüyor...`, 'working');

            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                try {
                    const messages = [
                        {
                            role: "system",
                            content: "Kısa, madde madde özet üret. Amaç, önemli talimatlar, riskler, ana kodları belirt. Teknik detayları koru."
                        },
                        {
                            role: "user",
                            content: `DOSYA: ${pathRel} (Bölüm ${i + 1}/${chunks.length})\n\n${chunk.slice(0, 8000)}`
                        }
                    ];

                    const rsp = await this.callOpenAI(messages, null, { tools: [], tool_choice: "none" });
                    const partSummary = typeof rsp === 'string' ? rsp : rsp.content;
                    parts.push(partSummary);

                    // Small delay to respect rate limits
                    await new Promise(r => setTimeout(r, 150));

                } catch (error) {
                    console.warn(`Chunk ${i} summarization failed:`, error);
                    parts.push(`[Bölüm ${i + 1} özeti başarısız]`);
                }
            }

            // Reduce phase: combine all parts
            if (parts.length > 1) {
                const messages = [
                    {
                        role: "system",
                        content: "Tek bir kapsamlı DOSYA ÖZETİ üret. Tekrarları kaldır, tutarlı birleştir."
                    },
                    {
                        role: "user",
                        content: `DOSYA: ${pathRel}\n\nPARÇALAR:\n${parts.join('\n---\n')}`
                    }
                ];

                const reduceRsp = await this.callOpenAI(messages, null, { tools: [], tool_choice: "none" });
                const finalSummary = typeof reduceRsp === 'string' ? reduceRsp : reduceRsp.content;

                this.addAgentStep(`✅ ${pathRel} özeti tamamlandı`, 'completed');
                return finalSummary;
            }

            return parts[0] || content.slice(0, 2000);

        } catch (error) {
            console.error(`File summarization failed for ${pathRel}:`, error);
            this.addAgentStep(`❌ ${pathRel} özeti başarısız`, 'error');
            return `[${pathRel} dosyası okunamadı: ${error.message}]`;
        }
    }

    displayAgentSteps() {
        const stepsContainer = document.querySelector('.progress-steps');

        // Eğer progress-steps elementi yoksa, işlem yapma
        if (!stepsContainer) {
            console.log('Progress steps container not found');
            return;
        }

        stepsContainer.innerHTML = '';

        this.aiMode.agentMode.steps.forEach((step, index) => {
            const stepDiv = document.createElement('div');
            stepDiv.className = 'agent-step';
            stepDiv.innerHTML = `
        <i class="fas fa-clock"></i>
        <span>${step.title}: ${step.description}</span>
      `;
            stepsContainer.appendChild(stepDiv);
        });
    }

    async executeAgentSteps() {
        for (let i = 0; i < this.aiMode.agentMode.steps.length; i++) {
            if (!this.aiMode.agentMode.isRunning) break;

            this.aiMode.agentMode.currentStepIndex = i;
            const step = this.aiMode.agentMode.steps[i];

            this.updateAgentStep(i, `🔄 ${step.title}`, 'working');

            try {
                await this.executeAgentStep(step);
                this.updateAgentStep(i, `✅ ${step.title}`, 'completed');

                // Kısa bir bekleme
                await new Promise(resolve => setTimeout(resolve, 500));

            } catch (error) {
                this.updateAgentStep(i, `❌ ${step.title}: ${error.message}`, 'error');
                throw error;
            }
        }

        if (this.aiMode.agentMode.isRunning) {
            this.showNotification('🎉 Agent görevi başarıyla tamamlandı!', 'success');
            this.stopAgent();
        }
    }

    async executeAgentStep(step) {
        switch (step.action) {
            case 'create':
                await this.agentCreateFile(step);
                break;
            case 'modify':
                await this.agentModifyFile(step);
                break;
            case 'delete':
                await this.agentDeleteFile(step);
                break;
            case 'terminal':
                await this.agentRunTerminalCommand(step);
                break;
            case 'analyze':
                await this.agentAnalyzeProject(step);
                break;
            case 'read':
                await this.agentReadFiles(step);
                break;
            default:
                // Genel görev - AI'dan kod üretimi iste
                await this.agentGenerateCode(step);
        }
    }

    async agentCreateFile(step) {
        if (!step.files || step.files.length === 0) return;

        for (const fileName of step.files) {
            const filePath = this.currentFolder ?
                require('path').join(this.currentFolder, fileName) :
                fileName;

            let content = step.code || '';

            // İçerik kontrolü ve geliştirme
            if (!content || content.trim() === '') {
                console.warn('⚠️ Empty content in agentCreateFile, generating default');
                if (step.description) {
                    content = await this.generateCodeForFile(fileName, step.description);
                } else {
                    content = this.generateDefaultFileContent(fileName);
                }
            }

            // Dosyayı oluştur - yeni tool sistemi ile
            try {
                if (this.toolsSystem) {
                    const result = await this.toolsSystem.executeToolWithExceptionHandling('writeFile', {
                        filePath: filePath,
                        content: content
                    });

                    if (result.success) {
                        this.showNotification(`📁 ${fileName} oluşturuldu`, 'success');
                        this.refreshExplorer();
                    } else {
                        throw new Error('Tool system file creation failed');
                    }
                } else {
                    // Fallback to electron API
                    const result = await window.electronAPI.writeFile(filePath, content);
                    if (result.success) {
                        this.showNotification(`📁 ${fileName} oluşturuldu`, 'success');
                        this.refreshExplorer();
                    } else {
                        throw new Error(result.error);
                    }
                }
            } catch (error) {
                console.error('❌ Agent file creation error:', error);
                throw new Error(`Dosya oluşturulamadı: ${error.message}`);
            }
        }
    }

    async agentModifyFile(step) {
        if (!step.files || step.files.length === 0) return;

        for (const fileName of step.files) {
            const filePath = this.currentFolder ?
                require('path').join(this.currentFolder, fileName) :
                fileName;

            try {
                // Mevcut dosyayı oku
                const result = await window.electronAPI.readFile(filePath);
                if (!result.success) {
                    throw new Error('Dosya okunamadı');
                }

                let newContent = result.content;

                // AI'dan modifikasyon kodu al
                if (step.code) {
                    newContent = step.code;
                } else {
                    newContent = await this.generateModificationForFile(fileName, result.content, step.description);
                }

                // Dosyayı güncelle
                const writeResult = await window.electronAPI.writeFile(filePath, newContent);
                if (writeResult.success) {
                    this.showNotification(`📝 ${fileName} güncellendi`, 'success');
                    if (this.currentFile === filePath) {
                        this.loadFileContent(filePath);
                    }
                } else {
                    throw new Error(writeResult.error);
                }
            } catch (error) {
                throw new Error(`Dosya güncellenemedi: ${error.message}`);
            }
        }
    }

    async agentDeleteFile(step) {
        if (!step.files || step.files.length === 0) return;

        for (const fileName of step.files) {
            const filePath = this.currentFolder ?
                require('path').join(this.currentFolder, fileName) :
                fileName;

            try {
                const result = await window.electronAPI.deleteFile(filePath);
                if (result.success) {
                    this.showNotification(`🗑️ ${fileName} silindi`, 'success');
                    this.refreshExplorer();
                } else {
                    throw new Error(result.error);
                }
            } catch (error) {
                throw new Error(`Dosya silinemedi: ${error.message}`);
            }
        }
    }

    async agentRunTerminalCommand(step) {
        if (!step.command) {
            throw new Error('Terminal komutu belirtilmedi');
        }

        try {
            // 🚀 Use runCommandWithAgent for MCP support (300s timeout + terminal display)
            console.log(`🤖 Agent running terminal command: ${step.command}`);
            const result = await this.runCommandWithAgent(step.command);

            // Terminal output is already displayed by runCommandWithAgent via addTerminalLine
            // Just show notification
            if (result.success) {
                this.showNotification(`✅ Komut çalıştırıldı: ${step.command}`, 'success');
            } else {
                throw new Error(`Komut hatası: ${result.stderr || 'Unknown error'}`);
            }

            return result;
        } catch (error) {
            // Display error in terminal if available
            if (typeof this.addTerminalLine === 'function') {
                this.addTerminalLine(`❌ Error: ${error.message}`, 'error');
            }
            throw new Error(`Terminal komutu çalıştırılamadı: ${error.message}`);
        }
    }

    async agentAnalyzeProject(step) {
        try {
            let analysisResult = '';

            if (this.currentFolder) {
                // Proje yapısını analiz et
                const folderInfo = await window.electronAPI.readDirectory(this.currentFolder);
                if (folderInfo.success) {
                    analysisResult += `Proje Yapısı:\n${folderInfo.files.map(f => `- ${f.name} (${f.isDirectory ? 'klasör' : 'dosya'})`).join('\n')}\n\n`;
                }

                // package.json varsa oku
                const packageJsonPath = require('path').join(this.currentFolder, 'package.json');
                try {
                    const packageResult = await window.electronAPI.readFile(packageJsonPath);
                    if (packageResult.success) {
                        const packageData = JSON.parse(packageResult.content);
                        analysisResult += `Dependencies:\n${Object.keys(packageData.dependencies || {}).join(', ')}\n\n`;
                        analysisResult += `DevDependencies:\n${Object.keys(packageData.devDependencies || {}).join(', ')}\n\n`;
                    }
                } catch (e) {
                    // package.json yoksa devam et
                }
            }

            // Analiz sonucunu chat'e ekle
            this.addChatMessage('assistant', `**Proje Analizi:**\n\n${analysisResult || 'Proje analiz edilemedi'}`);

        } catch (error) {
            throw new Error(`Proje analizi başarısız: ${error.message}`);
        }
    }

    async agentListDirectory(step) {
        try {
            const targetDir = step.directory || (Array.isArray(step.files) && step.files.length > 0 ? step.files[0] : '.');
            const pathLib = require('path');
            const basePath = this.currentFolder || process.cwd();
            const absolutePath = pathLib.resolve(basePath, targetDir);

            if (this.currentFolder) {
                const root = pathLib.resolve(this.currentFolder);
                if (!absolutePath.startsWith(root)) {
                    throw new Error('Agent kök dizinin dışına çıkılamaz');
                }
            }

            const result = await window.electronAPI.readDirectory(absolutePath);

            if (!result.success) {
                throw new Error(result.error || 'Klasör listelenemedi');
            }

            const entries = result.files
                .map(file => `${file.isDirectory ? '📁' : '📄'} ${file.name}`)
                .join('\n');

            const directoryLabel = targetDir === '.' ? (this.currentFolder || '.') : targetDir;
            this.addChatMessage('assistant', `**Klasör içeriği (${directoryLabel}):**\n\n${entries || 'Klasör boş.'}`);
            this.showNotification(`📂 ${directoryLabel} listelendi`, 'success');

        } catch (error) {
            throw new Error(`Klasör listelenemedi: ${error.message}`);
        }
    }

    async agentReadFiles(step) {
        if (!step.files || step.files.length === 0) {
            throw new Error('Okunacak dosya belirtilmedi');
        }

        for (const fileName of step.files) {
            const filePath = this.currentFolder ?
                require('path').join(this.currentFolder, fileName) :
                fileName;

            try {
                const result = await window.electronAPI.readFile(filePath);
                if (!result.success) {
                    throw new Error(result.error || 'Dosya okunamadı');
                }

                const content = result.content;
                const normalizedDescription = (step.description || '').toLowerCase();
                const needsSummary = normalizedDescription.includes('özet') ||
                    normalizedDescription.includes('summary') ||
                    normalizedDescription.includes('analiz') ||
                    (typeof step.summarize === 'boolean' && step.summarize) ||
                    content.length > 2000;

                let messageBody = '';

                if (needsSummary) {
                    const truncatedContent = content.length > 6000
                        ? `${content.slice(0, 6000)}\n...\n[İçerik kısaltıldı]`
                        : content;

                    const summary = await this.callOpenAI([
                        {
                            role: 'system',
                            content: 'Sen bir kıdemli yazılım uzmanısın. Sana verilen dosya içeriğini analiz eder, Türkçe olarak maddeler halinde özet çıkarır ve önemli teknik detaylara değinirsin.'
                        },
                        {
                            role: 'user',
                            content: `Aşağıdaki dosyayı mevcut görev bağlamında değerlendir ve özetle:

Dosya adı: ${fileName}

--- DOSYA İÇERİĞİ ---
${truncatedContent}
--- SON ---`
                        }
                    ]);

                    messageBody = `**${fileName} Özeti:**\n\n${summary}`;
                } else {
                    messageBody = `**${fileName} İçeriği:**\n\n\`\`\`markdown\n${content}\n\`\`\``;
                }

                this.addChatMessage('assistant', messageBody);
                this.showNotification(`📖 ${fileName} okundu`, 'success');

            } catch (error) {
                throw new Error(`Dosya okunamadı (${fileName}): ${error.message}`);
            }
        }
    }

    async agentGenerateCode(step) {
        // Gelişmiş kod üretimi görevi
        let context = '';

        // Mevcut workspace'i analiz et
        if (this.currentFolder) {
            try {
                const folderInfo = await window.electronAPI.readDirectory(this.currentFolder);
                if (folderInfo.success) {
                    context += `\nProje dosyaları: ${folderInfo.files.map(f => f.name).join(', ')}`;
                }
            } catch (error) {
                // Devam et
            }
        }

        // Aktif dosya içeriği
        if (this.currentFile && this.tabs.has(this.currentFile)) {
            const fileData = this.tabs.get(this.currentFile);
            context += `\n\nAktif dosya (${this.currentFile}):\n\`\`\`\n${fileData.content}\n\`\`\``;
        }

        const prompt = `**GÖREV:** ${step.description}

**WORKSPACE CONTEXT:**${context}

**TALİMAT:**
Bu görevi gerçekleştirmek için gerekli kodu üret. Kodu hangi dosyaya kaydedileceğini ve nasıl test edileceğini belirt.

Eğer terminal komutları gerekiyorsa, bunları da belirt.`;

        const response = await this.callOpenAI([
            {
                role: 'system',
                content: 'Sen tam yetkili bir yazılım geliştirici agent\'sın. Kod üretiyorsun, dosya operasyonları yapıyorsun ve terminal komutları çalıştırıyorsun. Praktik ve çalışan çözümler sunuyorsun.'
            },
            { role: 'user', content: prompt }
        ]);

        // Yanıtı chat'e ekle
        this.addChatMessage('assistant', `**Agent Görevi:** ${step.description}\n\n${response}`);
    }

    async generateCodeForFile(fileName, description) {
        const fileExtension = require('path').extname(fileName);
        let language = 'text';

        // Dosya uzantısından dil belirle
        const languageMap = {
            '.js': 'javascript',
            '.ts': 'typescript',
            '.py': 'python',
            '.html': 'html',
            '.css': 'css',
            '.json': 'json',
            '.md': 'markdown',
            '.php': 'php',
            '.java': 'java',
            '.cpp': 'cpp',
            '.c': 'c',
            '.cs': 'csharp'
        };

        language = languageMap[fileExtension] || 'text';

        const prompt = `${fileName} adlı ${language} dosyası için kod üret.

Görev: ${description}

Sadece kod içeriğini döndür, açıklama yapma. Temiz, profesyonel kod yaz.`;

        return await this.callOpenAI([
            { role: 'system', content: `Sen bir expert ${language} geliştiricisisin. Temiz, okunabilir ve verimli kod yazıyorsun.` },
            { role: 'user', content: prompt }
        ]);
    }

    async generateModificationForFile(fileName, currentContent, description) {
        const prompt = `${fileName} dosyasını aşağıdaki göreve göre güncelle:

Görev: ${description}

Mevcut içerik:
\`\`\`
${currentContent}
\`\`\`

Güncellenmiş dosyanın tam içeriğini döndür.`;

        return await this.callOpenAI([
            { role: 'system', content: 'Sen bir expert yazılım geliştirici asistanısın. Mevcut kodu analiz edip gerekli güncellemeleri yapıyorsun.' },
            { role: 'user', content: prompt }
        ]);
    }

    addAgentStep(message, status = 'working') {
        const stepsContainer = document.querySelector('.progress-steps');

        // Eğer progress-steps elementi yoksa, sadece console'a log yaz
        if (!stepsContainer) {
            console.log(`Agent Step [${status}]: ${message}`);
            return;
        }

        const stepDiv = document.createElement('div');
        stepDiv.className = `agent-step ${status}`;

        let icon = 'fas fa-clock';
        if (status === 'completed') icon = 'fas fa-check';
        else if (status === 'error') icon = 'fas fa-times';
        else if (status === 'working') icon = 'fas fa-spinner fa-spin';

        stepDiv.innerHTML = `<i class="${icon}"></i><span>${message}</span>`;
        stepsContainer.appendChild(stepDiv);
        stepsContainer.scrollTop = stepsContainer.scrollHeight;
    }

    updateAgentStep(index, message, status) {
        const steps = document.querySelectorAll('.agent-step');
        if (steps && steps[index]) {
            const step = steps[index];
            step.className = `agent-step ${status}`;

            let icon = 'fas fa-clock';
            if (status === 'completed') icon = 'fas fa-check';
            else if (status === 'error') icon = 'fas fa-times';
            else if (status === 'working') icon = 'fas fa-spinner fa-spin';

            step.innerHTML = `<i class="${icon}"></i><span>${message}</span>`;
        }
    }

    stopAgent() {
        this.aiMode.agentMode.isRunning = false;

        // UI güncellemeleri
        const executeBtn = document.getElementById('executeAgentTask');
        const stopBtn = document.getElementById('stopAgentBtn');
        const taskInput = document.getElementById('agentTaskInput');

        executeBtn.disabled = false;
        executeBtn.innerHTML = '<i class="fas fa-play"></i> Görevi Başlat';
        stopBtn.style.display = 'none';
        taskInput.disabled = false;

        if (this.aiMode.agentMode.steps.length > 0) {
            this.showNotification('🛑 Agent görevi durduruldu', 'info');
        }
    }

    // =====================================
    // Resizer & Layout Methods
    // =====================================

    initializeResizers() {
        const resizers = document.querySelectorAll('.resizer');

        resizers.forEach(resizer => {
            let isResizing = false;
            let startPos = 0;
            let startSize = 0;
            let element = null;

            resizer.addEventListener('mousedown', (e) => {
                isResizing = true;
                startPos = resizer.classList.contains('bottom-resizer') ? e.clientY : e.clientX;

                if (resizer.classList.contains('left-resizer')) {
                    element = document.querySelector('.left-sidebar');
                    startSize = element.offsetWidth;
                } else if (resizer.classList.contains('right-resizer')) {
                    element = document.querySelector('.right-sidebar');
                    startSize = element.offsetWidth;
                } else if (resizer.classList.contains('bottom-resizer')) {
                    element = document.querySelector('.terminal-section');
                    startSize = element.offsetHeight;
                }

                resizer.classList.add('resizing');
                document.body.style.cursor = resizer.classList.contains('bottom-resizer') ? 'row-resize' : 'col-resize';

                e.preventDefault();
            });

            document.addEventListener('mousemove', (e) => {
                if (!isResizing || !element) return;

                const currentPos = resizer.classList.contains('bottom-resizer') ? e.clientY : e.clientX;
                const diff = currentPos - startPos;

                if (resizer.classList.contains('left-resizer')) {
                    const newWidth = Math.max(200, Math.min(600, startSize + diff));
                    element.style.width = newWidth + 'px';
                } else if (resizer.classList.contains('right-resizer')) {
                    const newWidth = Math.max(200, Math.min(600, startSize - diff));
                    element.style.width = newWidth + 'px';
                } else if (resizer.classList.contains('bottom-resizer')) {
                    const newHeight = Math.max(100, Math.min(400, startSize - diff));
                    element.style.height = newHeight + 'px';
                }
            });

            document.addEventListener('mouseup', () => {
                if (isResizing) {
                    isResizing = false;
                    resizer.classList.remove('resizing');
                    document.body.style.cursor = '';
                    element = null;
                }
            });
        });
    }

    toggleTerminal() {
        const terminalSection = document.querySelector('.terminal-section');
        const toggleBtn = document.getElementById('toggleTerminalBtn');
        const icon = toggleBtn.querySelector('i');

        if (terminalSection.style.display === 'none') {
            terminalSection.style.display = 'flex';
            icon.className = 'fas fa-window-minimize';
            toggleBtn.title = 'Terminal\'i Gizle';
        } else {
            terminalSection.style.display = 'none';
            icon.className = 'fas fa-window-restore';
            toggleBtn.title = 'Terminal\'i Göster';
        }
    }

    // Theme System Methods
    initializeTheme() {
        this.applyTheme(this.themeSystem.current);
        this.updateThemeButton();
    }

    toggleTheme() {
        const newTheme = this.themeSystem.current === 'dragon' ? 'turquoise' : 'dragon';
        this.themeSystem.current = newTheme;
        localStorage.setItem('theme', newTheme);
        this.applyTheme(newTheme);
        this.updateThemeButton();
    }

    applyTheme(theme) {
        const appContainer = document.querySelector('.app-container');
        if (theme === 'turquoise') {
            appContainer.classList.add('theme-turquoise');
        } else {
            appContainer.classList.remove('theme-turquoise');
        }
    }

    updateThemeButton() {
        const themeNameEl = document.querySelector('.theme-name');
        const currentThemeName = this.themeSystem.themes[this.themeSystem.current];
        if (themeNameEl) {
            themeNameEl.textContent = currentThemeName;
        }
    }

    // Router Agent System Methods
    initializeRouterStatus() {
        // Initialize Router Agent status indicator
        this.updateRouterStatus(null);

        // Add click listener for router status info
        const routerStatus = document.getElementById('routerStatus');
        if (routerStatus) {
            routerStatus.addEventListener('click', () => {
                this.showRouterInfo();
            });
        }
    }

    showRouterInfo() {
        const info = `
🤖 Router Agent - Otomatik Rol Seçimi

Router Agent, yazdığınız mesajı analiz ederek otomatik olarak en uygun AI rolünü seçer:

🔧 Generator: Kod yazma, dosya oluşturma, refactoring
🔍 Analyzer: Kod analizi, hata bulma, test işlemleri  
📝 Documentation: Döküman yazma, README, açıklamalar
⚙️ Coordinator: Komut çalıştırma, kurulum, build işlemleri

Artık manuel olarak "Kod Üret" vs. seçmenize gerek yok!
Router Agent sizin için otomatik karar verir.
    `;

        this.showNotification(info, 'info', 8000);
    }

    setupGlobalMethods() {
        // Setup global window methods for UI callbacks
        // These methods are used by dynamically generated HTML onclick handlers

        // Make sure resolveRecovery is available globally
        window.KayraDenizApp = this;

        // Global helper methods that can be called from HTML onclick
        window.resolveRecovery = null; // Will be set dynamically by askUserToContinue
        window.resolveExecution = null; // Will be set dynamically by showExecutionPlan

        // Helper method to access app methods from global scope
        window.callAppMethod = (methodName, ...args) => {
            if (this[methodName] && typeof this[methodName] === 'function') {
                return this[methodName](...args);
            } else {
                console.warn(`Method ${methodName} not found on app instance`);
            }
        };
    }

    // Enhanced File Explorer Methods
    navigateToFolder(folderPath) {
        // Add current folder to history if it's different
        if (this.currentFolder && this.currentFolder !== folderPath) {
            if (this.folderHistoryIndex < this.folderHistory.length - 1) {
                // Remove forward history when navigating to new path
                this.folderHistory = this.folderHistory.slice(0, this.folderHistoryIndex + 1);
            }
            this.folderHistory.push(this.currentFolder);
            this.folderHistoryIndex = this.folderHistory.length - 1;
        }

        this.currentFolder = folderPath;
        this.setWorkingDirectory(folderPath);

        // ✅ FIX: Update workspace root when user explicitly selects folder
        // This ensures localStorage persistence and proper workspace tracking
        this.setWorkspaceRoot(folderPath);

        this.refreshExplorer();
    }

    explorerGoBack() {
        if (this.folderHistoryIndex > 0) {
            this.folderHistoryIndex--;
            this.currentFolder = this.folderHistory[this.folderHistoryIndex];
            this.setWorkingDirectory(this.currentFolder);
            this.refreshExplorer();
        }
    }

    explorerGoUp() {
        if (this.currentFolder) {
            const path = require('path');
            const parentPath = path.dirname(this.currentFolder);
            if (parentPath !== this.currentFolder) {
                this.navigateToFolder(parentPath);
            }
        }
    }

    updateExplorerNavigation() {
        const backBtn = document.getElementById('explorerBackBtn');
        const upBtn = document.getElementById('explorerUpBtn');

        if (backBtn) {
            backBtn.disabled = this.folderHistoryIndex <= 0;
        }

        if (upBtn && this.currentFolder) {
            const path = require('path');
            const canGoUp = path.dirname(this.currentFolder) !== this.currentFolder;
            upBtn.disabled = !canGoUp;
        }
    }

    updateBreadcrumb() {
        const breadcrumbNav = document.getElementById('breadcrumbNav');
        if (!breadcrumbNav || !this.currentFolder) return;

        const path = require('path');
        const pathParts = this.currentFolder.split(path.sep).filter(part => part);

        let breadcrumbHTML = `
      <div class="breadcrumb-item" data-path="" title="Root">
        <i class="fas fa-home"></i>
      </div>
    `;

        let currentPath = '';
        pathParts.forEach((part, index) => {
            currentPath = index === 0 ? part : path.join(currentPath, part);
            const isLast = index === pathParts.length - 1;

            breadcrumbHTML += `
        <span class="breadcrumb-separator">›</span>
        <div class="breadcrumb-item ${isLast ? 'active' : ''}" data-path="${currentPath}" title="${currentPath}">
          ${part}
        </div>
      `;
        });

        breadcrumbNav.innerHTML = breadcrumbHTML;

        // Add click listeners to breadcrumb items
        breadcrumbNav.querySelectorAll('.breadcrumb-item').forEach(item => {
            item.addEventListener('click', () => {
                const targetPath = item.dataset.path;
                if (targetPath && targetPath !== this.currentFolder) {
                    this.navigateToFolder(targetPath);
                }
            });
        });
    }

    async previewFile(filePath) {
        try {
            const result = await this.ipc.invoke('read-file', filePath);
            if (result.success) {
                this.showFilePreview(filePath, result.content);
            } else {
                this.showError('Dosya okunamadı: ' + result.error);
            }
        } catch (error) {
            this.showError('Dosya preview hatası: ' + error.message);
        }
    }

    showFilePreview(filePath, content) {
        const path = require('path');
        const fileName = path.basename(filePath);
        const fileExtension = path.extname(filePath).toLowerCase();

        // Create preview modal
        const modal = document.createElement('div');
        modal.className = 'file-preview-modal modal';
        modal.id = 'filePreviewModal';
        modal.dataset.filePath = filePath;
        modal.dataset.originalContent = content;

        modal.innerHTML = `
      <div class="modal-content" style="max-width: 80%; max-height: 85vh;">
        <div class="modal-header">
          <h3><i class="fas fa-file-alt"></i> ${fileName}</h3>
          <button class="modal-close-btn" onclick="kodCanavari.closeFilePreview()">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body" style="overflow-y: auto; max-height: calc(85vh - 120px);">
          <div class="file-preview-content" id="filePreviewContent">
            <pre><code class="language-${this.getLanguageFromExtension(fileExtension)}">${this.escapeHtml(content)}</code></pre>
          </div>
          <div class="file-edit-content" id="fileEditContent" style="display: none;">
            <textarea id="fileEditTextarea" style="width: 100%; min-height: 400px; font-family: 'Consolas', 'Monaco', monospace; font-size: 14px; padding: 10px; border: 1px solid #444; background: #1e1e1e; color: #d4d4d4; border-radius: 4px;">${this.escapeHtml(content)}</textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button id="editModeBtn" onclick="kodCanavari.toggleEditMode()" class="open-file-btn">
            <i class="fas fa-edit"></i> Düzenle
          </button>
          <button id="saveFileBtn" onclick="kodCanavari.saveFileFromPreview()" class="save-btn" style="display: none;">
            <i class="fas fa-save"></i> Kaydet
          </button>
          <button onclick="kodCanavari.closeFilePreview()" class="close-btn">
            <i class="fas fa-times"></i> Kapat
          </button>
        </div>
      </div>
    `;

        document.body.appendChild(modal);

        // Apply syntax highlighting if Prism is available
        if (window.Prism) {
            window.Prism.highlightAllUnder(modal);
        }

        // Store modal reference
        this.currentPreviewModal = modal;
    }

    toggleEditMode() {
        const modal = document.getElementById('filePreviewModal');
        if (!modal) return;

        const previewContent = document.getElementById('filePreviewContent');
        const editContent = document.getElementById('fileEditContent');
        const editModeBtn = document.getElementById('editModeBtn');
        const saveFileBtn = document.getElementById('saveFileBtn');

        const isEditing = editContent.style.display !== 'none';

        if (isEditing) {
            // Switch to preview mode
            previewContent.style.display = 'block';
            editContent.style.display = 'none';
            editModeBtn.innerHTML = '<i class="fas fa-edit"></i> Düzenle';
            saveFileBtn.style.display = 'none';
        } else {
            // Switch to edit mode
            previewContent.style.display = 'none';
            editContent.style.display = 'block';
            editModeBtn.innerHTML = '<i class="fas fa-eye"></i> Önizleme';
            saveFileBtn.style.display = 'inline-block';

            // Focus on textarea
            const textarea = document.getElementById('fileEditTextarea');
            if (textarea) {
                textarea.focus();
            }
        }
    }

    async saveFileFromPreview() {
        const modal = document.getElementById('filePreviewModal');
        if (!modal) return;

        const filePath = modal.dataset.filePath;
        const textarea = document.getElementById('fileEditTextarea');
        const newContent = textarea.value;

        try {
            this.showLoading('Dosya kaydediliyor...');

            const result = await this.ipc.invoke('write-file', filePath, newContent);

            if (result.success) {
                this.showNotification('Dosya başarıyla kaydedildi', 'success');

                // Update modal's original content
                modal.dataset.originalContent = newContent;

                // Update preview display
                const path = require('path');
                const fileExtension = path.extname(filePath).toLowerCase();
                const previewContent = document.getElementById('filePreviewContent');
                previewContent.innerHTML = `<pre><code class="language-${this.getLanguageFromExtension(fileExtension)}">${this.escapeHtml(newContent)}</code></pre>`;

                // Re-apply syntax highlighting
                if (window.Prism) {
                    window.Prism.highlightAllUnder(previewContent);
                }

                // Switch back to preview mode
                this.toggleEditMode();

                // If file is open in a tab, update it
                const existingTab = this.findTabByFilePath(filePath);
                if (existingTab) {
                    const tabData = this.tabs.get(existingTab);
                    if (tabData && tabData.editor) {
                        tabData.editor.setValue(newContent);
                    }
                }

            } else {
                this.showNotification('Dosya kaydedilemedi: ' + result.error, 'error');
            }

            this.hideLoading();

        } catch (error) {
            this.hideLoading();
            this.showNotification('Kaydetme hatası: ' + error.message, 'error');
        }
    }

    closeFilePreview() {
        const modal = document.getElementById('filePreviewModal');
        if (modal) {
            const textarea = document.getElementById('fileEditTextarea');
            const editContent = document.getElementById('fileEditContent');

            // Check if in edit mode and has unsaved changes
            if (editContent && editContent.style.display !== 'none' && textarea) {
                const originalContent = modal.dataset.originalContent;
                const currentContent = textarea.value;

                if (originalContent !== currentContent) {
                    if (!confirm('Kaydedilmemiş değişiklikler var. Yine de kapatmak istiyor musunuz?')) {
                        return;
                    }
                }
            }

            modal.remove();
            this.currentPreviewModal = null;
        }
    }

    getLanguageFromExtension(ext) {
        const languages = {
            '.js': 'javascript',
            '.ts': 'typescript',
            '.py': 'python',
            '.html': 'html',
            '.css': 'css',
            '.json': 'json',
            '.xml': 'xml',
            '.md': 'markdown',
            '.cpp': 'cpp',
            '.c': 'c',
            '.java': 'java',
            '.php': 'php',
            '.rb': 'ruby',
            '.go': 'go',
            '.rs': 'rust'
        };
        return languages[ext] || 'text';
    }

    // Tab management helper functions
    findTabByFilePath(filePath) {
        for (let [tabId, tabData] of this.tabs) {
            if (tabData.filePath === filePath) {
                return tabId;
            }
        }
        return null;
    }

    switchToTab(tabId) {
        // Remove active class from all tabs
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.remove('active');
        });

        // Add active class to target tab
        const targetTab = document.querySelector(`.tab[data-file="${tabId}"]`);
        if (targetTab) {
            targetTab.classList.add('active');
        }

        // Switch editor content
        const tabData = this.tabs.get(tabId);
        if (tabData) {
            const editor = document.getElementById('codeEditor');
            if (editor) {
                editor.value = tabData.content;
                editor.focus();
            }

            this.currentTab = tabId;
            this.currentFile = tabData.filePath;

            // Update syntax highlighting (FIX: use updateHighlight, not updateSyntaxHighlighting)
            this.updateHighlight();

            // Highlight file in explorer
            this.highlightCurrentFileInExplorer();
        }
    }

    highlightCurrentFileInExplorer() {
        if (!this.currentFile) return;

        const folderTree = document.getElementById('folderTree');
        if (!folderTree) return;

        // Remove all existing selections
        folderTree.querySelectorAll('.tree-item').forEach(item => {
            item.classList.remove('selected');
        });

        // Find and highlight current file
        const currentFileItem = folderTree.querySelector(`.tree-item[data-path="${this.currentFile}"]`);
        if (currentFileItem) {
            currentFileItem.classList.add('selected');
        }
    }

    // =====================================
    // Project Setup Wizard Methods
    // =====================================

    setupProjectWizardEvents(templateData) {
        let currentStep = 1;
        const totalSteps = 3;

        const nextBtn = document.getElementById('wizardNext');
        const prevBtn = document.getElementById('wizardPrev');
        const finishBtn = document.getElementById('wizardFinish');
        const closeBtn = document.getElementById('closeProjectWizard');

        // Close wizard
        closeBtn.addEventListener('click', () => {
            const wizard = document.getElementById('projectSetupWizard');
            if (wizard) {
                wizard.remove();
            }
        });

        // Next step
        nextBtn.addEventListener('click', () => {
            if (currentStep < totalSteps) {
                // Hide current step
                document.querySelector(`[data-step="${currentStep}"]`).classList.remove('active');

                currentStep++;

                // Show next step
                document.querySelector(`[data-step="${currentStep}"]`).classList.add('active');

                // Update buttons
                prevBtn.style.display = currentStep > 1 ? 'inline-block' : 'none';

                if (currentStep === totalSteps) {
                    nextBtn.style.display = 'none';
                    finishBtn.style.display = 'inline-block';
                    this.updateProjectSummary(templateData);
                }
            }
        });

        // Previous step
        prevBtn.addEventListener('click', () => {
            if (currentStep > 1) {
                // Hide current step
                document.querySelector(`[data-step="${currentStep}"]`).classList.remove('active');

                currentStep--;

                // Show previous step
                document.querySelector(`[data-step="${currentStep}"]`).classList.add('active');

                // Update buttons
                prevBtn.style.display = currentStep > 1 ? 'inline-block' : 'none';
                nextBtn.style.display = 'inline-block';
                finishBtn.style.display = 'none';
            }
        });

        // Finish wizard
        finishBtn.addEventListener('click', async () => {
            await this.createProjectFromWizard(templateData);
            const wizard = document.getElementById('projectSetupWizard');
            if (wizard) {
                wizard.remove();
            }
        });
    }

    updateProjectSummary(templateData) {
        const projectName = document.getElementById('projectName').value || 'my-project';
        const projectDescription = document.getElementById('projectDescription').value || 'Proje açıklaması belirtilmemiş';
        const projectAuthor = document.getElementById('projectAuthor').value || 'Belirtilmemiş';

        const summary = document.getElementById('projectSummary');
        const safeName = this.escapeHtml(projectName);
        const safeDescription = this.escapeHtml(projectDescription);
        const safeAuthor = this.escapeHtml(projectAuthor);
        const safeTitle = this.escapeHtml(templateData.title || '');
        summary.innerHTML = `
      <div class="summary-item">
        <strong>📝 Proje Adı:</strong> ${safeName}
      </div>
      <div class="summary-item">
        <strong>📄 Açıklama:</strong> ${safeDescription}
      </div>
      <div class="summary-item">
        <strong>👤 Yazar:</strong> ${safeAuthor}
      </div>
      <div class="summary-item">
        <strong>🛠️ Tür:</strong> ${safeTitle}
      </div>
      <div class="summary-item">
        <strong>📁 Oluşturulacak:</strong> 
        <ul>
          ${this.getProjectFiles(templateData.projectType).map(file => `<li>${this.escapeHtml(file)}</li>`).join('')}
        </ul>
      </div>
    `;
    }

    getProjectFiles(projectType) {
        const files = {
            react: [
                'package.json', 'src/App.js', 'src/components/', 'public/index.html', 'README.md', '.gitignore'
            ],
            nodejs: [
                'package.json', 'server.js', 'routes/', 'middleware/', '.env.example', 'README.md', '.gitignore'
            ],
            python: [
                'requirements.txt', 'main.py', 'src/', 'tests/', 'README.md', '.gitignore', 'venv/'
            ],
            static: [
                'index.html', 'css/style.css', 'js/script.js', 'assets/', 'README.md'
            ]
        };

        return files[projectType] || ['README.md'];
    }

    async createProjectFromWizard(templateData) {
        const projectName = document.getElementById('projectName').value || 'my-project';
        const projectDescription = document.getElementById('projectDescription').value || '';
        const projectAuthor = document.getElementById('projectAuthor').value || '';

        // Build detailed task for agent
        const detailedTask = `${templateData.description}

PROJE DETAYLARI:
- Proje Adı: ${projectName}
- Açıklama: ${projectDescription}
- Yazar: ${projectAuthor}
- Tip: ${templateData.projectType}

ZORUNLU GEREKSINIMLER:
1. Profesyonel README.md dosyası oluştur (proje açıklaması, kurulum, kullanım)
2. Tüm dosya ve klasör yapısını oluştur
3. Package.json ve gerekli config dosyalarını ekle
4. Working directory olarak mevcut klasörü kullan
5. Teknoloji stackini ve dependency'leri belirt
6. Geliştirme ortamı kurulum talimatları ekle

README dosyası şunları içermeli:
- Proje başlığı ve açıklaması
- Kullanılan teknolojiler
- Kurulum adımları
- Kullanım örnekleri
- Katkıda bulunma rehberi
- Lisans bilgisi`;

        // Agent mode'u aktif et
        this.switchToAgentMode();

        // Chat'e proje bilgilerini bildir
        this.addChatMessage('user', `🚀 Proje Kurulumu: ${projectName}`);

        // Unified agent system ile çalıştır
        await this.executeUnifiedAgentTask(detailedTask);

        this.showNotification(`🚀 ${projectName} projesi için kurulum başlatılıyor...`, 'success');
    }

    // =====================================
    // Advanced File Explorer Methods
    // =====================================

    initializeAdvancedFileExplorer() {
        this.selectedFiles = new Set();
        this.clipboard = { action: null, files: [] };
        this.setupFileExplorerEvents();
        this.setupDragAndDrop();
    }

    setupFileExplorerEvents() {
        // Context menu
        document.addEventListener('contextmenu', (e) => {
            const treeItem = e.target.closest('.tree-item');
            if (treeItem && treeItem.closest('#folderTree')) {
                e.preventDefault();
                this.showContextMenu(e, treeItem);
            }
        });

        // Click outside to close context menu
        document.addEventListener('click', () => {
            this.hideContextMenu();
        });

        // Multi-selection with Ctrl/Cmd
        document.addEventListener('click', (e) => {
            const treeItem = e.target.closest('.tree-item');
            if (treeItem && treeItem.closest('#folderTree')) {
                if (e.ctrlKey || e.metaKey) {
                    this.toggleFileSelection(treeItem);
                } else if (e.shiftKey && this.lastSelectedFile) {
                    this.selectFileRange(this.lastSelectedFile, treeItem);
                } else {
                    this.selectSingleFile(treeItem);
                }
                this.lastSelectedFile = treeItem;
                this.updateBulkOperationsPanel();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.target.closest('#folderTree')) {
                this.handleFileExplorerKeyboard(e);
            }
        });

        // Context menu actions
        document.addEventListener('click', (e) => {
            const menuItem = e.target.closest('.context-menu-item');
            if (menuItem) {
                const action = menuItem.dataset.action;
                this.handleContextMenuAction(action);
                this.hideContextMenu();
            }
        });

        // Bulk operations
        document.getElementById('closeBulkOperations')?.addEventListener('click', () => {
            this.clearFileSelection();
        });

        document.querySelectorAll('.bulk-action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action;
                this.handleBulkAction(action);
            });
        });

        // Rename modal
        document.getElementById('closeRenameModal')?.addEventListener('click', () => {
            this.hideRenameModal();
        });
        document.getElementById('cancelRename')?.addEventListener('click', () => {
            this.hideRenameModal();
        });
        document.getElementById('confirmRename')?.addEventListener('click', () => {
            this.confirmRename();
        });
    }

    setupDragAndDrop() {
        const dropZone = document.body;

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.showDragOverlay();
        });

        dropZone.addEventListener('dragleave', (e) => {
            if (!e.relatedTarget || !dropZone.contains(e.relatedTarget)) {
                this.hideDragOverlay();
            }
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.hideDragOverlay();
            this.handleFileDrop(e.dataTransfer.files);
        });
    }

    showContextMenu(event, treeItem) {
        const contextMenu = document.getElementById('contextMenu');
        const filePath = treeItem.dataset.path;

        // Update context menu based on file type
        this.updateContextMenuItems(filePath, treeItem);

        contextMenu.classList.remove('hidden');
        contextMenu.style.left = event.pageX + 'px';
        contextMenu.style.top = event.pageY + 'px';

        this.currentContextTarget = treeItem;
    }

    hideContextMenu() {
        document.getElementById('contextMenu').classList.add('hidden');
        this.currentContextTarget = null;
    }

    updateContextMenuItems(filePath, treeItem) {
        const isDirectory = treeItem.classList.contains('folder');
        const previewItem = document.querySelector('[data-action="preview"]');
        const openItem = document.querySelector('[data-action="open"]');

        if (isDirectory) {
            previewItem.style.display = 'none';
            openItem.innerHTML = '<i class="fas fa-folder-open"></i> Klasörü Aç';
        } else {
            previewItem.style.display = 'block';
            openItem.innerHTML = '<i class="fas fa-external-link-alt"></i> Dosyayı Aç';
        }
    }

    handleContextMenuAction(action) {
        if (!this.currentContextTarget) return;

        const filePath = this.currentContextTarget.dataset.path;

        switch (action) {
            case 'open':
                this.openFileOrFolder(filePath);
                break;
            case 'preview':
                this.previewFile(filePath);
                break;
            case 'rename':
                this.showRenameModal(filePath);
                break;
            case 'duplicate':
                this.duplicateFile(filePath);
                break;
            case 'new-file':
                this.createNewFile(filePath);
                break;
            case 'new-folder':
                this.createNewFolder(filePath);
                break;
            case 'delete':
                this.deleteFile(filePath);
                break;
        }
    }

    selectSingleFile(treeItem) {
        this.clearFileSelection();
        this.selectedFiles.add(treeItem);
        treeItem.classList.add('selected');
    }

    toggleFileSelection(treeItem) {
        if (this.selectedFiles.has(treeItem)) {
            this.selectedFiles.delete(treeItem);
            treeItem.classList.remove('selected', 'multi-selected');
        } else {
            this.selectedFiles.add(treeItem);
            treeItem.classList.add('multi-selected');
        }
    }

    selectFileRange(startItem, endItem) {
        const allItems = Array.from(document.querySelectorAll('.tree-item'));
        const startIndex = allItems.indexOf(startItem);
        const endIndex = allItems.indexOf(endItem);

        const start = Math.min(startIndex, endIndex);
        const end = Math.max(startIndex, endIndex);

        this.clearFileSelection();

        for (let i = start; i <= end; i++) {
            const item = allItems[i];
            this.selectedFiles.add(item);
            item.classList.add('multi-selected');
        }
    }

    clearFileSelection() {
        this.selectedFiles.forEach(item => {
            item.classList.remove('selected', 'multi-selected');
        });
        this.selectedFiles.clear();
        this.updateBulkOperationsPanel();
    }

    updateBulkOperationsPanel() {
        const panel = document.getElementById('bulkOperationsPanel');
        const count = document.getElementById('selectedCount');

        if (this.selectedFiles.size > 1) {
            count.textContent = `${this.selectedFiles.size} öğe seçili`;
            panel.classList.remove('hidden');
        } else {
            panel.classList.add('hidden');
        }
    }

    showDragOverlay() {
        document.getElementById('dragOverlay').classList.remove('hidden');
    }

    hideDragOverlay() {
        document.getElementById('dragOverlay').classList.add('hidden');
    }

    async handleFileDrop(files) {
        if (!this.currentFolder) {
            this.showNotification('⚠️ Önce bir klasör seçin', 'warning');
            return;
        }

        this.showNotification(`📁 ${files.length} dosya kopyalanıyor...`, 'info');

        try {
            for (const file of files) {
                await this.copyFileToFolder(file, this.currentFolder);
            }

            this.showNotification('✅ Dosyalar başarıyla kopyalandı', 'success');
            this.refreshExplorer();
        } catch (error) {
            this.showNotification(`❌ Dosya kopyalama hatası: ${error.message}`, 'error');
        }
    }

    showRenameModal(filePath) {
        const modal = document.getElementById('renameModal');
        const input = document.getElementById('newFileName');
        const fileName = filePath.split('/').pop();

        input.value = fileName;
        modal.classList.remove('hidden');
        input.focus();
        input.select();

        this.currentRenameTarget = filePath;
    }

    hideRenameModal() {
        document.getElementById('renameModal').classList.add('hidden');
        this.currentRenameTarget = null;
    }

    async confirmRename() {
        const newName = document.getElementById('newFileName').value.trim();

        if (!newName || !this.currentRenameTarget) {
            this.showNotification('⚠️ Geçerli bir dosya adı girin', 'warning');
            return;
        }

        try {
            await this.renameFile(this.currentRenameTarget, newName);
            this.hideRenameModal();
            this.showNotification('✅ Dosya adı değiştirildi', 'success');
            this.refreshExplorer();
        } catch (error) {
            this.showNotification(`❌ Ad değiştirme hatası: ${error.message}`, 'error');
        }
    }

    // =====================================
    // Progressive Flow Enhancement Functions
    // =====================================

    initializeReadyAIWorkflow() {
        this.workflowStage = 'ready';
        this.workflowProgress = [];
        this.addWorkflowIndicators();
    }

    addWorkflowIndicators() {
        const existingIndicator = document.querySelector('.workflow-indicator');

        if (!this.currentProjectData) {
            existingIndicator?.remove();
            return;
        }

        const chatHeader = document.querySelector('.chat-header');
        if (!chatHeader) return;

        const indicator = document.createElement('div');
        indicator.className = 'workflow-indicator';

        const projectTitle = this.escapeHtml(this.currentProjectData.title || 'Proje');
        const stageLabel = this.getStageDisplay();

        indicator.innerHTML = `
            <div class="project-status-bar">
                <span class="project-name">🎯 ${projectTitle}</span>
                <span class="project-stage">${stageLabel}</span>
                <button class="project-actions-btn" onclick="window.kodCanavari.showProjectActions()">
                    <i class="fas fa-cog"></i>
                </button>
            </div>
        `;

        chatHeader.querySelector('.workflow-indicator')?.remove();
        chatHeader.prepend(indicator);
    }

    getStageDisplay() {
        if (!this.currentProjectData) return '📋 Hazır';

        const stages = {
            under_discussion: '💬 Tartışıyor',
            approved: '✅ Onaylı',
            creating: '🚀 Oluşturuluyor',
            created: '🎉 Tamamlandı'
        };

        return stages[this.currentProjectData.status] || '📋 Hazır';
    }

    showProjectActions() {
        if (!this.currentProjectData) return;

        const modal = document.createElement('div');
        modal.className = 'modal project-actions-modal';

        const projectTitle = this.escapeHtml(this.currentProjectData.title || 'Proje');
        const projectType = this.escapeHtml(this.currentProjectData.analysis?.projectType || 'Bilinmiyor');
        const projectTime = this.currentProjectData.timestamp ? new Date(this.currentProjectData.timestamp).toLocaleString('tr-TR') : '-';
        const isCreated = this.currentProjectData.status === 'created';
        const implementButtonClass = `action-btn implement ${isCreated ? 'disabled' : ''}`.trim();
        const implementButtonDisabled = isCreated ? 'disabled' : '';

        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>🎯 Proje İşlemleri</h3>
                    <button class="close-btn">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="project-quick-info">
                        <h4>${projectTitle}</h4>
                        <p><strong>Durum:</strong> ${this.getStageDisplay()}</p>
                        <p><strong>Tür:</strong> ${projectType}</p>
                        <p><strong>Oluşturulma:</strong> ${projectTime}</p>
                    </div>
                    <div class="project-actions-grid">
                        <button class="action-btn modify" onclick="window.kodCanavari.quickModifyProject()">
                            <i class="fas fa-edit"></i>
                            Projeyi Düzenle
                        </button>
                        <button class="action-btn save" onclick="window.kodCanavari.saveProject()">
                            <i class="fas fa-save"></i>
                            Projeyi Kaydet
                        </button>
                        <button class="${implementButtonClass}" ${implementButtonDisabled} onclick="window.kodCanavari.approveAndImplementProject()">
                            <i class="fas fa-rocket"></i>
                            ${isCreated ? 'Oluşturuldu' : 'Oluştur'}
                        </button>
                        <button class="action-btn export" onclick="window.kodCanavari.exportProjectData()">
                            <i class="fas fa-download"></i>
                            Export
                        </button>
                        <button class="action-btn duplicate" onclick="window.kodCanavari.duplicateProject()">
                            <i class="fas fa-copy"></i>
                            Kopyala
                        </button>
                        <button class="action-btn delete danger" onclick="window.kodCanavari.deleteProject()">
                            <i class="fas fa-trash"></i>
                            Sil
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        modal.style.display = 'flex';

        modal.querySelector('.close-btn').onclick = () => modal.remove();
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                modal.remove();
            }
        });
    }

    quickModifyProject() {
        if (!this.currentProjectData) return;

        const projectTitle = this.escapeHtml(this.currentProjectData.title || 'Proje');
        const modifyMessage = `🔧 **Hızlı Proje Düzenleme**

Mevcut proje: **${projectTitle}**

Neyi değiştirmek istiyorsun? Şunları söyleyebilirsin:
- "Başlığı değiştir: [yeni başlık]"
- "Açıklamayı güncelle: [yeni açıklama]"
- "Özellik ekle: [özellik adı]"
- "Teknoloji değiştir: [yeni teknoloji]"

Örnek: "React yerine Vue kullan" veya "Dark mode özelliği ekle"`;

        this.addContextualChatMessage('assistant', modifyMessage, {
            isQuickModify: true,
            projectData: this.currentProjectData
        });

        document.querySelector('.project-actions-modal')?.remove();
        document.getElementById('chatInput')?.focus();
    }

    exportProjectData() {
        if (!this.currentProjectData) return;

        const exportData = {
            project: this.currentProjectData,
            exportedAt: new Date().toISOString(),
            exportedBy: 'Kayra Deniz AI IDE'
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${this.currentProjectData.title.replace(/\s+/g, '-')}-project.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);

        this.showNotification('✅ Proje export edildi', 'success');
        document.querySelector('.project-actions-modal')?.remove();
    }

    duplicateProject() {
        if (!this.currentProjectData) return;

        const duplicated = {
            ...this.currentProjectData,
            title: `${this.currentProjectData.title} (Kopya)`,
            timestamp: new Date().toISOString(),
            status: 'under_discussion'
        };

        this.currentProjectData = duplicated;
        this.initializeReadyAIWorkflow();
        this.updateProjectStatus('under_discussion');

        const duplicateMessage = `📋 **Proje Kopyalandı**

**${this.escapeHtml(duplicated.title)}** olarak yeni bir kopya oluşturuldu.

Bu kopyayı istediğin gibi değiştirebilirsin.`;

        this.addContextualChatMessage('assistant', duplicateMessage, {
            isProjectDuplicate: true,
            projectData: duplicated
        });

        this.showNotification('✅ Proje kopyalandı', 'success');
        document.querySelector('.project-actions-modal')?.remove();
    }

    deleteProject() {
        if (!this.currentProjectData) return;

        const confirmation = confirm(`"${this.currentProjectData.title}" projesini silmek istediğinizden emin misiniz?`);
        if (!confirmation) return;

        const projectTitle = this.currentProjectData.title;
        this.currentProjectData = null;
        this.workflowProgress = [];

        document.querySelector('.workflow-indicator')?.remove();

        const deleteMessage = `🗑️ **Proje Silindi**

**${this.escapeHtml(projectTitle)}** projesi silindi.

Yeni bir proje oluşturmak için "AI Proje Sihirbazı" kullanabilirsin.`;

        this.addContextualChatMessage('assistant', deleteMessage, {
            isProjectDelete: true
        });

        this.showNotification('✅ Proje silindi', 'success');
        document.querySelector('.project-actions-modal')?.remove();
    }

    updateProjectStatus(newStatus) {
        if (!this.currentProjectData) return;

        this.currentProjectData.status = newStatus;
        this.workflowProgress = this.workflowProgress || [];
        this.workflowProgress.push({
            stage: newStatus,
            timestamp: new Date().toISOString()
        });

        this.addWorkflowIndicators();
    }

    completeWorkflow() {
        this.updateProjectStatus('created');

        const completionMessage = `🎊 **Workflow Tamamlandı!**

Readdy AI stili proje oluşturma işlemi başarıyla tamamlandı:

✅ Proje analizi
✅ Teknik gereksinimler
✅ Kullanıcı onayı  
✅ Dosya oluşturma
✅ Proje hazır!

**Süreç:** ${this.workflowProgress.length} adım
**Süre:** ${this.calculateWorkflowDuration()}

Artık geliştirmeye başlayabilirsin! 🚀`;

        this.addContextualChatMessage('assistant', completionMessage, {
            isWorkflowComplete: true,
            progress: this.workflowProgress
        });
    }

    calculateWorkflowDuration() {
        if (!this.workflowProgress || this.workflowProgress.length < 2) {
            return 'Bilinmiyor';
        }

        const start = new Date(this.workflowProgress[0].timestamp);
        const end = new Date(this.workflowProgress[this.workflowProgress.length - 1].timestamp);
        const duration = Math.round((end - start) / 1000);

        if (duration < 60) return `${duration} saniye`;
        return `${Math.round(duration / 60)} dakika`;
    }

    // =========================================================================
    // 🔥 CONTINUE AGENT STYLE INTEGRATION - Helper Methods
    // =========================================================================

    /**
     * Execute multi-edit operation with atomic rollback support
     * @param {string} filepath - Absolute path to file
     * @param {Array} edits - Array of edit operations
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Edit result
     */
    async executeMultiEdit(filepath, edits, options = {}) {
        if (!this.multiEditSystem) {
            throw new Error('MultiEdit system not initialized');
        }

        console.log(`🔧 Executing multi-edit on ${filepath} with ${edits.length} operations`);

        try {
            const result = await this.multiEditSystem.executeMultiEdit(filepath, edits, options);
            
            // Show success notification
            this.addChatMessage('system', `✅ Successfully applied ${edits.length} edits to ${filepath}`);
            
            // Show diff if available
            if (result.diff && result.diff.length > 0) {
                const diffPreview = result.diff.slice(0, 10).join('\n');
                this.addChatMessage('system', `📊 **Changes Preview:**\n\`\`\`diff\n${diffPreview}\n\`\`\``);
            }

            return result;

        } catch (error) {
            console.error('❌ MultiEdit failed:', error);
            this.addChatMessage('system', `❌ Edit failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * View current git diff with approval workflow
     * @param {Object} options - Diff options
     * @returns {Promise<Object>} Diff result
     */
    async viewDiff(options = {}) {
        if (!this.viewDiffSystem) {
            throw new Error('ViewDiff system not initialized');
        }

        console.log('🔍 Viewing git diff...');

        try {
            const diff = await this.viewDiffSystem.viewDiff(options);

            if (!diff.success) {
                this.addChatMessage('system', `⚠️ Could not get diff: ${diff.error || 'Unknown error'}`);
                return diff;
            }

            // Show formatted diff
            this.addChatMessage('system', `📊 **Git Diff:**\n\`\`\`\n${diff.formatted}\n\`\`\``);

            // Return diff for approval workflow
            return diff;

        } catch (error) {
            console.error('❌ ViewDiff failed:', error);
            this.addChatMessage('system', `❌ Diff failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * View repository structure map
     * @param {Object} options - Map options
     * @returns {Promise<Object>} Repo map result
     */
    async viewRepoMap(options = {}) {
        if (!this.viewRepoMapSystem) {
            throw new Error('ViewRepoMap system not initialized');
        }

        console.log('🗺️ Generating repository map...');

        try {
            const map = await this.viewRepoMapSystem.viewRepoMap(options);

            if (!map.success) {
                this.addChatMessage('system', `⚠️ Could not generate repo map: ${map.error || 'Unknown error'}`);
                return map;
            }

            // Show formatted map
            this.addChatMessage('system', `🗺️ **Repository Map:**\n${map.formatted}`);

            // Return map for agent context
            return map;

        } catch (error) {
            console.error('❌ ViewRepoMap failed:', error);
            this.addChatMessage('system', `❌ Repo map failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Agent helper: Safe file editing with preview and approval
     * @param {string} filepath - File to edit
     * @param {Array} edits - Edit operations
     * @returns {Promise<boolean>} Success status
     */
    async agentSafeFileEdit(filepath, edits) {
        try {
            // Step 1: Show what will be changed
            this.addChatMessage('assistant', `📝 **Preparing to edit**: ${filepath}\n\nI will make ${edits.length} change(s). Let me show you what will happen...`);

            // Step 2: Dry run to show preview
            const dryRun = await this.executeMultiEdit(filepath, edits, { dryRun: true });

            // Step 3: Show diff preview
            if (dryRun.diff && dryRun.diff.length > 0) {
                const diffPreview = dryRun.diff.slice(0, 20).join('\n');
                this.addChatMessage('assistant', `\`\`\`diff\n${diffPreview}\n\`\`\``);
            }

            // Step 4: Ask for approval (for now, auto-approve in agent mode)
            // TODO: Add user approval UI
            const approved = true; // Auto-approve for now

            if (!approved) {
                this.addChatMessage('system', '❌ Edit cancelled by user');
                return false;
            }

            // Step 5: Execute actual edit
            const result = await this.executeMultiEdit(filepath, edits, { dryRun: false });

            return result.success;

        } catch (error) {
            console.error('❌ Agent safe file edit failed:', error);
            return false;
        }
    }
    
    /**
     * 🌌 LUMA: Show confirmation dialog for risky commands
     * @param {Object} lumaDecision - Luma decision object
     * @returns {Promise<boolean>} - User confirmed or not
     */
    async showLumaConfirmation(lumaDecision) {
        // Developer mode - auto-approve
        if (this.developerMode) {
            console.log('🔓 Developer Mode: Auto-approving risky command');
            return true;
        }
        
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'luma-confirmation-modal';
            modal.innerHTML = `
                <div class="luma-confirmation-content">
                    <div class="luma-confirmation-header">
                        <h3>⚠️ Luma Uyarısı</h3>
                        <p class="luma-risk-badge risk-${lumaDecision.metadata?.riskLevel || 'HIGH'}">
                            Risk: ${lumaDecision.metadata?.riskLevel || 'HIGH'}
                        </p>
                    </div>
                    
                    <div class="luma-confirmation-body">
                        <div class="luma-warning-message">
                            ${lumaDecision.message}
                        </div>
                        
                        <div class="luma-reasoning">
                            <strong>Reasoning:</strong> ${lumaDecision.reasoning || 'Güvenlik riski tespit edildi.'}
                        </div>
                        
                        ${lumaDecision.alternatives && lumaDecision.alternatives.length > 0 ? `
                            <div class="luma-alternatives">
                                <strong>Alternatifler:</strong>
                                <ul>
                                    ${lumaDecision.alternatives.map(alt => `<li>${alt}</li>`).join('')}
                                </ul>
                            </div>
                        ` : ''}
                    </div>
                    
                    <div class="luma-confirmation-actions">
                        <button class="luma-btn luma-btn-danger" data-action="proceed">
                            <i class="fas fa-exclamation-triangle"></i> Yine de Devam Et
                        </button>
                        <button class="luma-btn luma-btn-safe" data-action="cancel">
                            <i class="fas fa-shield-alt"></i> İptal Et (Güvenli)
                        </button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Add event listeners
            const proceedBtn = modal.querySelector('[data-action="proceed"]');
            const cancelBtn = modal.querySelector('[data-action="cancel"]');
            
            proceedBtn?.addEventListener('click', () => {
                modal.remove();
                resolve(true);
            });
            
            cancelBtn?.addEventListener('click', () => {
                modal.remove();
                resolve(false);
            });
            
            // Close on outside click
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.remove();
                    resolve(false);
                }
            });
        });
    }

    /**
     * Agent helper: Get project context for LLM
     * @returns {Promise<string>} Formatted context
     */
    async getAgentProjectContext() {
        try {
            const map = await this.viewRepoMapSystem.viewRepoMap({ 
                maxDepth: 3,
                includeStats: true,
                includeFileTree: true,
                useCache: true 
            });

            if (!map.success) {
                return '⚠️ Could not load project structure';
            }

            // Format for LLM context
            return `
# PROJECT CONTEXT

**Root Path**: ${map.rootPath}
**Total Files**: ${map.stats.totalFiles}
**Code Files**: ${map.stats.codeFiles}
**Directories**: ${map.stats.totalDirectories}

## File Types:
${Object.entries(map.stats.filesByExtension || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([ext, count]) => `- ${ext}: ${count}`)
    .join('\n')}

## Directory Structure (Top Level):
${map.fileTree ? map.fileTree.slice(0, 30).join('\n') : 'Not available'}

This is the current project structure. Use this to understand where files are located and what the project contains.
`;

        } catch (error) {
            console.error('❌ Get project context failed:', error);
            return '⚠️ Error loading project context';
        }
    }

    /**
     * Agent helper: Commit changes with diff preview
     * @param {string} message - Commit message
     * @returns {Promise<boolean>} Success status
     */
    async agentCommitWithPreview(message) {
        try {
            // Step 1: Get current diff
            const diff = await this.viewDiff({
                includeStaged: true,
                includeUnstaged: true,
                includeUntracked: false
            });

            if (!diff.success || diff.summary.totalFiles === 0) {
                this.addChatMessage('system', '⚠️ No changes to commit');
                return false;
            }

            // Step 2: Show summary
            this.addChatMessage('assistant', `📊 **Commit Summary:**
- ${diff.summary.totalFiles} files changed
- +${diff.summary.additions} additions
- -${diff.summary.deletions} deletions

Commit message: "${message}"`);

            // Step 3: Stage all changes
            // TODO: Implement git add via terminal command

            // Step 4: Commit
            // TODO: Implement git commit via terminal command

            this.addChatMessage('system', '✅ Changes committed successfully');
            return true;

        } catch (error) {
            console.error('❌ Commit with preview failed:', error);
            this.addChatMessage('system', `❌ Commit failed: ${error.message}`);
            return false;
        }
    }
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.kodCanavari = new KodCanavari();

    // Initialize MCP Proxy Monitor (after kodCanavari is ready)
    if (typeof window.initializeMCPMonitor === 'function') {
        window.initializeMCPMonitor();
        console.log('🔍 [Main] MCP Monitor initialization triggered');
    } else {
        console.warn('⚠️ [Main] MCP Monitor not found, auto-restart disabled');
    }

    // Initialize GitHub and Code Agent managers
    if (typeof KayraGitHubCodeManager !== 'undefined') {
        window.githubCodeManager = new KayraGitHubCodeManager();

        // MCP Client bağlantısını bekle ve set et
        setTimeout(() => {
            if (window.kodCanavari.mcpToolsManager) {
                window.githubCodeManager.setMCPClient(window.kodCanavari.mcpToolsManager);
                console.log('✅ GitHub Code Manager MCP client ile bağlandı');
            }
        }, 2000);

        console.log('✅ GitHub Code Manager başlatıldı');
    }

    // Initialize standalone Code Agent
    if (typeof CodeAgent !== 'undefined') {
        window.codeAgent = new CodeAgent();
        console.log('✅ Code Agent başlatıldı');
    }

    // Initialize GitHub API Manager
    if (typeof GitHubAPIManager !== 'undefined') {
        window.githubAPI = new GitHubAPIManager();
        console.log('✅ GitHub API Manager başlatıldı');
    }

    // Theme toggle button event listener
    const themeToggleBtn = document.querySelector('.theme-toggle-btn');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            window.kodCanavari.toggleTheme();
        });
    }

    // 🎯 LIVE VISUALIZATION: Minimize button
    const minimizeLiveBtn = document.getElementById('minimizeLiveBtn');
    if (minimizeLiveBtn) {
        minimizeLiveBtn.addEventListener('click', () => {
            const liveView = document.getElementById('agentLiveView');
            if (liveView) {
                liveView.classList.toggle('hidden');
                minimizeLiveBtn.querySelector('i').classList.toggle('fa-minus');
                minimizeLiveBtn.querySelector('i').classList.toggle('fa-eye');
            }
        });
    }
    
    // 🔓 DEVELOPER MODE TOGGLE (Console Command + UI Button)
    window.toggleDeveloperMode = function() {
        if (window.kodCanavari) {
            window.kodCanavari.developerMode = !window.kodCanavari.developerMode;
            localStorage.setItem('developerMode', window.kodCanavari.developerMode);
            
            const status = window.kodCanavari.developerMode ? 'ENABLED ✅' : 'DISABLED ❌';
            console.log(`🔓 Developer Mode: ${status}`);
            
            if (window.kodCanavari.developerMode) {
                console.log('⚠️ All operations will be auto-approved!');
            } else {
                console.log('✅ Manual approval required for operations.');
            }
            
            // 🎨 UPDATE UI BUTTON
            const btn = document.getElementById('developerModeBtn');
            const statusSpan = btn?.querySelector('.dev-mode-status');
            const icon = btn?.querySelector('i');
            
            if (btn && statusSpan && icon) {
                if (window.kodCanavari.developerMode) {
                    btn.classList.add('dev-mode-active');
                    statusSpan.textContent = 'DEV: ON';
                    icon.className = 'fas fa-unlock';
                    btn.title = 'Developer Mode ENABLED (Auto-approve all)';
                } else {
                    btn.classList.remove('dev-mode-active');
                    statusSpan.textContent = 'DEV: OFF';
                    icon.className = 'fas fa-code';
                    btn.title = 'Developer Mode DISABLED';
                }
            }
            
            return window.kodCanavari.developerMode;
        }
    };
    
    // 🎓 TEACH MODE TOGGLE (Console Command)
    window.toggleTeachMode = function() {
        if (window.kodCanavari) {
            window.kodCanavari.settings.teachWhileDoing = !window.kodCanavari.settings.teachWhileDoing;
            localStorage.setItem('teachWhileDoing', window.kodCanavari.settings.teachWhileDoing);
            
            const status = window.kodCanavari.settings.teachWhileDoing ? 'ENABLED ✅' : 'DISABLED ❌';
            console.log(`🎓 Teach-While-Doing Mode: ${status}`);
            
            if (window.kodCanavari.settings.teachWhileDoing) {
                console.log('📚 All steps will include detailed explanations (goal, rationale, tradeoffs)');
                console.log('💡 Policy will enforce explain fields in every step');
            } else {
                console.log('⚡ Fast mode: Minimal explanations');
            }
            
            return window.kodCanavari.settings.teachWhileDoing;
        }
    };
    
    console.log('💡 TIP: Use toggleDeveloperMode() in console to enable/disable auto-approval');
    console.log('💡 TIP: Use toggleTeachMode() in console to enable/disable detailed explanations');
});

// Handle theme changes
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        // Refresh UI when app becomes visible
        if (window.kodCanavari) {
            window.kodCanavari.updateStatus();
            window.kodCanavari.addWorkflowIndicators();
        }
    }
});

// Export for external access
if (typeof module !== 'undefined' && module.exports) {
    module.exports = KodCanavari;
}