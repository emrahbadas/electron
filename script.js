document.addEventListener('DOMContentLoaded', () => {
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
});