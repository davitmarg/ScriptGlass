import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { exec } from 'child_process';
import axios from 'axios';
import { 
  SettingsManager, 
  FileSystemProvider, 
  GitManager, 
  decodePath, 
  browseFolders 
} from './src/lib/services.server.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_FILE = path.join(app.getPath('userData'), 'config.json');
const settings = new SettingsManager(CONFIG_FILE);
const fsProvider = new FileSystemProvider();

async function createWindow() {
  await settings.load();

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

  const isDev = process.env.VITE_DEV_URL || process.env.NODE_ENV === 'development';

  if (isDev) {
    win.loadURL(process.env.VITE_DEV_URL || 'http://localhost:3000');
  } else {
    win.loadFile(path.join(__dirname, 'dist', 'index.html'));
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

// --- IPC Handlers ---

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
    return await browseFolders(params?.path, settings.baseDir);
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

    if (params.endpoint.endsWith('/status')) {
      const status = await git.getStatus();
      const branch = await git.getBranch();
      return { status, branch };
    }

    if (params.endpoint.endsWith('/log')) {
      return await git.getLog();
    }

    if (params.endpoint.endsWith('/sync')) {
      await git.initRepo();
      await git.commit(params.commitMessage || `Sync ${new Date().toISOString()}`, params.token);
      return await git.push(params.token, path.basename(absPath));
    }

    if (params.endpoint.endsWith('/pull')) {
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

ipcMain.handle('/api/auth/github/url', async () => {
  const client_id = process.env.GITHUB_CLIENT_ID;
  const redirect_uri = `https://github.com/login/oauth/callback`;
  return { 
    url: `https://github.com/login/oauth/authorize?client_id=${client_id}&redirect_uri=${encodeURIComponent(redirect_uri)}&scope=repo,user`,
    isElectron: true
  };
});

ipcMain.on('github-oauth-start', (event, url) => {
  const authWin = new BrowserWindow({
    width: 600,
    height: 800,
    show: true,
  });

  authWin.loadURL(url);

  const handleRedirect = async (newUrl) => {
    if (newUrl.includes('code=')) {
      const code = new URL(newUrl).searchParams.get('code');
      authWin.close();

      try {
        const response = await axios.post('https://github.com/login/oauth/access_token', {
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code,
        }, { headers: { Accept: 'application/json' } });

        const { access_token } = response.data;
        if (access_token) {
          event.sender.send('github-oauth-token', access_token);
        }
      } catch (err) {
        console.error('OAuth token exchange failed', err);
      }
    }
  };

  authWin.webContents.on('will-navigate', (e, url) => handleRedirect(url));
  authWin.webContents.on('will-redirect', (e, url) => handleRedirect(url));
});
