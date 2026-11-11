// 렌더러(게임)에 노출하는 최소 API. 웹 빌드에서는 window.native 가 없으므로 게임 코드는 항상 존재 여부를 확인한다.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('native', {
  platform: 'electron',
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
  },
  save: {
    read: (slot) => ipcRenderer.invoke('save:read', slot),
    write: (slot, data) => ipcRenderer.invoke('save:write', slot, data),
  },
  setFullscreen: (on) => ipcRenderer.invoke('win:fullscreen', on),
  isFullscreen: () => ipcRenderer.invoke('win:isFullscreen'),
  quit: () => ipcRenderer.invoke('app:quit'),
});
