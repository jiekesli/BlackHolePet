'use strict';

const { contextBridge, ipcRenderer, webUtils } = require('electron');

function listen(channel, callback) {
  const wrapped = (_event, value) => callback(value);
  ipcRenderer.on(channel, wrapped);
  return () => ipcRenderer.removeListener(channel, wrapped);
}

contextBridge.exposeInMainWorld('desktopPet', {
  onPreferences: (callback) => listen('pet:preferences', callback),
  onDesktop: (callback) => listen('pet:desktop', callback),
  onPlacement: (callback) => listen('pet:placement', callback),
  onCommand: (callback) => listen('pet:command', callback),
  moveBy: (dx, dy) => ipcRenderer.invoke('pet:move', { dx, dy }),
  passPointerThrough: (enabled) => ipcRenderer.send('pet:pass', Boolean(enabled)),
  refreshDesktop: () => ipcRenderer.invoke('pet:refresh'),
  placement: () => ipcRenderer.invoke('pet:placement'),
  trash: (paths) => ipcRenderer.invoke('pet:trash', paths),
  filePath: (file) => webUtils.getPathForFile(file),
});
