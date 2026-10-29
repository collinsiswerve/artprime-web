(function (root, factory) {
    const model = factory();
    if (typeof module === 'object' && module.exports) module.exports = model;
    else root.ArtPrimeStudio = model;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    const text = value => String(value ?? '').trim();
    const truth = value => value === true || /^(true|yes|1)$/i.test(text(value));
    const key = value => text(value).toLowerCase().replace(/[^a-z0-9]/g, '');
    const order = value => Number.isFinite(Number(value)) ? Number(value) : 999;

    function imageURL(value) {
        const source = text(value);
        if (/^assets\/[a-z0-9_./-]+\.(webp|avif|jpe?g|png)$/i.test(source) && !source.includes('..')) return source;
        try {
            const url = new URL(source);
            if (url.protocol === 'https:' && !url.username && !url.password) return url.href;
        } catch (_) { /* A project needs a real image address. */ }
        throw new Error('Use a direct HTTPS image URL, or a local assets/ image.');
    }

    function tableFromResponse(response) {
        const match = String(response).match(/google\.visualization\.Query\.setResponse\(\s*([\s\S]+?)\s*\)\s*;?\s*$/);
        if (!match) throw new Error('Google Sheets did not return a public data table.');
        const data = JSON.parse(match[1]);
        if (data.status === 'error' || !Array.isArray(data.table?.cols) || !Array.isArray(data.table?.rows)) {
            throw new Error('The Studio sheet could not be read. Check its name and sharing settings.');
        }
        const columns = data.table.cols.map(column => key(column.label));
        const rows = data.table.rows.map(row => Object.fromEntries(columns.map((column, index) => [column, row.c?.[index]?.v ?? ''])));
        return { columns, rows };
    }

    function requireColumns(table, columns, name) {
        for (const column of columns) {
            if (!table.columns.includes(key(column))) throw new Error(`${name} is missing the ${column} column.`);
        }
    }

    function snapshotFromTables(projectTable, imageTable, updatedAt = new Date().toISOString()) {
        requireColumns(projectTable, ['id', 'title', 'category', 'coverImage', 'coverAlt', 'published'], 'Projects');
        requireColumns(imageTable, ['projectId', 'imageUrl', 'alt'], 'ProjectImages');
        const ids = new Set();
        const knownIds = new Set(projectTable.rows.map(row => text(row.id)).filter(Boolean));
        const projects = projectTable.rows.filter(row => truth(row.published)).map(row => {
            const id = text(row.id);
            if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(id)) throw new Error(`Invalid project ID: ${id}. Use lowercase letters, numbers and hyphens.`);
            if (ids.has(id)) throw new Error(`Duplicate project ID: ${id}.`);
            ids.add(id);
            if (!text(row.title) || !text(row.category) || !text(row.coveralt)) throw new Error(`Project ${id} needs a title, category and coverAlt.`);
            return {
                id, title: text(row.title), location: text(row.location), category: text(row.category),
                year: text(row.year), description: text(row.description),
                coverImage: imageURL(row.coverimage), coverAlt: text(row.coveralt),
                sortOrder: order(row.sortorder), featured: truth(row.featured), images: []
            };
        }).sort((a, b) => a.sortOrder - b.sortOrder);
        const byId = new Map(projects.map(project => [project.id, project]));
        for (const row of imageTable.rows) {
            if (!Object.values(row).some(value => text(value))) continue;
            const id = text(row.projectid);
            if (!knownIds.has(id)) throw new Error(`Gallery image refers to an unknown project: ${id}.`);
            const project = byId.get(id);
            if (!project) continue; // Images for unpublished projects stay unpublished.
            if (!text(row.alt)) throw new Error(`A gallery image for ${id} needs alt text.`);
            project.images.push({ url: imageURL(row.imageurl), alt: text(row.alt), caption: text(row.caption), sortOrder: order(row.sortorder) });
        }
        for (const project of projects) {
            project.images.sort((a, b) => a.sortOrder - b.sortOrder);
            if (!project.images.length) project.images.push({ url: project.coverImage, alt: project.coverAlt, caption: '' });
        }
        return { schemaVersion: 1, isExample: false, updatedAt, projects };
    }

    function validateSnapshot(snapshot) {
        if (snapshot?.schemaVersion !== 1 || !Array.isArray(snapshot.projects)) throw new Error('Invalid Studio portfolio.');
        const ids = new Set();
        for (const project of snapshot.projects) {
            if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(project.id) || ids.has(project.id)) throw new Error('Project IDs must be unique and shareable.');
            ids.add(project.id);
            if (!text(project.title) || !text(project.category) || !text(project.coverAlt)) throw new Error('Incomplete project.');
            imageURL(project.coverImage);
            if (!Array.isArray(project.images) || !project.images.length) throw new Error('A project needs a gallery.');
            for (const image of project.images) {
                imageURL(image.url);
                if (!text(image.alt)) throw new Error('A gallery image needs alt text.');
            }
        }
        return snapshot;
    }

    return { imageURL, tableFromResponse, snapshotFromTables, validateSnapshot };
});
