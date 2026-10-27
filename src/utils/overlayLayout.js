// Placement of the compact answer overlay shown during a session. Pure functions so they can be unit tested.

const COMPACT_OVERLAY_SIZE = { width: 400, height: 180 };
const COMPACT_OVERLAY_MIN_SIZE = { width: 240, height: 90 };
const COMPACT_OVERLAY_MARGIN = 16;
const DEFAULT_OVERLAY_OPACITY = 0.85;
const MIN_OVERLAY_OPACITY = 0.15;

// Bottom-right corner of the given work area.
function computeCompactBounds(workArea, { size = COMPACT_OVERLAY_SIZE, margin = COMPACT_OVERLAY_MARGIN } = {}) {
    return {
        x: Math.round(workArea.x + workArea.width - size.width - margin),
        y: Math.round(workArea.y + workArea.height - size.height - margin),
        width: size.width,
        height: size.height,
    };
}

function isBoundsOnScreen(bounds, workAreas) {
    const cx = bounds.x + bounds.width / 2;
    const cy = bounds.y + bounds.height / 2;
    return workAreas.some(area => cx >= area.x && cx <= area.x + area.width && cy >= area.y && cy <= area.y + area.height);
}

function isValidBounds(bounds) {
    return (
        !!bounds &&
        ['x', 'y', 'width', 'height'].every(key => Number.isFinite(bounds[key])) &&
        bounds.width >= COMPACT_OVERLAY_MIN_SIZE.width &&
        bounds.height >= COMPACT_OVERLAY_MIN_SIZE.height
    );
}

// Last position the user left the overlay at, if it is still usable; otherwise the default corner.
function resolveCompactBounds({ saved, workArea, workAreas }) {
    if (isValidBounds(saved) && isBoundsOnScreen(saved, workAreas)) {
        return { x: saved.x, y: saved.y, width: saved.width, height: saved.height };
    }
    return computeCompactBounds(workArea);
}

function clampOverlayOpacity(value) {
    const opacity = Number(value);
    if (value === undefined || value === null || value === '' || !Number.isFinite(opacity)) return DEFAULT_OVERLAY_OPACITY;
    return Math.min(1, Math.max(MIN_OVERLAY_OPACITY, opacity));
}

// Menu bar answer: a one-line window drawn over the macOS menu bar, right of the notch by default.
const MENU_BAR_ANSWER_WIDTH = 320;
const DEFAULT_MENU_BAR_HEIGHT = 24;
// Half the notch width on MacBooks plus a little space, so the text starts clear of it
const NOTCH_CLEARANCE = 110;

// The menu bar is the strip between the top of the display and its work area.
function menuBarHeight(displayBounds, workArea) {
    const height = workArea.y - displayBounds.y;
    return height > 0 ? height : DEFAULT_MENU_BAR_HEIGHT;
}

function clampMenuBarX(x, width, displayBounds) {
    return Math.round(Math.min(displayBounds.x + displayBounds.width - width, Math.max(displayBounds.x, x)));
}

// savedOffset is the last x the user moved the answer to, relative to the display's left edge.
function computeMenuBarAnswerBounds({ displayBounds, workArea, savedOffset, width = MENU_BAR_ANSWER_WIDTH }) {
    const answerWidth = Math.min(width, displayBounds.width);
    const defaultX = displayBounds.x + displayBounds.width / 2 + NOTCH_CLEARANCE;
    const x = Number.isFinite(savedOffset) ? displayBounds.x + savedOffset : defaultX;
    return {
        x: clampMenuBarX(x, answerWidth, displayBounds),
        y: displayBounds.y,
        width: answerWidth,
        height: menuBarHeight(displayBounds, workArea),
    };
}

module.exports = {
    clampMenuBarX,
    computeMenuBarAnswerBounds,
    MENU_BAR_ANSWER_WIDTH,
    menuBarHeight,
    COMPACT_OVERLAY_SIZE,
    clampOverlayOpacity,
    COMPACT_OVERLAY_MIN_SIZE,
    computeCompactBounds,
    isBoundsOnScreen,
    resolveCompactBounds,
};
