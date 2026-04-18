import "dotenv/config";
import express from "express";
import axios from "axios";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs/promises";
import os from "os";
import { exec } from "child_process";
import { simpleGit } from "simple-git";
import type { SimpleGit } from "simple-git";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_FILE = path.join(__dirname, "config.json");
const DEFAULT_STORAGE_DIR = path.join(os.homedir(), "Documents", "ScriptGlass");

// --- Services ---

class SettingsManager {
  private config: { baseProjectsDir: string; githubToken?: string; geminiKey?: string } = { baseProjectsDir: DEFAULT_STORAGE_DIR };

  async load() {
    try {
      const data = await fs.readFile(CONFIG_FILE, "utf-8");
      this.config = JSON.parse(data);
    } catch {
      await this.save();
    }
  }

  async save() {
    await fs.writeFile(CONFIG_FILE, JSON.stringify(this.config, null, 2));
  }

  get baseDir() {
    return this.config.baseProjectsDir;
  }

  set baseDir(val: string) {
    this.config.baseProjectsDir = val;
  }

  get githubToken() {
    return this.config.githubToken;
  }

  set githubToken(val: string | undefined) {
    this.config.githubToken = val;
  }

  get geminiKey() {
    return this.config.geminiKey;
  }

  set geminiKey(val: string | undefined) {
    this.config.geminiKey = val;
  }
}

const settings = new SettingsManager();

const decodePath = (encoded: string) => Buffer.from(encoded, "base64").toString("utf-8");

class FileSystemProvider {
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

class GitManager {
  private git: SimpleGit;
  private absPath: string;

  constructor(absPath: string) {
    this.absPath = absPath;
    this.git = simpleGit(this.absPath);
  }

  async initRepo() {
    try {
      await fs.access(path.join(this.absPath, ".git"));
    } catch {
      await this.git.init();
      await this.git.addConfig("user.name", "ScriptGlass User");
      await this.git.addConfig("user.email", "user@scriptglass.app");
    }
  }

  async ensureIdentity(token?: string) {
    try {
      const config = await this.git.listConfig();
      if (config.all["user.name"] && config.all["user.email"]) {
        return;
      }

      let name = "ScriptGlass User";
      let email = "user@scriptglass.app";

      if (token) {
        try {
          const userRes = await axios.get("https://api.github.com/user", {
            headers: { 
              Authorization: `token ${token}`,
              "User-Agent": "ScriptGlass-App"
            },
          });
          if (userRes.data.name) name = userRes.data.name;
          if (userRes.data.email) email = userRes.data.email;
          else if (userRes.data.login) email = `${userRes.data.login}@users.noreply.github.com`;
        } catch (e) {
          console.error("Failed to fetch user identity from GitHub, using defaults");
        }
      }

      await this.git.addConfig("user.name", name);
      await this.git.addConfig("user.email", email);
    } catch (error) {
      console.error("Error ensuring git identity:", error);
    }
  }

  async commit(message: string, token?: string) {
    await this.ensureIdentity(token);
    await this.git.add(".");
    const status = await this.git.status();
    if (status.staged.length > 0) {
      await this.git.commit(message);
    }
  }

  async getLog() {
    try {
      return await this.git.log();
    } catch {
      return { all: [] };
    }
  }

  async getStatus() {
    return await this.git.status();
  }

  async getBranch() {
    try {
      const branch = await this.git.branch();
      return branch.current || null;
    } catch {
      return null;
    }
  }

  async push(token: string, repoName: string) {
    try {
      // Slugify repo name for GitHub
      const slugifiedRepoName = repoName.toLowerCase().replace(/[^a-z0-9-_]/g, "-");

      const username = await this.getGitHubUsername(token);

      // 2. Ensure repository exists on GitHub
      await this.ensureRepoExists(token, username, slugifiedRepoName, repoName);

      // 3. Configure remote and push
      // Using oauth2 as username is the standard for OAuth tokens
      const remoteUrl = `https://oauth2:${token}@github.com/${username}/${slugifiedRepoName}.git`;
      
      const remotes = await this.git.getRemotes();
      if (remotes.find(r => r.name === "origin")) {
        await this.git.remote(["set-url", "origin", remoteUrl]);
      } else {
        await this.git.addRemote("origin", remoteUrl);
      }

      const branch = await this.getBranch();
      // Ensure we have at least one commit
      const log = await this.getLog();
      if (log.all.length === 0) {
        throw new Error("No commits to push. Please save/sync your changes first.");
      }

      await this.git.push("origin", branch, ["--force"]);
      return { success: true, repoUrl: `https://github.com/${username}/${slugifiedRepoName}` };
    } catch (error: any) {
      if (error.response) {
        console.error("GitHub API Error Response:", error.response.data);
      }
      console.error("Git Push Error:", error);
      throw error;
    }
  }

  private async getGitHubUsername(token: string): Promise<string> {
    try {
      const userRes = await axios.get("https://api.github.com/user", {
        headers: { 
          Authorization: `token ${token}`,
          "User-Agent": "ScriptGlass-App",
          Accept: "application/vnd.github+json"
        },
      });
      return userRes.data.login;
    } catch (error: any) {
      console.error("Failed to get user info:", error.response?.data || error.message);
      if (error.response?.data?.message === "Resource not accessible by integration") {
        throw new Error("GitHub App permissions issue: Please ensure your GitHub App has 'User' permissions enabled (Read-only is enough for username).");
      }
      throw error;
    }
  }

  private async ensureRepoExists(token: string, username: string, slugifiedRepoName: string, repoName: string) {
    try {
      await axios.get(`https://api.github.com/repos/${username}/${slugifiedRepoName}`, {
        headers: { 
          Authorization: `token ${token}`,
          "User-Agent": "ScriptGlass-App",
          Accept: "application/vnd.github+json"
        },
      });
    } catch (error: any) {
      if (error.response?.status === 404) {
        // Create repo if it doesn't exist
        try {
          await axios.post(
            "https://api.github.com/user/repos",
            {
              name: slugifiedRepoName,
              description: `ScriptGlass Project: ${repoName}`,
              private: true,
            },
            {
              headers: { 
                Authorization: `token ${token}`,
                "User-Agent": "ScriptGlass-App",
                Accept: "application/vnd.github+json"
              },
            }
          );
        } catch (createError: any) {
          console.error("Failed to create repository:", createError.response?.data || createError.message);
          if (createError.response?.data?.message === "Resource not accessible by integration") {
            throw new Error("GitHub App permissions issue: Please ensure your GitHub App has 'Contents' and 'Administration' write permissions.");
          }
          throw createError;
        }
      } else {
        console.error("Failed to check repository existence:", error.response?.data || error.message);
        throw error;
      }
    }
  }

  async pull(token: string, repoName: string) {
    if (!repoName) {
      throw new Error("Repository name could not be determined from the folder path.");
    }
    console.log(`[GitManager] Pulling repo: ${repoName} into ${this.absPath}`);
    try {
      await this.initRepo();
      const slugifiedRepoName = repoName.toLowerCase().replace(/[^a-z0-9-_]/g, "-");
      const username = await this.getGitHubUsername(token);
      const remoteUrl = `https://oauth2:${token}@github.com/${username}/${slugifiedRepoName}.git`;
      
      const remotes = await this.git.getRemotes();
      if (remotes.find(r => r.name === "origin")) {
        await this.git.remote(["set-url", "origin", remoteUrl]);
      } else {
        await this.git.addRemote("origin", remoteUrl);
      }

      // Fetch all to discover branches
      await this.git.fetch("origin");

      const localBranch = await this.getBranch();
      const remoteBranches = await this.git.branch(["-r"]).then(r => r.all);
      
      let targetRemoteBranch = "";
      
      // 1. Prefer current local branch if it exists on remote
      if (localBranch && remoteBranches.includes(`origin/${localBranch}`)) {
        targetRemoteBranch = `origin/${localBranch}`;
      } 
      // 2. Otherwise, check for standard default branches
      else if (remoteBranches.includes("origin/main")) {
        targetRemoteBranch = "origin/main";
      } else if (remoteBranches.includes("origin/master")) {
        targetRemoteBranch = "origin/master";
      }

      if (!targetRemoteBranch) {
        return { success: true, message: "Remote branch does not exist yet; nothing to pull." };
      }

      const targetBranchShort = targetRemoteBranch.replace("origin/", "");

      // Handle conflicts before potentially switching or resetting
      try {
        const status = await this.git.status();
        const log = await this.git.log().catch(() => ({ all: [] }));
        const hasCommits = log.all.length > 0;
        
        let commonBase = "";
        if (hasCommits) {
          try {
            commonBase = (await this.git.raw(["merge-base", "HEAD", targetRemoteBranch])).trim();
          } catch (e) {}
        }

        let remoteChanges: string[] = [];
        if (commonBase) {
          const remoteDiff = await this.git.diff(["--name-only", commonBase, targetRemoteBranch]);
          remoteChanges = remoteDiff.split("\n").filter(Boolean);
        } else {
          // No common base, all remote files are potential conflicts
          const lsRemote = await this.git.raw(["ls-tree", "-r", "--name-only", targetRemoteBranch]);
          remoteChanges = lsRemote.split("\n").filter(Boolean);
        }

        const localChangesSet = new Set([
          ...status.modified, 
          ...status.not_added, 
          ...status.created, 
          ...status.deleted, 
          ...status.renamed.map(r => r.to)
        ]);
        
        // If we have history, also check what diverged from base
        if (commonBase) {
          const localDiff = await this.git.diff(["--name-only", commonBase]);
          localDiff.split("\n").filter(Boolean).forEach(f => localChangesSet.add(f));
        }

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
      } catch (e) {
        console.error("Conflict detection failed:", e);
      }

      // Switch or reset
      if (localBranch !== targetBranchShort) {
        // Use -B to create/reset local branch to match remote
        await this.git.checkout(["-B", targetBranchShort, targetRemoteBranch]);
      } else {
        await this.git.reset(["--hard", targetRemoteBranch]);
      }

      return { success: true };
    } catch (error: any) {
      console.error("Git Pull Error:", error);
      throw error;
    }
  }
}

// --- Server Setup ---

async function startServer() {
  const app = express();
  const PORT = 3000;
  const fsProvider = new FileSystemProvider();

  await settings.load();

  app.use(express.json());

  // API Routes
  app.get("/api/settings", (req, res) => {
    res.json({ 
      baseProjectsDir: settings.baseDir,
      githubToken: settings.githubToken,
      geminiKey: settings.geminiKey
    });
  });

  app.post("/api/settings", async (req, res) => {
    try {
      const { baseProjectsDir, githubToken, geminiKey } = req.body;
      if (baseProjectsDir) settings.baseDir = baseProjectsDir;
      if (githubToken !== undefined) settings.githubToken = githubToken;
      if (geminiKey !== undefined) settings.geminiKey = geminiKey;
      
      await settings.save();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.post("/api/workspace/open", async (req, res) => {
    try {
      const { folderPath, type, url: cloneUrl } = req.body;
      
      if (!folderPath) return res.status(400).json({ error: "Folder path is required" });

      if (type === "clone") {
        if (!cloneUrl) return res.status(400).json({ error: "URL is required for cloning" });
        
        let authenticatedUrl = cloneUrl;
        if (settings.githubToken && cloneUrl.includes("github.com")) {
          try {
            const url = new URL(cloneUrl);
            url.username = "x-access-token";
            url.password = settings.githubToken;
            authenticatedUrl = url.toString();
          } catch (e) {}
        }

        try {
          await simpleGit().clone(authenticatedUrl, folderPath);
        } catch (error: any) {
          if (error.message.includes("could not read Username") || error.message.includes("Authentication failed")) {
            throw new Error("Authentication failed. Please check your GitHub token in Settings.");
          }
          throw error;
        }
      } else {
        // Just ensure the folder exists
        await fs.mkdir(folderPath, { recursive: true });
      }

      const git = new GitManager(folderPath);
      await git.initRepo();
      res.json({ path: folderPath });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.get("/api/browse", async (req, res) => {
    try {
      const isWindows = os.platform() === 'win32';
      let startPath = (req.query.path as string) || settings.baseDir || os.homedir();
      
      // If path is empty, we show drives on Windows or system root on Linux
      if (req.query.path === 'ROOT') {
        if (isWindows) {
          // List Windows drives
          return new Promise((resolve) => {
            exec('wmic logicaldisk get name', (error, stdout) => {
              if (error) {
                res.status(500).json({ error: 'Could not list drives' });
                return resolve();
              }
              const drives = stdout.split('\r\n')
                .filter(value => /[A-Za-z]:/.test(value))
                .map(value => value.trim() + path.sep);
              
              res.json({
                currentPath: 'ROOT',
                parentPath: 'ROOT',
                directories: drives,
                sep: path.sep,
                isRoot: true
              });
              resolve();
            });
          });
        } else {
          startPath = '/';
        }
      }

      const items = await fs.readdir(startPath, { withFileTypes: true });
      const directories = items
        .filter(item => item.isDirectory() && !item.name.startsWith('.'))
        .map(item => item.name)
        .sort();
      
      const parentPath = path.dirname(startPath);
      
      res.json({
        currentPath: startPath,
        parentPath: parentPath === startPath ? (isWindows ? 'ROOT' : startPath) : parentPath,
        directories,
        sep: path.sep,
        isRoot: parentPath === startPath && !isWindows
      });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.get("/api/workspace/:path/files", async (req, res) => {
    try {
      const absPath = decodePath(req.params.path);
      const files = await fsProvider.listFiles(absPath);
      res.json(files);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.get("/api/workspace/:path/files/:filename", async (req, res) => {
    try {
      const absPath = decodePath(req.params.path);
      const content = await fsProvider.readFile(absPath, req.params.filename);
      res.json({ content });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.post("/api/workspace/:path/files/:filename", async (req, res) => {
    try {
      const absPath = decodePath(req.params.path);
      const { content } = req.body;
      await fsProvider.writeFile(absPath, req.params.filename, content);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.delete("/api/workspace/:path/files/:filename", async (req, res) => {
    try {
      const absPath = decodePath(req.params.path);
      await fsProvider.deleteFile(absPath, req.params.filename);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.get("/api/workspace/:path/git/status", async (req, res) => {
    try {
      const absPath = decodePath(req.params.path);
      const git = new GitManager(absPath);
      const status = await git.getStatus();
      const branch = await git.getBranch();
      res.json({ status, branch });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.get("/api/workspace/:path/git/log", async (req, res) => {
    try {
      const absPath = decodePath(req.params.path);
      const git = new GitManager(absPath);
      const log = await git.getLog();
      res.json(log);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.post("/api/workspace/:path/git/sync", async (req, res) => {
    try {
      const { token, commitMessage } = req.body;
      if (!token) return res.status(400).json({ error: "GitHub token is required" });
      
      const absPath = decodePath(req.params.path);
      const git = new GitManager(absPath);
      await git.initRepo();
      await git.commit(commitMessage || `Sync ${new Date().toISOString()}`, token);
      const result = await git.push(token, path.basename(absPath));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.response?.data?.message || String(error) });
    }
  });

  app.post("/api/workspace/:path/git/pull", async (req, res) => {
    try {
      const { token } = req.body;
      if (!token) return res.status(400).json({ error: "GitHub token is required" });
      
      const absPath = decodePath(req.params.path);
      const git = new GitManager(absPath);
      
      // Ensure repo name is valid even with trailing slashes
      const repoName = path.basename(absPath.replace(/[/\\]$/, ""));
      const result = await git.pull(token, repoName);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.response?.data?.message || String(error) });
    }
  });

  app.post("/api/terminal/exec", async (req, res) => {
    const { command, activePath } = req.body;
    const cwd = activePath || settings.baseDir;
    
    exec(command, { cwd }, (error, stdout, stderr) => {
      res.json({
        stdout,
        stderr,
        error: error ? error.message : null
      });
    });
  });

  // GitHub OAuth Routes
  app.get("/api/auth/github/url", (req, res) => {
    const client_id = process.env.GITHUB_CLIENT_ID;
    if (!client_id) {
      return res.status(500).json({ error: "GITHUB_CLIENT_ID not configured" });
    }
    const redirect_uri = `${process.env.APP_URL}/auth/github/callback`;
    const url = `https://github.com/login/oauth/authorize?client_id=${client_id}&redirect_uri=${encodeURIComponent(redirect_uri)}&scope=repo,user`;
    res.json({ url });
  });

  app.get(["/auth/github/callback", "/auth/github/callback/"], async (req, res) => {
    const { code } = req.query;
    const client_id = process.env.GITHUB_CLIENT_ID;
    const client_secret = process.env.GITHUB_CLIENT_SECRET;

    try {
      const response = await axios.post(
        "https://github.com/login/oauth/access_token",
        {
          client_id,
          client_secret,
          code,
        },
        {
          headers: { 
            Accept: "application/json",
            "User-Agent": "ScriptGlass-App"
          },
        }
      );

      const { access_token, error } = response.data;

      if (error) {
        throw new Error(error);
      }

      // Send success message and token to the opener window
      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'GITHUB_AUTH_SUCCESS', token: '${access_token}' }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>Authentication successful. This window should close automatically.</p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("GitHub OAuth Error:", error);
      res.status(500).send("Authentication failed");
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
