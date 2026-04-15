import express from "express";
import axios from "axios";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs/promises";
import os from "os";
import { simpleGit, SimpleGit } from "simple-git";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_FILE = path.join(__dirname, "config.json");
const DEFAULT_STORAGE_DIR = path.join(os.homedir(), "Documents", "ScriptGlass");

// --- Services ---

class SettingsManager {
  private config: { baseProjectsDir: string; githubToken?: string } = { baseProjectsDir: DEFAULT_STORAGE_DIR };

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
}

const settings = new SettingsManager();

class FileSystemProvider {
  async ensureStorage() {
    const dir = settings.baseDir;
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  async listProjects() {
    await this.ensureStorage();
    const entries = await fs.readdir(settings.baseDir, { withFileTypes: true });
    return entries
      .filter(e => e.isDirectory() && !e.name.startsWith("."))
      .map(e => e.name);
  }

  async createProject(name: string) {
    const projectPath = path.join(settings.baseDir, name);
    await fs.mkdir(projectPath, { recursive: true });
    return name;
  }

  async listFiles(project: string) {
    const projectPath = path.join(settings.baseDir, project);
    const files = await fs.readdir(projectPath);
    return files.filter(f => (f.endsWith(".fountain") || f.endsWith(".txt")) && !f.startsWith("."));
  }

  async readFile(project: string, filename: string) {
    const filePath = path.join(settings.baseDir, project, filename);
    return await fs.readFile(filePath, "utf-8");
  }

  async writeFile(project: string, filename: string, content: string) {
    const projectPath = path.join(settings.baseDir, project);
    await fs.mkdir(projectPath, { recursive: true });
    const filePath = path.join(projectPath, filename);
    await fs.writeFile(filePath, content, "utf-8");
  }

  async deleteFile(project: string, filename: string) {
    const filePath = path.join(settings.baseDir, project, filename);
    await fs.unlink(filePath);
  }
}

class GitManager {
  private git: SimpleGit;
  private projectPath: string;

  constructor(project: string) {
    this.projectPath = path.join(settings.baseDir, project);
    this.git = simpleGit(this.projectPath);
  }

  async initRepo() {
    try {
      await fs.access(path.join(this.projectPath, ".git"));
    } catch {
      await this.git.init();
      await this.git.addConfig("user.name", "ScriptGlass User");
      await this.git.addConfig("user.email", "user@scriptglass.app");
    }
  }

  async commit(message: string) {
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
    const branch = await this.git.branch();
    return branch.current;
  }

  async push(token: string, repoName: string) {
    try {
      // 1. Get user info to determine username
      const userRes = await axios.get("https://api.github.com/user", {
        headers: { 
          Authorization: `Bearer ${token}`,
          "User-Agent": "ScriptGlass-App"
        },
      });
      const username = userRes.data.login;

      // 2. Ensure repository exists on GitHub
      try {
        await axios.get(`https://api.github.com/repos/${username}/${repoName}`, {
          headers: { 
            Authorization: `Bearer ${token}`,
            "User-Agent": "ScriptGlass-App"
          },
        });
      } catch (error: any) {
        if (error.response?.status === 404) {
          // Create repo if it doesn't exist
          await axios.post(
            "https://api.github.com/user/repos",
            {
              name: repoName,
              description: `ScriptGlass Project: ${repoName}`,
              private: true,
            },
            {
              headers: { 
                Authorization: `Bearer ${token}`,
                "User-Agent": "ScriptGlass-App"
              },
            }
          );
        } else {
          throw error;
        }
      }

      // 3. Configure remote and push
      const remoteUrl = `https://${token}@github.com/${username}/${repoName}.git`;
      
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
      return { success: true, repoUrl: `https://github.com/${username}/${repoName}` };
    } catch (error) {
      console.error("Git Push Error:", error);
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
  await fsProvider.ensureStorage();

  app.use(express.json());

  // API Routes
  app.get("/api/settings", (req, res) => {
    res.json({ 
      baseProjectsDir: settings.baseDir,
      githubToken: settings.githubToken 
    });
  });

  app.post("/api/settings", async (req, res) => {
    try {
      const { baseProjectsDir, githubToken } = req.body;
      if (baseProjectsDir) settings.baseDir = baseProjectsDir;
      if (githubToken !== undefined) settings.githubToken = githubToken;
      
      await settings.save();
      if (baseProjectsDir) await fsProvider.ensureStorage();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.get("/api/projects", async (req, res) => {
    try {
      const projects = await fsProvider.listProjects();
      res.json(projects);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.post("/api/projects", async (req, res) => {
    try {
      const { name, type, path: linkPath, url: cloneUrl } = req.body;
      
      if (type === "link") {
        if (!linkPath) return res.status(400).json({ error: "Path is required for linking" });
        const projectName = name || path.basename(linkPath);
        const targetPath = path.join(settings.baseDir, projectName);
        
        try {
          await fs.symlink(linkPath, targetPath, "dir");
          return res.json({ name: projectName });
        } catch (error: any) {
          if (error.code === "EEXIST") {
            return res.status(400).json({ error: "A project with this name already exists in your workspace." });
          }
          throw error;
        }
      }

      if (type === "clone") {
        if (!cloneUrl) return res.status(400).json({ error: "URL is required for cloning" });
        const projectName = name || path.basename(cloneUrl, ".git");
        const projectPath = path.join(settings.baseDir, projectName);
        await simpleGit().clone(cloneUrl, projectPath);
        return res.json({ name: projectName });
      }

      if (!name) return res.status(400).json({ error: "Project name is required" });
      const projectName = await fsProvider.createProject(name);
      const git = new GitManager(projectName);
      await git.initRepo();
      res.json({ name: projectName });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.get("/api/projects/:project/files", async (req, res) => {
    try {
      const files = await fsProvider.listFiles(req.params.project);
      res.json(files);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.get("/api/projects/:project/files/:filename", async (req, res) => {
    try {
      const content = await fsProvider.readFile(req.params.project, req.params.filename);
      res.json({ content });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.post("/api/projects/:project/files/:filename", async (req, res) => {
    try {
      const { content } = req.body;
      await fsProvider.writeFile(req.params.project, req.params.filename, content);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.delete("/api/projects/:project/files/:filename", async (req, res) => {
    try {
      await fsProvider.deleteFile(req.params.project, req.params.filename);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.get("/api/projects/:project/git/status", async (req, res) => {
    try {
      const git = new GitManager(req.params.project);
      const status = await git.getStatus();
      const branch = await git.getBranch();
      res.json({ status, branch });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.get("/api/projects/:project/git/log", async (req, res) => {
    try {
      const git = new GitManager(req.params.project);
      const log = await git.getLog();
      res.json(log);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.post("/api/projects/:project/git/sync", async (req, res) => {
    try {
      const { token, commitMessage } = req.body;
      if (!token) return res.status(400).json({ error: "GitHub token is required" });
      
      const git = new GitManager(req.params.project);
      await git.commit(commitMessage || `Sync ${new Date().toISOString()}`);
      const result = await git.push(token, req.params.project);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
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
