(function (root, factory) {
    const gallery = factory();
    if (typeof module === 'object' && module.exports) module.exports = gallery;
    else root.ArtPrimeGallery = gallery;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    // Loading and timing are independent of the DOM so late image responses
    // cannot replace a newer selection or restart a closed project's slideshow.
    class Slideshow {
        constructor({ load, present, onState = () => {}, onError = () => {}, clock = {
            setTimeout: (fn, delay) => globalThis.setTimeout(fn, delay),
            clearTimeout: handle => globalThis.clearTimeout(handle)
        }, interval = 12000 }) {
            Object.assign(this, { load, present, onState, onError, clock, interval });
            this.items = [];
            this.generation = 0;
            this.timer = null;
            this.index = -1;
            this.target = 0;
            this.isOpen = false;
            this.pending = false;
            this.paused = false;
            this.suspensions = new Set();
        }

        clearTimer() {
            if (this.timer !== null) this.clock.clearTimeout(this.timer);
            this.timer = null;
        }

        update() {
            this.clearTimer();
            const playing = this.isOpen && this.items.length > 1 && this.index >= 0
                && !this.pending && !this.paused && !this.suspensions.size;
            if (playing) this.timer = this.clock.setTimeout(() => this.goBy(1, false), this.interval);
            this.onState({ playing, paused: this.paused, pending: this.pending, index: this.index, count: this.items.length });
        }

        open(items, { reducedMotion = false, hidden = false } = {}) {
            this.close();
            this.items = items;
            this.isOpen = true;
            this.reducedMotion = reducedMotion;
            this.paused = reducedMotion;
            if (hidden) this.suspensions.add('visibility');
            return this.goTo(0, false);
        }

        close() {
            this.clearTimer();
            this.generation++;
            this.isOpen = false;
            this.pending = false;
            this.index = -1;
            this.target = 0;
            this.items = [];
            this.suspensions.clear();
        }

        async goTo(index, manual = true) {
            if (!this.isOpen || !this.items.length) return;
            const selected = ((index % this.items.length) + this.items.length) % this.items.length;
            this.target = selected;
            if (selected === this.index && !this.pending) { this.update(); return; }
            const generation = ++this.generation;
            this.pending = true;
            this.update();
            try {
                const asset = await this.load(this.items[selected]);
                if (!this.isOpen || generation !== this.generation) return;
                this.present(asset, selected, { initial: this.index < 0, manual, reducedMotion: this.reducedMotion });
                this.index = selected;
                this.pending = false;
                this.update();
            } catch (error) {
                if (!this.isOpen || generation !== this.generation) return;
                this.pending = false;
                this.paused = true;
                this.onError(error);
                this.update();
            }
        }

        goBy(direction, manual = true) { return this.goTo(this.target + direction, manual); }
        setPaused(paused) { this.paused = paused; this.update(); }
        suspend(reason, suspended) {
            if (suspended) this.suspensions.add(reason);
            else this.suspensions.delete(reason);
            this.update();
        }
        setReducedMotion(reduced) {
            this.reducedMotion = reduced;
            if (reduced) this.paused = true;
            this.update();
        }
    }

    class Viewer {
        constructor(dialog) {
            this.dialog = dialog;
            this.find = id => dialog.querySelector(`#${id}`);
            this.frames = this.find('gallery-frames');
            this.preference = window.matchMedia('(prefers-reduced-motion: reduce)');
            this.cache = new Map();
            this.loads = new Set();
            this.animations = [];
            this.panel = null;
            this.slideshow = new Slideshow({
                load: image => this.photo(image),
                present: (asset, index, options) => this.present(asset, index, options),
                onState: state => this.updateControls(state),
                onError: error => {
                    console.error('Unable to show Studio photograph:', error);
                    this.find('gallery-announcement').textContent = 'The photograph could not load. Please choose another photo.';
                }
            });
            this.find('gallery-prev').addEventListener('click', () => this.goBy(-1));
            this.find('gallery-next').addEventListener('click', () => this.goBy(1));
            this.find('gallery-playback').addEventListener('click', () => this.slideshow.setPaused(!this.slideshow.paused));
            this.find('gallery-fit').addEventListener('click', () => {
                const fit = this.dialog.classList.toggle('gallery-fit');
                this.find('gallery-fit').setAttribute('aria-pressed', String(fit));
                this.find('gallery-fit').textContent = fit ? 'Fill screen' : 'Fit image';
            });
            this.find('gallery-photos-toggle').addEventListener('click', () => this.togglePanel('gallery-contact-sheet'));
            this.find('gallery-info-toggle').addEventListener('click', () => this.togglePanel('project-information'));
            this.dialog.querySelectorAll('[data-gallery-panel-close]').forEach(button => button.addEventListener('click', () => this.closePanel()));
            document.addEventListener('visibilitychange', () => this.slideshow.suspend('visibility', document.hidden));
            window.addEventListener('pagehide', () => this.slideshow.suspend('page', true));
            window.addEventListener('pageshow', () => this.slideshow.suspend('page', false));
            this.preference.addEventListener('change', event => {
                this.slideshow.setReducedMotion(event.matches);
                if (event.matches) this.finishTransition();
            });
            let pointer = null;
            const scene = this.find('gallery-scene');
            scene.addEventListener('pointerdown', event => {
                if (event.isPrimary && event.button === 0) pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
            });
            scene.addEventListener('pointerup', event => {
                if (!pointer || pointer.id !== event.pointerId) return;
                const dx = event.clientX - pointer.x;
                const dy = event.clientY - pointer.y;
                pointer = null;
                if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.5) this.goBy(dx < 0 ? 1 : -1);
            });
            scene.addEventListener('pointercancel', () => { pointer = null; });
        }

        photo(image) {
            if (this.cache.has(image.url)) return this.cache.get(image.url);
            const promise = new Promise(resolve => {
                const element = document.createElement('img');
                element.alt = image.alt;
                element.width = 1920;
                element.height = 1280;
                element.decoding = 'async';
                element.draggable = false;
                let unavailable = false;
                let finished = false;
                let timeout;
                const cleanup = () => {
                    clearTimeout(timeout);
                    element.onload = element.onerror = null;
                    this.loads.delete(cancel);
                };
                const ready = () => {
                    if (finished) return;
                    finished = true;
                    cleanup();
                    resolve({ element, unavailable });
                };
                const cancel = () => {
                    finished = true;
                    cleanup();
                    element.removeAttribute('srcset');
                    element.removeAttribute('src');
                    resolve(null);
                };
                const fallback = () => {
                    if (finished) return;
                    unavailable = true;
                    element.removeAttribute('srcset');
                    element.alt = `${image.alt} — photograph unavailable`;
                    element.src = new URL('assets/product-placeholder.svg', document.baseURI).href;
                    // Even a failed placeholder must not block manual navigation.
                    element.onload = element.onerror = ready;
                    clearTimeout(timeout);
                    timeout = setTimeout(ready, 3000);
                };
                element.onload = () => {
                    if (element.decode) element.decode().catch(() => {}).then(ready);
                    else ready();
                };
                element.onerror = fallback;
                this.loads.add(cancel);
                timeout = setTimeout(fallback, 15000);
                const variants = window.ArtPrimeCatalogue.imageVariants(image.url, [640, 960, 1600, 1920], document.baseURI);
                element.sizes = '100vw';
                if (variants.srcset) element.srcset = variants.srcset;
                element.src = variants.src;
            });
            this.cache.set(image.url, promise);
            // Keep only the current view, its neighbour and a recent manual view.
            while (this.cache.size > 3) this.cache.delete(this.cache.keys().next().value);
            return promise;
        }

        finishTransition() {
            this.animations.forEach(animation => animation.cancel());
            this.animations = [];
            const current = this.frames.lastElementChild;
            [...this.frames.children].forEach(image => { if (image !== current) image.remove(); });
            if (current) current.style.opacity = '1';
        }

        present(asset, index, { initial, manual, reducedMotion }) {
            if (!asset) return;
            this.finishTransition();
            const previous = this.frames.lastElementChild;
            const photo = this.project.images[index];
            const image = asset.element;
            if (previous && previous !== image) { previous.removeAttribute('id'); previous.setAttribute('aria-hidden', 'true'); previous.alt = ''; }
            image.removeAttribute('aria-hidden');
            image.alt = asset.unavailable ? `${photo.alt} — photograph unavailable` : photo.alt;
            image.id = 'gallery-image';
            this.frames.append(image);
            if (previous && previous !== image && !initial && !reducedMotion) {
                const animation = image.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 1100, easing: 'linear', fill: 'both' });
                this.animations.push(animation);
                animation.finished.then(() => previous.remove()).catch(() => {});
            } else if (previous !== image) previous?.remove();
            this.find('gallery-caption').textContent = asset.unavailable ? 'Photograph unavailable. Choose another view.' : photo.caption || '';
            this.find('gallery-count').textContent = `${String(index + 1).padStart(2, '0')} / ${String(this.project.images.length).padStart(2, '0')}`;
            this.find('gallery-thumbs').querySelectorAll('button').forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
            if (manual) this.find('gallery-announcement').textContent = `Photo ${index + 1} of ${this.project.images.length}. ${photo.alt}`;
            if (this.project.images.length > 1) this.photo(this.project.images[(index + 1) % this.project.images.length]);
        }

        updateControls({ playing, paused, pending }) {
            this.find('gallery-scene').setAttribute('aria-busy', String(pending));
            this.find('gallery-playback').textContent = paused ? 'Play' : 'Pause';
            this.find('gallery-playback').setAttribute('aria-label', paused ? 'Play automatic slideshow' : 'Pause automatic slideshow');
            this.progress?.cancel();
            this.progress = null;
            const progress = this.find('gallery-progress');
            progress.hidden = !playing || this.preference.matches;
            if (playing && !this.preference.matches) this.progress = progress.animate(
                [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }],
                { duration: this.slideshow.interval, easing: 'linear', fill: 'both' }
            );
        }

        open(project) {
            this.close();
            this.project = project;
            this.find('gallery-project-title').textContent = project.title;
            this.find('gallery-caption').textContent = '';
            this.find('gallery-count').textContent = '';
            this.find('gallery-announcement').textContent = '';
            const thumbnails = document.createDocumentFragment();
            project.images.forEach((photo, index) => {
                const button = document.createElement('button');
                button.className = 'gallery-thumb';
                button.type = 'button';
                button.setAttribute('aria-label', `View photo ${index + 1}: ${photo.alt}`);
                button.setAttribute('aria-pressed', 'false');
                button.addEventListener('click', () => { this.slideshow.goTo(index); this.closePanel(); });
                const image = document.createElement('img');
                image.width = 160;
                image.height = 120;
                image.alt = '';
                image.loading = 'lazy';
                image.decoding = 'async';
                const variants = window.ArtPrimeCatalogue.imageVariants(photo.url, [160, 320], document.baseURI);
                image.sizes = '160px';
                if (variants.srcset) image.srcset = variants.srcset;
                image.src = variants.src;
                image.onerror = () => { image.onerror = null; image.removeAttribute('srcset'); image.src = new URL('assets/product-placeholder.svg', document.baseURI).href; };
                const number = document.createElement('span');
                number.textContent = String(index + 1).padStart(2, '0');
                button.append(image, number);
                thumbnails.append(button);
            });
            this.find('gallery-thumbs').replaceChildren(thumbnails);
            for (const id of ['gallery-prev', 'gallery-next', 'gallery-playback', 'gallery-photos-toggle']) this.find(id).hidden = project.images.length < 2;
            this.slideshow.open(project.images, { reducedMotion: this.preference.matches, hidden: document.hidden });
        }

        goBy(direction) { if (!this.panel) this.slideshow.goBy(direction); }

        togglePanel(id) {
            if (this.panel === id) { this.closePanel(); return; }
            this.closePanel(false);
            this.panel = id;
            this.find(id).hidden = false;
            this.find(id).scrollTop = 0;
            const toggle = this.find(id === 'project-information' ? 'gallery-info-toggle' : 'gallery-photos-toggle');
            toggle.setAttribute('aria-expanded', 'true');
            this.slideshow.suspend('panel', true);
            this.find(id).querySelector('[data-gallery-panel-close]').focus({ preventScroll: true });
        }

        closePanel(restoreFocus = true) {
            if (!this.panel) return false;
            const id = this.panel;
            this.find(id).hidden = true;
            this.panel = null;
            const toggle = this.find(id === 'project-information' ? 'gallery-info-toggle' : 'gallery-photos-toggle');
            toggle.setAttribute('aria-expanded', 'false');
            this.slideshow.suspend('panel', false);
            if (restoreFocus) toggle.focus({ preventScroll: true });
            return true;
        }

        close() {
            this.slideshow.close();
            this.closePanel(false);
            this.loads.forEach(cancel => cancel());
            this.cache.clear();
            this.finishTransition();
            this.frames.replaceChildren();
            this.progress?.cancel();
            this.progress = null;
            this.find('gallery-progress').hidden = true;
            this.dialog.classList.remove('gallery-fit');
            this.find('gallery-fit').setAttribute('aria-pressed', 'false');
            this.find('gallery-fit').textContent = 'Fit image';
        }
    }

    return { Slideshow, Viewer };
});
