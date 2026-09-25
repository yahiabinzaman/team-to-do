const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  setWidgetSize: (sizeKey) => ipcRenderer.send('set-widget-size', sizeKey)
});
