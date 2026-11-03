const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('titleBar', {
  onState: (listener) => ipcRenderer.on('bf:titlebar:state', (_event, state) => listener(state)),
  onFocus: (listener) => ipcRenderer.on('bf:titlebar:focus', (_event, focused) => listener(focused)),
  ready: () => ipcRenderer.send('bf:titlebar:ready'),
})