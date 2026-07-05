import React from 'react';
import { 
  Folder, 
  Save, 
  CloudUpload, 
  Terminal as TerminalIcon, 
  Settings as SettingsIcon, 
  RefreshCw, 
  Download, 
  Upload 
} from 'lucide-react';
import { motion } from 'motion/react';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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
import { toast } from 'sonner';
import { apiCall } from '@/src/lib/platform';

interface SidebarProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  isTerminalOpen: boolean;
  setIsTerminalOpen: (open: boolean) => void;
  isSaving: boolean;
  handleSave: () => void;
  activeFile: string | null;
  isSyncing: boolean;
  isPulling: boolean;
  isGitHubConnected: boolean;
  setIsGitHubConnected: (conn: boolean) => void;
  githubToken: string;
  setGithubToken: (tok: string) => void;
  activePath: string | null;
  getBasename: (path: string | null) => string;
  handleConnectGitHub: () => void;
  syncCommitMessage: string;
  setSyncCommitMessage: (msg: string) => void;
  isFilesLoading: boolean;
  fetchFiles: (path: string) => Promise<void>;
  handlePull: () => void;
  handleSync: () => void;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isSidebarOpen,
  setIsSidebarOpen,
  isTerminalOpen,
  setIsTerminalOpen,
  isSaving,
  handleSave,
  activeFile,
  isSyncing,
  isPulling,
  isGitHubConnected,
  setIsGitHubConnected,
  githubToken,
  setGithubToken,
  activePath,
  getBasename,
  handleConnectGitHub,
  syncCommitMessage,
  setSyncCommitMessage,
  isFilesLoading,
  fetchFiles,
  handlePull,
  handleSync,
  isSettingsOpen,
  setIsSettingsOpen,
}) => {
  return (
    <motion.aside 
      whileHover={{ scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className="absolute left-6 top-1/2 -translate-y-1/2 w-14 glass-panel border rounded-[2rem] flex flex-col items-center py-5 gap-6 shrink-0 h-[calc(100%-8rem)] shadow-lg hover:shadow-xl transition-shadow z-50"
    >
      <Tooltip>
        <TooltipTrigger 
          className={`transition-colors ${isSidebarOpen ? 'text-indigo-600 dark:text-indigo-400' : 'text-muted-foreground/50'}`}
          onClick={() => {
            if (!isSidebarOpen) {
              setIsTerminalOpen(false);
            }
            setIsSidebarOpen(!isSidebarOpen);
          }}
        >
          <Folder className="w-5 h-5" />
        </TooltipTrigger>
        <TooltipContent side="right">Scripts</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger 
          className={`transition-colors ${isSaving ? 'text-indigo-600 dark:text-indigo-400 animate-pulse' : 'text-muted-foreground/40'}`}
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
                  <button className={`transition-colors ${isSyncing ? 'text-indigo-600 dark:text-indigo-400 animate-spin' : 'text-muted-foreground/40'}`} />
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
                ? `Syncing workspace "${getBasename(activePath)}" to GitHub.`
                : "Connect your GitHub account to sync your scripts to a private repository."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {!isGitHubConnected ? (
              <div className="flex flex-col items-center gap-4 py-4">
                <p className="text-sm text-foreground/60 text-center">
                  Sign in with GitHub to sync your scripts to a private repository.
                </p>
                <Button onClick={handleConnectGitHub} className="bg-indigo-950 dark:bg-indigo-800 hover:bg-indigo-900 dark:hover:bg-indigo-700 text-white gap-2">
                  <CloudUpload className="w-4 h-4" />
                  Connect GitHub
                </Button>
              </div>
            ) : (
              <div className="grid gap-4">
                <div className="flex items-center justify-between p-3 bg-green-500/5 dark:bg-green-500/10 border border-green-500/10 dark:border-green-500/20 rounded-md">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-400 text-sm font-medium">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    Connected to GitHub
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={async () => {
                    setGithubToken('');
                    setIsGitHubConnected(false);
                    localStorage.removeItem('sg_github_token');
                    try {
                      await apiCall('/api/settings', {
                        method: 'POST',
                        body: { githubToken: null },
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
                  <Label htmlFor="commitMessage" className="text-[10px] uppercase tracking-wider text-foreground/60 font-bold mb-1">Commit Message (Optional)</Label>
                  <Input 
                    id="commitMessage" 
                    placeholder="e.g. Added new scene" 
                    value={syncCommitMessage}
                    onChange={(e) => setSyncCommitMessage(e.target.value)}
                  />
                </div>

                <p className="text-[10px] text-muted-foreground">
                  This will create/update a repository named <strong>{getBasename(activePath)}</strong> on your GitHub account.
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 items-center">
            <div className="mr-auto">
              <Tooltip>
                <TooltipTrigger 
                  onClick={() => activePath && fetchFiles(activePath)}
                  disabled={isFilesLoading || !activePath}
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "icon" }),
                    "h-8 w-8 text-muted-foreground/50 hover:text-indigo-600 focus-visible:ring-0"
                  )}
                >
                  <RefreshCw className={`w-4 h-4 ${isFilesLoading ? 'animate-spin' : ''}`} />
                </TooltipTrigger>
                <TooltipContent>Refresh scripts list</TooltipContent>
              </Tooltip>
            </div>
            <Button 
              variant="outline" 
              onClick={handlePull} 
              disabled={isPulling || isSyncing || !isGitHubConnected || !activePath}
              className="gap-2"
            >
              <Download className={`w-4 h-4 ${isPulling ? 'animate-bounce' : ''}`} />
              {isPulling ? 'Getting Latest...' : 'Get Latest'}
            </Button>
            <Button 
              onClick={handleSync} 
              disabled={isSyncing || isPulling || !isGitHubConnected || !activePath}
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
            >
              <Upload className={`w-4 h-4 ${isSyncing ? 'animate-bounce' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Sync Now'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="mt-auto flex flex-col gap-6">
        <Tooltip>
          <TooltipTrigger 
            className={`transition-colors ${isTerminalOpen ? 'text-indigo-600 dark:text-indigo-400' : 'text-muted-foreground/60'}`}
            onClick={() => {
              if (!isTerminalOpen) {
                setIsSidebarOpen(false);
              }
              setIsTerminalOpen(!isTerminalOpen);
            }}
          >
            <TerminalIcon className="w-5 h-5" />
          </TooltipTrigger>
          <TooltipContent side="right">Terminal</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger 
            className={`transition-colors ${isSettingsOpen ? 'text-indigo-600 dark:text-indigo-400' : 'text-muted-foreground/60'}`}
            onClick={() => setIsSettingsOpen(true)}
          >
            <SettingsIcon className="w-5 h-5" />
          </TooltipTrigger>
          <TooltipContent side="right">Settings</TooltipContent>
        </Tooltip>
      </div>
    </motion.aside>
  );
};
