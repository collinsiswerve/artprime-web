(function () {
    'use strict';

    const catalogue = window.ArtPrimeCatalogue;
    const sheetId = '1A7pErif9dQMJ8Q-yclWOFDSgKzUNg4qLFbm6u-_Be5k';
    const sheetURL = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json`;
    const byId = id => document.getElementById(id);
    const placeholder = new URL('assets/product-placeholder.svg', document.baseURI).href;
    let allProducts = [];
    let currentProduct = null;
    let selectedQty = 1;
    let cart = [];
    let activeCategory = 'All';
    let catalogueState = 'loading';
    let requestNumber = 0;
    let cartNotice = '';
    let modalReturnFocus = null;
    let cartReturnFocus = null;

    function element(tag, classes = '', text) {
        const node = document.createElement(tag);
        node.className = classes;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    function button(classes, label, action) {
        const node = element('button', classes, label);
        node.type = 'button';
        node.addEventListener('click', action);
        return node;
    }

    function setImage(image, source, name, widths = [640, 960, 1280, 1600], sizes = '(min-width: 1280px) 496px, (min-width: 768px) calc((100vw - 240px) / 2), calc(100vw - 80px)') {
        image.alt = name;
        image.onerror = () => {
            image.onerror = null;
            image.removeAttribute('srcset');
            image.removeAttribute('sizes');
            image.src = placeholder;
        };
        const variants = catalogue.imageVariants(source, widths, document.baseURI);
        if (variants.srcset) {
            image.sizes = sizes;
            image.srcset = variants.srcset;
        } else {
            image.removeAttribute('srcset');
            image.removeAttribute('sizes');
        }
        image.src = variants.src;
    }

    function productImage(product, classes, kind = 'catalogue') {
        const image = element('img', classes);
        image.loading = 'lazy';
        image.decoding = 'async';
        const cartImage = kind === 'cart';
        image.width = cartImage ? 80 : 600;
        image.height = cartImage ? 80 : kind === 'recommendation' ? 600 : 800;
        const sizes = cartImage ? '80px' : kind === 'recommendation'
            ? '(min-width: 1280px) 336px, (min-width: 768px) calc((100vw - 224px) / 3), (min-width: 640px) calc((100vw - 144px) / 3), calc(100vw - 96px)'
            : '(min-width: 1280px) 296px, (min-width: 1024px) calc((100vw - 144px) / 4), (min-width: 640px) calc((100vw - 80px) / 2), calc(100vw - 48px)';
        setImage(image, product.image, product.name, cartImage ? [80, 160, 240] : [320, 480, 640, 960], sizes);
        return image;
    }

    function priceContent(product) {
        const fragment = document.createDocumentFragment();
        if (product.isOnSale) {
            fragment.append(element('span', 'line-through text-gray-500 text-sm mr-2', catalogue.formatMoney(product.originalPrice)));
        }
        fragment.append(document.createTextNode(catalogue.formatMoney(catalogue.priceOf(product))));
        return fragment;
    }

    function soldOutBadge(compact = false) {
        const overlay = element('div', 'absolute inset-0 bg-white bg-opacity-60 z-10 flex items-center justify-center');
        overlay.append(element('span', compact
            ? 'bg-navy text-white px-3 py-1 uppercase tracking-widest text-xs font-semibold shadow-md border border-white'
            : 'bg-navy text-white px-5 py-2 uppercase tracking-widest text-sm font-semibold shadow-md border border-white', 'Sold Out'));
        return overlay;
    }

    function productCard(product, compact = false) {
        const card = button('text-left w-full group cursor-pointer flex flex-col focus:outline-none focus:ring-2 focus:ring-terra focus:ring-offset-2 rounded', undefined, () => openModal(product.id));
        card.setAttribute('aria-label', `View details for ${product.name}${product.isSoldOut ? ', sold out' : ''}`);
        card.dataset.productId = product.id;
        const picture = element('div', compact
            ? 'relative overflow-hidden mb-3 bg-gray-100 aspect-square w-full'
            : 'relative w-full overflow-hidden mb-4 bg-gray-100 aspect-[3/4]');
        if (product.isSoldOut) picture.append(soldOutBadge(compact));
        else if (product.isOnSale) picture.append(element('div', 'absolute top-4 left-4 bg-terra text-white text-xs px-3 py-1 uppercase tracking-widest font-semibold z-10', 'Sale'));
        picture.append(productImage(product, 'w-full h-full object-cover group-hover:scale-105 transition-transform duration-700', compact ? 'recommendation' : 'catalogue'));
        const price = element('p', compact ? 'text-sm text-gray-600 mt-1' : 'text-gray-600 mt-1');
        price.append(priceContent(product));
        card.append(picture, element(compact ? 'h4' : 'h3', 'font-serif text-lg text-navy', product.name), price);
        return card;
    }

    function renderProducts(category = activeCategory) {
        activeCategory = category;
        document.querySelectorAll('.tab-btn').forEach(tab => {
            const active = tab.textContent.trim() === category;
            tab.classList.toggle('text-navy', active);
            tab.classList.toggle('border-terra', active);
            tab.classList.toggle('border-transparent', !active);
            tab.setAttribute('aria-pressed', String(active));
        });
        const query = byId('search-input').value;
        byId('clear-search').classList.toggle('hidden', !query);
        if (catalogueState !== 'ready') {
            byId('product-grid').replaceChildren();
            byId('empty-state').classList.add('hidden');
            byId('search-status').textContent = '';
            return;
        }
        const result = catalogue.searchProducts(allProducts, query, category);
        const fragment = document.createDocumentFragment();
        result.products.forEach(product => fragment.append(productCard(product)));
        byId('product-grid').replaceChildren(fragment);
        byId('empty-state').classList.toggle('hidden', result.products.length > 0);
        const count = result.products.length;
        byId('search-status').textContent = result.approximate
            ? `No exact matches. Showing ${count} similar ${count === 1 ? 'product' : 'products'}.`
            : `${count} ${count === 1 ? 'product' : 'products'}${catalogue.normalize(query) ? ' matching your search' : ''}.`;
    }

    function handleSearch() { renderProducts(); }

    function clearSearch() {
        byId('search-input').value = '';
        renderProducts();
        byId('search-input').focus();
    }

    async function loadCatalogue() {
        const request = ++requestNumber;
        catalogueState = 'loading';
        byId('loading-state').classList.remove('hidden');
        byId('catalogue-error').classList.add('hidden');
        byId('product-notice').textContent = '';
        byId('product-grid').setAttribute('aria-busy', 'true');
        updateCartUI();
        updateAddButton();
        renderProducts();
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 20000);
        try {
            const response = await fetch(sheetURL, { cache: 'no-store', signal: controller.signal });
            if (!response.ok) throw new Error('Catalogue request failed');
            const products = catalogue.parseSheetResponse(await response.text(), document.baseURI);
            if (request !== requestNumber) return;
            const reconciled = catalogue.reconcileCart(cart, products);
            allProducts = products;
            cart = reconciled.cart;
            catalogueState = 'ready';
            const notices = [];
            if (reconciled.removed) notices.push('Unavailable items were removed from your cart.');
            if (reconciled.repriced) notices.push('Cart prices were updated to the current prices.');
            cartNotice = notices.join(' ');
            updateCartUI();
            renderProducts();
            handleProductRoute();
        } catch (error) {
            if (request !== requestNumber) return;
            catalogueState = 'error';
            byId('catalogue-error').classList.remove('hidden');
            updateCartUI();
            updateAddButton();
            // Preserve saved selections on a network or catalogue error.
            console.error('Unable to load catalogue:', error);
        } finally {
            window.clearTimeout(timeout);
            if (request === requestNumber) {
                byId('loading-state').classList.add('hidden');
                byId('product-grid').setAttribute('aria-busy', 'false');
            }
        }
    }

    function modalIsOpen() { return !byId('product-modal').classList.contains('hidden'); }
    function cartIsOpen() { return byId('cart-drawer').classList.contains('cart-open'); }
    function activeDialog() { return cartIsOpen() ? byId('cart-drawer') : modalIsOpen() ? byId('product-modal') : null; }

    function syncDialogs() {
        const active = activeDialog();
        for (const node of document.querySelectorAll('body > nav, body > main, body > footer')) node.inert = Boolean(active);
        for (const dialog of [byId('product-modal'), byId('cart-drawer')]) {
            dialog.inert = dialog !== active;
            dialog.setAttribute('aria-hidden', String(dialog !== active));
        }
        document.body.classList.toggle('modal-open', Boolean(active));
    }

    function focusable(dialog) {
        return [...dialog.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]')]
            .filter(node => !node.closest('[inert]') && node.getClientRects().length > 0);
    }

    function focusDialog(dialog) { focusable(dialog)[0]?.focus({ preventScroll: true }); }

    function restoreFocus(opener) {
        const dialog = activeDialog();
        if (dialog) focusDialog(dialog);
        else if (opener?.isConnected && opener !== document.body && !opener.closest('[inert]')) opener.focus({ preventScroll: true });
        else byId('nav-cart-button').focus({ preventScroll: true });
    }

    function updateAddButton() {
        const button = byId('add-to-cart-btn');
        const soldOut = currentProduct?.isSoldOut;
        button.disabled = catalogueState !== 'ready' || !currentProduct || soldOut;
        button.textContent = soldOut ? 'Sold Out' : catalogueState === 'ready' ? 'Add to Cart' : 'Checking availability…';
        button.classList.toggle('bg-gray-400', button.disabled);
        button.classList.toggle('cursor-not-allowed', button.disabled);
        button.classList.toggle('bg-navy', !button.disabled);
        button.classList.toggle('hover:bg-terra', !button.disabled);
    }

    function openModal(id, { syncRoute = true } = {}) {
        if (catalogueState !== 'ready') return;
        const product = allProducts.find(item => item.id === catalogue.idOf(id));
        if (!product) return;
        const wasOpen = modalIsOpen();
        if (cartIsOpen()) toggleCart(false);
        if (!wasOpen) modalReturnFocus = document.activeElement;
        const sameProduct = wasOpen && currentProduct?.id === product.id;
        currentProduct = product;
        if (!sameProduct) selectedQty = 1;
        byId('modal-qty').textContent = selectedQty;
        byId('modal-title').textContent = product.name;
        byId('modal-desc').textContent = product.description;
        setImage(byId('modal-image'), product.image, product.name);
        byId('modal-price').replaceChildren(priceContent(product));
        byId('modal-sale-badge').replaceChildren();
        if (product.isOnSale && !product.isSoldOut) {
            byId('modal-sale-badge').append(element('div', 'absolute top-4 left-4 bg-terra text-white text-xs px-3 py-1 uppercase tracking-widest font-semibold z-10', 'Sale'));
        }
        byId('modal-sold-out-overlay').replaceChildren();
        if (product.isSoldOut) byId('modal-sold-out-overlay').append(soldOutBadge());
        updateAddButton();
        byId('share-status').textContent = '';
        byId('share-link-fallback').classList.add('hidden');
        byId('product-link').value = catalogue.productURL(window.location.href, product.id);
        byId('share-product-btn').textContent = typeof navigator.share === 'function' ? 'Share product' : 'Copy product link';
        const recommendations = document.createDocumentFragment();
        allProducts.filter(item => item.id !== product.id && !item.isSoldOut).slice(0, 3)
            .forEach(item => recommendations.append(productCard(item, true)));
        byId('recommends-grid').replaceChildren(recommendations);
        byId('recommendations').classList.toggle('hidden', !byId('recommends-grid').childNodes.length);
        byId('product-modal').classList.remove('hidden');
        if (!sameProduct) byId('product-modal-content').scrollTop = 0;
        syncDialogs();
        focusDialog(byId('product-modal'));
        if (syncRoute) {
            const url = catalogue.productURL(window.location.href, product.id);
            if (new URL(window.location.href).searchParams.has('product')) window.history.replaceState(window.history.state, '', url);
            else window.history.pushState({ ...window.history.state, artPrimeProduct: true }, '', url);
        }
    }

    function closeModal({ syncRoute = true } = {}) {
        const wasOpen = modalIsOpen();
        byId('product-modal').classList.add('hidden');
        currentProduct = null;
        syncDialogs();
        if (wasOpen) restoreFocus(modalReturnFocus);
        if (syncRoute && new URL(window.location.href).searchParams.has('product')) {
            if (window.history.state?.artPrimeProduct) window.history.back();
            else {
                const url = new URL(window.location.href);
                url.searchParams.delete('product');
                window.history.replaceState(window.history.state, '', url);
            }
        }
    }

    function handleProductRoute() {
        if (catalogueState !== 'ready') return;
        const id = new URL(window.location.href).searchParams.get('product');
        if (id !== null && allProducts.some(product => product.id === catalogue.idOf(id))) {
            byId('product-notice').textContent = '';
            openModal(id, { syncRoute: false });
        } else {
            closeModal({ syncRoute: false });
            byId('product-notice').textContent = id === null ? '' : 'This product is no longer available. Please browse the current collection.';
        }
    }

    function updateQty(change) {
        const next = selectedQty + change;
        if (catalogue.validQuantity(next)) selectedQty = next;
        byId('modal-qty').textContent = selectedQty;
    }

    async function shareProduct() {
        if (!currentProduct) return;
        const url = catalogue.productURL(window.location.href, currentProduct.id);
        if (typeof navigator.share === 'function') {
            try {
                await navigator.share({ title: `${currentProduct.name} | Art Prime Interiors`, url });
                return;
            } catch (error) {
                if (error.name === 'AbortError') return;
            }
        }
        try {
            await navigator.clipboard.writeText(url);
            byId('share-status').textContent = 'Product link copied. Paste it into WhatsApp or any message.';
        } catch (_) {
            byId('product-link').value = url;
            byId('share-link-fallback').classList.remove('hidden');
            byId('share-status').textContent = 'Select and copy the product link below.';
            byId('product-link').focus();
            byId('product-link').select();
        }
    }

    function addToCart() {
        if (catalogueState !== 'ready' || !currentProduct || currentProduct.isSoldOut) return;
        const existing = cart.find(item => item.id === currentProduct.id);
        const quantity = (existing?.qty ?? 0) + selectedQty;
        if (!catalogue.validQuantity(quantity)) return;
        if (existing) existing.qty = quantity;
        else cart.push({ id: currentProduct.id, name: currentProduct.name, image: currentProduct.image, price: catalogue.priceOf(currentProduct), qty: selectedQty });
        updateCartUI();
        closeModal();
        toggleCart(true);
    }

    function toggleCart(forceOpen) {
        const shouldOpen = forceOpen ?? !cartIsOpen();
        if (shouldOpen === cartIsOpen()) return;
        if (shouldOpen) {
            if (modalIsOpen()) closeModal();
            cartReturnFocus = document.activeElement;
        }
        byId('cart-drawer').classList.toggle('cart-open', shouldOpen);
        byId('cart-drawer').classList.toggle('cart-closed', !shouldOpen);
        byId('cart-overlay').classList.toggle('hidden', !shouldOpen);
        syncDialogs();
        if (shouldOpen) focusDialog(byId('cart-drawer'));
        else restoreFocus(cartReturnFocus);
    }

    function changeCartQty(id, amount) {
        const item = cart.find(item => item.id === id);
        if (!item) return;
        const next = item.qty + amount;
        if (next <= 0) removeFromCart(id);
        else if (catalogue.validQuantity(next)) {
            item.qty = next;
            updateCartUI();
        }
    }

    function removeFromCart(id) {
        cart = cart.filter(item => item.id !== id);
        updateCartUI();
    }

    function cartAction(item, action, label, text, handler) {
        const control = button('px-3 py-2 text-gray-600 hover:bg-gray-100 transition focus:outline-none focus:ring-2 focus:ring-terra rounded', text, handler);
        control.setAttribute('aria-label', `${label} ${item.name}`);
        control.dataset.cartId = item.id;
        control.dataset.cartAction = action;
        return control;
    }

    function updateCartUI() {
        try { window.localStorage.setItem('artPrimeCart', JSON.stringify(cart)); }
        catch (_) { /* The cart still works in memory if storage is unavailable. */ }
        const focused = document.activeElement;
        const previousId = focused?.dataset.cartId;
        const previousAction = focused?.dataset.cartAction;
        const fragment = document.createDocumentFragment();
        if (!cart.length) {
            const empty = element('div', 'flex flex-col items-center justify-center h-full text-gray-600');
            empty.append(element('p', 'font-light', 'Your cart is empty.'), button('mt-6 border-b border-terra text-terra hover:text-navy transition-colors', 'Continue Shopping', () => toggleCart(false)));
            fragment.append(empty);
        }
        for (const item of cart) {
            const row = element('div', 'flex items-center gap-4 border-b border-gray-100 pb-4');
            const details = element('div', 'flex-1 min-w-0');
            details.append(element('h4', 'font-serif text-navy text-sm leading-tight break-words', item.name || 'Saved item'),
                element('p', 'text-terra font-semibold text-sm mt-1', catalogueState === 'ready' ? catalogue.formatMoney(item.price * item.qty) : 'Confirming price…'));
            const quantity = element('div', 'flex items-center mt-3 border border-gray-200 w-fit rounded');
            quantity.append(cartAction(item, 'decrease', 'Decrease quantity for', '−', () => changeCartQty(item.id, -1)),
                element('span', 'px-3 text-xs font-semibold text-navy', item.qty),
                cartAction(item, 'increase', 'Increase quantity for', '+', () => changeCartQty(item.id, 1)));
            details.append(quantity);
            row.append(productImage(item, 'w-20 h-20 object-cover bg-gray-100 shrink-0', 'cart'), details,
                cartAction(item, 'remove', 'Remove from cart:', '×', () => removeFromCart(item.id)));
            fragment.append(row);
        }
        byId('cart-items').replaceChildren(fragment);
        const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
        const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
        byId('nav-cart-count').textContent = `(${totalItems > 99 ? '99+' : totalItems})`;
        byId('nav-cart-button').setAttribute('aria-label', `Open cart, ${totalItems} ${totalItems === 1 ? 'item' : 'items'}`);
        byId('cart-subtotal').textContent = cart.length && catalogueState !== 'ready' ? 'Confirming…' : catalogue.formatMoney(subtotal);
        const checkout = byId('checkout-btn');
        checkout.disabled = !catalogue.orderURL(cart, catalogueState === 'ready');
        checkout.classList.toggle('bg-gray-300', checkout.disabled);
        checkout.classList.toggle('cursor-not-allowed', checkout.disabled);
        checkout.classList.toggle('bg-terra', !checkout.disabled);
        checkout.classList.toggle('hover:bg-navy', !checkout.disabled);
        byId('cart-status').textContent = catalogueState === 'loading' && cart.length
            ? 'Checking current prices and availability…'
            : catalogueState === 'error'
                ? 'Prices and availability could not be confirmed. Retry loading the collection before ordering.'
                : cartNotice || (cart.length && checkout.disabled ? 'Please reduce the quantity before ordering.' : '');
        byId('cart-retry').classList.toggle('hidden', catalogueState !== 'error');
        if (previousId && cartIsOpen()) {
            const replacement = [...byId('cart-items').querySelectorAll('button')]
                .find(node => node.dataset.cartId === previousId && node.dataset.cartAction === previousAction);
            if (replacement) replacement.focus({ preventScroll: true });
            else focusDialog(byId('cart-drawer'));
        }
    }

    function checkoutWhatsApp() {
        const url = catalogue.orderURL(cart, catalogueState === 'ready');
        if (url) window.open(url, '_blank', 'noopener,noreferrer');
    }

    function toggleMobileMenu(forceOpen) {
        const menu = byId('mobile-menu');
        const open = forceOpen ?? menu.classList.contains('hidden');
        menu.classList.toggle('hidden', !open);
        document.querySelector('button[aria-controls="mobile-menu"]').setAttribute('aria-expanded', String(open));
    }

    function init() {
        try { cart = catalogue.savedCart(window.localStorage.getItem('artPrimeCart')); }
        catch (_) { cart = []; }
        syncDialogs();
        updateCartUI();
        document.addEventListener('keydown', event => {
            const dialog = activeDialog();
            if (event.key === 'Escape') {
                if (cartIsOpen()) toggleCart(false);
                else if (modalIsOpen()) closeModal();
                else toggleMobileMenu(false);
            } else if (event.key === 'Tab' && dialog) {
                const controls = focusable(dialog);
                const first = controls[0];
                const last = controls[controls.length - 1];
                if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
                    event.preventDefault();
                    last?.focus();
                } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
                    event.preventDefault();
                    first?.focus();
                }
            }
        });
        document.addEventListener('focusin', event => {
            const dialog = activeDialog();
            if (dialog && !dialog.contains(event.target)) focusDialog(dialog);
        });
        window.addEventListener('popstate', handleProductRoute);
        loadCatalogue();
    }

    Object.assign(window, { renderProducts, handleSearch, clearSearch, loadCatalogue, openModal, closeModal,
        updateQty, shareProduct, addToCart, toggleCart, checkoutWhatsApp, toggleMobileMenu });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
    else init();
})();
