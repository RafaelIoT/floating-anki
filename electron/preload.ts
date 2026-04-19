import { contextBridge, ipcRenderer } from 'electron';

const idArg = process.argv.find((a) => a.startsWith('--window-id='));
const windowId = idArg ? idArg.slice('--window-id='.length) : '';

contextBridge.exposeInMainWorld('api', {
  self: {
    id: windowId,
    getState: () => ipcRenderer.invoke('self:state', windowId),
    setApkg: (p: string | null) => ipcRenderer.invoke('self:set-apkg', windowId, p),
  },
  apkg: {
    pick: () => ipcRenderer.invoke('apkg:pick') as Promise<string | null>,
    read: (p: string) => ipcRenderer.invoke('apkg:read', p) as Promise<ArrayBuffer>,
  },
  reviews: {
    get: (p: string) => ipcRenderer.invoke('reviews:get', p),
    save: (p: string, reviews: object) => ipcRenderer.invoke('reviews:save', p, reviews),
  },
  window: {
    close: () => ipcRenderer.invoke('window:close'),
    openNew: () => ipcRenderer.invoke('window:new'),
  },
});
