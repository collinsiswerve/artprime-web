const { test } = require('node:test');
const assert = require('node:assert/strict');
const model = require('../assets/studio-model.js');
const catalogue = require('../assets/catalogue.js');

const table = (columns, rows) => ({ columns: columns.map(column => column.toLowerCase()), rows });
const projects = rows => table(['id', 'title', 'category', 'coverimage', 'coveralt', 'published'], rows);
const images = rows => table(['projectid', 'imageurl', 'alt'], rows);
const project = overrides => ({ id: 'home-a', title: 'A home', category: 'Residential', coverimage: 'https://example.com/home.webp', coveralt: 'A sunlit living room', published: true, ...overrides });

test('sheet publication joins galleries by stable project ID, orders content and excludes drafts', () => {
    const snapshot = model.snapshotFromTables(projects([
        project({ id: 'home-b', sortorder: 2 }), project({ id: 'home-a', sortorder: 1 }),
        project({ id: 'draft', published: 'FALSE' })
    ]), images([
        { projectid: 'home-a', imageurl: 'https://example.com/second.webp', alt: 'Second view', sortorder: 2 },
        { projectid: 'draft', imageurl: 'https://example.com/private-draft.webp', alt: 'Draft view' },
        { projectid: 'home-a', imageurl: 'https://example.com/first.webp', alt: 'First view', sortorder: 1 }
    ]), '2026-10-29T00:00:00.000Z');
    assert.equal(snapshot.isExample, false);
    assert.deepEqual(snapshot.projects.map(item => item.id), ['home-a', 'home-b']);
    assert.deepEqual(snapshot.projects[0].images.map(item => item.alt), ['First view', 'Second view']);
    assert.equal(snapshot.projects[1].images[0].url, 'https://example.com/home.webp');
    assert.equal(snapshot.updatedAt, '2026-10-29T00:00:00.000Z');
    assert.equal(model.validateSnapshot(snapshot), snapshot);
});

test('bad published rows, duplicate IDs and orphan gallery photos abort publication', () => {
    assert.throws(() => model.snapshotFromTables(projects([project(), project()]), images([])), /Duplicate/);
    assert.throws(() => model.snapshotFromTables(projects([project({ id: '../unsafe' })]), images([])), /Invalid project ID/);
    assert.throws(() => model.snapshotFromTables(projects([project({ coveralt: '' })]), images([])), /coverAlt/);
    assert.throws(() => model.snapshotFromTables(projects([project()]), images([{ projectid: 'missing', imageurl: 'https://example.com/a.jpg', alt: 'View' }])), /unknown project/);
    assert.throws(() => model.snapshotFromTables(projects([project()]), images([{ projectid: 'home-a', imageurl: 'https://example.com/a.jpg', alt: '' }])), /alt text/);
});

test('wrong tabs and missing required headers fail rather than publishing product data as projects', () => {
    const productTable = table(['id', 'name', 'image'], []);
    assert.throws(() => model.snapshotFromTables(productTable, images([])), /missing/);
    assert.throws(() => model.tableFromResponse('<html>Sign in</html>'), /public data table/);
    assert.throws(() => model.tableFromResponse('google.visualization.Query.setResponse({"status":"error"});'), /could not be read/);
    const data = { table: { cols: [{ label: 'Project ID' }, { label: 'Image URL' }], rows: [{ c: [{ v: 'home-a' }, { v: 'https://example.com/a.webp' }] }] } };
    assert.deepEqual(model.tableFromResponse(`/*O_o*/\ngoogle.visualization.Query.setResponse(${JSON.stringify(data)});`).rows,
        [{ projectid: 'home-a', imageurl: 'https://example.com/a.webp' }]);
});

test('image data rejects active content, plain HTTP and traversal paths', () => {
    for (const url of ['javascript:alert(1)', 'data:image/svg+xml,test', 'http://example.com/a.jpg', 'assets/../secret.png', '//example.com/a.webp', 'https://user:password@example.com/a.jpg']) assert.throws(() => model.imageURL(url));
    assert.equal(model.imageURL('assets/studio/living-1600.webp'), 'assets/studio/living-1600.webp');
    assert.equal(model.imageURL('https://images.example.com/photo(1).jpg'), 'https://images.example.com/photo(1).jpg');
});

test('an intentionally empty published portfolio is valid and has no sample projects', () => {
    const snapshot = model.snapshotFromTables(projects([project({ published: false })]), images([]));
    assert.equal(snapshot.isExample, false);
    assert.deepEqual(model.validateSnapshot(snapshot).projects, []);
});

test('publication flags cannot silently turn a ready project into a draft', () => {
    assert.throws(() => model.snapshotFromTables(projects([project({ published: 'TURE' })]), images([])), /published must be TRUE or FALSE/);
    assert.throws(() => model.snapshotFromTables(projects([project({ featured: 'sometimes' })]), images([])), /featured must be TRUE or FALSE/);
});

test('blank ordering comes after numbered entries, and invalid order values fail clearly', () => {
    const ordered = model.snapshotFromTables(projects([project({ id: 'blank' }), project({ id: 'numbered', sortorder: 1 })]), images([]));
    assert.deepEqual(ordered.projects.map(item => item.id), ['numbered', 'blank']);
    for (const sortorder of [-1, 0, 1.5, 'first']) assert.throws(() => model.snapshotFromTables(projects([project({ sortorder })]), images([])), /sortOrder/);
});

test('image sharing pages and spreadsheet image formulas are rejected while direct images remain valid', () => {
    for (const url of ['https://postimg.cc/abc', 'https://www.imgur.com/a/abc', 'https://drive.google.com/file/d/abc/view', '=IMAGE("https://example.com/a.jpg")']) {
        assert.throws(() => model.imageURL(url), /direct HTTPS image URL/);
    }
    assert.equal(model.imageURL('https://i.postimg.cc/abc/photo.jpg'), 'https://i.postimg.cc/abc/photo.jpg');
});

test('Cloudinary cards and gallery images use automatic format, quality and responsive limits', () => {
    const source = 'https://res.cloudinary.com/artprime/image/upload/v123/projects/home.jpg';
    const resized = catalogue.imageVariants(source, [320, 640, 1600]);
    assert.equal(resized.src, 'https://res.cloudinary.com/artprime/image/upload/c_limit,w_640,f_auto,q_auto/v123/projects/home.jpg');
    assert.match(resized.srcset, /w_320.* 320w, .*w_640.* 640w, .*w_1600.* 1600w/);
    const edited = catalogue.imageVariants('https://res.cloudinary.com/artprime/image/upload/c_crop,g_center/v123/photo.jpg', [640]);
    assert.match(edited.src, /c_crop,g_center\/c_limit,w_640,f_auto,q_auto\/v123/);
    const versionless = catalogue.imageVariants('https://res.cloudinary.com/artprime/image/upload/home.jpg', [640]);
    assert.match(versionless.src, /upload\/c_limit,w_640,f_auto,q_auto\/home.jpg/);
});

test('signed Cloudinary URLs are never rewritten', () => {
    for (const source of ['https://res.cloudinary.com/artprime/image/upload/s--abc123--/v123/a.jpg', 'https://res.cloudinary.com/artprime/image/upload/v123/a.jpg?token=secret', 'https://res.cloudinary.com/artprime/image/upload/v123/a.jpg?__cld_token__=signed']) {
        assert.deepEqual(catalogue.imageVariants(source, [320, 640]), { src: source, srcset: '' });
    }
});

test('website-hosted Studio renders use the actual small and large files for public Sheet URLs', () => {
    const base = 'https://collinsiswerve.github.io/artprime-web/';
    for (const maximum of [1280, 1600, 1920]) {
        const source = `${base}assets/studio/arc-and-ember-living-01-${maximum}.webp`;
        const smaller = source.replace(`-${maximum}.webp`, '-640.webp');
        assert.deepEqual(catalogue.imageVariants(source, [160, 320], base), {
            src: smaller, srcset: `${smaller} 640w, ${source} ${maximum}w`
        });
        assert.deepEqual(catalogue.imageVariants(source, [640, 960, 1920], base), {
            src: source, srcset: `${smaller} 640w, ${source} ${maximum}w`
        });
    }
    const local = catalogue.imageVariants('assets/studio/living-1600.webp', [640, 1600], 'http://localhost:3000/preview/');
    assert.equal(local.srcset, 'http://localhost:3000/preview/assets/studio/living-640.webp 640w, http://localhost:3000/preview/assets/studio/living-1600.webp 1600w');
});

test('Studio variants preserve other hosts, other site paths and signed image addresses', () => {
    for (const source of [
        'https://example.com/assets/studio/room-1920.webp',
        'https://collinsiswerve.github.io/another-site/assets/studio/room-1920.webp',
        'https://collinsiswerve.github.io/artprime-web/assets/studio/room-1920.webp?token=keep-this'
    ]) assert.deepEqual(catalogue.imageVariants(source, [160, 640]), { src: source, srcset: '' });
});

test('the saved portfolio is valid and every website-hosted photo and responsive source exists', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const root = path.resolve(__dirname, '..');
    const snapshot = model.validateSnapshot(JSON.parse(fs.readFileSync(path.join(root, 'assets/studio-projects.json'), 'utf8')));
    const base = 'https://collinsiswerve.github.io/artprime-web/';
    for (const project of snapshot.projects) {
        for (const source of [project.coverImage, ...project.images.map(item => item.url)]) {
            const variants = catalogue.imageVariants(source, [640, 1920], base);
            const sources = [variants.src, ...variants.srcset.split(', ').filter(Boolean).map(item => item.split(' ')[0])];
            for (const address of sources) {
                const url = new URL(address, base);
                if (!url.href.startsWith(`${base}assets/`)) continue;
                const local = decodeURIComponent(url.pathname.slice(new URL(base).pathname.length));
                assert.ok(fs.existsSync(path.join(root, local)), address);
            }
        }
    }
});
