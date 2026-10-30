// Import the two public Studio tabs. Validation finishes before any file changes.
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const model = require('../assets/studio-model.js');

async function readTab(config, name, requiredHeader, { fetchImpl, delay }) {
    const url = new URL(`https://docs.google.com/spreadsheets/d/${config.sheetId}/gviz/tq`);
    url.searchParams.set('tqx', 'out:json');
    url.searchParams.set('sheet', name);
    url.searchParams.set('headers', '1');
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const response = await fetchImpl(url, { signal: AbortSignal.timeout(20000), cache: 'no-store' });
            if (!response.ok) {
                const error = new Error(`HTTP ${response.status}. Check the tab name and public read access.`);
                error.retryable = response.status === 429 || response.status >= 500;
                throw error;
            }
            const table = model.tableFromResponse(await response.text());
            if (!table.columns.includes(requiredHeader)) throw new Error('Tab missing or row 1 headings do not match the Studio guide.');
            return table;
        } catch (error) {
            const transient = error.retryable === true || error.retryable !== false
                && ['TypeError', 'TimeoutError', 'AbortError'].includes(error.name);
            if (!transient || attempt === 2) throw new Error(`${name}: ${error.message}`);
            await delay(250 * 2 ** attempt);
        }
    }
}

async function syncStudio({ root = path.resolve(__dirname, '..'), dryRun = false, allowEmpty = false,
    fetchImpl = fetch, delay = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
    const config = JSON.parse(fs.readFileSync(path.join(root, 'assets/studio-config.json'), 'utf8'));
    if (!/^[a-zA-Z0-9_-]+$/.test(config.sheetId) || !config.projectsSheet || !config.imagesSheet
        || config.projectsSheet === config.imagesSheet) throw new Error('Configure a valid public workbook ID and two different Studio tab names.');
    const [projects, images] = await Promise.all([
        readTab(config, config.projectsSheet, 'published', { fetchImpl, delay }),
        readTab(config, config.imagesSheet, 'projectid', { fetchImpl, delay })
    ]);
    const snapshot = model.validateSnapshot(model.snapshotFromTables(projects, images));
    if (!snapshot.projects.length && !allowEmpty) {
        throw new Error('No published Studio projects were found. The existing snapshot was kept. Add a ready project and tick published. Use --allow-empty only when deliberately clearing the portfolio.');
    }
    const summary = {
        projects: snapshot.projects.length,
        featured: snapshot.projects.filter(project => project.featured).length,
        photos: snapshot.projects.reduce((total, project) => total + project.images.length, 0)
    };
    if (dryRun) return { ...summary, status: 'checked' };

    const target = path.join(root, 'assets/studio-projects.json');
    let previous;
    try { previous = model.validateSnapshot(JSON.parse(fs.readFileSync(target, 'utf8'))); }
    catch (_) { /* A validated import can also repair a missing or damaged snapshot. */ }
    if (previous && !previous.isExample && JSON.stringify(previous.projects) === JSON.stringify(snapshot.projects)) {
        return { ...summary, status: 'unchanged' };
    }
    const temporary = `${target}.${randomUUID()}.tmp`;
    try {
        fs.writeFileSync(temporary, `${JSON.stringify(snapshot, null, 2)}\n`, { flag: 'wx' });
        fs.renameSync(temporary, target);
    } finally {
        fs.rmSync(temporary, { force: true });
    }
    return { ...summary, status: 'saved' };
}

if (require.main === module) {
    const args = process.argv.slice(2);
    const unknown = args.filter(arg => !['--dry-run', '--allow-empty'].includes(arg));
    const run = unknown.length ? Promise.reject(new Error(`Unknown option: ${unknown.join(', ')}`))
        : syncStudio({ dryRun: args.includes('--dry-run'), allowEmpty: args.includes('--allow-empty') });
    run.then(result => {
        console.log(`Studio ${result.status}: ${result.projects} published projects, ${result.featured} featured, ${result.photos} gallery photos.`);
        if (result.status === 'checked') console.log('Validation only: the saved portfolio was not changed.');
    }).catch(error => { console.error(error.message); process.exitCode = 1; });
}

module.exports = { syncStudio };
