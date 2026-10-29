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

test('the checked-in preview is valid and every demo photo has both local responsive sizes', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const root = path.resolve(__dirname, '..');
    const snapshot = model.validateSnapshot(JSON.parse(fs.readFileSync(path.join(root, 'assets/studio-projects.json'), 'utf8')));
    if (!snapshot.isExample) return;
    for (const project of snapshot.projects) {
        for (const source of [project.coverImage, ...project.images.map(item => item.url)]) {
            assert.ok(fs.existsSync(path.join(root, source)), source);
            assert.ok(fs.existsSync(path.join(root, source.replace('-1600.webp', '-640.webp'))), `Responsive source for ${source}`);
        }
    }
});
