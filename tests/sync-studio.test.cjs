const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { syncStudio } = require('../scripts/sync-studio.cjs');
const model = require('../assets/studio-model.js');

const projectColumns = ['id', 'title', 'location', 'category', 'year', 'description', 'coverImage', 'coverAlt', 'sortOrder', 'published', 'featured'];
const imageColumns = ['projectId', 'imageUrl', 'alt', 'caption', 'sortOrder'];
const project = { id: 'nairobi-home', title: 'Nairobi home', category: 'Residential',
    coverImage: 'https://i.postimg.cc/example/cover.jpg', coverAlt: 'A warm living room', published: true, featured: true, sortOrder: 1 };
const photos = [
    { projectId: project.id, imageUrl: 'https://i.postimg.cc/example/dining.jpg', alt: 'Dining room', sortOrder: 2 },
    { projectId: project.id, imageUrl: 'https://i.postimg.cc/example/living.jpg', alt: 'Living room', sortOrder: 1 }
];

function response(columns, rows) {
    return new Response(`/*O_o*/\ngoogle.visualization.Query.setResponse(${JSON.stringify({ status: 'ok', table: {
        cols: columns.map(label => ({ label })), rows: rows.map(row => ({ c: columns.map(column => ({ v: row[column] ?? null })) }))
    } })});`);
}

function fixture(t, { projects = [project], images = photos } = {}) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'artprime-studio-test-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    fs.mkdirSync(path.join(root, 'assets'));
    fs.writeFileSync(path.join(root, 'assets/studio-config.json'), JSON.stringify({ sheetId: 'fixture-sheet', projectsSheet: 'Projects', imagesSheet: 'ProjectImages' }));
    const target = path.join(root, 'assets/studio-projects.json');
    const previous = fs.readFileSync(path.join(__dirname, '../assets/studio-projects.json'), 'utf8');
    fs.writeFileSync(target, previous);
    const fetchImpl = async url => url.searchParams.get('sheet') === 'Projects'
        ? response(projectColumns, projects) : response(imageColumns, images);
    return { root, target, previous, fetchImpl, delay: async () => {} };
}

test('import joins the two Google table responses into the correct cover, featured selection and ordered gallery', async t => {
    const f = fixture(t);
    const result = await syncStudio(f);
    assert.deepEqual(result, { status: 'saved', projects: 1, featured: 1, photos: 2 });
    const snapshot = model.validateSnapshot(JSON.parse(fs.readFileSync(f.target, 'utf8')));
    assert.equal(snapshot.isExample, false);
    assert.equal(snapshot.projects[0].id, project.id);
    assert.equal(snapshot.projects[0].coverImage, project.coverImage);
    assert.equal(snapshot.projects[0].featured, true);
    assert.deepEqual(snapshot.projects[0].images.map(photo => photo.alt), ['Living room', 'Dining room']);
    assert.deepEqual(fs.readdirSync(path.dirname(f.target)).sort(), ['studio-config.json', 'studio-projects.json']);
});

test('a dry run validates real import data without changing the portfolio bytes', async t => {
    const f = fixture(t);
    assert.equal((await syncStudio({ ...f, dryRun: true })).status, 'checked');
    assert.equal(fs.readFileSync(f.target, 'utf8'), f.previous);
});

test('an empty or all-draft workbook cannot clear the portfolio without the explicit option', async t => {
    for (const projects of [[], [{ ...project, published: false }]]) {
        const f = fixture(t, { projects, images: [] });
        await assert.rejects(syncStudio(f), /No published Studio projects/);
        assert.equal(fs.readFileSync(f.target, 'utf8'), f.previous);
    }
    const f = fixture(t, { projects: [], images: [] });
    await syncStudio({ ...f, allowEmpty: true });
    assert.deepEqual(JSON.parse(fs.readFileSync(f.target, 'utf8')).projects, []);
});

test('incomplete photos, duplicate IDs, invalid publication flags and sharing pages preserve the last snapshot', async t => {
    const cases = [
        { projects: [{ ...project, coverAlt: '' }] },
        { projects: [project, { ...project, published: false }] },
        { projects: [{ ...project, published: 'TURE' }] },
        { projects: [{ ...project, coverImage: 'https://postimg.cc/gallery-page' }] },
        { images: [{ ...photos[0], alt: '' }] },
        { images: [{ ...photos[0], projectId: 'unknown-project' }] },
        { images: [{ ...photos[0], imageUrl: 'javascript:alert(1)' }] }
    ];
    for (const data of cases) {
        const f = fixture(t, data);
        await assert.rejects(syncStudio(f));
        assert.equal(fs.readFileSync(f.target, 'utf8'), f.previous);
        assert.equal(fs.readdirSync(path.dirname(f.target)).some(file => file.endsWith('.tmp')), false);
    }
});

test('temporary Google failures are retried, but permission and header failures do not overwrite data', async t => {
    const f = fixture(t);
    let calls = 0;
    const delays = [];
    const fetchImpl = async url => {
        if (url.searchParams.get('sheet') === 'Projects' && ++calls < 3) return new Response('Unavailable', { status: 503 });
        return f.fetchImpl(url);
    };
    assert.equal((await syncStudio({ ...f, fetchImpl, delay: async ms => delays.push(ms) })).status, 'saved');
    assert.deepEqual(delays, [250, 500]);
    assert.equal(calls, 3);

    for (const brokenResponse of [() => new Response('Forbidden', { status: 403 }),
        () => response(['id', 'name'], []), () => response(['id', 'id', 'published'], [])]) {
        const broken = fixture(t);
        await assert.rejects(syncStudio({ ...broken, fetchImpl: async () => brokenResponse() }));
        assert.equal(fs.readFileSync(broken.target, 'utf8'), broken.previous);
    }
});

test('importing identical content keeps the saved snapshot and its timestamp unchanged', async t => {
    const f = fixture(t);
    await syncStudio(f);
    const saved = fs.readFileSync(f.target, 'utf8');
    assert.equal((await syncStudio(f)).status, 'unchanged');
    assert.equal(fs.readFileSync(f.target, 'utf8'), saved);
});
