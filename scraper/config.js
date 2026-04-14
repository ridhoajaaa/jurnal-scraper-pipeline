/**
 * Scraper Configuration
 * Centralized constants untuk seluruh scraper module
 */

module.exports = {
    // Timeouts (dalam milliseconds)
    TIMEOUT: {
        PAGE_LOAD: 30000,           // 30 detik untuk load halaman
        PAGE_LOAD_RETRY: 20000,     // 20 detik saat retry
        API_CALL: 25000,            // 25 detik untuk panggil API (Semantic Scholar, CrossRef)
        CAPTCHA: 120000,            // 2 menit untuk user selesaikan CAPTCHA
        NAVIGATION: 60000,          // 60 detik untuk navigation umum
        STDIN_POLL: 2000            // 2 detik poll untuk stdin commands
    },

    // Quality thresholds
    QUALITY: {
        MIN_CITATION: 3,            // Minimal sitasi untuk lolos filter
        SKIP_CITATION_YEAR: 2024,   // Tahun ini ke atas bebas dari citation filter
        RESERVED_CITATION_MIN: 3,   // Minimal sitasi untuk reserved slot
        MAX_RESERVED_SLOTS: 15,     // Maksimal jurnal tanpa abstract per scrape
        ABSTRACT_MIN_LENGTH: 150,   // Minimal karakter abstract yang diterima
        ABSTRACT_MAX_LENGTH: 5000   // Maksimal karakter abstract (cegah full-page dump)
    },

    // Delays (anti-rate limit)
    DELAY: {
        BETWEEN_PAGES: 2500,        // 2.5 detik antar halaman Scholar
        RETRY_BACKOFF: 2000,        // 2 detik sebelum retry
        BETWEEN_REQUESTS: 100,      // 100ms antar request ke API
        SCROLL: 300                 // 300ms antar scroll action
    },

    // Pagination & Limits
    PAGINATION: {
        RESULTS_PER_PAGE: 10,       // Google Scholar default
        MAX_PAGES_BUFFER: 20        // Buffer halaman tambahan
    },

    // Retry settings
    RETRY: {
        API_MAX: 3,                 // Kurangi dari 6 → 3
        NAVIGATION_MAX: 2          // Maksimal retry untuk navigation
    },

    // User Agent & Headers
    HEADERS: {
        USER_AGENT: 'LiteratureAssistant/2.0',
        EMAIL_CONTACT: 'mailto:research@example.com'
    },

    // Abstract extraction selectors (fallback order)
    // IMPORTANT: More specific selectors first, generic ones last
    ABSTRACT_SELECTORS: [
        '#abstract',
        '#articleAbstract',
        '#abs',
        '#abstractSection',
        '#abstractInFull',
        '.abstract',
        '.art-abstract',           // MDPI journals
        '.abstract-content',       // MDPI / Frontiers
        '.article-abstract',
        '.paper-abstract',
        '.abstractSection',
        '.hlFld-Abstract',         // Wiley
        '.abstract-text',          // Taylor & Francis
        'section.abstract',
        'div.abstract',
        'meta[name="description"]',
        'meta[property="og:description"]'
    ],

    // Open Access domain patterns
    OPEN_ACCESS_DOMAINS: [
        'arxiv.org',
        'semanticscholar.org',
        'researchgate.net',
        'ncbi.nlm.nih.gov',
        'plos',
        'frontiersin.org',
        'mdpi.com',
        'hindawi.com',
        'springeropen',
        'doaj.org'
    ],

    // Browser launch args
    BROWSER: {
        // When DISPLAY is set (Xvfb/Docker), use non-headless so noVNC can show browser for CAPTCHA solving.
        // When no DISPLAY (local/CI), use headless mode.
        HEADLESS: process.env.DISPLAY ? false : 'new',
        WINDOW_WIDTH: 1280,
        WINDOW_HEIGHT: 720,
        ARGS: [
            '--no-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--window-size=1280,720'
        ]
    },

    // Logging
    LOG: {
        PROGRESS_INTERVAL: 1  // Emit progress setiap N items
    }
};