const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const context = { window: {}, clearTimeout };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/studio-stage.js'), 'utf8'), context);
const Stage = context.window.ArtPrimeStage;

// Only geometry is substituted. These tests exercise the production navigation
// and resize methods; the native scrolling, images and links are checked in-browser.
function stageAt({ index = 1, height = 390, top = 780, count = 3 } = {}) {
    const stage = Object.create(Stage.prototype);
    const movements = [];
    Object.assign(stage, {
        projects: Array.from({ length: count }, (_, i) => ({ id: `project-${i}` })),
        index, lastHeight: height, targetSlot: null, frame: 0, settleTimer: 0,
        preference: { matches: true }, changes: [],
        viewport: {
            clientHeight: height, scrollTop: top,
            scrollTo(options) { this.scrollTop = options.top; movements.push(options); }
        }
    });
    stage.activate = selected => { stage.index = selected; stage.changes.push(selected); };
    return { stage, movements };
}

test('a resize scroll event arriving before ResizeObserver preserves the selected project', () => {
    const { stage } = stageAt();
    // Landscape -> portrait: the old 780px offset must not be read as project 1.
    stage.viewport.clientHeight = 844;
    stage.readPosition();
    assert.equal(stage.index, 1);
    assert.equal(stage.viewport.scrollTop, 1688);
    assert.deepEqual(stage.changes, []);
    stage.readPosition();
    assert.deepEqual(stage.changes, [1]);

    // Returning to landscape keeps the same selection and snaps to its new size.
    stage.viewport.clientHeight = 390;
    stage.readPosition();
    assert.equal(stage.index, 1);
    assert.equal(stage.viewport.scrollTop, 780);
});

test('loop boundaries settle on the identical real project in either direction', () => {
    const { stage, movements } = stageAt({ index: 0, height: 936, top: 0 });
    stage.settle();
    assert.equal(stage.index, 2);
    assert.equal(stage.viewport.scrollTop, 2808);
    assert.equal(movements.at(-1).behavior, 'instant');
    stage.viewport.scrollTop = 3744;
    stage.settle();
    assert.equal(stage.index, 0);
    assert.equal(stage.viewport.scrollTop, 936);
    assert.equal(stage.targetSlot, null);
});

test('reduced-motion navigation uses immediate scrolling and preserves the target', () => {
    const { stage, movements } = stageAt({ index: 0, height: 936, top: 936 });
    stage.goTo(2);
    assert.deepEqual(movements.map(item => [item.top, item.behavior]), [[2808, 'instant']]);
    stage.readPosition();
    assert.equal(stage.index, 2);
});

test('empty and single-project portfolios do not navigate into boundary copies', () => {
    for (const count of [0, 1]) {
        const { stage, movements } = stageAt({ index: 0, height: 844, top: 0, count });
        stage.goBy(-1);
        stage.goBy(1);
        stage.goTo(10);
        assert.deepEqual(movements, []);
        assert.equal(stage.viewport.scrollTop, 0);
    }
});
