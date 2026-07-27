'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petSettings', {
  read: () => ipcRenderer.invoke('settings:read'),
  defaults: () => ipcRenderer.invoke('settings:defaults'),
  update: (patch) => ipcRenderer.invoke('settings:update', patch),
  reset: () => ipcRenderer.invoke('settings:reset'),
  close: () => ipcRenderer.send('settings:close'),
  onState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('settings:state', listener);
    return () => ipcRenderer.removeListener('settings:state', listener);
  },
});
