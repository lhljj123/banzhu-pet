const { app, BrowserWindow, ipcMain, Notification, powerMonitor, screen, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const readline = require('readline');

const FOCUS_SECONDS = 60 * 60;
const WARNING_SECONDS = 55 * 60;
const BREAK_SECONDS = 10 * 60;
const RESET_INACTIVE_SECONDS = 8 * 60;

let mainWindow;
let tray;
let overlayWindows = [];
let timer;
let displayMonitor;
let inactiveAt = null;
let lastTick = Date.now();
let state = {
  mode: 'focus',
  elapsed: 0,
  breakRemaining: BREAK_SECONDS,
  warned: false,
  paused: false,
  rounds: 0,
  points: 0,
  totalSeconds: 0,
  resetReason: ''
};

function publicState() {
  return {
    ...state,
    focusSeconds: FOCUS_SECONDS,
    warningSeconds: WARNING_SECONDS,
    breakSeconds: BREAK_SECONDS,
    resetInactiveSeconds: RESET_INACTIVE_SECONDS,
    remaining: Math.max(0, FOCUS_SECONDS - Math.floor(state.elapsed))
  };
}

function broadcast() {
  const data = publicState();
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('timer:state', data);
  overlayWindows.forEach(win => {
    if (!win.isDestroyed()) win.webContents.send('break:state', data);
  });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 760,
    minHeight: 620,
    show: false,
    backgroundColor: '#f7f3eb',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.loadFile(path.join(__dirname, '..', 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('close', event => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" rx="7" fill="#386b55"/><text x="16" y="22" text-anchor="middle" font-size="18" fill="white">伴</text></svg>`;
  tray = new Tray(nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`).resize({ width: 16, height: 16 }));
  tray.setToolTip('伴桌 - 久坐休息提醒');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '打开伴桌', click: () => { mainWindow.show(); mainWindow.focus(); } },
    { label: '重新计时', click: resetFocus },
    { type: 'separator' },
    { label: '退出', click: () => { app.isQuitting = true; app.quit(); } }
  ]));
  tray.on('double-click', () => { mainWindow.show(); mainWindow.focus(); });
}

function showWarning() {
  state.warned = true;
  if (Notification.isSupported()) {
    const notice = new Notification({
      title: '还有 5 分钟就该休息了',
      body: '收个尾，保存手上的内容。伴桌会在整一小时后接管屏幕。'
    });
    notice.show();
  }
  mainWindow?.flashFrame(true);
}

function startBreak() {
  state.mode = 'break';
  state.breakRemaining = BREAK_SECONDS;
  state.rounds += 1;
  state.points += 20;
  closeOverlays();
  for (const display of screen.getAllDisplays()) {
    const { x, y, width, height } = display.bounds;
    const overlay = new BrowserWindow({
      x, y, width, height,
      fullscreen: true,
      kiosk: true,
      alwaysOnTop: true,
      skipTaskbar: false,
      frame: false,
      movable: false,
      minimizable: false,
      closable: false,
      backgroundColor: '#cfe0d7',
      webPreferences: {
        preload: path.join(__dirname, 'break-preload.js'),
        contextIsolation: true,
        nodeIntegration: false
      }
    });
    overlay.setAlwaysOnTop(true, 'screen-saver');
    overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    overlay.loadFile(path.join(__dirname, 'break.html'));
    overlay.on('close', event => {
      if (state.mode === 'break') event.preventDefault();
    });
    overlayWindows.push(overlay);
  }
  broadcast();
}

function finishBreak() {
  if (state.breakRemaining > 0) return false;
  closeOverlays();
  state.mode = 'focus';
  state.elapsed = 0;
  state.warned = false;
  lastTick = Date.now();
  broadcast();
  return true;
}

function closeOverlays() {
  const windows = overlayWindows;
  overlayWindows = [];
  windows.forEach(win => {
    if (!win.isDestroyed()) {
      win.setClosable(true);
      win.destroy();
    }
  });
}

function resetFocus(reason = '') {
  if (state.mode === 'break') return;
  state.elapsed = 0;
  state.warned = false;
  state.resetReason = reason;
  lastTick = Date.now();
  broadcast();
  if (reason && Notification.isSupported()) new Notification({ title: '本轮已重新计时', body: reason }).show();
}

function becomeInactive() {
  if (inactiveAt || state.mode === 'break') return;
  inactiveAt = Date.now();
}

function becomeActive() {
  if (!inactiveAt || state.mode === 'break') {
    inactiveAt = null;
    lastTick = Date.now();
    return;
  }
  const inactiveSeconds = Math.floor((Date.now() - inactiveAt) / 1000);
  inactiveAt = null;
  if (inactiveSeconds >= RESET_INACTIVE_SECONDS) {
    resetFocus(`屏幕关闭或锁定了 ${Math.floor(inactiveSeconds / 60)} 分钟，已从零开始。`);
  } else {
    state.elapsed += inactiveSeconds;
    state.totalSeconds += inactiveSeconds;
    lastTick = Date.now();
    evaluateFocus();
  }
}

function evaluateFocus() {
  if (!state.warned && state.elapsed >= WARNING_SECONDS) showWarning();
  if (state.elapsed >= FOCUS_SECONDS) startBreak();
  broadcast();
}

function tick() {
  const now = Date.now();
  const delta = Math.max(0, (now - lastTick) / 1000);
  lastTick = now;
  if (state.mode === 'break') {
    state.breakRemaining = Math.max(0, state.breakRemaining - delta);
    broadcast();
    return;
  }
  if (state.paused || inactiveAt) return;
  state.elapsed += delta;
  state.totalSeconds += delta;
  state.points = Math.floor(state.totalSeconds / 60) * 2 + state.rounds * 20;
  evaluateFocus();
}

function registerIpc() {
  ipcMain.handle('timer:get-state', () => publicState());
  ipcMain.handle('timer:pause', () => { state.paused = true; broadcast(); return publicState(); });
  ipcMain.handle('timer:resume', () => { state.paused = false; lastTick = Date.now(); broadcast(); return publicState(); });
  ipcMain.handle('timer:reset', () => { resetFocus('你手动重新开始了本轮。'); return publicState(); });
  ipcMain.handle('settings:save', () => publicState());
  ipcMain.handle('break:finish', () => finishBreak());
  ipcMain.handle('break:get-state', () => publicState());
}

function startDisplayMonitor() {
  const scriptPath = app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'electron', 'display-monitor.ps1')
    : path.join(__dirname, 'display-monitor.ps1');
  displayMonitor = spawn('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy', 'Bypass',
    '-File', scriptPath
  ], { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
  const output = readline.createInterface({ input: displayMonitor.stdout });
  output.on('line', line => {
    if (line.trim() === 'DISPLAY_OFF') becomeInactive();
    if (line.trim() === 'DISPLAY_ON') becomeActive();
  });
  displayMonitor.on('error', () => {
    displayMonitor = null;
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();
else {
  app.on('second-instance', () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } });
  app.whenReady().then(() => {
    if (app.isPackaged) {
      app.setLoginItemSettings({ openAtLogin: true, path: app.getPath('exe') });
    }
    createMainWindow();
    createTray();
    registerIpc();
    powerMonitor.on('lock-screen', becomeInactive);
    powerMonitor.on('suspend', becomeInactive);
    powerMonitor.on('unlock-screen', becomeActive);
    powerMonitor.on('resume', becomeActive);
    startDisplayMonitor();
    lastTick = Date.now();
    timer = setInterval(tick, 1000);
  });
}

app.on('before-quit', () => {
  app.isQuitting = true;
  clearInterval(timer);
  if (displayMonitor && !displayMonitor.killed) displayMonitor.kill();
  closeOverlays();
});
app.on('window-all-closed', event => event.preventDefault());
