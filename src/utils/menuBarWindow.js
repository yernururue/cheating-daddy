// Menu bar answer: during a session the main window hides and the current answer is shown as one line of text
// in a small click-through window over the macOS menu bar (src/menubar.html). Like the main window it uses
// setContentProtection, so it is left out of screen captures that honor it.
const { BrowserWindow, screen } = require('electron');
const path = require('node:path');
const storage = require('../storage');
const { computeMenuBarAnswerBounds, clampMenuBarX } = require('./overlayLayout');

let menuBarWindow = null;
// True while a session shows its answers in the menu bar (the window itself may be hidden with Toggle Visibility)
let active = false;
let lastAnswer = { text: '', index: -1 };

function isMenuBarAnswerEnabled() {
    return process.platform === 'darwin' && storage.getPreferences().menuBarAnswer === true;
}

function isMenuBarAnswerActive() {
    return active;
}

function sendAnswer() {
    if (!menuBarWindow || menuBarWindow.isDestroyed()) return;
    menuBarWindow.webContents.send('menubar-answer', { ...lastAnswer, color: storage.getPreferences().responseTextColor });
}

function ensureWindow() {
    if (menuBarWindow && !menuBarWindow.isDestroyed()) return menuBarWindow;

    menuBarWindow = new BrowserWindow({
        show: false,
        frame: false,
        transparent: true,
        hasShadow: false,
        resizable: false,
        movable: false,
        minimizable: false,
        maximizable: false,
        fullscreenable: false,
        focusable: false,
        skipTaskbar: true,
        // Lets the window sit above the work area, over the menu bar
        enableLargerThanScreen: true,
        backgroundColor: '#00000000',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            backgroundThrottling: false,
        },
    });

    menuBarWindow.setContentProtection(true);
    menuBarWindow.setIgnoreMouseEvents(true);
    menuBarWindow.setAlwaysOnTop(true, 'screen-saver', 1);
    menuBarWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    try {
        menuBarWindow.setHiddenInMissionControl(true);
    } catch (error) {
        console.warn('Could not hide menu bar answer from Mission Control:', error.message);
    }

    menuBarWindow.webContents.on('did-finish-load', sendAnswer);
    menuBarWindow.on('closed', () => {
        menuBarWindow = null;
    });
    menuBarWindow.loadFile(path.join(__dirname, '../menubar.html'));
    return menuBarWindow;
}

// anchorBounds: bounds of the main window, so the answer goes to the menu bar of the display the app is on.
function showMenuBarAnswer(anchorBounds) {
    const display = anchorBounds ? screen.getDisplayMatching(anchorBounds) : screen.getPrimaryDisplay();
    const win = ensureWindow();
    win.setBounds(
        computeMenuBarAnswerBounds({
            displayBounds: display.bounds,
            workArea: display.workArea,
            savedOffset: storage.getPreferences().menuBarAnswerOffset,
        })
    );
    win.showInactive();
    active = true;
}

function hideMenuBarAnswer() {
    active = false;
    lastAnswer = { text: '', index: -1 };
    if (!menuBarWindow || menuBarWindow.isDestroyed()) return;
    sendAnswer();
    menuBarWindow.hide();
}

function setMenuBarAnswer(answer) {
    lastAnswer = {
        text: typeof answer?.text === 'string' ? answer.text : '',
        index: Number.isInteger(answer?.index) ? answer.index : -1,
        pending: answer?.pending === true,
    };
    if (active) sendAnswer();
}

function pageMenuBarAnswer(delta) {
    if (!active || !menuBarWindow || menuBarWindow.isDestroyed()) return;
    menuBarWindow.webContents.send('menubar-page', delta);
}

// Horizontal move with the Move Left/Right shortcuts; the position is remembered for the next session.
function moveMenuBarAnswer(dx) {
    if (!active || !menuBarWindow || menuBarWindow.isDestroyed()) return;
    const bounds = menuBarWindow.getBounds();
    const display = screen.getDisplayMatching(bounds);
    const x = clampMenuBarX(bounds.x + dx, bounds.width, display.bounds);
    menuBarWindow.setBounds({ ...bounds, x });
    storage.updatePreference('menuBarAnswerOffset', x - display.bounds.x);
}

function toggleMenuBarAnswerVisibility() {
    if (!active || !menuBarWindow || menuBarWindow.isDestroyed()) return;
    if (menuBarWindow.isVisible()) {
        menuBarWindow.hide();
    } else {
        menuBarWindow.showInactive();
    }
}

module.exports = {
    hideMenuBarAnswer,
    isMenuBarAnswerActive,
    isMenuBarAnswerEnabled,
    moveMenuBarAnswer,
    pageMenuBarAnswer,
    setMenuBarAnswer,
    showMenuBarAnswer,
    toggleMenuBarAnswerVisibility,
};
