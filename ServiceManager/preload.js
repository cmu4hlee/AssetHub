const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  startBackend: () => ipcRenderer.invoke('start-backend'),
  startFrontend: () => ipcRenderer.invoke('start-frontend'),
  stopBackend: () => ipcRenderer.invoke('stop-backend'),
  stopFrontend: () => ipcRenderer.invoke('stop-frontend'),
  getStatus: () => ipcRenderer.invoke('get-status'),
  checkPort: (port) => ipcRenderer.invoke('check-port', port),
  readConfig: () => ipcRenderer.invoke('read-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  onStatusUpdate: (callback) => {
    ipcRenderer.on('status-update', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('status-update');
  },
  onError: (callback) => {
    ipcRenderer.on('error', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('error');
  },
  onBackendStarted: (callback) => {
    ipcRenderer.on('backend-started', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('backend-started');
  },
  onFrontendStarted: (callback) => {
    ipcRenderer.on('frontend-started', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('frontend-started');
  },
  onBackendStopped: (callback) => {
    ipcRenderer.on('backend-stopped', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('backend-stopped');
  },
  onFrontendStopped: (callback) => {
    ipcRenderer.on('frontend-stopped', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('frontend-stopped');
  },
  onAutoRestartFailed: (callback) => {
    ipcRenderer.on('auto-restart-failed', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('auto-restart-failed');
  },
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});
