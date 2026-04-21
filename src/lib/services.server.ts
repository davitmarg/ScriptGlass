import axios from "axios";
import path from "path";
import fs from "fs/promises";
import os from "os";
import { exec } from "child_process";
import { simpleGit } from "simple-git";
import type { SimpleGit } from "simple-git";
import { fileURLToPath } from "url";

const _filename = typeof __filename !== 'undefined' ? __filename : fileURLToPath(import.meta.url);
const _dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(_filename);

// In Electron, we want to store config in the user data directory
// But for now, we'll keep it simple or allow the caller to specify
const DEFAULT_STORAGE_DIR = path.join(os.homedir(), "Documents", "ScriptGlass");

export class SettingsManager {
  private configPath: string;
  private config: { 
    baseProjectsDir: string; 
    githubToken?: string; 
    geminiKey?: string;
    theme?: string;
  } = { baseProjectsDir: DEFAULT_STORAGE_DIR, theme: 'system' };

  constructor(configPath: string) {
    this.configPath = configPath;
  }

  async load() {
    try {
      const data = await fs.readFile(this.configPath, "utf-8");
      this.config = { ...this.config, ...JSON.parse(data) };
    } catch {
      await this.save();
    }
  }

  async save() {
    const dir = path.dirname(this.configPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
  }

  get baseDir() { return this.config.baseProjectsDir; }
  set baseDir(val: string) { this.config.baseProjectsDir = val; }
  get githubToken() { return this.config.githubToken; }
  set githubToken(val: string | undefined) { this.config.githubToken = val; }
  get geminiKey() { return this.config.geminiKey; }
  set geminiKey(val: string | undefined) { this.config.geminiKey = val; }
  get theme() { return this.config.theme; }
  set theme(val: string | undefined) { this.config.theme = val; }
  
  getConfig() {
    return { 
      baseProjectsDir: this.baseDir,
      githubToken: this.githubToken,
      geminiKey: this.geminiKey,
      theme: this.theme
    };
  }
}

export class FileSystemProvider {
  async listFiles(absPath: string) {
    const files = await fs.readdir(absPath);
    return files.filter(f => (f.endsWith(".fountain") || f.endsWith(".txt")) && !f.startsWith("."));
  }

  async readFile(absPath: string, filename: string) {
    const filePath = path.join(absPath, filename);
    return await fs.readFile(filePath, "utf-8");
  }

  async writeFile(absPath: string, filename: string, content: string) {
    await fs.mkdir(absPath, { recursive: true });
    const filePath = path.join(absPath, filename);
    await fs.writeFile(filePath, content, "utf-8");
  }

  async deleteFile(absPath: string, filename: string) {
    const filePath = path.join(absPath, filename);
    await fs.unlink(filePath);
  }
}

export class GitManager {
  private git: SimpleGit;
  private absPath: string;

  constructor(absPath: string) {
    this.absPath = absPath;
    this.git = simpleGit(this.absPath);
  }

  async getGitHubUser(token: string): Promise<{ login: string; name: string; email: string } | null> {
    try {
      const response = await axios.get("https://api.github.com/user", {
        headers: { 
          Authorization: `token ${token}`,
          "User-Agent": "ScriptGlass-App"
        }
      });
      const { login, name, email } = response.data;
      return { 
        login, 
        name: name || login, 
        email: email || `${login}@users.noreply.github.com` 
      };
    } catch (error) {
      console.error("GitHub User Fetch Error:", error);
      return null;
    }
  }

  async getGitHubUsername(token: string): Promise<string | null> {
    const user = await this.getGitHubUser(token);
    return user ? user.login : null;
  }

  async createGitHubRepo(token: string, repoName: string, isOrg: boolean = false, orgName: string | null = null) {
    try {
      const name = repoName.includes('/') ? repoName.split('/')[1] : repoName;
      const url = isOrg && orgName ? `https://api.github.com/orgs/${orgName}/repos` : "https://api.github.com/user/repos";
      
      console.log(`Attempting to create GitHub repository: ${name} at ${url}`);
      
      await axios.post(url, {
        name: name,
        private: true,
        auto_init: false
      }, {
        headers: { 
          Authorization: `token ${token}`,
          "User-Agent": "ScriptGlass-App",
          "Accept": "application/vnd.github.v3+json"
        }
      });
      console.log(`Successfully created repository: ${name}`);
      return true;
    } catch (error: any) {
      console.error("GitHub Repo Creation Error:", error.response?.data || error.message);
      return false;
    }
  }

  async initRepo() {
    try {
      await fs.access(path.join(this.absPath, ".git"));
    } catch {
      await this.git.init();
    }
  }

  async getStatus() { return await this.git.status(); }
  async getLog() { return await this.git.log(); }
  async getBranch() { 
    const summary = await this.git.branch(); 
    return summary.current;
  }

  async commit(message: string, token: string) {
    // Ensure user identity is set
    try {
      const config = await this.git.listConfig();
      if (!config.all['user.name'] || !config.all['user.email'] || config.all['user.email'].includes('root@localhost')) {
        const user = await this.getGitHubUser(token);
        if (user) {
          await this.git.addConfig('user.name', user.name);
          await this.git.addConfig('user.email', user.email);
        }
      }
    } catch (e) {
      console.error("Failed to set git config:", e);
    }

    await this.git.add(".");
    await this.git.commit(message);
  }

  async push(token: string, repoName: string) {
    let fullRepoPath = repoName;
    
    // If repoName is just 'metro' instead of 'user/metro', try to prefix with username
    if (!repoName.includes('/')) {
      const username = await this.getGitHubUsername(token);
      if (username) {
        fullRepoPath = `${username}/${repoName}`;
      }
    }

    const remote = `https://x-access-token:${token}@github.com/${fullRepoPath}.git`;
    try {
      await this.git.addRemote("origin", remote);
    } catch (e) {}

    // Try to determine current branch
    const status = await this.git.status();
    const branch = status.current || 'main';

    try {
      await this.git.push("origin", branch, ["--set-upstream"]);
      return { success: true };
    } catch (error: any) {
      if (error.message.includes("not found")) {
        console.log(`Repository not found. Attempting to create it...`);
        
        let repoOnlyName = repoName;
        let isOrg = false;
        let orgName: string | null = null;
        
        if (repoName.includes('/')) {
          const parts = repoName.split('/');
          const username = await this.getGitHubUsername(token);
          if (parts[0] !== username) {
            isOrg = true;
            orgName = parts[0];
          }
          repoOnlyName = parts[1];
        }

        const created = await this.createGitHubRepo(token, repoOnlyName, isOrg, orgName);
        if (created) {
          // Retry push
          await this.git.push("origin", branch, ["--set-upstream"]);
          return { success: true };
        }
        
        throw new Error(`Repository "${fullRepoPath}" not found on GitHub and automatic creation failed. Please make sure the repository exists in your GitHub account or you have permissions to create it.`);
      }
      if (error.message.includes("does not match any")) {
        // Fallback or handle initial push
        await this.git.push("origin", branch);
        return { success: true };
      }
      throw error;
    }
  }

  async pull(token: string, repoName: string) {
    let fullRepoPath = repoName;
    if (!repoName.includes('/')) {
      const username = await this.getGitHubUsername(token);
      if (username) {
        fullRepoPath = `${username}/${repoName}`;
      }
    }
    
    const remote = `https://x-access-token:${token}@github.com/${fullRepoPath}.git`;
    try {
      await this.git.addRemote("origin", remote);
    } catch (e) {
      await this.git.remote(["set-url", "origin", remote]);
    }

    await this.git.fetch("origin");
    
    // Logic for branch discovery
    const remotes = await this.git.branch(['-r']);
    let targetBranch = 'origin/main';
    let targetBranchShort = 'main';
    
    if (!remotes.all.includes('origin/main')) {
      if (remotes.all.includes('origin/master')) {
        targetBranch = 'origin/master';
        targetBranchShort = 'master';
      } else {
        const firstRemote = remotes.all.find(b => b.startsWith('origin/'));
        if (firstRemote) {
          targetBranch = firstRemote;
          targetBranchShort = firstRemote.replace('origin/', '');
        }
      }
    }

    const status = await this.git.status();
    const localBranch = status.current;

    // Merge conflict backup logic
    try {
      const targetRemoteBranch = targetBranch;
      
      // Check if HEAD points to a valid commit
      let hasHead = true;
      try {
        await this.git.revparse(['HEAD']);
      } catch (e) {
        hasHead = false;
      }

      if (hasHead) {
        const mergeBase = await this.git.revparse(['--merge-base', 'HEAD', targetRemoteBranch]).catch(() => '');
        
        if (mergeBase) {
          const diff = await this.git.diff(['--name-only', mergeBase, targetRemoteBranch]);
          const remoteChanges = diff.split('\n').filter(f => f.trim());
          
          const localStatus = await this.git.status();
          const localChanges = [
            ...localStatus.modified,
            ...localStatus.not_added,
            ...localStatus.created,
            ...localStatus.deleted,
            ...localStatus.renamed.map(r => r.to)
          ];
          const localChangesSet = new Set(localChanges);

          const conflicts = remoteChanges.filter(f => localChangesSet.has(f));

          if (conflicts.length > 0) {
            const timestamp = new Date().toISOString().split('T')[0];
            for (const file of conflicts) {
              const filePath = path.join(this.absPath, file);
              try {
                await fs.access(filePath);
                const ext = path.extname(file);
                const base = path.basename(file, ext);
                const backupName = `${base}_Backup_${timestamp}${ext}`;
                await fs.rename(filePath, path.join(this.absPath, backupName));
              } catch (e) {}
            }
          }
        }
      }
    } catch (e) {
      console.error("Conflict detection failed:", e);
    }

    if (localBranch !== targetBranchShort) {
      await this.git.checkout(["-B", targetBranchShort, targetBranch]);
    } else {
      await this.git.reset(["--hard", targetBranch]);
    }

    return { success: true };
  }
}

export const decodePath = (encoded: string) => Buffer.from(encoded, "base64").toString("utf-8");

export async function browseFolders(targetPath: string | null, baseDir: string) {
  const isWindows = os.platform() === 'win32';
  
  // Normalize Windows paths and handle ROOT
  let startPath = targetPath;
  if (startPath && isWindows && startPath !== 'ROOT') {
    startPath = path.normalize(startPath);
  }
  
  if (!startPath || startPath === '' || startPath === 'ROOT') {
    const defaultStart = baseDir || os.homedir();
    if (isWindows && (!targetPath || targetPath === 'ROOT')) {
      const drives = await new Promise<string[]>((resolve) => {
        exec('powershell -Command "Get-PSDrive -PSProvider FileSystem | Select-Object -ExpandProperty Root"', (error, stdout) => {
          if (error) {
            exec('wmic logicaldisk get name', (error2, stdout2) => {
              if (error2) {
                resolve(['C:\\']);
                return;
              }
              const list = stdout2.split(/\r?\n/)
                .filter(value => /[A-Za-z]:/.test(value))
                .map(value => value.trim() + path.sep);
              resolve(list.length > 0 ? list : ['C:\\']);
            });
            return;
          }
          const list = stdout.split(/\r?\n/)
            .map(v => v.trim())
            .filter(v => v !== '' && !v.toLowerCase().includes('root'))
            .map(v => v.endsWith(path.sep) ? v : v + path.sep);
          resolve(list.length > 0 ? list : ['C:\\']);
        });
      });
      return {
        currentPath: 'ROOT',
        parentPath: 'ROOT',
        directories: drives,
        sep: path.sep,
        isRoot: true
      };
    } else {
      startPath = isWindows ? defaultStart : (targetPath === 'ROOT' ? '/' : defaultStart);
    }
  }

  try {
    const absoluteStartPath = path.resolve(startPath);
    let items;
    try {
       items = await fs.readdir(absoluteStartPath, { withFileTypes: true });
    } catch (e) {
       // If we can't read this directory, go to ROOT on Windows or just throw
       // Only recurse IF we are NOT already trying to browse ROOT
       if (isWindows && targetPath !== 'ROOT' && startPath !== 'ROOT') {
          return await browseFolders('ROOT', baseDir);
       }
       // If readdir failed, return empty directories instead of throwing
       // which causes the 500/Failed to browse error
       return {
         currentPath: absoluteStartPath,
         parentPath: (isWindows && /^[A-Z]:\\?$/i.test(absoluteStartPath)) ? 'ROOT' : path.dirname(absoluteStartPath),
         directories: [],
         sep: path.sep,
         isRoot: isWindows && /^[A-Z]:\\?$/i.test(absoluteStartPath)
       };
    }

    const directories = items
      .filter(item => item.isDirectory() && !item.name.startsWith('.'))
      .map(item => item.name)
      .sort();
    
    const parentPath = path.dirname(absoluteStartPath);
    const isAtDriveRoot = isWindows && /^[A-Z]:\\?$/i.test(absoluteStartPath);
    const isAtSystemRoot = !isWindows && absoluteStartPath === '/';
    
    return {
      currentPath: absoluteStartPath,
      parentPath: (isAtDriveRoot || isAtSystemRoot) ? 'ROOT' : parentPath,
      directories,
      sep: path.sep,
      isRoot: isAtSystemRoot || isAtDriveRoot
    };
  } catch (error) {
    throw error;
  }
}
