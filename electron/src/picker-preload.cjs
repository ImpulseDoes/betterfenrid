const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('picker', {
  sources: () => ipcRenderer.invoke('bf:picker:sources'),
  choose: (id, audio) => ipcRenderer.send('bf:picker:choose', { id, audio }),
  cancel: () => ipcRenderer.send('bf:picker:choose', null),
})