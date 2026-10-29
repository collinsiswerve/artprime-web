// Publish a validated, static portfolio from the two public Google Sheets tabs.
// A failed read/validation leaves the checked-in snapshot untouched.
const fs = require('node:fs');
const path = require('node:path');
const model = require('../assets/studio-model.js');
const root = path.resolve(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(root, 'assets/studio-config.json'), 'utf8'));

async function readTab(name, requiredHeader) {
    if (!/^[a-zA-Z0-9_-]+$/.test(config.sheetId)) throw new Error('Configure a valid public Google Sheet ID first.');
    const url = new URL(`https://docs.google.com/spreadsheets/d/${config.sheetId}/gviz/tq`);
    url.searchParams.set('tqx', 'out:json');
    url.searchParams.set('sheet', name);
    url.searchParams.set('headers', '1');
    const response = await fetch(url, { signal: AbortSignal.timeout(20000), cache: 'no-store' });
    if (!response.ok) throw new Error(`Cannot read ${name}: HTTP ${response.status}.`);
    const table = model.tableFromResponse(await response.text());
    if (!table.columns.includes(requiredHeader)) throw new Error(`The ${name} tab was not found, or its headers do not match the guide.`);
    return table;
}

async function main() {
    const [projects, images] = await Promise.all([
        readTab(config.projectsSheet, 'published'), readTab(config.imagesSheet, 'projectid')
    ]);
    const snapshot = model.validateSnapshot(model.snapshotFromTables(projects, images));
    const target = path.join(root, 'assets/studio-projects.json');
    const previous = JSON.parse(fs.readFileSync(target, 'utf8'));
    if (!previous.isExample && JSON.stringify(previous.projects) === JSON.stringify(snapshot.projects)) {
        console.log('Studio is already up to date.');
        return;
    }
    fs.writeFileSync(`${target}.tmp`, `${JSON.stringify(snapshot, null, 2)}\n`);
    fs.renameSync(`${target}.tmp`, target);
    console.log(`Published ${snapshot.projects.length} Studio projects to the static snapshot.`);
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
