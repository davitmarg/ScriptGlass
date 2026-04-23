import "dotenv/config";
import express from "express";
import axios from "axios";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import { SettingsManager, FileSystemProvider, GitManager, decodePath, browseFolders } from "./src/lib/services.server.ts";
import { simpleGit } from "simple-git";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_FILE = path.join(__dirname, "config.json");
const settings = new SettingsManager(CONFIG_FILE);
const fsProvider = new FileSystemProvider();

async function startServer() {
  const app = express();
  const PORT = 3000;

  await settings.load();

  app.use(express.json());

  // API Routes
  app.get("/api/settings", (req, res) => {
    res.json(settings.getConfig());
  });

  app.post("/api/settings", async (req, res) => {
    try {
      const { baseProjectsDir, githubToken, geminiKey, theme } = req.body;
      if (baseProjectsDir) settings.baseDir = baseProjectsDir;
      if (githubToken !== undefined) settings.githubToken = githubToken;
      if (geminiKey !== undefined) settings.geminiKey = geminiKey;
      if (theme !== undefined) settings.theme = theme;
      
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
      const data = await browseFolders(req.query.path as string, settings.baseDir);
      res.json(data);
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
      
      console.log(`Git Sync: target path is "${absPath}"`);
      if (!absPath || absPath === "undefined" || absPath === "null") {
        return res.status(400).json({ error: "Invalid workspace path" });
      }

      const git = new GitManager(absPath);
      await git.initRepo();
      await git.commit(commitMessage || `Sync ${new Date().toISOString()}`, token);
      const result = await git.push(token, path.basename(absPath));
      res.json(result);
    } catch (error: any) {
      console.error("Git Sync Error:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  app.post("/api/workspace/:path/git/pull", async (req, res) => {
    try {
      const { token } = req.body;
      if (!token) return res.status(400).json({ error: "GitHub token is required" });
      const absPath = decodePath(req.params.path);

      console.log(`Git Pull: target path is "${absPath}"`);
      if (!absPath || absPath === "undefined" || absPath === "null") {
        return res.status(400).json({ error: "Invalid workspace path" });
      }

      const git = new GitManager(absPath);
      const repoName = path.basename(absPath.replace(/[/\\]$/, ""));
      const result = await git.pull(token, repoName);
      res.json(result);
    } catch (error: any) {
      console.error("Git Pull Error:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  app.post("/api/terminal/exec", async (req, res) => {
    const { command, activePath } = req.body;
    const cwd = activePath || settings.baseDir;
    const { exec } = await import("child_process");
    exec(command, { cwd }, (error, stdout, stderr) => {
      res.json({ stdout, stderr, error: error ? error.message : null });
    });
  });

  app.get("/api/auth/github/url", (req, res) => {
    const client_id = process.env.GITHUB_CLIENT_ID;
    if (!client_id) return res.status(500).json({ error: "GITHUB_CLIENT_ID missing" });
    const redirect_uri = `${process.env.APP_URL}/auth/github/callback`;
    const url = `https://github.com/login/oauth/authorize?client_id=${client_id}&redirect_uri=${encodeURIComponent(redirect_uri)}&scope=repo,user`;
    res.json({ url });
  });

  app.get(["/auth/github/callback", "/auth/github/callback/"], async (req, res) => {
    const { code } = req.query;
    try {
      const response = await axios.post("https://github.com/login/oauth/access_token", {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      }, { headers: { Accept: "application/json" } });
      const { access_token, error } = response.data;
      if (error) throw new Error(error);
      res.send(`<html><body><script>if(window.opener){window.opener.postMessage({type:'GITHUB_AUTH_SUCCESS',token:'${access_token}'},'*');window.close();}else{window.location.href='/';}</script></body></html>`);
    } catch (error) {
      res.status(500).send("Authentication failed");
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  app.listen(PORT, "0.0.0.0", () => console.log(`Server running on http://localhost:${PORT}`));
}

startServer();
