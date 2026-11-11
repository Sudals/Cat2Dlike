// Electron 메인 프로세스
// - 개발: ELECTRON_DEV_URL(vite dev server) 로드
// - 배포: dist/ 를 app:// 커스텀 프로토콜로 서빙 (file:// 보다 안전하고 fetch/XHR 호환)
// - SMOKE_SCREENSHOT=<path> : 로드 후 화면을 캡처해 저장하고 종료 (빌드 검증용)
const { app, BrowserWindow, ipcMain, protocol, net, Menu } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { pathToFileURL } = require('node:url');

const DEV_URL = process.env.ELECTRON_DEV_URL;
const SMOKE_PATH = process.env.SMOKE_SCREENSHOT;
const DIST_DIR = path.join(__dirname, '..', 'dist');
const APP_ORIGIN = 'app://game';
const IS_DEV = !app.isPackaged;

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
]);

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

function registerAppProtocol() {
  protocol.handle('app', (request) => {
    const { pathname } = new URL(request.url);
    const rel = decodeURIComponent(pathname === '/' ? '/index.html' : pathname);
    const filePath = path.normalize(path.join(DIST_DIR, rel));
    if (!filePath.startsWith(DIST_DIR + path.sep)) {
      return new Response('Forbidden', { status: 403 });
    }
    return net.fetch(pathToFileURL(filePath).toString());
  });
}

// ---- 세이브 (userData/saves/<slot>.json) ----
const SLOT_RE = /^[a-z0-9_-]{1,32}$/i;
const saveDir = () => path.join(app.getPath('userData'), 'saves');

ipcMain.handle('save:read', async (_e, slot) => {
  if (!SLOT_RE.test(slot)) throw new Error('invalid slot');
  try {
    return await fs.readFile(path.join(saveDir(), `${slot}.json`), 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
});

ipcMain.handle('save:write', async (_e, slot, data) => {
  if (!SLOT_RE.test(slot) || typeof data !== 'string') throw new Error('invalid save');
  await fs.mkdir(saveDir(), { recursive: true });
  const target = path.join(saveDir(), `${slot}.json`);
  const tmp = `${target}.tmp`;
  await fs.writeFile(tmp, data, 'utf8');
  await fs.rename(tmp, target); // 원자적 교체로 세이브 손상 방지
});

ipcMain.handle('win:fullscreen', (e, on) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  if (win) win.setFullScreen(Boolean(on));
});
ipcMain.handle('win:isFullscreen', (e) => BrowserWindow.fromWebContents(e.sender)?.isFullScreen() ?? false);
ipcMain.handle('app:quit', () => app.quit());

// ---- 윈도우 ----
function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 640,
    minHeight: 360,
    useContentSize: true,
    backgroundColor: '#0d0b14',
    title: '냥생은 한 번뿐',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });

  win.once('ready-to-show', () => win.show());

  const allowedOrigin = DEV_URL ? new URL(DEV_URL).origin : APP_ORIGIN;
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(allowedOrigin)) e.preventDefault();
  });

  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11' || (input.alt && input.key === 'Enter')) {
      win.setFullScreen(!win.isFullScreen());
      e.preventDefault();
    } else if (input.key === 'F12' && IS_DEV) {
      win.webContents.toggleDevTools();
      e.preventDefault();
    }
  });

  if (SMOKE_PATH) attachSmokeTest(win);

  // SMOKE_HASH=viewer 등으로 시작 씬 지정 가능 (기본: 자동 플레이 샌드박스)
  const hash = SMOKE_PATH ? `#${process.env.SMOKE_HASH ?? 'autoplay'}` : '';
  if (DEV_URL) win.loadURL(DEV_URL + '/' + hash);
  else win.loadURL(`${APP_ORIGIN}/index.html${hash}`);
  return win;
}

function attachSmokeTest(win) {
  win.webContents.on('console-message', (e) => {
    if (e.level === 'warning' || e.level === 'error') console.log(`[renderer:${e.level}] ${e.message}`);
  });
  win.webContents.on('render-process-gone', (_e, details) => {
    console.error('[smoke] renderer gone', details);
    app.exit(1);
  });
  win.webContents.once('did-finish-load', () => {
    setTimeout(async () => {
      try {
        const image = await win.webContents.capturePage();
        const out = path.resolve(SMOKE_PATH);
        await fs.mkdir(path.dirname(out), { recursive: true });
        await fs.writeFile(out, image.toPNG());
        console.log(`[smoke] screenshot saved: ${out}`);
        app.exit(0);
      } catch (err) {
        console.error('[smoke] capture failed', err);
        app.exit(1);
      }
    }, Number(process.env.SMOKE_DELAY_MS ?? 3500));
  });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  if (!DEV_URL) registerAppProtocol();
  createWindow();
});

app.on('second-instance', () => {
  const [win] = BrowserWindow.getAllWindows();
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.on('window-all-closed', () => app.quit());
