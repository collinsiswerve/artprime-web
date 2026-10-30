(function () {
    'use strict';

    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const mobile = window.matchMedia('(max-width: 767px)');
    const header = document.querySelector('.atelier-nav');
    const toggle = header?.querySelector('.atelier-menu-toggle');
    const menu = toggle && document.getElementById(toggle.getAttribute('aria-controls'));
    const pending = new Set();
    let previousY = window.scrollY;
    let lastDirectionY = previousY;
    let frame = 0;

    // The reference fades in place: 900ms, linear, without scroll interception.
    const observer = !preference.matches && 'IntersectionObserver' in window
        ? new IntersectionObserver(entries => {
            for (const entry of entries) {
                if (entry.isIntersecting) reveal(entry.target);
            }
        }, { threshold: 0.04, rootMargin: '0px 0px -12px 0px' }) : null;

    function reveal(element) {
        element.classList.add('is-revealed');
        pending.delete(element);
        observer?.unobserve(element);
    }

    function register(elements) {
        if (!observer || preference.matches) return;
        elements.forEach((element, index) => {
            if (element.classList.contains('motion-pending')) return;
            element.style.setProperty('--reveal-delay', `${Math.min(index % 4 * 11, 33)}ms`);
            element.classList.add('motion-pending');
            pending.add(element);
            observer.observe(element);
        });
    }

    function showTarget(element) {
        if (!element) return;
        let ancestor = element;
        while (ancestor) {
            if (ancestor.classList.contains('motion-pending')) reveal(ancestor);
            ancestor = ancestor.parentElement;
        }
    }

    function revealAnchor() {
        try {
            const target = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
            showTarget(target);
            target?.querySelectorAll('.motion-pending').forEach(reveal);
        } catch (_) { /* A malformed fragment must not interfere with the page. */ }
    }

    function setMenu(open, restoreFocus = false) {
        if (!menu || !toggle) return;
        open = Boolean(open && mobile.matches);
        menu.hidden = !open;
        menu.classList.toggle('hidden', !open);
        toggle.setAttribute('aria-expanded', String(open));
        toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
        header.classList.toggle('menu-is-open', open);
        header.classList.remove('is-away');
        document.body.classList.toggle('navigation-open', open);
        if (restoreFocus) toggle.focus({ preventScroll: true });
    }

    function updateHeader() {
        frame = 0;
        if (!header) return;
        const y = Math.max(0, window.scrollY);
        const delta = y - previousY;
        header.classList.toggle('is-scrolled', y > 40);
        if (delta > 0 && y - lastDirectionY > 8 && y > 120
            && toggle?.getAttribute('aria-expanded') !== 'true'
            && !header.contains(document.activeElement)) {
            header.classList.add('is-away');
            lastDirectionY = y;
        } else if ((delta < 0 && lastDirectionY - y > 8) || y <= 40) {
            header.classList.remove('is-away');
            lastDirectionY = y;
        }
        previousY = y;
    }

    function init() {
        register(document.querySelectorAll(
            '.nav-links, .atelier-wordmark, .hero > .relative, .stage-image, .stage-intro, .stage-copy, .stage-bottom, '
            + '.studio-method > div, .work-heading, .example-notice, .collection-header, '
            + '.philosophy-content > *, .studio-philosophy > .eyebrow, .studio-contact > *, '
            + '.shop-studio-invitation > *, .shop-footer-top > *, .atelier-footer > *, '
            + '.legal-heading, .legal-copy > section'
        ));

        // Both grids are replaced after asynchronous loads, searches and filters.
        for (const id of ['project-grid', 'product-grid']) {
            const grid = document.getElementById(id);
            if (!grid || !observer) continue;
            register([...grid.children]);
            new MutationObserver(() => {
                for (const element of pending) {
                    if (!element.isConnected) {
                        observer.unobserve(element);
                        pending.delete(element);
                    }
                }
                register([...grid.children]);
            }).observe(grid, { childList: true });
        }

        toggle?.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
        menu?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setMenu(false)));
        mobile.addEventListener('change', () => setMenu(false));
        document.addEventListener('keydown', event => {
            if (toggle?.getAttribute('aria-expanded') !== 'true') return;
            if (event.key === 'Escape') {
                event.preventDefault();
                setMenu(false, true);
            } else if (event.key === 'Tab') {
                const controls = [...header.querySelectorAll('a,button')].filter(element => element.getClientRects().length);
                const first = controls[0];
                const last = controls[controls.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last?.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first?.focus();
                }
            }
        });
        document.addEventListener('focusin', event => {
            showTarget(event.target);
            if (header?.contains(event.target)) header.classList.remove('is-away');
        });
        window.addEventListener('scroll', () => {
            if (!frame) frame = window.requestAnimationFrame(updateHeader);
        }, { passive: true });
        window.addEventListener('hashchange', revealAnchor);
        window.addEventListener('pageshow', event => {
            if (event.persisted) {
                pending.forEach(reveal);
                updateHeader();
            }
        });
        preference.addEventListener('change', () => {
            if (preference.matches) pending.forEach(reveal);
        });
        // If another script fails, the visitor must still be able to read the page.
        window.addEventListener('error', () => pending.forEach(reveal));
        window.ArtPrimeMotion = { setMenu };
        revealAnchor();
        updateHeader();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
    else init();
})();
