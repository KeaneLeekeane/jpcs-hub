// Lets the portal know it is running inside the desktop app (hides "Install app").
const { contextBridge } = require('electron');
contextBridge.exposeInMainWorld('jpcsDesktop', { isDesktopApp: true });
