// Gives the pages three narrow helpers: download a file from a link for the import cards (www/netload.js),
// and post to the registration server for sign-up and login (www/auth-api.js).
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bfNet', {
  fetchUrl: (url) => ipcRenderer.invoke('bf-fetch-url', String(url)),
  post: (url, body) => ipcRenderer.invoke('bf-post', String(url), String(body))
});
// Report and Furnace 3D view: save the page as a PDF file
contextBridge.exposeInMainWorld('bfReport', {
  savePdf: (name) => ipcRenderer.invoke('bf-save-pdf', String(name))
});
