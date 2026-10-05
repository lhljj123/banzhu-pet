const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('breakControl', {
  getState: () => ipcRenderer.invoke('break:get-state'),
  finish: () => ipcRenderer.invoke('break:finish'),
  onState: callback => ipcRenderer.on('break:state', (_event, state) => callback(state))
});
