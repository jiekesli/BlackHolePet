'use strict';

const {
  app,
  BrowserWindow,
  Menu,
  Tray,
  desktopCapturer,
  globalShortcut,
  ipcMain,
  nativeImage,
  screen,
  session,
  shell,
} = require('electron');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const {
  DEFAULT_PREFERENCES,
  normalizePreferences,
  rendererPreferences,
  windowSizeFor,
} = require('./app-config');

app.commandLine.appendSwitch('enable-transparent-visuals');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');

let petWindow;
let settingsWindow;
let tray;
let helperProcess;
let preferences = { ...DEFAULT_PREFERENCES };
let sessionGrowth = 0;
let helperPaused = false;

const debugCapture = process.env.BLACK_HOLE_DEBUG_CAPTURE === '1';
const settingsPath = () => path.join(app.getPath('userData'), 'settings.json');

function readPreferences() {
  try {
    return normalizePreferences({
      ...DEFAULT_PREFERENCES,
      ...JSON.parse(fs.readFileSync(settingsPath(), 'utf8')),
    });
  } catch {
    return normalizePreferences(DEFAULT_PREFERENCES);
  }
}

function storePreferences() {
  fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
  fs.writeFileSync(settingsPath(), `${JSON.stringify(preferences, null, 2)}\n`, 'utf8');
}

function windowHandleNumber(win) {
  const buffer = win.getNativeWindowHandle();
  return buffer.length >= 8
    ? buffer.readBigUInt64LE(0).toString()
    : String(buffer.readUInt32LE(0));
}

function helperExecutable() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'GravityHelper.exe')
    : path.join(__dirname, 'native', 'GravityHelper.exe');
}

function writeHelper(command) {
  if (helperProcess?.stdin?.writable) helperProcess.stdin.write(`${command}\n`);
}

function synchronizeHelper() {
  const usable =
    preferences.petScheme === 'black-hole' &&
    preferences.gravityStrength > 0 &&
    petWindow?.isVisible() &&
    !helperPaused;
  if (petWindow && !petWindow.isDestroyed()) {
    writeHelper(`hwnd ${windowHandleNumber(petWindow)}`);
  }
  writeHelper(`strength ${preferences.gravityStrength.toFixed(3)}`);
  writeHelper(`enabled ${usable ? 1 : 0}`);
}

function consumeHelperOutput(data) {
  for (const line of String(data).split(/\r?\n/)) {
    const match = /^recycle\s+(\d+)\s+(\d+)/.exec(line.trim());
    if (match && Number(match[1]) === 0 && sessionGrowth !== 0) {
      sessionGrowth = 0;
      publishPreferences();
    }
  }
}

function launchHelper() {
  const executable = helperExecutable();
  if (helperProcess || !fs.existsSync(executable)) return;
  helperProcess = spawn(executable, [], {
    stdio: ['pipe', 'pipe', 'ignore'],
    windowsHide: true,
  });
  helperProcess.stdout.on('data', consumeHelperOutput);
  helperProcess.on('spawn', synchronizeHelper);
  helperProcess.on('error', () => {
    helperProcess = undefined;
  });
  helperProcess.on('exit', () => {
    helperProcess = undefined;
  });
}

function shutdownHelper() {
  const processToClose = helperProcess;
  helperProcess = undefined;
  if (!processToClose) return;
  try {
    if (processToClose.stdin.writable) processToClose.stdin.write('quit\n');
  } catch {}
  setTimeout(() => {
    if (!processToClose.killed) processToClose.kill();
  }, 400).unref();
}

function currentPage() {
  return preferences.petScheme === 'nailong' ? 'pet.html' : 'blackhole.html';
}

function preferredSize() {
  return windowSizeFor(preferences, sessionGrowth);
}

function centeredBounds(display = screen.getPrimaryDisplay()) {
  const size = preferredSize();
  const area = display.workArea;
  return {
    x: Math.round(area.x + (area.width - size) / 2),
    y: Math.round(area.y + (area.height - size) / 2),
    width: size,
    height: size,
  };
}

function placementPayload() {
  if (!petWindow || petWindow.isDestroyed()) return undefined;
  const bounds = petWindow.getContentBounds();
  const display = screen.getDisplayMatching(bounds);
  return {
    window: bounds,
    display: {
      x: display.bounds.x,
      y: display.bounds.y,
      width: display.bounds.width,
      height: display.bounds.height,
      scaleFactor: display.scaleFactor,
    },
  };
}

function rendererPayload() {
  return {
    ...rendererPreferences(preferences, sessionGrowth),
    placement: placementPayload(),
  };
}

function preserveCenterResize() {
  if (!petWindow || petWindow.isDestroyed()) return;
  const before = petWindow.getBounds();
  const size = preferredSize();
  if (before.width === size && before.height === size) return;
  petWindow.setBounds({
    x: Math.round(before.x + (before.width - size) / 2),
    y: Math.round(before.y + (before.height - size) / 2),
    width: size,
    height: size,
  });
}

function publishPreferences() {
  preserveCenterResize();
  petWindow?.webContents.send('pet:preferences', rendererPayload());
  settingsWindow?.webContents.send('settings:state', preferences);
  synchronizeHelper();
}

async function takeDesktopSnapshot() {
  if (!petWindow || preferences.petScheme !== 'black-hole') return undefined;
  const display = screen.getDisplayMatching(petWindow.getBounds());
  const scale = display.scaleFactor;
  helperPaused = true;
  synchronizeHelper();
  petWindow.hide();
  try {
    await new Promise((resolve) => setTimeout(resolve, 75));
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: Math.round(display.bounds.width * scale),
        height: Math.round(display.bounds.height * scale),
      },
    });
    const source =
      sources.find((item) => String(item.display_id) === String(display.id)) ||
      sources.find((item) => /screen|entire|整个/i.test(item.name)) ||
      sources[0];
    if (!source || source.thumbnail.isEmpty()) return undefined;
    return {
      image: source.thumbnail.toDataURL(),
      placement: placementPayload(),
    };
  } finally {
    petWindow.showInactive();
    petWindow.moveTop();
    helperPaused = false;
    synchronizeHelper();
  }
}

async function refreshDesktopForRenderer() {
  const snapshot = await takeDesktopSnapshot();
  if (snapshot && petWindow && !petWindow.isDestroyed()) {
    petWindow.webContents.send('pet:desktop', snapshot);
  }
  return snapshot;
}

function createPetWindow() {
  petWindow = new BrowserWindow({
    ...centeredBounds(),
    transparent: true,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });

  petWindow.setContentProtection(!debugCapture);
  petWindow.loadFile(currentPage());

  petWindow.webContents.on('did-finish-load', async () => {
    petWindow.webContents.send('pet:preferences', rendererPayload());
    if (preferences.petScheme === 'black-hole') {
      await refreshDesktopForRenderer();
    }
    petWindow.showInactive();
    petWindow.moveTop();
    synchronizeHelper();
  });

  petWindow.on('show', synchronizeHelper);
  petWindow.on('hide', synchronizeHelper);
  petWindow.on('closed', () => {
    petWindow = undefined;
  });
}

function toggleVisibility() {
  if (!petWindow || petWindow.isDestroyed()) return;
  if (petWindow.isVisible()) petWindow.hide();
  else {
    petWindow.showInactive();
    petWindow.moveTop();
  }
  synchronizeHelper();
}

function centerPet() {
  if (!petWindow || petWindow.isDestroyed()) return;
  petWindow.setBounds(centeredBounds());
  petWindow.showInactive();
  petWindow.moveTop();
  petWindow.webContents.send('pet:placement', placementPayload());
  synchronizeHelper();
}

function switchScheme(requested) {
  const next = requested === 'nailong' ? 'nailong' : 'black-hole';
  if (!petWindow || preferences.petScheme === next) return;
  preferences = normalizePreferences({ ...preferences, petScheme: next });
  storePreferences();
  const old = petWindow.getBounds();
  const size = preferredSize();
  petWindow.hide();
  petWindow.setIgnoreMouseEvents(false);
  petWindow.setBounds({
    x: Math.round(old.x + (old.width - size) / 2),
    y: Math.round(old.y + (old.height - size) / 2),
    width: size,
    height: size,
  });
  petWindow.loadFile(currentPage());
  rebuildTray();
  synchronizeHelper();
}

function iconForTray() {
  const file = path.join(__dirname, 'tray-icon.png');
  if (!fs.existsSync(file)) return nativeImage.createEmpty();
  return nativeImage.createFromPath(file).resize({ width: 18, height: 18 });
}

function rebuildTray() {
  if (!tray) return;
  const blackHole = preferences.petScheme === 'black-hole';
  tray.setToolTip(blackHole ? '黑洞桌宠' : '奶龙桌宠');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '显示 / 隐藏（Ctrl+Alt+B）', click: toggleVisibility },
    { label: '移动到屏幕中央', click: centerPet },
    {
      label: '桌宠方案',
      submenu: [
        {
          label: '黑洞',
          type: 'radio',
          checked: blackHole,
          click: () => switchScheme('black-hole'),
        },
        {
          label: '奶龙',
          type: 'radio',
          checked: !blackHole,
          click: () => switchScheme('nailong'),
        },
      ],
    },
    {
      label: petWindow?.isAlwaysOnTop() ? '取消置顶' : '保持置顶',
      click: () => {
        if (!petWindow) return;
        petWindow.setAlwaysOnTop(!petWindow.isAlwaysOnTop());
        rebuildTray();
      },
    },
    {
      label: '切换黑洞形态',
      enabled: blackHole,
      click: () => petWindow?.webContents.send('pet:command', 'next-view'),
    },
    {
      label: '刷新后景',
      enabled: blackHole,
      click: refreshDesktopForRenderer,
    },
    { label: '设置', click: openSettings },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() },
  ]));
}

function createTray() {
  tray = new Tray(iconForTray());
  tray.on('click', centerPet);
  rebuildTray();
}

function openSettings() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    settingsWindow.focus();
    return;
  }
  settingsWindow = new BrowserWindow({
    width: 440,
    height: 590,
    resizable: false,
    maximizable: false,
    title: '桌宠设置',
    backgroundColor: '#11141a',
    webPreferences: {
      preload: path.join(__dirname, 'settings-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  settingsWindow.setMenuBarVisibility(false);
  settingsWindow.loadFile('settings.html');
  settingsWindow.on('closed', () => {
    settingsWindow = undefined;
  });
}

function rootContains(root, candidate) {
  if (!root) return false;
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function rejectTrashPath(candidate) {
  const resolved = path.resolve(String(candidate || ''));
  if (!resolved || !fs.existsSync(resolved)) return '文件不存在';
  const protectedRoots = [
    process.env.WINDIR,
    process.env.ProgramFiles,
    process.env['ProgramFiles(x86)'],
    app.getAppPath(),
    process.resourcesPath,
  ].filter(Boolean);
  if (protectedRoots.some((root) => rootContains(root, resolved))) return '受保护路径';
  const parsed = path.parse(resolved);
  if (resolved === parsed.root) return '不能回收磁盘根目录';
  return undefined;
}

async function moveFilesToTrash(paths) {
  const candidates = [...new Set(Array.isArray(paths) ? paths : [])].slice(0, 24);
  const results = [];
  let totalBytes = 0;
  for (const candidate of candidates) {
    const problem = rejectTrashPath(candidate);
    if (problem) {
      results.push({ path: candidate, ok: false, error: problem });
      continue;
    }
    try {
      const stat = fs.statSync(candidate);
      totalBytes += stat.isFile() ? stat.size : 0;
      await shell.trashItem(candidate);
      results.push({ path: candidate, ok: true });
    } catch (error) {
      results.push({ path: candidate, ok: false, error: error.message });
    }
  }
  const successful = results.filter((item) => item.ok).length;
  if (successful) {
    const sizeBonus = Math.min(0.018, Math.log10(totalBytes + 10) * 0.002);
    sessionGrowth = Math.min(0.09, sessionGrowth + successful * 0.006 + sizeBonus);
    publishPreferences();
  }
  return results;
}

function clampWindowMove(dx, dy) {
  const current = petWindow.getBounds();
  const desired = {
    x: current.x + Math.round(Number(dx) || 0),
    y: current.y + Math.round(Number(dy) || 0),
    width: current.width,
    height: current.height,
  };
  const center = {
    x: desired.x + desired.width / 2,
    y: desired.y + desired.height / 2,
  };
  const area = screen.getDisplayNearestPoint(center).workArea;
  const margin = 18;
  desired.x = Math.min(
    area.x + area.width - margin,
    Math.max(area.x - desired.width + margin, desired.x),
  );
  desired.y = Math.min(
    area.y + area.height - margin,
    Math.max(area.y - desired.height + margin, desired.y),
  );
  petWindow.setBounds(desired);
  return placementPayload();
}

ipcMain.handle('pet:move', (_event, delta) => {
  if (!petWindow) return undefined;
  const placement = clampWindowMove(delta?.dx, delta?.dy);
  petWindow.webContents.send('pet:placement', placement);
  return placement;
});

ipcMain.on('pet:pass', (_event, passThrough) => {
  if (!petWindow) return;
  if (passThrough) petWindow.setIgnoreMouseEvents(true, { forward: true });
  else petWindow.setIgnoreMouseEvents(false);
});

ipcMain.handle('pet:refresh', refreshDesktopForRenderer);
ipcMain.handle('pet:trash', (_event, paths) => moveFilesToTrash(paths));
ipcMain.handle('pet:placement', () => placementPayload());

ipcMain.handle('settings:read', () => preferences);
ipcMain.handle('settings:defaults', () => ({ ...DEFAULT_PREFERENCES }));
ipcMain.handle('settings:update', (_event, patch) => {
  preferences = normalizePreferences({ ...preferences, ...patch });
  storePreferences();
  publishPreferences();
  return preferences;
});
ipcMain.handle('settings:reset', () => {
  const scheme = preferences.petScheme;
  preferences = normalizePreferences({ ...DEFAULT_PREFERENCES, petScheme: scheme });
  storePreferences();
  publishPreferences();
  return preferences;
});
ipcMain.on('settings:close', () => settingsWindow?.close());

app.whenReady().then(async () => {
  preferences = readPreferences();
  const commandLineScheme = app.commandLine.getSwitchValue('pet-scheme');
  if (['black-hole', 'nailong'].includes(commandLineScheme)) {
    preferences = normalizePreferences({ ...preferences, petScheme: commandLineScheme });
  }

  session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => callback({}));
  createPetWindow();
  createTray();
  launchHelper();
  globalShortcut.register('CommandOrControl+Alt+B', toggleVisibility);
});

app.on('window-all-closed', () => {});
app.on('before-quit', () => {
  globalShortcut.unregisterAll();
  shutdownHelper();
});
