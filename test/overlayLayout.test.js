const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
    COMPACT_OVERLAY_SIZE,
    computeCompactBounds,
    isBoundsOnScreen,
    resolveCompactBounds,
    clampOverlayOpacity,
} = require('../src/utils/overlayLayout');

const LAPTOP = { x: 0, y: 25, width: 1512, height: 919 }; // work area below the menu bar
const EXTERNAL = { x: 1512, y: 0, width: 2560, height: 1415 };

test('compact overlay is small', () => {
    assert.ok(COMPACT_OVERLAY_SIZE.width <= 440);
    assert.ok(COMPACT_OVERLAY_SIZE.height <= 200);
});

test('computeCompactBounds places the overlay in the bottom-right corner with a margin', () => {
    assert.deepEqual(computeCompactBounds(LAPTOP, { size: { width: 400, height: 180 }, margin: 16 }), {
        x: 1512 - 400 - 16,
        y: 25 + 919 - 180 - 16,
        width: 400,
        height: 180,
    });
});

test('computeCompactBounds respects the work area origin of secondary displays', () => {
    const bounds = computeCompactBounds(EXTERNAL, { size: { width: 400, height: 180 }, margin: 16 });
    assert.equal(bounds.x, 1512 + 2560 - 400 - 16);
    assert.equal(bounds.y, 1415 - 180 - 16);
});

test('computeCompactBounds uses default size and margin', () => {
    const bounds = computeCompactBounds(LAPTOP);
    assert.equal(bounds.width, COMPACT_OVERLAY_SIZE.width);
    assert.equal(bounds.height, COMPACT_OVERLAY_SIZE.height);
    assert.ok(bounds.x + bounds.width <= LAPTOP.x + LAPTOP.width);
    assert.ok(bounds.y + bounds.height <= LAPTOP.y + LAPTOP.height);
});

test('isBoundsOnScreen checks that the center lies on some display', () => {
    assert.equal(isBoundsOnScreen({ x: 100, y: 100, width: 400, height: 180 }, [LAPTOP, EXTERNAL]), true);
    assert.equal(isBoundsOnScreen({ x: 3000, y: 500, width: 400, height: 180 }, [LAPTOP, EXTERNAL]), true);
    assert.equal(isBoundsOnScreen({ x: 3000, y: 500, width: 400, height: 180 }, [LAPTOP]), false);
    assert.equal(isBoundsOnScreen({ x: -900, y: 100, width: 400, height: 180 }, [LAPTOP]), false);
});

test('resolveCompactBounds reuses the last position when it is still on screen', () => {
    const saved = { x: 40, y: 60, width: 360, height: 150 };
    assert.deepEqual(resolveCompactBounds({ saved, workArea: LAPTOP, workAreas: [LAPTOP] }), saved);
});

test('resolveCompactBounds falls back to the corner when the saved position is off screen or invalid', () => {
    const corner = computeCompactBounds(LAPTOP);
    assert.deepEqual(resolveCompactBounds({ saved: { x: 3000, y: 500, width: 400, height: 180 }, workArea: LAPTOP, workAreas: [LAPTOP] }), corner);
    assert.deepEqual(resolveCompactBounds({ saved: null, workArea: LAPTOP, workAreas: [LAPTOP] }), corner);
    assert.deepEqual(resolveCompactBounds({ saved: { x: 'a', y: 1 }, workArea: LAPTOP, workAreas: [LAPTOP] }), corner);
    assert.deepEqual(resolveCompactBounds({ saved: { x: 10, y: 10, width: 0, height: 0 }, workArea: LAPTOP, workAreas: [LAPTOP] }), corner);
});

test('clampOverlayOpacity keeps the overlay between faint and fully opaque', () => {
    assert.equal(clampOverlayOpacity(0.5), 0.5);
    assert.equal(clampOverlayOpacity(0.01), 0.15);
    assert.equal(clampOverlayOpacity(3), 1);
    assert.equal(clampOverlayOpacity('0.4'), 0.4);
    assert.equal(clampOverlayOpacity(undefined), 0.85);
    assert.equal(clampOverlayOpacity('abc'), 0.85);
});
