import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, 
  Folder, 
  Terminal as TerminalIcon, 
  GitBranch, 
  CloudUpload, 
  Plus, 
  Trash2, 
  ChevronLeft, 
  ChevronRight,
  Save,
  Clock,
  Settings as SettingsIcon,
  Globe,
  Link as LinkIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { parseFountain } from '@/src/lib/editor-engine';
import { GitStatus, GitLogEntry } from '@/src/types';

export default function App() {
  const [projects, setProjects] = useState<string[]>([]);
  const [activeProject, setActiveProject] = useState<string | null>(null);
  const [files, setFiles] = useState<string[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [gitLog, setGitLog] = useState<GitLogEntry[]>([]);
  const [wordCount, setWordCount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [githubToken, setGithubToken] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isGitHubConnected, setIsGitHubConnected] = useState(false);
  const [syncCommitMessage, setSyncCommitMessage] = useState('');
  const [settings, setSettings] = useState({ baseProjectsDir: '' });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [newProjectData, setNewProjectData] = useState({ name: '', type: 'create', url: '', path: '' });
  const [isNewScriptOpen, setIsNewScriptOpen] = useState(false);
  const [newScriptName, setNewScriptName] = useState('');

  const editorRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) {
        return;
      }
      if (event.data?.type === 'GITHUB_AUTH_SUCCESS') {
        const token = event.data.token;
        setGithubToken(token);
        setIsGitHubConnected(true);
        
        // Persist token to server
        try {
          await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ githubToken: token }),
          });
          toast.success('GitHub account connected and saved');
        } catch (error) {
          console.error('Failed to persist GitHub token');
          toast.success('GitHub account connected (local session only)');
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  useEffect(() => {
    fetchProjects();
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      setSettings({ baseProjectsDir: data.baseProjectsDir });
      if (data.githubToken) {
        setGithubToken(data.githubToken);
        setIsGitHubConnected(true);
      }
    } catch (error) {
      console.error('Failed to fetch settings');
    }
  };

  useEffect(() => {
    if (activeProject) {
      fetchFiles(activeProject);
      fetchGitStatus(activeProject);
    } else {
      setFiles([]);
      setActiveFile(null);
      setContent('');
    }
  }, [activeProject]);

  useEffect(() => {
    if (activeProject && activeFile) {
      fetchFileContent(activeProject, activeFile);
    }
  }, [activeProject, activeFile]);

  useEffect(() => {
    const words = (content || '').trim() ? (content || '').trim().split(/\s+/).length : 0;
    setWordCount(words);
  }, [content]);

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      setProjects(data);
      if (data.length > 0 && !activeProject) {
        setActiveProject(data[0]);
      }
    } catch (error) {
      toast.error('Failed to fetch projects');
    }
  };

  const fetchFiles = async (project: string) => {
    try {
      const res = await fetch(`/api/projects/${project}/files`);
      const data = await res.json();
      setFiles(data);
      if (data.length > 0 && !activeFile) {
        setActiveFile(data[0]);
      }
    } catch (error) {
      toast.error('Failed to fetch files');
    }
  };

  const fetchFileContent = async (project: string, filename: string) => {
    try {
      const res = await fetch(`/api/projects/${project}/files/${filename}`);
      const data = await res.json();
      setContent(data.content || '');
    } catch (error) {
      toast.error('Failed to fetch file content');
    }
  };

  const fetchGitStatus = async (project: string) => {
    try {
      const res = await fetch(`/api/projects/${project}/git/status`);
      const data = await res.json();
      setGitStatus(data);
    } catch (error) {
      console.error('Failed to fetch git status');
    }
  };

  const fetchGitLog = async (project: string) => {
    try {
      const res = await fetch(`/api/projects/${project}/git/log`);
      const data = await res.json();
      setGitLog(data.all);
    } catch (error) {
      console.error('Failed to fetch git log');
    }
  };

  const handleCreateProject = async () => {
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProjectData),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      fetchProjects();
      setActiveProject(data.name);
      setIsNewProjectOpen(false);
      setNewProjectData({ name: '', type: 'create', url: '', path: '' });
      toast.success(newProjectData.type === 'clone' ? 'Project cloned' : (newProjectData.type === 'link' ? 'Project linked' : 'Project created'));
    } catch (error: any) {
      toast.error(`Failed to create project: ${error.message}`);
    }
  };

  const handleUpdateSettings = async () => {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success('Settings updated');
      setIsSettingsOpen(false);
      fetchProjects(); // Re-fetch projects from new location
    } catch (error: any) {
      toast.error(`Failed to update settings: ${error.message}`);
    }
  };

  const handleSave = async () => {
    if (!activeProject || !activeFile) return;
    setIsSaving(true);
    try {
      await fetch(`/api/projects/${activeProject}/files/${activeFile}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      toast.success('Saved locally');
    } catch (error) {
      toast.error('Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateFile = async () => {
    if (!activeProject) {
      toast.error('Please select or create a project first');
      return;
    }
    if (!newScriptName) return;
    const filename = newScriptName.endsWith('.fountain') ? newScriptName : `${newScriptName}.fountain`;
    try {
      const res = await fetch(`/api/projects/${activeProject}/files/${filename}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: '' }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      fetchFiles(activeProject);
      setActiveFile(filename);
      setIsNewScriptOpen(false);
      setNewScriptName('');
      toast.success('File created');
    } catch (error: any) {
      toast.error(`Failed to create file: ${error.message}`);
    }
  };

  const handleConnectGitHub = async () => {
    try {
      const res = await fetch('/api/auth/github/url');
      const { url, error } = await res.json();
      if (error) throw new Error(error);

      window.open(url, 'github_oauth', 'width=600,height=700');
    } catch (error) {
      toast.error('Failed to initiate GitHub connection');
    }
  };

  const handleSync = async () => {
    if (!activeProject) return;
    if (!githubToken) {
      toast.error('Please connect your GitHub account first');
      return;
    }
    setIsSyncing(true);
    try {
      const res = await fetch(`/api/projects/${activeProject}/git/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: githubToken, commitMessage: syncCommitMessage }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      toast.success('Successfully pushed to GitHub');
      setSyncCommitMessage('');
      fetchGitStatus(activeProject);
    } catch (error: any) {
      toast.error(`Failed to push: ${error.message}`);
      console.error(error);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteFile = async (filename: string) => {
    if (!activeProject) return;
    if (!confirm(`Are you sure you want to delete ${filename}?`)) return;
    try {
      await fetch(`/api/projects/${activeProject}/files/${filename}`, { method: 'DELETE' });
      fetchFiles(activeProject);
      if (activeFile === filename) {
        setActiveFile(null);
        setContent('');
      }
      toast.success('File deleted');
    } catch (error) {
      toast.error('Failed to delete file');
    }
  };

  return (
    <TooltipProvider>
      <div className="flex flex-col h-screen w-full bg-[#f2f2f2] text-[#1a1a1a] font-sans selection:bg-blue-100 overflow-hidden">
        <Toaster position="top-center" />
        
        {/* Title Bar */}
        <div className="h-[38px] bg-[#ebebeb] border-b border-[#d1d1d1] flex items-center px-4 shrink-0">
          <div className="flex gap-2 mr-6">
            <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
            <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
            <div className="w-3 h-3 rounded-full bg-[#28c840]" />
          </div>
          <div className="text-[12px] font-semibold text-[#666666] uppercase tracking-wider">
            ScriptFlow — {activeFile || 'Untitled'}
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <aside className="w-12 bg-[#ebebeb] border-r border-[#d1d1d1] flex flex-col items-center py-5 gap-6 shrink-0">
            <Tooltip>
              <TooltipTrigger 
                className={`transition-colors ${isSidebarOpen ? 'text-[#3b82f6]' : 'text-[#666666] opacity-50'}`}
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              >
                <Folder className="w-5 h-5" />
              </TooltipTrigger>
              <TooltipContent side="right">Explorer</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger 
                className="text-[#666666] opacity-50 hover:opacity-100 transition-opacity"
                onClick={() => setIsNewProjectOpen(true)}
              >
                <Plus className="w-5 h-5" />
              </TooltipTrigger>
              <TooltipContent side="right">New Project</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger 
                className="text-[#666666] opacity-50 hover:opacity-100 transition-opacity"
                onClick={() => {
                  if (!activeProject) {
                    toast.error('Please select or create a project first');
                    return;
                  }
                  setIsNewScriptOpen(true);
                }}
              >
                <FileText className="w-5 h-5" />
              </TooltipTrigger>
              <TooltipContent side="right">New Script</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger 
                className={`transition-colors ${isTerminalOpen ? 'text-[#3b82f6]' : 'text-[#666666] opacity-50'}`}
                onClick={() => {
                  setIsTerminalOpen(!isTerminalOpen);
                  if (!isTerminalOpen && activeProject) fetchGitLog(activeProject);
                }}
              >
                <Clock className="w-5 h-5" />
              </TooltipTrigger>
              <TooltipContent side="right">History</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger 
                className={`transition-colors ${isSettingsOpen ? 'text-[#3b82f6]' : 'text-[#666666] opacity-50'}`}
                onClick={() => setIsSettingsOpen(true)}
              >
                <SettingsIcon className="w-5 h-5" />
              </TooltipTrigger>
              <TooltipContent side="right">Settings</TooltipContent>
            </Tooltip>

            <div className="mt-auto pb-4 flex flex-col gap-6">
              <Tooltip>
                <TooltipTrigger 
                  className={`transition-colors ${isSaving ? 'text-[#3b82f6] animate-pulse' : 'text-[#666666] opacity-50'}`}
                  onClick={handleSave}
                  disabled={isSaving || !activeFile}
                >
                  <Save className="w-5 h-5" />
                </TooltipTrigger>
                <TooltipContent side="right">Save Locally</TooltipContent>
              </Tooltip>

              <Dialog>
                <Tooltip>
                  <TooltipTrigger 
                    render={
                      <DialogTrigger 
                        render={
                          <button className={`transition-colors ${isSyncing ? 'text-[#3b82f6] animate-spin' : 'text-[#666666] opacity-50'}`} />
                        } 
                      />
                    }
                  >
                    <CloudUpload className="w-5 h-5" />
                  </TooltipTrigger>
                  <TooltipContent side="right">GitHub Sync</TooltipContent>
                </Tooltip>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>GitHub Integration</DialogTitle>
                    <DialogDescription>
                      {isGitHubConnected 
                        ? `Syncing project "${activeProject}" to GitHub.`
                        : "Connect your GitHub account to sync your scripts to a private repository."}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    {!isGitHubConnected ? (
                      <div className="flex flex-col items-center gap-4 py-4">
                        <p className="text-sm text-gray-600 text-center">
                          Sign in with GitHub to sync your scripts to a private repository.
                        </p>
                        <Button onClick={handleConnectGitHub} className="bg-[#24292e] hover:bg-[#2c3238] text-white gap-2">
                          <CloudUpload className="w-4 h-4" />
                          Connect GitHub
                        </Button>
                      </div>
                    ) : (
                      <div className="grid gap-4">
                        <div className="flex items-center justify-between p-3 bg-green-50 border border-green-100 rounded-md">
                          <div className="flex items-center gap-2 text-green-700 text-sm font-medium">
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                            Connected to GitHub
                          </div>
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-gray-500" onClick={async () => {
                            setGithubToken('');
                            setIsGitHubConnected(false);
                            try {
                              await fetch('/api/settings', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ githubToken: null }),
                              });
                              toast.success('GitHub account disconnected');
                            } catch (error) {
                              console.error('Failed to clear GitHub token on server');
                            }
                          }}>
                            Disconnect
                          </Button>
                        </div>
                        
                        <div className="grid gap-2">
                          <Label htmlFor="commitMessage">Commit Message (Optional)</Label>
                          <Input 
                            id="commitMessage" 
                            placeholder="e.g. Added new scene" 
                            value={syncCommitMessage}
                            onChange={(e) => setSyncCommitMessage(e.target.value)}
                          />
                        </div>

                        <p className="text-[10px] text-gray-500">
                          This will create/update a repository named <strong>{activeProject}</strong> on your GitHub account.
                        </p>
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button onClick={handleSync} disabled={isSyncing || !isGitHubConnected || !activeProject}>
                      {isSyncing ? 'Syncing...' : 'Sync Now'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </aside>

          {/* File List (Conditional) */}
          <AnimatePresence>
            {isSidebarOpen && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 240, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                className="bg-[#ebebeb] border-r border-[#d1d1d1] overflow-hidden flex flex-col shrink-0"
              >
                <div className="flex flex-col h-1/2 border-b border-[#d1d1d1]">
                  <div className="p-4 flex items-center justify-between text-[11px] font-bold text-[#666666] uppercase tracking-widest border-b border-[#d1d1d1]">
                    <span>Projects</span>
                    <button onClick={() => setIsNewProjectOpen(true)} className="hover:text-[#3b82f6]">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <ScrollArea className="flex-1">
                    <div className="p-2 space-y-1">
                      {projects.map((project) => (
                        <div
                          key={project}
                          className={`p-2 rounded-none cursor-pointer transition-colors text-sm truncate ${
                            activeProject === project ? 'bg-white border border-[#d1d1d1] text-[#1a1a1a]' : 'hover:bg-white/50 text-[#666666]'
                          }`}
                          onClick={() => setActiveProject(project)}
                        >
                          {project}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>

                <div className="flex flex-col h-1/2">
                  <div className="p-4 flex items-center justify-between text-[11px] font-bold text-[#666666] uppercase tracking-widest border-b border-[#d1d1d1]">
                    <span>Files</span>
                    <button onClick={() => setIsNewScriptOpen(true)} className="hover:text-[#3b82f6]">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <ScrollArea className="flex-1">
                    <div className="p-2 space-y-1">
                      {files.map((file) => (
                        <div
                          key={file}
                          className={`group flex items-center justify-between p-2 rounded-none cursor-pointer transition-colors text-sm ${
                            activeFile === file ? 'bg-white border border-[#d1d1d1] text-[#1a1a1a]' : 'hover:bg-white/50 text-[#666666]'
                          }`}
                          onClick={() => setActiveFile(file)}
                        >
                          <div className="flex items-center gap-2 overflow-hidden">
                            <FileText className="w-4 h-4 flex-shrink-0" />
                            <span className="truncate">{file}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="opacity-0 group-hover:opacity-100 h-6 w-6 text-gray-400 hover:text-red-500"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteFile(file);
                            }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Editor Canvas */}
          <main className="flex-1 flex justify-center overflow-y-auto p-10 bg-[#f2f2f2]">
            <div className="w-full max-w-[560px] min-h-full bg-white shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-[#d1d1d1] p-16 md:p-20 relative">
              {activeFile ? (
                <textarea
                  ref={editorRef}
                  className="w-full h-full min-h-[800px] resize-none focus:outline-none font-mono text-[14px] leading-[1.4] text-black placeholder:text-gray-300"
                  placeholder="Start writing in Fountain format..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                      e.preventDefault();
                      handleSave();
                    }
                  }}
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4">
                  <FileText className="w-12 h-12 opacity-20" />
                  <p className="text-sm">Select or create a script to begin</p>
                  <Button variant="outline" onClick={() => setIsNewScriptOpen(true)}>Create New Script</Button>
                </div>
              )}
            </div>
          </main>
        </div>

        {/* Terminal Pane */}
        <AnimatePresence>
          {isTerminalOpen && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 160 }}
              exit={{ height: 0 }}
              className="bg-[#1e1e1e] text-[#d4d4d4] font-mono border-t border-[#333] overflow-hidden flex flex-col shrink-0"
            >
              <div className="flex items-center justify-between px-4 py-2 border-b border-[#333]">
                <div className="flex items-center gap-2 text-[10px] text-[#666666] uppercase tracking-[1px]">
                  <span>Terminal</span>
                  <Separator orientation="vertical" className="h-2 bg-[#333]" />
                  <span>git-log --oneline -n 5</span>
                </div>
                <button className="text-[#666666] hover:text-white" onClick={() => setIsTerminalOpen(false)}>
                  <ChevronLeft className="w-4 h-4 rotate-[-90deg]" />
                </button>
              </div>
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-1 text-[12px]">
                  {gitLog.length > 0 ? gitLog.map((log) => (
                    <div key={log.hash} className="flex gap-4">
                      <span className="text-[#22c55e]">$</span>
                      <span className="text-gray-500">{log.hash.substring(0, 7)}</span>
                      <span className="text-[#d4d4d4]">{log.message}</span>
                    </div>
                  )) : (
                    <div className="text-gray-600">No commit history yet.</div>
                  )}
                </div>
              </ScrollArea>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Status Bar */}
        <footer className="h-[28px] bg-[#ebebeb] border-t border-[#d1d1d1] flex items-center justify-between px-4 text-[11px] text-[#666666] shrink-0">
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-1.5 text-[#1a1a1a]">
              <GitBranch className="w-3.5 h-3.5" />
              <span>{gitStatus?.branch || 'main'}</span>
            </div>
            <span>Page 1 of 1</span>
            <span>{wordCount} words</span>
          </div>
          
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-1.5 text-[#22c55e] font-semibold">
              <span>Synced to GitHub</span>
            </div>
            <span>UTF-8</span>
            <span>Fountain 1.1</span>
          </div>
        </footer>

        {/* Settings Dialog */}
        <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Settings</DialogTitle>
              <DialogDescription>
                Configure your workspace preferences.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="baseDir">Default Projects Location</Label>
                <Input 
                  id="baseDir" 
                  value={settings.baseProjectsDir}
                  onChange={(e) => setSettings({ ...settings, baseProjectsDir: e.target.value })}
                  placeholder="/path/to/your/projects"
                />
                <p className="text-[10px] text-gray-500">
                  Projects will be stored and searched in this directory.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsSettingsOpen(false)}>Cancel</Button>
              <Button onClick={handleUpdateSettings}>Save Settings</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* New Project Dialog */}
        <Dialog open={isNewProjectOpen} onOpenChange={setIsNewProjectOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Project</DialogTitle>
              <DialogDescription>
                Create a new project, clone from GitHub, or link an existing folder.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="flex gap-2 p-1 bg-[#ebebeb] rounded-md">
                <Button 
                  variant={newProjectData.type === 'create' ? 'secondary' : 'ghost'} 
                  className="flex-1 h-8 text-xs"
                  onClick={() => setNewProjectData({ ...newProjectData, type: 'create' })}
                >
                  Create
                </Button>
                <Button 
                  variant={newProjectData.type === 'clone' ? 'secondary' : 'ghost'} 
                  className="flex-1 h-8 text-xs"
                  onClick={() => setNewProjectData({ ...newProjectData, type: 'clone' })}
                >
                  Clone
                </Button>
                <Button 
                  variant={newProjectData.type === 'link' ? 'secondary' : 'ghost'} 
                  className="flex-1 h-8 text-xs"
                  onClick={() => setNewProjectData({ ...newProjectData, type: 'link' })}
                >
                  Link
                </Button>
              </div>

              {newProjectData.type === 'create' && (
                <div className="grid gap-2">
                  <Label htmlFor="projName">Project Name</Label>
                  <Input 
                    id="projName" 
                    placeholder="My New Script" 
                    value={newProjectData.name}
                    onChange={(e) => setNewProjectData({ ...newProjectData, name: e.target.value })}
                  />
                </div>
              )}

              {newProjectData.type === 'clone' && (
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="cloneUrl">GitHub Repository URL</Label>
                    <Input 
                      id="cloneUrl" 
                      placeholder="https://github.com/user/repo.git" 
                      value={newProjectData.url}
                      onChange={(e) => setNewProjectData({ ...newProjectData, url: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="projNameClone">Project Name (Optional)</Label>
                    <Input 
                      id="projNameClone" 
                      placeholder="Leave empty to use repo name" 
                      value={newProjectData.name}
                      onChange={(e) => setNewProjectData({ ...newProjectData, name: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {newProjectData.type === 'link' && (
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="linkPath">Local Folder Path</Label>
                    <Input 
                      id="linkPath" 
                      placeholder="/Users/name/Documents/MyProject" 
                      value={newProjectData.path}
                      onChange={(e) => setNewProjectData({ ...newProjectData, path: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="projNameLink">Project Name (Optional)</Label>
                    <Input 
                      id="projNameLink" 
                      placeholder="Leave empty to use folder name" 
                      value={newProjectData.name}
                      onChange={(e) => setNewProjectData({ ...newProjectData, name: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsNewProjectOpen(false)}>Cancel</Button>
              <Button 
                onClick={handleCreateProject} 
                disabled={
                  (newProjectData.type === 'create' && !newProjectData.name) ||
                  (newProjectData.type === 'clone' && !newProjectData.url) ||
                  (newProjectData.type === 'link' && !newProjectData.path)
                }
              >
                {newProjectData.type === 'clone' ? 'Clone Project' : (newProjectData.type === 'link' ? 'Link Project' : 'Create Project')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* New Script Dialog */}
        <Dialog open={isNewScriptOpen} onOpenChange={setIsNewScriptOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Script</DialogTitle>
              <DialogDescription>
                Create a new Fountain script in project: <strong>{activeProject}</strong>
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="scriptName">Script Name</Label>
                <Input 
                  id="scriptName" 
                  placeholder="e.g. pilot_episode" 
                  value={newScriptName}
                  onChange={(e) => setNewScriptName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateFile();
                  }}
                />
                <p className="text-[10px] text-gray-500">
                  The .fountain extension will be added automatically.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsNewScriptOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateFile} disabled={!newScriptName}>
                Create Script
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
