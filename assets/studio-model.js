(function (root, factory) {
    const model = factory();
    if (typeof module === 'object' && module.exports) module.exports = model;
    else root.ArtPrimeStudio = model;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    const text = value => String(value ?? '').trim();
    function truth(value, label) {
        if (value === true || /^(true|yes|1)$/i.test(text(value))) return true;
        if (value === false || /^(false|no|0)?$/i.test(text(value))) return false;
        throw new Error(`${label} must be TRUE or FALSE. Use the checkbox.`);
    }
    const key = value => text(value).toLowerCase().replace(/[^a-z0-9]/g, '');
    function order(value, label) {
        if (!text(value)) return Number.MAX_SAFE_INTEGER;
        const number = Number(value);
        if (!Number.isSafeInteger(number) || number <= 0) throw new Error(`${label} must be a positive whole number, or blank.`);
        return number;
    }

    function imageURL(value) {
        const source = text(value);
        if (/^assets\/[a-z0-9_./-]+\.(webp|avif|jpe?g|png)$/i.test(source) && !source.includes('..')) return source;
        try {
            const url = new URL(source);
            if (url.protocol === 'https:' && !url.username && !url.password) {
                const host = url.hostname.replace(/^www\./, '');
                const viewer = ['postimg.cc', 'imgur.com', 'docs.google.com'].includes(host)
                    || host === 'drive.google.com' && /^(?:\/file\/d\/|\/drive\/|\/open(?:\/|$))/.test(url.pathname);
                if (viewer) throw new Error('Image sharing pages cannot be used as photos.');
                return url.href;
            }
        } catch (_) { /* A project needs a real image address. */ }
        throw new Error('Use a direct HTTPS image URL, not a sharing page, IMAGE formula or embedded picture. A local assets/ image also works.');
    }

    function tableFromResponse(response) {
        const match = String(response).match(/google\.visualization\.Query\.setResponse\(\s*([\s\S]+?)\s*\)\s*;?\s*$/);
        if (!match) throw new Error('Google Sheets did not return a public data table.');
        const data = JSON.parse(match[1]);
        if (data.status === 'error' || !Array.isArray(data.table?.cols) || !Array.isArray(data.table?.rows)) {
            throw new Error('The Studio sheet could not be read. Check its name and sharing settings.');
        }
        const columns = data.table.cols.map(column => key(column.label));
        const labels = columns.filter(Boolean);
        if (new Set(labels).size !== labels.length) throw new Error('Sheet column headings must be unique. Check row 1.');
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
        const knownIds = new Set();
        projectTable.rows.forEach((row, index) => {
            const id = text(row.id);
            if (!id) return;
            if (knownIds.has(id)) throw new Error(`Duplicate project ID: ${id} at Projects row ${index + 2}. Draft and published IDs must all be unique.`);
            knownIds.add(id);
        });
        const projects = projectTable.rows.map((row, index) => ({ row, rowNumber: index + 2 }))
            .filter(({ row, rowNumber }) => truth(row.published, `Projects row ${rowNumber} published`)).map(({ row, rowNumber }) => {
            const id = text(row.id);
            if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(id)) throw new Error(`Invalid project ID: ${id}. Use lowercase letters, numbers and hyphens.`);
            if (ids.has(id)) throw new Error(`Duplicate project ID: ${id}.`);
            ids.add(id);
            if (!text(row.title) || !text(row.category) || !text(row.coveralt)) throw new Error(`Project ${id} needs a title, category and coverAlt.`);
            return {
                id, title: text(row.title), location: text(row.location), category: text(row.category),
                year: text(row.year), description: text(row.description),
                coverImage: imageURL(row.coverimage), coverAlt: text(row.coveralt),
                sortOrder: order(row.sortorder, `Projects row ${rowNumber} sortOrder`),
                featured: truth(row.featured, `Projects row ${rowNumber} featured`), images: []
            };
        }).sort((a, b) => a.sortOrder - b.sortOrder);
        const byId = new Map(projects.map(project => [project.id, project]));
        for (const [index, row] of imageTable.rows.entries()) {
            if (!Object.values(row).some(value => text(value))) continue;
            const id = text(row.projectid);
            if (!knownIds.has(id)) throw new Error(`Gallery image refers to an unknown project: ${id}.`);
            const project = byId.get(id);
            if (!project) continue; // Images for unpublished projects stay unpublished.
            if (!text(row.alt)) throw new Error(`A gallery image for ${id} needs alt text.`);
            project.images.push({ url: imageURL(row.imageurl), alt: text(row.alt), caption: text(row.caption), sortOrder: order(row.sortorder, `ProjectImages row ${index + 2} sortOrder`) });
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
