const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
    COMPACT_OVERLAY_SIZE,
    computeCompactBounds,
    isBoundsOnScreen,
    resolveCompactBounds,
    clampOverlayOpacity,
    MENU_BAR_ANSWER_WIDTH,
    menuBarHeight,
    computeMenuBarAnswerBounds,
    clampMenuBarX,
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

// Display bounds include the menu bar; the work area starts below it (37pt on a notched MacBook).
const NOTCHED = { bounds: { x: 0, y: 0, width: 1512, height: 982 }, workArea: { x: 0, y: 37, width: 1512, height: 945 } };
const SECOND = { bounds: { x: 1512, y: -200, width: 2560, height: 1440 }, workArea: { x: 1512, y: -175, width: 2560, height: 1415 } };

test('menuBarHeight is the gap between the display top and its work area', () => {
    assert.equal(menuBarHeight(NOTCHED.bounds, NOTCHED.workArea), 37);
    assert.equal(menuBarHeight(SECOND.bounds, SECOND.workArea), 25);
});

test('menuBarHeight falls back to the standard height when the menu bar is hidden', () => {
    assert.equal(menuBarHeight({ x: 0, y: 0, width: 1512, height: 982 }, { x: 0, y: 0, width: 1512, height: 982 }), 24);
});

test('computeMenuBarAnswerBounds puts the answer right of the notch, inside the menu bar', () => {
    assert.deepEqual(computeMenuBarAnswerBounds({ displayBounds: NOTCHED.bounds, workArea: NOTCHED.workArea }), {
        x: 756 + 110,
        y: 0,
        width: MENU_BAR_ANSWER_WIDTH,
        height: 37,
    });
});

test('computeMenuBarAnswerBounds uses the origin of secondary displays', () => {
    const bounds = computeMenuBarAnswerBounds({ displayBounds: SECOND.bounds, workArea: SECOND.workArea });
    assert.equal(bounds.x, 1512 + 1280 + 110);
    assert.equal(bounds.y, -200);
    assert.equal(bounds.height, 25);
});

test('computeMenuBarAnswerBounds reuses a saved offset from the display left edge', () => {
    const bounds = computeMenuBarAnswerBounds({ displayBounds: SECOND.bounds, workArea: SECOND.workArea, savedOffset: 400 });
    assert.equal(bounds.x, 1512 + 400);
});

test('computeMenuBarAnswerBounds keeps a saved offset on the display', () => {
    const right = computeMenuBarAnswerBounds({ displayBounds: NOTCHED.bounds, workArea: NOTCHED.workArea, savedOffset: 5000 });
    assert.equal(right.x, 1512 - MENU_BAR_ANSWER_WIDTH);
    const left = computeMenuBarAnswerBounds({ displayBounds: NOTCHED.bounds, workArea: NOTCHED.workArea, savedOffset: -50 });
    assert.equal(left.x, 0);
});

test('computeMenuBarAnswerBounds ignores an invalid saved offset', () => {
    const defaults = computeMenuBarAnswerBounds({ displayBounds: NOTCHED.bounds, workArea: NOTCHED.workArea });
    for (const savedOffset of [null, undefined, 'abc', NaN]) {
        assert.equal(computeMenuBarAnswerBounds({ displayBounds: NOTCHED.bounds, workArea: NOTCHED.workArea, savedOffset }).x, defaults.x);
    }
});

test('computeMenuBarAnswerBounds narrows the answer on small displays', () => {
    const small = { x: 0, y: 0, width: 300, height: 600 };
    const bounds = computeMenuBarAnswerBounds({ displayBounds: small, workArea: { x: 0, y: 24, width: 300, height: 576 } });
    assert.equal(bounds.width, 300);
    assert.equal(bounds.x, 0);
});

test('clampMenuBarX keeps the answer within the display horizontally', () => {
    assert.equal(clampMenuBarX(100, 320, NOTCHED.bounds), 100);
    assert.equal(clampMenuBarX(-10, 320, NOTCHED.bounds), 0);
    assert.equal(clampMenuBarX(1400, 320, NOTCHED.bounds), 1512 - 320);
    assert.equal(clampMenuBarX(1000, 320, SECOND.bounds), 1512);
});
