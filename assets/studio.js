(function () {
    'use strict';
    const byId = id => document.getElementById(id);
    const dialog = byId('project-dialog');
    let projects = [];
    let featured = [];
    let stage = null;
    let gallery = null;
    let titleAnimation = null;
    let currentProject = null;
    let activeFilter = 'All spaces';
    let returnFocus = null;
    let loading = false;

    function node(tag, classes, text) {
        const result = document.createElement(tag);
        if (classes) result.className = classes;
        if (text !== undefined) result.textContent = text;
        return result;
    }

    function makeButton(label, classes, action) {
        const result = node('button', classes, label);
        result.type = 'button';
        result.addEventListener('click', action);
        return result;
    }

    function setImage(image, source, alt, kind = 'card') {
        const widths = kind === 'thumbnail' ? [160, 320] : kind === 'stage' ? [640, 960, 1600, 1920] : [640, 960, 1600];
        const variants = window.ArtPrimeCatalogue.imageVariants(source, widths, document.baseURI);
        image.alt = alt;
        image.classList.add('image-loading');
        image.onload = () => image.classList.remove('image-loading');
        image.onerror = () => {
            image.onerror = null;
            image.removeAttribute('srcset');
            image.src = new URL('assets/product-placeholder.svg', document.baseURI).href;
            image.alt = `${alt} — photograph unavailable`;
            image.classList.remove('image-loading');
        };
        image.sizes = kind === 'stage' ? '100vw' : kind === 'thumbnail' ? '68px' : '(min-width: 768px) 48vw, 88vw';
        if (variants.srcset) image.srcset = variants.srcset;
        else image.removeAttribute('srcset');
        image.src = variants.src;
        if (image.complete && image.naturalWidth) image.classList.remove('image-loading');
    }

    function updateStage(project, index, initial) {
        const title = byId('stage-title');
        titleAnimation?.cancel();
        title.textContent = project.title;
        if (!initial && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            titleAnimation = title.animate([{ opacity: 0 }, { opacity: 1 }], {
                duration: 400, easing: 'cubic-bezier(.22,1,.36,1)'
            });
        }
        byId('stage-meta').textContent = [project.location, project.category].filter(Boolean).join(' / ').toUpperCase();
        byId('stage-count').textContent = `${String(index + 1).padStart(2, '0')} / ${String(featured.length).padStart(2, '0')}`;
        byId('stage-dots').querySelectorAll('button').forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
    }

    function showStage(index) { stage?.goTo(index); }

    function renderStage() {
        const selected = projects.filter(project => project.featured);
        featured = selected.length ? selected : projects;
        byId('stage-prev').disabled = featured.length < 2;
        byId('stage-next').disabled = featured.length < 2;
        byId('stage-prev').hidden = featured.length < 2;
        byId('stage-next').hidden = featured.length < 2;
        const fragment = document.createDocumentFragment();
        featured.forEach((project, index) => {
            const button = makeButton(undefined, 'stage-dot', () => showStage(index));
            button.setAttribute('aria-label', `Show ${project.title}`);
            button.setAttribute('aria-pressed', String(index === 0));
            fragment.append(button);
        });
        byId('stage-dots').replaceChildren(fragment);
        stage.setProjects(featured);
        if (!featured.length) {
            byId('stage-title').textContent = 'Interiors, considered.';
            byId('stage-meta').textContent = 'ART PRIME STUDIO / NAIROBI';
            byId('stage-count').textContent = '';
        }
    }

    function renderFilters() {
        const categories = ['All spaces', ...new Set(projects.map(project => project.category))];
        const fragment = document.createDocumentFragment();
        categories.forEach(category => {
            const button = makeButton(category, 'project-filter', () => {
                activeFilter = category;
                renderGrid();
                byId('project-filters').querySelectorAll('button').forEach(item => item.setAttribute('aria-pressed', String(item.textContent === category)));
            });
            button.setAttribute('aria-pressed', String(category === activeFilter));
            fragment.append(button);
        });
        byId('project-filters').replaceChildren(fragment);
    }

    function renderGrid() {
        const filtered = projects.filter(project => activeFilter === 'All spaces' || project.category === activeFilter);
        const fragment = document.createDocumentFragment();
        filtered.forEach(project => {
            const button = makeButton(undefined, 'project-tile', () => openProject(project.id));
            button.setAttribute('aria-label', `Explore ${project.title}`);
            const picture = node('span', 'tile-image-wrap');
            const image = node('img');
            image.width = 800;
            image.height = 1000;
            image.loading = 'lazy';
            image.decoding = 'async';
            setImage(image, project.coverImage, project.coverAlt);
            picture.append(image);
            const caption = node('span', 'tile-caption');
            const details = node('span');
            details.append(node('h3', '', project.title), node('p', '', [project.location, project.category].filter(Boolean).join(' / ')));
            const arrow = node('span', '', '↗');
            arrow.setAttribute('aria-hidden', 'true');
            caption.append(details, arrow);
            button.append(picture, caption);
            fragment.append(button);
        });
        byId('project-grid').replaceChildren(fragment);
        byId('studio-status').textContent = filtered.length ? '' : 'Our next chapter is taking shape. Speak to us about your space while we prepare the portfolio.';
        byId('project-grid').setAttribute('aria-label', `${filtered.length} ${filtered.length === 1 ? 'interior' : 'interiors'}`);
    }

    function projectLink(id) {
        const url = new URL(window.location.href);
        url.searchParams.set('project', id);
        url.hash = '';
        return url.href;
    }

    function openProject(id, { syncRoute = true } = {}) {
        const project = projects.find(item => item.id === id);
        if (!project) return;
        const alreadyOpen = dialog.open;
        if (!alreadyOpen) returnFocus = document.activeElement;
        currentProject = project;
        byId('project-title').textContent = project.title;
        byId('project-category').textContent = project.category;
        byId('project-description').textContent = project.description;
        byId('dialog-project-index').textContent = `THE STUDIO / ${String(projects.indexOf(project) + 1).padStart(2, '0')}`;
        const facts = document.createDocumentFragment();
        for (const [label, value] of [['Location', project.location], ['Year', project.year]]) {
            if (!value) continue;
            const fact = node('div');
            fact.append(node('dt', '', label), node('dd', '', value));
            facts.append(fact);
        }
        byId('project-facts').replaceChildren(facts);
        const enquiry = `Hello Art Prime, I'd like to discuss an interior design project. I was looking at ${project.title} in your Studio: ${projectLink(project.id)}`;
        byId('project-inquire').href = `https://wa.me/254748649103?text=${encodeURIComponent(enquiry)}`;
        byId('project-share-status').textContent = '';
        byId('project-share-fallback').hidden = true;
        byId('studio-project-link').value = projectLink(project.id);
        const next = projects[(projects.indexOf(project) + 1) % projects.length];
        byId('next-project-title').textContent = next.title;
        byId('next-project').hidden = projects.length < 2;
        if (!alreadyOpen) dialog.showModal();
        gallery.open(project);
        dialog.scrollTop = 0;
        byId('project-close').focus({ preventScroll: true });
        if (syncRoute) {
            const url = projectLink(id);
            if (new URL(window.location.href).searchParams.has('project')) window.history.replaceState(window.history.state, '', url);
            else window.history.pushState({ ...window.history.state, artPrimeStudio: true }, '', url);
        }
    }

    function closeProject({ syncRoute = true } = {}) {
        gallery.close();
        if (dialog.open) dialog.close();
        if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
        if (syncRoute && new URL(window.location.href).searchParams.has('project')) {
            if (window.history.state?.artPrimeStudio) window.history.back();
            else {
                const url = new URL(window.location.href);
                url.searchParams.delete('project');
                window.history.replaceState(window.history.state, '', url);
            }
        }
    }

    function handleRoute() {
        const id = new URL(window.location.href).searchParams.get('project');
        if (id && projects.some(project => project.id === id)) openProject(id, { syncRoute: false });
        else {
            if (dialog.open) closeProject({ syncRoute: false });
            if (id) byId('studio-status').textContent = 'This project is no longer available. Explore the spaces below or contact the studio.';
        }
    }

    async function copyProjectLink() {
        if (!currentProject) return;
        try {
            await navigator.clipboard.writeText(projectLink(currentProject.id));
            byId('project-share-status').textContent = 'Project link copied.';
        } catch (_) {
            byId('project-share-fallback').hidden = false;
            byId('studio-project-link').focus();
            byId('studio-project-link').select();
            byId('project-share-status').textContent = 'Copy the selected project link.';
        }
    }

    async function loadProjects() {
        if (loading) return;
        loading = true;
        byId('studio-retry').hidden = true;
        byId('project-grid').setAttribute('aria-busy', 'true');
        try {
            const response = await fetch('assets/studio-projects.json', { cache: 'no-cache', signal: AbortSignal.timeout(12000) });
            if (!response.ok) throw new Error('Portfolio unavailable');
            const snapshot = window.ArtPrimeStudio.validateSnapshot(await response.json());
            projects = snapshot.projects;
            activeFilter = 'All spaces';
            byId('example-notice').hidden = !snapshot.isExample;
            byId('work-label').textContent = snapshot.isExample ? 'EXPLORE THE INTERIOR STUDIES' : 'SELECTED PROJECTS';
            renderStage();
            renderFilters();
            renderGrid();
            handleRoute();
        } catch (error) {
            byId('studio-status').textContent = 'The portfolio could not load. Please try again, or contact us to discuss your space.';
            byId('studio-retry').hidden = false;
            console.error('Unable to load Studio:', error);
        } finally {
            loading = false;
            byId('project-grid').setAttribute('aria-busy', 'false');
        }
    }

    function init() {
        gallery = new window.ArtPrimeGallery.Viewer(dialog);
        stage = new window.ArtPrimeStage(document.querySelector('.studio-stage'), {
            setImage, onChange: updateStage, onOpen: id => openProject(id)
        });
        byId('stage-prev').addEventListener('click', () => stage.goBy(-1));
        byId('stage-next').addEventListener('click', () => stage.goBy(1));
        byId('project-close').addEventListener('click', () => closeProject());
        dialog.addEventListener('cancel', event => { event.preventDefault(); if (!gallery.closePanel()) closeProject(); });
        dialog.addEventListener('close', () => gallery.close());
        byId('next-project').addEventListener('click', () => {
            if (currentProject) openProject(projects[(projects.indexOf(currentProject) + 1) % projects.length].id);
        });
        byId('project-share').addEventListener('click', copyProjectLink);
        byId('studio-retry').addEventListener('click', loadProjects);
        document.addEventListener('keydown', event => {
            if (event.target.closest('input,textarea,select')) return;
            if (dialog.open && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
                event.preventDefault();
                gallery.goBy(event.key === 'ArrowRight' ? 1 : -1);
            } else if (event.target.closest('.studio-stage')) {
                const direction = { ArrowLeft: -1, ArrowUp: -1, PageUp: -1, ArrowRight: 1, ArrowDown: 1, PageDown: 1 }[event.key];
                if (direction) {
                    event.preventDefault();
                    stage.goBy(direction);
                } else if (event.key === 'Home' || event.key === 'End') {
                    event.preventDefault();
                    stage.goTo(event.key === 'Home' ? 0 : featured.length - 1);
                }
            }
        });
        window.addEventListener('popstate', handleRoute);
        byId('footer-year').textContent = String(new Date().getFullYear());
        loadProjects();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
    else init();
})();
