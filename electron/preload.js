const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopPet', {
  getState: () => ipcRenderer.invoke('timer:get-state'),
  pause: () => ipcRenderer.invoke('timer:pause'),
  resume: () => ipcRenderer.invoke('timer:resume'),
  reset: () => ipcRenderer.invoke('timer:reset'),
  hide: () => ipcRenderer.invoke('window:hide'),
  beginDrag: (point) => ipcRenderer.invoke('window:drag-start', point),
  dragTo: (point) => ipcRenderer.send('window:drag-move', point),
  showContextMenu: () => ipcRenderer.invoke('window:context-menu'),
  reportError: (message) => ipcRenderer.send('debug:renderer-error', message),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  onState: (callback) => ipcRenderer.on('timer:state', (_event, state) => callback(state))
  ,onPointer: (callback) => ipcRenderer.on('pointer:state', (_event, point) => callback(point))
});
