const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');

// This is a placeholder for the Electron main process
// It demonstrates how to handle IPC calls that were previously handled by Express
function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      autoHideMenuBar: true,
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  // Automatically detect environment
  const isDev = process.env.VITE_DEV_URL || process.env.NODE_ENV === 'development';

  if (isDev) {
    win.loadURL(process.env.VITE_DEV_URL || 'http://localhost:3000');
  } else {
    // Correctly load the built file in the ASAR package
    win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// --- IPC Handlers (The Bridge) ---

// Handle external links
ipcMain.handle('open-external-url', async (event, { url }) => {
  if (url) await shell.openExternal(url);
});

// Example: Abstracting Git Sync
ipcMain.handle('/api/workspace/:path/git/sync', async (event, params) => {
  // Logic from server.ts would be ported here
  // const git = new GitManager(params.path);
  // return await git.sync(...);
  return { success: true, message: "Handled by Electron IPC" };
});

// Add more handlers for files, settings, etc.
