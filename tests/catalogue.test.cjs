const { test } = require('node:test');
const assert = require('node:assert/strict');
const catalogue = require('../assets/catalogue.js');

const row = values => ({ c: values.map(value => value === null ? null : { v: value }) });
const product = (overrides = {}) => ({
    id: '1', name: 'Round Mirror', description: 'A brass wall mirror for the living room',
    image: 'https://example.com/mirror.jpg', originalPrice: 12000, salePrice: 9000,
    isNewArrival: false, isBestSeller: false, isOnSale: false, isSoldOut: false, ...overrides
});
const products = [
    product(),
    product({ id: '2', name: 'Halo', description: 'Large mirror with a golden frame', isNewArrival: true }),
    product({ id: '3', name: 'Linen Chair', description: 'A comfortable upholstered chair', isBestSeller: true }),
    product({ id: '4', name: 'Café Light', description: 'Brass pendant lighting', isOnSale: true })
];
const ids = result => result.products.map(item => item.id);

test('search matches names and descriptions, ignoring case, accents and extra spaces', () => {
    assert.deepEqual(ids(catalogue.searchProducts(products, '  MIRROR  ')), ['1', '2']);
    assert.deepEqual(ids(catalogue.searchProducts(products, 'cafe')), ['4']);
    assert.deepEqual(ids(catalogue.searchProducts(products, 'frame')), ['2']);
    assert.deepEqual(ids(catalogue.searchProducts(products, '   ')), ['1', '2', '3', '4']);
});

test('search handles plurals, partial words and words in different order', () => {
    assert.deepEqual(ids(catalogue.searchProducts(products, 'mirrors')), ['1', '2']);
    assert.deepEqual(ids(catalogue.searchProducts(products, 'lights')), ['4']);
    assert.deepEqual(ids(catalogue.searchProducts(products, 'mirr')), ['1', '2']);
    assert.deepEqual(ids(catalogue.searchProducts(products, 'brass mirror')), ['1']);
    assert.deepEqual(ids(catalogue.searchProducts(products, 'mirror brass')), ['1']);
});

test('small spelling mistakes offer similar results only when there are no exact matches', () => {
    const result = catalogue.searchProducts(products, 'morrior');
    assert.deepEqual(ids(result), ['1', '2']);
    assert.equal(result.approximate, true);
    const exact = catalogue.searchProducts([...products, product({ id: '5', name: 'Miroir', description: '' })], 'mirror');
    assert.deepEqual(ids(exact), ['1', '2']);
    assert.equal(exact.approximate, false);
    assert.deepEqual(ids(catalogue.searchProducts(products, 'refrigerator')), []);
});

test('search preserves the existing marketing filter', () => {
    assert.deepEqual(ids(catalogue.searchProducts(products, 'mirror', 'New Arrivals')), ['2']);
    assert.deepEqual(ids(catalogue.searchProducts(products, '', 'Best Sellers')), ['3']);
    assert.deepEqual(ids(catalogue.searchProducts(products, 'lights', 'Sale')), ['4']);
});

test('spreadsheet booleans correctly distinguish FALSE strings from true values', () => {
    for (const value of [false, 'FALSE', ' false ', 0, '', null, 'no']) assert.equal(catalogue.flag(value), false);
    for (const value of [true, 'TRUE', ' true ', 1, 'yes', '1']) assert.equal(catalogue.flag(value), true);
    const [item] = catalogue.productsFromRows([row([7, 'Mirror', '', 12000, 9000, 'FALSE', false, 'FALSE', null, 'FALSE'])]);
    assert.equal(item.id, '7');
    assert.equal(item.description, '');
    assert.equal(item.isOnSale, false);
    assert.equal(item.isSoldOut, false);
    assert.equal(item.isNewArrival, false);
});

test('catalogue supports string IDs, readable prices and sold-out status', () => {
    const [item] = catalogue.productsFromRows([row(['mirror-A', 'Mirror', '', 'KES 12,000', '9,500', 'yes', 'TRUE', true, 'Brass', 'Sold Out'])]);
    assert.equal(item.id, 'mirror-A');
    assert.equal(item.originalPrice, 12000);
    assert.equal(catalogue.priceOf(item), 9500);
    assert.equal(item.isSoldOut, true);
    assert.equal(item.isNewArrival, true);
});

test('invalid discounts use the regular price; invalid and duplicate IDs do not produce orders', () => {
    for (const salePrice of [0, -1, '', null, 'invalid', 13000, 12000]) {
        const [item] = catalogue.productsFromRows([row(['A', 'Mirror', '', 12000, salePrice, false, false, true, '', false])]);
        assert.equal(catalogue.priceOf(item), 12000);
        assert.equal(item.isOnSale, false);
    }
    assert.throws(() => catalogue.productsFromRows([
        row([1, 'Mirror', '', 12000]), row(['1', 'Chair', '', 5000])
    ]), /unique/);
    assert.throws(() => catalogue.productsFromRows([row([1, 'Mirror', '', 'oops'])]), /No valid products/);
    assert.deepEqual(catalogue.productsFromRows([row([null, null, null, null])]), []);
});

test('Google Sheets wrapper is parsed without fixed offsets or script execution', () => {
    const data = { status: 'ok', table: { rows: [row(['A', 'Mirror (large)', '', 12000])] } };
    const wrapped = '/*O_o*/\n\ngoogle.visualization.Query.setResponse(\n' + JSON.stringify(data) + '\n);\n';
    assert.equal(catalogue.parseSheetResponse(wrapped)[0].name, 'Mirror (large)');
    assert.throws(() => catalogue.parseSheetResponse('Not a catalogue'));
    assert.throws(() => catalogue.parseSheetResponse('google.visualization.Query.setResponse({"status":"error"});'));
    assert.throws(() => catalogue.parseSheetResponse('google.visualization.Query.setResponse({broken});'));
});

test('image URLs retain parentheses, support pasted Markdown and reject unsafe protocols', () => {
    assert.equal(catalogue.imageURL('https://example.com/mirror(1).jpg'), 'https://example.com/mirror(1).jpg');
    assert.equal(catalogue.imageURL('![Mirror](https://example.com/mirror.jpg)'), 'https://example.com/mirror.jpg');
    assert.equal(catalogue.imageURL('https://example.com/mirror.jpg](https://example.com/other.jpg)'), 'https://example.com/mirror.jpg');
    assert.equal(catalogue.imageURL('assets/mirror.jpg'), 'https://collinsiswerve.github.io/artprime-web/assets/mirror.jpg');
    for (const source of ['', 'javascript:alert(1)', 'data:text/html,test', 'https://[invalid']) {
        assert.match(catalogue.imageURL(source), /\/assets\/product-placeholder\.svg$/);
    }
});

test('responsive images resize supported hosts while preserving the source identity and shape', () => {
    const image = catalogue.imageVariants('https://images.unsplash.com/photo-mirror?ixid=campaign&w=1200&h=1600', [640, 320, 640, 960]);
    const source = new URL(image.src);
    assert.equal(source.pathname, '/photo-mirror');
    assert.equal(source.searchParams.get('ixid'), 'campaign');
    assert.equal(source.searchParams.get('w'), '640');
    assert.equal(source.searchParams.get('h'), '853');
    assert.equal(source.searchParams.get('auto'), 'format');
    assert.equal(source.searchParams.get('q'), '78');
    assert.match(image.srcset, / 320w, .* 640w, .* 960w$/);
    assert.equal(image.srcset.split(', ').length, 3);
});

test('cart thumbnails and full-size images request different widths', () => {
    const source = 'https://images.pexels.com/photos/1/photo.jpeg';
    const thumbnail = catalogue.imageVariants(source, [80, 160, 240]);
    const detail = catalogue.imageVariants(source, [640, 960, 1280, 1600]);
    assert.equal(new URL(thumbnail.src).searchParams.get('w'), '160');
    assert.equal(new URL(detail.src).searchParams.get('w'), '960');
    assert.match(thumbnail.srcset, / 80w/);
    assert.match(detail.srcset, / 1600w/);
});

test('unsupported and signed image URLs are preserved and unsafe sources use the placeholder', () => {
    for (const source of [
        'https://i.postimg.cc/example/mirror(1).jpg',
        'https://images.unsplash.com/photo-mirror?sig=secret&w=1200',
        'https://images.pexels.com/photos/1/photo.jpeg?token=signed-token'
    ]) assert.deepEqual(catalogue.imageVariants(source, [320, 640]), { src: source, srcset: '' });
    assert.deepEqual(catalogue.imageVariants('javascript:alert(1)', [320, 640]), {
        src: 'https://collinsiswerve.github.io/artprime-web/assets/product-placeholder.svg', srcset: ''
    });
});

test('corrupt storage and invalid quantities cannot break or contaminate the cart', () => {
    for (const raw of ['broken', '{}', null, 12]) assert.deepEqual(catalogue.savedCart(raw), []);
    const cart = catalogue.savedCart(JSON.stringify([
        { id: 1, qty: 2, name: 'Old mirror', price: 10000 },
        { id: '1', qty: '3', price: 10000 },
        { id: 2, qty: 0 }, { id: 3, qty: -2 }, { id: 4, qty: 1.5 },
        { id: 5, qty: true }, { id: 6, qty: [] }, { id: {}, qty: 1 },
        { id: 7, qty: Number.MAX_SAFE_INTEGER + 1 }, { qty: 1 }, null
    ]));
    assert.equal(cart.length, 1);
    assert.equal(cart[0].id, '1');
    assert.equal(cart[0].qty, 5);
});

test('saved carts reconcile numeric IDs, current prices and availability', () => {
    const result = catalogue.reconcileCart([
        { id: 1, qty: 2, name: 'Old mirror', image: 'https://example.com/old.jpg', price: 5000 },
        { id: 2, qty: 1, price: 12000 }, { id: 9, qty: 1, price: 100 }
    ], [product({ isOnSale: true }), product({ id: '2', isSoldOut: true })]);
    assert.equal(result.removed, 2);
    assert.equal(result.repriced, 1);
    assert.deepEqual(result.cart, [{ id: '1', qty: 2, name: 'Round Mirror', image: 'https://example.com/mirror.jpg', price: 9000 }]);
});

test('WhatsApp ordering waits for verified catalogue data and valid totals', () => {
    const item = { id: '1', name: 'Mirror', price: 12000, qty: 1 };
    assert.equal(catalogue.orderURL([item], false), null);
    assert.equal(catalogue.orderURL([], true), null);
    for (const qty of [0, -1, 1.5, true, Infinity]) assert.equal(catalogue.orderURL([{ ...item, qty }], true), null);
    for (const price of [0, -1, NaN, Infinity, 'invalid']) assert.equal(catalogue.orderURL([{ ...item, price }], true), null);
    assert.equal(catalogue.orderURL([{ ...item, price: Number.MAX_SAFE_INTEGER, qty: 2 }], true), null);
});

test('WhatsApp messages preserve special characters and call the amount an items subtotal', () => {
    const url = new URL(catalogue.orderURL([
        { id: 'A', name: 'Mirror & light #1 🪞', price: 12000, qty: 2 },
        { id: 'B', name: 'Chair\nlinen', price: 5500, qty: 1 }
    ], true));
    assert.equal(url.origin, 'https://wa.me');
    assert.equal(url.pathname, '/254748649103');
    const message = url.searchParams.get('text');
    assert.match(message, /2x Mirror & light #1 🪞 - KES 24,000/);
    assert.match(message, /Chair linen/);
    assert.match(message, /Items subtotal: KES 29,500/);
    assert.match(message, /confirm availability, payment and delivery/);
});

test('product links preserve the GitHub Pages path and campaign parameters', () => {
    const url = new URL(catalogue.productURL('https://collinsiswerve.github.io/artprime-web/?utm_source=whatsapp#collections', 'Mirror & Light/1'));
    assert.equal(url.pathname, '/artprime-web/');
    assert.equal(url.searchParams.get('product'), 'Mirror & Light/1');
    assert.equal(url.searchParams.get('utm_source'), 'whatsapp');
    assert.equal(url.hash, '');
});
