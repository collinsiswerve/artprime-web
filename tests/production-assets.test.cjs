const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets/styles.css'), 'utf8');

test('production pages load local styles and all local image sources exist', () => {
    assert.match(html, /rel="stylesheet" href="assets\/styles\.css"/);
    assert.doesNotMatch(html, /cdn\.tailwindcss\.com|tailwind\.config/);
    const images = [...html.matchAll(/(?:src|srcset)="(assets\/[^"\n]+)"/g)]
        .flatMap(match => match[1].split(', ').map(source => source.split(' ')[0]));
    assert.ok(images.length >= 7);
    for (const image of images) assert.ok(fs.existsSync(path.join(root, image)), image);
});

test('compiled CSS includes dynamic cart states, dialogs, card ratios and responsive layouts', () => {
    const critical = ['hidden', 'bg-gray-300', 'bg-gray-400', 'cursor-not-allowed', 'bg-terra', 'cart-open',
        'cart-closed', 'aspect-[3/4]', 'z-[120]', 'md:w-96', 'lg:grid-cols-4', 'group-hover:scale-105'];
    for (const name of critical) {
        const selector = '.' + name.replace(/[^a-zA-Z0-9_-]/g, char => '\\' + char);
        assert.ok(css.includes(selector), `Missing production rule for ${name}`);
    }
    assert.ok(Buffer.byteLength(css) < 40000, 'Ship a small stylesheet instead of the compiler');
});

test('hero text remains readable with the lighter overlay over the brightest possible photo background', () => {
    const config = require('../tailwind.config.cjs');
    const source = fs.readFileSync(path.join(root, 'styles/input.css'), 'utf8');
    const overlays = [...source.matchAll(/rgb\((\d+) (\d+) (\d+) \/ (\d+)%\)/g)];
    assert.ok(overlays.length > 0);
    const sand = config.theme.extend.colors.sand.match(/[a-f\d]{2}/gi).map(channel => parseInt(channel, 16));
    function luminance(channels) {
        const linear = channels.map(channel => {
            const value = channel / 255;
            return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
        });
        return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
    }
    for (const match of overlays) {
        const alpha = Number(match[4]) / 100;
        const background = match.slice(1, 4).map(channel => Number(channel) * alpha + 255 * (1 - alpha));
        const headingContrast = (luminance(sand) + 0.05) / (luminance(background) + 0.05);
        const paragraphContrast = (luminance([243, 244, 246]) + 0.05) / (luminance(background) + 0.05);
        // The heading is at least 2.75rem (large text); the paragraph uses text-gray-100.
        assert.ok(headingContrast >= 3, `Large hero heading contrast is ${headingContrast.toFixed(2)}:1`);
        assert.ok(paragraphContrast >= 4.5, `Hero paragraph contrast is ${paragraphContrast.toFixed(2)}:1`);
    }
});
