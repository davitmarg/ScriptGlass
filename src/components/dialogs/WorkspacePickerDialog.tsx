import React from 'react';
import { Folder, FolderPlus, CloudUpload, Clock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FolderBrowserDialog } from '@/src/components/dialogs/FolderBrowserDialog';
import { useApp } from '@/src/contexts/AppContext';

export const WorkspacePickerDialog: React.FC = () => {
  const {
    isWorkspacePickerOpen,
    setIsWorkspacePickerOpen,
    workspaceData,
    setWorkspaceData,
    recentFolders,
    getBasename,
    settings,
    onOpenWorkspace,

    // FolderBrowserDialog props
    isBrowserOpen,
    setIsBrowserOpen,
    browserData,
    onBrowseNavigate,
    onBrowseBack,
    onSelectFolder,
    fetchBrowseData,
  } = useApp();

  const handleOpenBrowserLocal = () => {
    setIsBrowserOpen(true);
    fetchBrowseData(workspaceData.path);
  };

  return (
    <>
      <Dialog open={isWorkspacePickerOpen} onOpenChange={setIsWorkspacePickerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Workspace Management</DialogTitle>
            <DialogDescription>
              Open an existing folder, create a new one, or clone a repository.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex gap-1.5 p-1.5 bg-muted/50 rounded-xl border border-border/50">
              <Button 
                variant={workspaceData.type === 'open' ? 'secondary' : 'ghost'} 
                className={`flex-1 h-9 text-xs rounded-lg transition-all ${workspaceData.type === 'open' ? 'bg-background shadow-sm text-primary font-bold' : 'text-muted-foreground'}`}
                onClick={() => setWorkspaceData({ ...workspaceData, type: 'open' })}
              >
                <Folder className="w-3 h-3 mr-1.5" />
                Open
              </Button>
              <Button 
                variant={workspaceData.type === 'create' ? 'secondary' : 'ghost'} 
                className={`flex-1 h-9 text-xs rounded-lg transition-all ${workspaceData.type === 'create' ? 'bg-background shadow-sm text-primary font-bold' : 'text-muted-foreground'}`}
                onClick={() => setWorkspaceData({ ...workspaceData, type: 'create' })}
              >
                <FolderPlus className="w-3 h-3 mr-1.5" />
                Create
              </Button>
              <Button 
                variant={workspaceData.type === 'clone' ? 'secondary' : 'ghost'} 
                className={`flex-1 h-9 text-xs rounded-lg transition-all ${workspaceData.type === 'clone' ? 'bg-background shadow-sm text-primary font-bold' : 'text-muted-foreground'}`}
                onClick={() => setWorkspaceData({ ...workspaceData, type: 'clone' })}
              >
                <CloudUpload className="w-3 h-3 mr-1.5" />
                Clone
              </Button>
            </div>

            {workspaceData.type === 'create' ? (
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="folderName" className="text-[10px] uppercase tracking-wider text-foreground/60 font-bold mb-1">New Folder Name</Label>
                  <Input 
                    id="folderName" 
                    placeholder="e.g. my-new-screenplay"
                    value={workspaceData.name}
                    onChange={(e) => setWorkspaceData({ ...workspaceData, name: e.target.value })}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Will be created in: <span className="text-foreground/80 font-mono italic">{settings.baseProjectsDir || 'default location'}</span>
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="workspacePath" className="text-[10px] uppercase tracking-wider text-foreground/60 font-bold mb-1">{workspaceData.type === 'clone' ? 'Target Folder Path' : 'Absolute Folder Path'}</Label>
                  <div className="flex gap-2">
                    <Input 
                      id="workspacePath" 
                      placeholder={settings.baseProjectsDir || "/path/to/folder"}
                      value={workspaceData.path}
                      onChange={(e) => setWorkspaceData({ ...workspaceData, path: e.target.value })}
                      className="flex-1"
                    />
                    <Button 
                      variant="secondary" 
                      className="h-10 px-3"
                      onClick={handleOpenBrowserLocal}
                    >
                      Browse...
                    </Button>
                  </div>
                </div>

                {recentFolders.length > 0 && workspaceData.type === 'open' && (
                  <div className="grid gap-2">
                    <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Recently Used</Label>
                    <div className="flex flex-col gap-1">
                      {recentFolders.map((p) => (
                        <button
                          key={p}
                          onClick={() => {
                            setWorkspaceData({ ...workspaceData, path: p, type: 'open' });
                            onOpenWorkspace(p);
                          }}
                          className="text-left text-xs px-2 py-1.5 rounded hover:bg-secondary flex items-center gap-2 group overflow-hidden transition-colors"
                          title={p}
                        >
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          <span className="truncate flex-1 text-foreground">{getBasename(p)}</span>
                          <span className="text-[9px] text-muted-foreground opacity-0 group-hover:opacity-100 truncate">{p}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {workspaceData.type === 'clone' && (
              <div className="grid gap-2">
                <Label htmlFor="gitUrl" className="text-[10px] uppercase tracking-wider text-foreground/60 font-bold mb-1">Git Repository URL</Label>
                <Input 
                  id="gitUrl" 
                  placeholder="https://github.com/user/repo.git"
                  value={workspaceData.url}
                  onChange={(e) => setWorkspaceData({ ...workspaceData, url: e.target.value })}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsWorkspacePickerOpen(false)}>Cancel</Button>
            <Button onClick={() => onOpenWorkspace()}>
              {workspaceData.type === 'clone' ? 'Clone & Open' : 
               workspaceData.type === 'create' ? 'Create & Open' : 'Open Folder'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Folder Browser Dialog */}
      <FolderBrowserDialog
        isOpen={isBrowserOpen}
        onOpenChange={setIsBrowserOpen}
        browserData={browserData}
        onNavigate={onBrowseNavigate}
        onBack={onBrowseBack}
        onSelect={onSelectFolder}
      />
    </>
  );
};
