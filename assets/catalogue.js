(function (root, factory) {
    const catalogue = factory();
    if (typeof module === 'object' && module.exports) module.exports = catalogue;
    else root.ArtPrimeCatalogue = catalogue;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const DEFAULT_BASE = 'https://collinsiswerve.github.io/artprime-web/';
    const currency = new Intl.NumberFormat('en-KE', { maximumFractionDigits: 2 });
    const text = value => String(value ?? '').trim();
    const idOf = value => typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value)) ? text(value) : '';
    const normalize = value => text(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
    const flag = value => value === true || value === 1 || /^(true|yes|1)$/i.test(text(value));

    function money(value) {
        if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : null;
        const cleaned = text(value).replace(/^(?:KES|KSHS?\.?)\s*/i, '').replace(/,/g, '');
        if (!/^\d+(?:\.\d{1,2})?$/.test(cleaned)) return null;
        const amount = Number(cleaned);
        return Number.isFinite(amount) ? amount : null;
    }

    function imageURL(value, base = DEFAULT_BASE) {
        let source = text(value);
        // Accept a pasted Markdown image/link without breaking ordinary URL parentheses.
        const markdown = source.match(/^!?\[[^\]]*\]\((.+)\)$/);
        if (markdown) source = markdown[1];
        else if (/^https?:\/\//i.test(source) && source.includes('](')) source = source.split('](')[0];
        if (!source) return new URL('assets/product-placeholder.svg', base).href;
        try {
            const url = new URL(source, base);
            if (url.protocol === 'https:' || url.protocol === 'http:') return url.href;
        } catch (_) { /* Use the local placeholder for an invalid image address. */ }
        return new URL('assets/product-placeholder.svg', base).href;
    }

    function productsFromRows(rows, base = DEFAULT_BASE) {
        if (!Array.isArray(rows)) throw new Error('Missing catalogue rows');
        const products = [];
        const ids = new Set();
        for (const row of rows) {
            const cell = index => row?.c?.[index]?.v ?? null;
            const id = idOf(cell(0));
            const name = text(cell(1));
            const originalPrice = money(cell(3));
            if (!id || !name || originalPrice === null || originalPrice <= 0) continue;
            if (ids.has(id)) throw new Error('Product IDs must be unique');
            ids.add(id);
            const salePrice = money(cell(4));
            products.push({
                id, name,
                image: imageURL(cell(2), base),
                originalPrice,
                salePrice,
                isNewArrival: flag(cell(5)),
                isBestSeller: flag(cell(6)),
                isOnSale: flag(cell(7)) && salePrice !== null && salePrice > 0 && salePrice < originalPrice,
                description: text(cell(8)),
                isSoldOut: flag(cell(9)) || /^(sold out|out of stock|unavailable)$/.test(normalize(cell(9)))
            });
        }
        if (rows.some(row => row?.c?.some(cell => text(cell?.v))) && !products.length) {
            throw new Error('No valid products in catalogue');
        }
        return products;
    }

    function parseSheetResponse(response, base = DEFAULT_BASE) {
        const match = String(response).match(/google\.visualization\.Query\.setResponse\(\s*([\s\S]+?)\s*\)\s*;?\s*$/);
        if (!match) throw new Error('Invalid catalogue response');
        const data = JSON.parse(match[1]);
        if (data.status === 'error' || !data.table) throw new Error('Catalogue request failed');
        return productsFromRows(data.table.rows, base);
    }

    const priceOf = product => product.isOnSale ? product.salePrice : product.originalPrice;
    const formatMoney = amount => `KES ${currency.format(amount)}`;
    const validQuantity = value => (typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value))) &&
        Number.isSafeInteger(Number(value)) && Number(value) > 0;

    function savedCart(raw) {
        let items;
        try { items = typeof raw === 'string' ? JSON.parse(raw) : raw; }
        catch (_) { return []; }
        if (!Array.isArray(items)) return [];
        const unique = new Map();
        for (const item of items) {
            if (!item || !idOf(item.id) || !validQuantity(item.qty)) continue;
            const id = idOf(item.id);
            const qty = Number(item.qty);
            if (unique.has(id)) {
                const combined = unique.get(id).qty + qty;
                if (Number.isSafeInteger(combined)) unique.get(id).qty = combined;
            } else {
                unique.set(id, { id, qty, name: text(item.name), image: imageURL(item.image), price: money(item.price) ?? 0 });
            }
        }
        return [...unique.values()];
    }

    function reconcileCart(items, products) {
        const byId = new Map(products.map(product => [idOf(product.id), product]));
        const previous = savedCart(items);
        let removed = 0;
        let repriced = 0;
        const cart = [];
        for (const item of previous) {
            const product = byId.get(item.id);
            if (!product || product.isSoldOut) { removed++; continue; }
            const price = priceOf(product);
            if (price !== item.price) repriced++;
            cart.push({ id: product.id, name: product.name, image: product.image, price, qty: item.qty });
        }
        return { cart, removed, repriced };
    }

    function filterCategory(products, category) {
        if (category === 'New Arrivals') return products.filter(product => product.isNewArrival);
        if (category === 'Best Sellers') return products.filter(product => product.isBestSeller);
        if (category === 'Sale') return products.filter(product => product.isOnSale);
        return products;
    }

    function stem(word) {
        if (word.length > 4 && word.endsWith('ies')) return word.slice(0, -3) + 'y';
        if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
        return word;
    }

    function distance(left, right) {
        let previous = Array.from({ length: right.length + 1 }, (_, i) => i);
        for (let i = 0; i < left.length; i++) {
            const current = [i + 1];
            for (let j = 0; j < right.length; j++) {
                current[j + 1] = Math.min(current[j] + 1, previous[j + 1] + 1,
                    previous[j] + (left[i] === right[j] ? 0 : 1));
            }
            previous = current;
        }
        return previous[right.length];
    }

    function searchProducts(products, query, category = 'All') {
        const candidates = filterCategory(products, category);
        const phrase = normalize(query);
        if (!phrase) return { products: candidates, approximate: false };
        const tokens = phrase.split(' ').map(stem);
        function score(product, allowTypos) {
            const name = normalize(product.name);
            const description = normalize(product.description);
            const nameWords = name.split(' ').map(stem);
            const words = [...nameWords, ...description.split(' ').map(stem), normalize(product.id)];
            let rank = name.includes(phrase) ? 100 : 0;
            for (const token of tokens) {
                const exact = word => word === token || word.startsWith(token);
                if (nameWords.some(exact)) rank += 10;
                else if (words.some(exact)) rank += 1;
                else if (allowTypos && token.length >= 4 && words.some(word => {
                    const limit = token.length >= 6 ? 2 : 1;
                    return Math.abs(word.length - token.length) <= limit && distance(token, word) <= limit;
                })) rank += 0.1;
                else return -1;
            }
            return rank;
        }
        const ranked = allowTypos => candidates.map((product, index) => ({ product, index, score: score(product, allowTypos) }))
            .filter(result => result.score >= 0).sort((a, b) => b.score - a.score || a.index - b.index)
            .map(result => result.product);
        const exact = ranked(false);
        if (exact.length) return { products: exact, approximate: false };
        const approximate = ranked(true);
        return { products: approximate, approximate: approximate.length > 0 };
    }

    function productURL(base, id) {
        const url = new URL(base);
        url.searchParams.set('product', idOf(id));
        url.hash = '';
        return url.href;
    }

    function orderURL(items, ready) {
        if (!ready || !Array.isArray(items) || !items.length) return null;
        if (items.some(item => !validQuantity(item.qty) || money(item.price) === null || item.price <= 0)) return null;
        const subtotal = items.reduce((sum, item) => sum + Number(item.price) * Number(item.qty), 0);
        if (!Number.isFinite(subtotal) || subtotal > Number.MAX_SAFE_INTEGER) return null;
        const lines = items.map(item => `${item.qty}x ${text(item.name).replace(/\s+/g, ' ')} - ${formatMoney(item.price * item.qty)}`);
        const message = 'Hello Art Prime, I would like to place an order:\n\n' + lines.join('\n') +
            `\n\n*Items subtotal: ${formatMoney(subtotal)}*\n\nPlease confirm availability, payment and delivery details.`;
        return `https://wa.me/254748649103?text=${encodeURIComponent(message)}`;
    }

    return { normalize, flag, money, imageURL, productsFromRows, parseSheetResponse, priceOf, formatMoney,
        savedCart, reconcileCart, searchProducts, productURL, orderURL, validQuantity, idOf };
});
