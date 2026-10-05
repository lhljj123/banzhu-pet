const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopPet', {
  getState: () => ipcRenderer.invoke('timer:get-state'),
  pause: () => ipcRenderer.invoke('timer:pause'),
  resume: () => ipcRenderer.invoke('timer:resume'),
  reset: () => ipcRenderer.invoke('timer:reset'),
  hide: () => ipcRenderer.invoke('window:hide'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  onState: (callback) => ipcRenderer.on('timer:state', (_event, state) => callback(state))
});
