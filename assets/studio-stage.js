/* A native, full-viewport project gallery. Wheel and touch scrolling stay native. */
(function () {
    'use strict';

    class StudioStage {
        constructor(root, { setImage, onChange, onOpen }) {
            this.root = root;
            this.viewport = root.querySelector('#stage-viewport');
            this.track = root.querySelector('#stage-track');
            this.setImage = setImage;
            this.onChange = onChange;
            this.onOpen = onOpen;
            this.projects = [];
            this.slides = [];
            this.index = 0;
            this.targetSlot = null;
            this.lastHeight = 0;
            this.frame = 0;
            this.settleTimer = 0;
            this.suppressClickUntil = 0;
            this.preference = window.matchMedia('(prefers-reduced-motion: reduce)');

            this.viewport.addEventListener('scroll', () => {
                if (!this.frame) this.frame = requestAnimationFrame(() => this.readPosition());
                clearTimeout(this.settleTimer);
                this.settleTimer = setTimeout(() => this.settle(), 180);
            }, { passive: true });
            this.viewport.addEventListener('scrollend', () => this.settle());
            this.viewport.addEventListener('click', event => {
                const link = event.target.closest('.stage-cover-link');
                if (!link || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
                event.preventDefault();
                if (Date.now() >= this.suppressClickUntil) this.onOpen(link.dataset.projectId);
            });

            let touch = null;
            this.viewport.addEventListener('touchstart', event => {
                touch = event.touches.length === 1
                    ? [event.touches[0].clientX, event.touches[0].clientY] : null;
            }, { passive: true });
            this.viewport.addEventListener('touchmove', event => {
                if (!touch) return;
                const dx = event.touches[0].clientX - touch[0];
                const dy = event.touches[0].clientY - touch[1];
                if (Math.hypot(dx, dy) > 10) this.suppressClickUntil = Date.now() + 450;
            }, { passive: true });
            this.viewport.addEventListener('touchend', event => {
                if (!touch || !event.changedTouches.length) return;
                const dx = event.changedTouches[0].clientX - touch[0];
                const dy = event.changedTouches[0].clientY - touch[1];
                if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.5) {
                    this.suppressClickUntil = Date.now() + 450;
                    this.goBy(dx < 0 ? 1 : -1);
                }
                touch = null;
            }, { passive: true });
            this.viewport.addEventListener('touchcancel', () => { touch = null; }, { passive: true });

            const resize = () => this.syncHeight();
            if ('ResizeObserver' in window) new ResizeObserver(resize).observe(this.viewport);
            else window.addEventListener('resize', resize, { passive: true });
            this.preference.addEventListener('change', () => {
                if (this.preference.matches && this.projects.length) {
                    this.moveToSlot(this.projects.length > 1 ? this.index + 1 : 0, false);
                }
            });
        }

        setProjects(projects) {
            clearTimeout(this.settleTimer);
            if (this.frame) cancelAnimationFrame(this.frame);
            this.frame = 0;
            this.projects = projects;
            this.index = 0;
            this.targetSlot = null;
            this.slides = [];
            this.root.classList.toggle('has-projects', projects.length > 0);
            if (!projects.length) return;

            const initialImage = this.root.querySelector('#stage-image');
            const fragment = document.createDocumentFragment();
            const makeSlide = (project, index, clone = false) => {
                const slide = document.createElement('div');
                slide.className = 'stage-slide';
                slide.setAttribute('role', 'group');
                slide.setAttribute('aria-roledescription', 'slide');
                slide.setAttribute('aria-label', `${index + 1} of ${projects.length}: ${project.title}`);
                const link = document.createElement('a');
                link.className = 'stage-cover-link';
                const url = new URL(window.location.href);
                url.searchParams.set('project', project.id);
                url.hash = '';
                link.href = url.href;
                link.dataset.projectId = project.id;
                link.setAttribute('aria-label', `Explore ${project.title}`);
                link.tabIndex = -1;
                const image = !clone && index === 0 && initialImage ? initialImage : new Image();
                image.removeAttribute('id');
                image.className = 'stage-image';
                image.width = 1600;
                image.height = 1067;
                image.decoding = 'async';
                image.draggable = false;
                image.loading = clone || index <= 1 || index === projects.length - 1 ? 'eager' : 'lazy';
                image.fetchPriority = !clone && index === 0 ? 'high' : 'auto';
                this.setImage(image, project.coverImage, clone ? '' : project.coverAlt, 'stage');
                link.append(image);
                slide.append(link);
                if (clone) {
                    slide.setAttribute('aria-hidden', 'true');
                    slide.inert = true;
                    slide.dataset.clone = 'true';
                } else this.slides.push(slide);
                fragment.append(slide);
            };

            // Two inert boundary copies let the last and first projects join seamlessly.
            if (projects.length > 1) makeSlide(projects.at(-1), projects.length - 1, true);
            projects.forEach((project, index) => makeSlide(project, index));
            if (projects.length > 1) makeSlide(projects[0], 0, true);
            this.track.replaceChildren(fragment);
            this.lastHeight = this.viewport.clientHeight;
            this.moveToSlot(projects.length > 1 ? 1 : 0, false);
            this.activate(0, true);
        }

        indexForSlot(slot) {
            const count = this.projects.length;
            return count > 1 ? ((slot - 1) % count + count) % count : 0;
        }

        syncHeight() {
            const height = this.viewport.clientHeight;
            if (!height || Math.abs(height - this.lastHeight) <= 1 || !this.projects.length) return false;
            // A resize can emit a scroll event before ResizeObserver runs. Preserve
            // the selected project before reading the old offset at the new height.
            this.lastHeight = height;
            this.targetSlot = null;
            this.moveToSlot(this.projects.length > 1 ? this.index + 1 : 0, false);
            return true;
        }

        readPosition() {
            this.frame = 0;
            if (!this.projects.length || !this.viewport.clientHeight) return;
            if (this.syncHeight()) return;
            const slot = Math.round(this.viewport.scrollTop / this.viewport.clientHeight);
            this.activate(this.indexForSlot(slot));
        }

        activate(index, initial = false) {
            if (!this.projects.length || (!initial && index === this.index)) return;
            const focusedSlide = document.activeElement?.closest('.stage-slide');
            if (focusedSlide && focusedSlide !== this.slides[index]) this.viewport.focus({ preventScroll: true });
            this.index = index;
            this.slides.forEach((slide, i) => {
                slide.setAttribute('aria-hidden', String(i !== index));
                slide.querySelector('a').tabIndex = i === index ? 0 : -1;
                const image = slide.querySelector('img');
                if (i === index) image.id = 'stage-image';
                else image.removeAttribute('id');
            });
            for (const offset of [-1, 0, 1]) {
                const neighbor = (index + offset + this.projects.length) % this.projects.length;
                this.slides[neighbor].querySelector('img').loading = 'eager';
            }
            this.onChange(this.projects[index], index, initial);
        }

        moveToSlot(slot, animate = true) {
            this.viewport.scrollTo({ top: slot * this.viewport.clientHeight,
                behavior: animate && !this.preference.matches ? 'smooth' : 'instant' });
        }

        goTo(index) {
            const count = this.projects.length;
            if (count < 2) return;
            const selected = ((index % count) + count) % count;
            this.targetSlot = selected + 1;
            this.moveToSlot(this.targetSlot);
        }

        goBy(direction) {
            const count = this.projects.length;
            if (count < 2) return;
            const current = this.targetSlot ?? Math.round(this.viewport.scrollTop / this.viewport.clientHeight);
            this.targetSlot = Math.max(0, Math.min(count + 1, current + direction));
            this.moveToSlot(this.targetSlot);
        }

        settle() {
            clearTimeout(this.settleTimer);
            if (!this.projects.length || !this.viewport.clientHeight) return;
            this.readPosition();
            const height = this.viewport.clientHeight;
            const slot = Math.round(this.viewport.scrollTop / height);
            // Wait for the snap to finish before moving between identical boundary images.
            if (this.projects.length > 1 && Math.abs(this.viewport.scrollTop - slot * height) < 2) {
                if (slot === 0) this.moveToSlot(this.projects.length, false);
                else if (slot === this.projects.length + 1) this.moveToSlot(1, false);
            }
            this.targetSlot = null;
        }
    }

    window.ArtPrimeStage = StudioStage;
})();
