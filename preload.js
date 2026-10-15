const { contextBridge, clipboard, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getData: () => ipcRenderer.invoke('get-data'),
  copyText: (text) => {
    clipboard.writeText(text);
    return true;
  }
});
