const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Slideshow } = require('../assets/studio-gallery.js');

function clock() {
    let now = 0;
    let id = 0;
    const timers = new Map();
    return {
        timers,
        setTimeout(fn, delay) { const key = ++id; timers.set(key, { at: now + delay, fn }); return key; },
        clearTimeout(key) { timers.delete(key); },
        tick(ms) {
            const until = now + ms;
            for (;;) {
                const due = [...timers.entries()].filter(([, timer]) => timer.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
                if (!due) break;
                now = due[1].at;
                timers.delete(due[0]);
                due[1].fn();
            }
            now = until;
        }
    };
}
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
const deferred = () => { let resolve; let reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
function setup(load = async item => item) {
    const time = clock();
    const shown = [];
    const states = [];
    const errors = [];
    const slideshow = new Slideshow({ clock: time, load, present: (asset, index, options) => shown.push({ asset, index, ...options }), onState: state => states.push(state), onError: error => errors.push(error) });
    return { slideshow, time, shown, states, errors };
}

test('native browser timers keep their Window receiver', async () => {
    const browser = { module: { exports: {} } };
    vm.createContext(browser);
    vm.runInContext(`
        globalThis.timerCalls = [];
        globalThis.setTimeout = function (fn, delay) {
            if (this !== globalThis) throw new TypeError('Illegal invocation');
            timerCalls.push(delay);
            return timerCalls.length;
        };
        globalThis.clearTimeout = function () {
            if (this !== globalThis) throw new TypeError('Illegal invocation');
        };
    `, browser);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets/studio-gallery.js'), 'utf8'), browser);
    const slideshow = new browser.module.exports.Slideshow({ load: async item => item, present: () => {} });
    await slideshow.open([0, 1]);
    assert.deepEqual([...browser.timerCalls], [12000]);
    slideshow.close();
});

test('each loaded photograph gets 12 seconds and the sequence loops', async () => {
    const { slideshow, time, shown } = setup();
    await slideshow.open(['first', 'second']);
    time.tick(11999);
    assert.deepEqual(shown.map(photo => photo.index), [0]);
    time.tick(1);
    await flush();
    assert.deepEqual(shown.map(photo => photo.index), [0, 1]);
    assert.equal(shown[1].manual, false);
    time.tick(12000);
    await flush();
    assert.deepEqual(shown.map(photo => photo.index), [0, 1, 0]);
    assert.equal(time.timers.size, 1);
});

test('manual navigation wraps and gives the selected photograph a fresh interval', async () => {
    const { slideshow, time, shown } = setup();
    await slideshow.open(['first', 'second', 'third']);
    time.tick(11000);
    await slideshow.goBy(-1);
    assert.equal(shown.at(-1).index, 2);
    assert.equal(shown.at(-1).manual, true);
    time.tick(11999);
    assert.equal(shown.length, 2);
    time.tick(1);
    await flush();
    assert.equal(shown.at(-1).index, 0);
});

test('slow or out-of-order image loads cannot replace a newer manual selection', async () => {
    const pending = [deferred(), deferred(), deferred()];
    const { slideshow, time, shown } = setup(item => pending[item].promise);
    const first = slideshow.open([0, 1, 2]);
    time.tick(30000);
    assert.equal(shown.length, 0);
    assert.equal(time.timers.size, 0);
    const second = slideshow.goBy(1);
    const third = slideshow.goBy(1);
    pending[2].resolve('third');
    await third;
    pending[1].resolve('second');
    pending[0].resolve('first');
    await Promise.all([first, second]);
    assert.deepEqual(shown.map(photo => photo.asset), ['third']);
    assert.equal(time.timers.size, 1);
});

test('an automatic transition waits for the next image to load before starting its interval', async () => {
    const next = deferred();
    const { slideshow, time, shown } = setup(item => item === 1 ? next.promise : Promise.resolve(item));
    await slideshow.open([0, 1]);
    time.tick(12000);
    time.tick(30000);
    assert.deepEqual(shown.map(photo => photo.index), [0]);
    assert.equal(time.timers.size, 0);
    next.resolve(1);
    await flush();
    time.tick(11999);
    assert.equal(shown.at(-1).index, 1);
    time.tick(1);
    await flush();
    assert.equal(shown.at(-1).index, 0);
});

test('pause, hidden tabs and open panels do not override one another', async () => {
    const { slideshow, time, shown } = setup();
    await slideshow.open([0, 1]);
    slideshow.suspend('visibility', true);
    slideshow.suspend('panel', true);
    slideshow.suspend('visibility', false);
    time.tick(60000);
    assert.equal(shown.length, 1);
    slideshow.setPaused(true);
    slideshow.suspend('panel', false);
    assert.equal(time.timers.size, 0);
    slideshow.setPaused(false);
    assert.equal(time.timers.size, 1);
    slideshow.setPaused(false);
    assert.equal(time.timers.size, 1);
    time.tick(12000);
    await flush();
    assert.equal(shown.length, 2);
});

test('closing and changing projects cancel old timers and late image results', async () => {
    const old = deferred();
    const { slideshow, time, shown } = setup(item => item === 'old' ? old.promise : Promise.resolve(item));
    const previous = slideshow.open(['old', 'unused']);
    await slideshow.open(['new', 'next']);
    old.resolve('old');
    await previous;
    assert.deepEqual(shown.map(photo => photo.asset), ['new']);
    slideshow.close();
    time.tick(60000);
    await flush();
    assert.equal(shown.length, 1);
    assert.equal(time.timers.size, 0);
    await slideshow.open(['again', 'last']);
    assert.equal(shown.at(-1).index, 0);
    assert.equal(time.timers.size, 1);
});

test('reduced motion starts paused, allows deliberate playback and pauses when enabled', async () => {
    const { slideshow, time, shown } = setup();
    await slideshow.open([0, 1], { reducedMotion: true });
    time.tick(60000);
    assert.equal(shown.length, 1);
    slideshow.setPaused(false);
    time.tick(12000);
    await flush();
    assert.equal(shown.at(-1).reducedMotion, true);
    slideshow.setReducedMotion(false);
    slideshow.setReducedMotion(true);
    assert.equal(time.timers.size, 0);
});

test('empty and single-photo galleries never schedule an automatic transition', async () => {
    const { slideshow, time, shown } = setup();
    await slideshow.open([]);
    await slideshow.goBy(1);
    assert.equal(shown.length, 0);
    await slideshow.open(['only']);
    await slideshow.goBy(-1);
    slideshow.setPaused(false);
    time.tick(60000);
    assert.equal(shown.length, 1);
    assert.equal(time.timers.size, 0);
});

test('an unexpected load failure preserves the visible photograph and pauses safely', async () => {
    const { slideshow, time, shown, errors } = setup(item => item === 'bad' ? Promise.reject(new Error('offline')) : Promise.resolve(item));
    await slideshow.open(['good', 'bad']);
    time.tick(12000);
    await flush();
    assert.equal(shown.at(-1).asset, 'good');
    assert.equal(slideshow.pending, false);
    assert.equal(slideshow.paused, true);
    assert.equal(errors.length, 1);
    assert.equal(time.timers.size, 0);
});
