const { app, BrowserWindow, ipcMain, Notification, powerMonitor, screen, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const readline = require('readline');
const fs = require('fs');

const FOCUS_SECONDS = Number(process.env.PET_FOCUS_SECONDS || 60 * 60);
const WARNING_SECONDS = Number(process.env.PET_WARNING_SECONDS || 55 * 60);
const BREAK_SECONDS = Number(process.env.PET_BREAK_SECONDS || 10 * 60);
const RESET_INACTIVE_SECONDS = Number(process.env.PET_RESET_INACTIVE_SECONDS || 8 * 60);
const PET_VISIBLE_SECONDS = Number(process.env.PET_VISIBLE_SECONDS || 120);
const PET_WIDTH = 220;
const PET_HEIGHT = 280;

let mainWindow;
let tray;
let overlayWindows = [];
let timer;
let displayMonitor;
let inactiveAt = null;
let lastTick = Date.now();
let preferencesPath;
let preferences = {};
let dragOffset = null;
let petVisibleUntil = 0;
let wanderTarget = null;
let nextWanderAt = 0;
let warningVisible = false;
let pointerTimer;
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

function startPointerTracking() {
  clearInterval(pointerTimer);
  pointerTimer = setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const cursor = screen.getCursorScreenPoint();
    const bounds = mainWindow.getBounds();
    const x = Math.max(-1, Math.min(1, (cursor.x - (bounds.x + bounds.width / 2)) / (bounds.width * .9)));
    const y = Math.max(-1, Math.min(1, (cursor.y - (bounds.y + bounds.height / 2)) / (bounds.height * .9)));
    mainWindow.webContents.send('pointer:state', { x, y });
  }, 80);
}

function showPetFor(seconds = 120) {
  petVisibleUntil = Date.now() + seconds * 1000;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.showInactive();
  }
}

function updatePetVisibility() {
  if (!mainWindow || mainWindow.isDestroyed() || state.mode === 'break' || inactiveAt) return;
  if (warningVisible || Date.now() < petVisibleUntil) mainWindow.showInactive();
  else mainWindow.hide();
}

function updateWander(now) {
  if (!mainWindow || mainWindow.isDestroyed() || !warningVisible || state.mode !== 'focus') return;
  const [currentX, currentY] = mainWindow.getPosition();
  const display = screen.getDisplayNearestPoint({ x: currentX, y: currentY });
  const area = display.workArea;
  const [width, height] = mainWindow.getSize();
  if (!wanderTarget || now >= nextWanderAt) {
    wanderTarget = {
      x: area.x + 30 + Math.floor(Math.random() * Math.max(1, area.width - width - 60)),
      y: area.y + 30 + Math.floor(Math.random() * Math.max(1, area.height - height - 60))
    };
    nextWanderAt = now + 4500 + Math.random() * 3500;
  }
  const [x, y] = mainWindow.getPosition();
  const nx = Math.round(x + (wanderTarget.x - x) * .035);
  const ny = Math.round(y + (wanderTarget.y - y) * .035);
  mainWindow.setPosition(nx, ny);
}

function createMainWindow() {
  const display = screen.getPrimaryDisplay();
  const defaultX = display.workArea.x + display.workArea.width - PET_WIDTH - 20;
  const defaultY = display.workArea.y + display.workArea.height - PET_HEIGHT - 20;
  // Always start at the primary display's lower-right corner.
  const requestedPoint = { x: defaultX, y: defaultY };
  const initialArea = screen.getDisplayNearestPoint(requestedPoint).workArea;
  const initialX = Math.max(initialArea.x, Math.min(requestedPoint.x, initialArea.x + initialArea.width - PET_WIDTH));
  const initialY = Math.max(initialArea.y, Math.min(requestedPoint.y, initialArea.y + initialArea.height - PET_HEIGHT));
  mainWindow = new BrowserWindow({
    x: initialX,
    y: initialY,
    width: PET_WIDTH,
    height: PET_HEIGHT,
    minWidth: PET_WIDTH,
    minHeight: PET_HEIGHT,
    maxWidth: PET_WIDTH,
    maxHeight: PET_HEIGHT,
    show: false,
    transparent: true,
    frame: false,
    resizable: false,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.setAlwaysOnTop(true, 'floating');
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false });
  // Do not use BrowserWindow.setShape here: it clips the 3D canvas itself.
  // A transparent desktop pet must remain visually complete and click-through.
  mainWindow.setIgnoreMouseEvents(true, { forward: true });
  mainWindow.loadFile(path.join(__dirname, '..', 'index.html'));
  mainWindow.webContents.on('console-message', (_event, details) => {
    if (details.level === 'error') console.error(`[renderer] ${details.message}`);
  });
  mainWindow.once('ready-to-show', () => {
    const currentDisplay = screen.getPrimaryDisplay();
    const area = currentDisplay.workArea;
    mainWindow.setPosition(
      area.x + area.width - PET_WIDTH - 20,
      area.y + area.height - PET_HEIGHT - 20
    );
    mainWindow.showInactive();
    showPetFor(PET_VISIBLE_SECONDS);
  });
  mainWindow.webContents.once('did-finish-load', async () => {
    if (!process.env.PET_CAPTURE_PATH) return;
    setTimeout(async () => {
      const image = await mainWindow.webContents.capturePage();
      fs.writeFileSync(process.env.PET_CAPTURE_PATH, image.toPNG());
    }, 1500);
  });
  let savePositionTimer;
  mainWindow.on('move', () => {
    clearTimeout(savePositionTimer);
    savePositionTimer = setTimeout(() => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      const [x, y] = mainWindow.getPosition();
      preferences = { ...preferences, x, y };
      try { fs.writeFileSync(preferencesPath, JSON.stringify(preferences)); } catch {}
    }, 250);
  });
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
    { label: '伴桌正在自动计时', enabled: false },
    { label: '亮屏时出现 2 分钟', enabled: false },
    { type: 'separator' },
    { label: '退出', click: () => { app.isQuitting = true; app.quit(); } }
  ]));
}

function showWarning() {
  state.warned = true;
  warningVisible = true;
  mainWindow?.showInactive();
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
  warningVisible = false;
  mainWindow?.hide();
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
  warningVisible = false;
  lastTick = Date.now();
  showPetFor(PET_VISIBLE_SECONDS);
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
  warningVisible = false;
  state.resetReason = reason;
  lastTick = Date.now();
  broadcast();
  if (reason && Notification.isSupported()) new Notification({ title: '本轮已重新计时', body: reason }).show();
}

function becomeInactive() {
  if (inactiveAt || state.mode === 'break') return;
  inactiveAt = Date.now();
  mainWindow?.hide();
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
  if (state.elapsed >= WARNING_SECONDS) warningVisible = true;
  showPetFor(PET_VISIBLE_SECONDS);
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
  updatePetVisibility();
  updateWander(now);
  if (state.paused || inactiveAt) return;
  state.elapsed += delta;
  state.totalSeconds += delta;
  state.points = Math.floor(state.totalSeconds / 60) * 2 + state.rounds * 20;
  evaluateFocus();
}

function registerIpc() {
  ipcMain.on('debug:renderer-error', (_event, message) => {
    fs.writeFileSync(path.join(app.getPath('userData'), 'renderer-error.log'), String(message));
  });
  ipcMain.handle('timer:get-state', () => publicState());
  ipcMain.handle('timer:pause', () => publicState());
  ipcMain.handle('timer:resume', () => publicState());
  ipcMain.handle('timer:reset', () => publicState());
  ipcMain.handle('window:hide', () => true);
  ipcMain.handle('window:drag-start', (_event, point) => {
    const [windowX, windowY] = mainWindow.getPosition();
    dragOffset = { x: point.x - windowX, y: point.y - windowY };
    return true;
  });
  ipcMain.on('window:drag-move', (_event, point) => {
    if (!dragOffset || !mainWindow || mainWindow.isDestroyed()) return;
    const area = screen.getDisplayNearestPoint(point).workArea;
    const [width, height] = mainWindow.getSize();
    const nextX = Math.max(area.x, Math.min(Math.round(point.x - dragOffset.x), area.x + area.width - width));
    const nextY = Math.max(area.y, Math.min(Math.round(point.y - dragOffset.y), area.y + area.height - height));
    mainWindow.setPosition(nextX, nextY);
  });
  ipcMain.handle('window:context-menu', event => {
    const minutes = Math.floor(state.totalSeconds / 60);
    const roundMinutes = Math.floor(state.elapsed / 60);
    const menu = Menu.buildFromTemplate([
      { label: `今日陪伴  ${minutes} 分钟`, enabled: false },
      { label: `本轮使用  ${roundMinutes} 分钟`, enabled: false },
      { label: `完成休息  ${state.rounds} 次`, enabled: false },
      { type: 'separator' },
      { label: '计时由屏幕状态自动控制', enabled: false },
      { label: '始终置顶', type: 'checkbox', checked: mainWindow.isAlwaysOnTop(), click: item => mainWindow.setAlwaysOnTop(item.checked, 'floating') },
      { label: '随 Windows 启动', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin, click: item => app.setLoginItemSettings({ openAtLogin: item.checked, path: app.getPath('exe') }) },
      { type: 'separator' },
      { label: '退出伴桌', click: () => { app.isQuitting = true; app.quit(); } }
    ]);
    menu.popup({ window: BrowserWindow.fromWebContents(event.sender) });
    return true;
  });
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
    preferencesPath = path.join(app.getPath('userData'), 'preferences.json');
    try { preferences = JSON.parse(fs.readFileSync(preferencesPath, 'utf8')); } catch { preferences = {}; }
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
    startPointerTracking();
    lastTick = Date.now();
    timer = setInterval(tick, 1000);
  });
}

app.on('before-quit', () => {
  app.isQuitting = true;
  clearInterval(timer);
  clearInterval(pointerTimer);
  if (displayMonitor && !displayMonitor.killed) displayMonitor.kill();
  closeOverlays();
});
app.on('window-all-closed', event => event.preventDefault());
