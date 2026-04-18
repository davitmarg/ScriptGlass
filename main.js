import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import 'dotenv/config';

// Suppress punycode deprecation warning
const originalEmitWarning = process.emitWarning;
process.emitWarning = (warning, ...args) => {
  if (typeof warning === 'string' && (warning.includes('punycode') || warning.includes('DeprecationWarning'))) return;
  return originalEmitWarning(warning, ...args);
};

// Handle unhandled rejections and exceptions to avoid "Node Exception" popups
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { exec } from 'child_process';
import axios from 'axios';
import http from 'http';
import { 
  SettingsManager, 
  FileSystemProvider, 
  GitManager, 
  decodePath, 
  browseFolders 
} from './src/lib/services.server.ts';

const _filename = typeof __filename !== 'undefined' ? __filename : fileURLToPath(import.meta.url);
const _dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(_filename);

const CONFIG_FILE = path.join(app.getPath('userData'), 'config.json');
const settings = new SettingsManager(CONFIG_FILE);
const fsProvider = new FileSystemProvider();

async function createWindow() {
  await settings.load();

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false, // Frameless window
    titleBarStyle: 'hidden', // Native controls hidden
    webPreferences: {
      autoHideMenuBar: true,
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(_dirname, 'preload.cjs'),
    },
  });

  const isDev = process.env.VITE_DEV_URL || process.env.NODE_ENV === 'development';

  if (isDev) {
    win.loadURL(process.env.VITE_DEV_URL || 'http://localhost:3000');
  } else {
    // When bundled into dist/main.js, index.html is in the same folder
    win.loadFile(path.join(_dirname, 'index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// --- IPC Utilities ---
const getEncodedPathFromUrl = (url) => {
  const parts = url.split('/workspace/');
  if (parts.length < 2) return null;
  return parts[1].split('/')[0];
};

const getFilenameFromUrl = (url) => {
  const parts = url.split('/files/');
  if (parts.length < 2) return null;
  return parts[1];
};

const getQueryParam = (url, param) => {
  try {
    const u = new URL(url, 'http://localhost');
    return u.searchParams.get(param);
  } catch (e) {
    return null;
  }
};

// --- IPC Handlers ---

// Window Controls
ipcMain.on('window-minimize', () => {
  BrowserWindow.getFocusedWindow()?.minimize();
});
ipcMain.on('window-maximize', () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win?.isMaximized()) {
    win.unmaximize();
  } else {
    win?.maximize();
  }
});
ipcMain.on('window-close', () => {
  BrowserWindow.getFocusedWindow()?.close();
});

ipcMain.handle('open-external-url', async (event, { url }) => {
  if (url) await shell.openExternal(url);
});

ipcMain.handle('/api/settings', async (event, params) => {
  if (params && params.method === 'POST') {
    const { baseProjectsDir, githubToken, geminiKey } = params;
    if (baseProjectsDir) settings.baseDir = baseProjectsDir;
    if (githubToken !== undefined) settings.githubToken = githubToken;
    if (geminiKey !== undefined) settings.geminiKey = geminiKey;
    await settings.save();
    return { success: true };
  }
  return settings.getConfig();
});

ipcMain.handle('/api/workspace/open', async (event, { folderPath, type, url }) => {
  try {
    if (type === 'clone' && url) {
      const { simpleGit } = await import('simple-git');
      let authenticatedUrl = url;
      if (settings.githubToken && url.includes('github.com')) {
        const u = new URL(url);
        u.username = 'x-access-token';
        u.password = settings.githubToken;
        authenticatedUrl = u.toString();
      }
      await simpleGit().clone(authenticatedUrl, folderPath);
    } else {
      await fs.mkdir(folderPath, { recursive: true });
    }
    const git = new GitManager(folderPath);
    await git.initRepo();
    return { path: folderPath };
  } catch (e) {
    return { error: String(e) };
  }
});

ipcMain.handle('/api/browse', async (event, params) => {
  try {
    const pathParam = getQueryParam(params.endpoint, 'path');
    return await browseFolders(pathParam, settings.baseDir);
  } catch (e) {
    return { error: String(e) };
  }
});

ipcMain.handle('/api/workspace/files', async (event, params) => {
  try {
    const encodedPath = getEncodedPathFromUrl(params.endpoint);
    const filename = getFilenameFromUrl(params.endpoint);
    const absPath = decodePath(encodedPath);

    if (filename) {
      if (params.method === 'DELETE') {
        await fsProvider.deleteFile(absPath, filename);
        return { success: true };
      }
      if (params.method === 'POST') {
        await fsProvider.writeFile(absPath, filename, params.content);
        return { success: true };
      }
      const data = await fsProvider.readFile(absPath, filename);
      return { content: data };
    }

    return await fsProvider.listFiles(absPath);
  } catch (e) {
    return { error: String(e) };
  }
});

ipcMain.handle('/api/workspace/git', async (event, params) => {
  try {
    const encodedPath = getEncodedPathFromUrl(params.endpoint);
    const absPath = decodePath(encodedPath);
    const git = new GitManager(absPath);

    if (params.endpoint.includes('/status')) {
      const status = await git.getStatus();
      const branch = await git.getBranch();
      return { status, branch };
    }

    if (params.endpoint.includes('/log')) {
      return await git.getLog();
    }

    if (params.endpoint.includes('/sync')) {
      await git.initRepo();
      await git.commit(params.commitMessage || `Sync ${new Date().toISOString()}`, params.token);
      return await git.push(params.token, path.basename(absPath));
    }

    if (params.endpoint.includes('/pull')) {
      const repoName = path.basename(absPath.replace(/[/\\]$/, ""));
      return await git.pull(params.token, repoName);
    }

    return { error: "Unknown Git action" };
  } catch (e) {
    return { error: String(e) };
  }
});

ipcMain.handle('/api/terminal/exec', async (event, { command, activePath }) => {
  const cwd = activePath || settings.baseDir;
  return new Promise((resolve) => {
    exec(command, { cwd }, (error, stdout, stderr) => {
      resolve({ stdout, stderr, error: error ? error.message : null });
    });
  });
});

// GitHub Auth with System Browser
let oauthServer = null;
const OAUTH_PORT = 4567;
const OAUTH_HOST = '127.0.0.1'; // Use explicit IPv4 to avoid localhost resolution issues

ipcMain.handle('/api/auth/github/url', async () => {
  const client_id = process.env.GITHUB_CLIENT_ID || 'Iv23liev9mUnatZ8W9S3';
  const redirect_uri = `http://${OAUTH_HOST}:${OAUTH_PORT}/callback`;
  
  if (!process.env.GITHUB_CLIENT_ID) {
    console.warn('Warning: GITHUB_CLIENT_ID is not set in environment or .env file.');
  }

  return { 
    url: `https://github.com/login/oauth/authorize?client_id=${client_id}&redirect_uri=${encodeURIComponent(redirect_uri)}&scope=repo,user`,
    isElectron: true
  };
});

ipcMain.on('github-oauth-start', (event, url) => {
  if (oauthServer) {
    oauthServer.close();
    oauthServer = null;
  }

  oauthServer = http.createServer(async (req, res) => {
    const urlObj = new URL(req.url, `http://${OAUTH_HOST}:${OAUTH_PORT}`);
    
    if (urlObj.pathname === '/callback') {
      const code = urlObj.searchParams.get('code');
      const client_id = process.env.GITHUB_CLIENT_ID || 'Iv23liev9mUnatZ8W9S3';
      const client_secret = process.env.GITHUB_CLIENT_SECRET;

      console.log(`OAuth Callback received. Exchanging code for token...`);
      
      try {
        if (!client_secret) {
          throw new Error('GITHUB_CLIENT_SECRET is not set. Token exchange cannot proceed.');
        }

        const response = await axios.post('https://github.com/login/oauth/access_token', {
          client_id,
          client_secret,
          code,
        }, { headers: { Accept: 'application/json' } });

        const { access_token, error, error_description } = response.data;
        
        if (error) {
          console.error(`GitHub OAuth Error: ${error} - ${error_description}`);
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`<h1>Authentication Failed</h1><p>${error_description || error}</p>`);
          return;
        }

        if (access_token) {
          event.sender.send('github-oauth-token', access_token);
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                <h1 style="color: #2ea44f;">Success!</h1>
                <p>Authentication complete. You can close this tab and return to ScriptGlass.</p>
                <script>window.close();</script>
              </body>
            </html>
          `);
        } else {
          throw new Error('No access token received from GitHub');
        }
      } catch (err) {
        console.error('Code exchange failed:', err);
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end(`<h1>Server Error</h1><p>${err instanceof Error ? err.message : 'Unknown error during authentication'}</p>`);
      } finally {
        if (oauthServer) {
          oauthServer.close();
          oauthServer = null;
        }
      }
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });

  oauthServer.listen(OAUTH_PORT, OAUTH_HOST, () => {
    console.log(`Local OAuth server listening on http://${OAUTH_HOST}:${OAUTH_PORT}`);
    shell.openExternal(url);
  });
});
