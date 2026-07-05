import React from 'react';
import { 
  FileText, 
  Folder, 
  FolderPlus,
  Plus, 
  Trash2, 
  ChevronLeft, 
  RefreshCw 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface FileListProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  activePath: string | null;
  activeFile: string | null;
  setActiveFile: (file: string | null) => void;
  files: string[];
  isFilesLoading: boolean;
  fetchFiles: (path: string) => Promise<void>;
  fetchGitStatus: (path: string) => Promise<void>;
  getBasename: (path: string | null) => string;
  setIsNewScriptOpen: (open: boolean) => void;
  confirmDeleteFile: (file: string) => void;
  setIsWorkspacePickerOpen: (open: boolean) => void;
}

export const FileList: React.FC<FileListProps> = ({
  isSidebarOpen,
  setIsSidebarOpen,
  activePath,
  activeFile,
  setActiveFile,
  files,
  isFilesLoading,
  fetchFiles,
  fetchGitStatus,
  getBasename,
  setIsNewScriptOpen,
  confirmDeleteFile,
  setIsWorkspacePickerOpen,
}) => {
  return (
    <AnimatePresence>
      {isSidebarOpen && (
        <motion.div
          initial={{ width: 0, opacity: 0, x: -20 }}
          animate={{ width: 260, opacity: 1, x: 0 }}
          exit={{ width: 0, opacity: 0, x: -20 }}
          whileHover={{ scale: 1.01 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="absolute left-[108px] top-1/2 -translate-y-1/2 z-40 glass-panel border rounded-[2rem] overflow-hidden flex flex-col shrink-0 h-[calc(100%-8rem)] shadow-xl hover:shadow-2xl transition-shadow"
        >
          <div className="flex-1 flex flex-col min-h-0">
            <div className="p-4 flex items-center justify-between text-[11px] font-bold text-muted-foreground/40 uppercase tracking-widest border-b border-border/50">
              <span className="truncate">{activePath ? getBasename(activePath) : 'Workspace'}</span>
              <div className="flex items-center gap-1">
                {activePath && (
                  <>
                    <Tooltip>
                      <TooltipTrigger 
                        onClick={() => {
                          if (activePath) {
                            fetchFiles(activePath);
                            fetchGitStatus(activePath);
                          }
                        }} 
                        disabled={isFilesLoading}
                        className={cn(
                          buttonVariants({ variant: "ghost", size: "icon" }),
                          "h-7 w-7 rounded-lg transition-all focus-visible:ring-0",
                          isFilesLoading ? 'text-indigo-600 bg-indigo-500/10' : 'text-muted-foreground/40 hover:text-indigo-600 hover:bg-indigo-500/5'
                        )}
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isFilesLoading ? 'animate-spin' : ''}`} />
                      </TooltipTrigger>
                      <TooltipContent>Refresh Scripts</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger 
                        onClick={() => setIsNewScriptOpen(true)} 
                        className="hover:text-indigo-600 p-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </TooltipTrigger>
                      <TooltipContent>New Script</TooltipContent>
                    </Tooltip>
                  </>
                )}
                <Tooltip>
                  <TooltipTrigger 
                    onClick={() => setIsSidebarOpen(false)} 
                    className="hover:text-destructive p-1"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </TooltipTrigger>
                  <TooltipContent>Minimize</TooltipContent>
                </Tooltip>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-1 custom-scrollbar">
              {!activePath ? (
                <div className="p-8 flex flex-col items-center justify-center text-center space-y-4 h-full">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/5 flex items-center justify-center">
                    <FolderPlus className="w-6 h-6 text-indigo-400" />
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-foreground">No Folder Open</div>
                    <p className="text-[10px] text-muted-foreground/60 leading-relaxed px-4">
                      Open a folder from your computer or clone a GitHub repository to start writing.
                    </p>
                  </div>
                  <Button 
                    onClick={() => setIsWorkspacePickerOpen(true)}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-9 text-xs"
                  >
                    Open Folder
                  </Button>
                </div>
              ) : (
                files.length > 0 ? files.map((file) => (
                  <div
                    key={file}
                    className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all text-sm ${
                      activeFile === file 
                        ? 'glass-card text-foreground font-medium shadow-sm' 
                        : 'hover:bg-indigo-500/10 text-foreground/60'
                    }`}
                    onClick={() => setActiveFile(file)}
                  >
                    <div className="flex items-center gap-2 overflow-hidden px-1">
                      <FileText className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{file}</span>
                    </div>
                    <button
                      className="opacity-0 group-hover:opacity-100 h-6 w-6 flex items-center justify-center text-muted-foreground/60 hover:text-destructive rounded-md hover:bg-destructive/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        confirmDeleteFile(file);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )) : (
                  <div className="p-8 flex flex-col items-center justify-center text-center space-y-3">
                    <FileText className="w-8 h-8 text-indigo-200/50" />
                    <div className="text-xs text-muted-foreground/40 italic">
                      No scripts in this folder.
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="text-[10px]" onClick={() => setIsNewScriptOpen(true)}>
                        Create First Script
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-[10px] gap-1" 
                        onClick={() => activePath && fetchFiles(activePath)}
                        disabled={isFilesLoading}
                      >
                        <RefreshCw className={`w-3 h-3 ${isFilesLoading ? 'animate-spin' : ''}`} />
                        Reload
                      </Button>
                    </div>
                  </div>
                )
              )}
            </div>

            {activePath && (
              <div className="p-3 border-t border-border/50 bg-muted/5">
                <Button 
                  variant="ghost" 
                  className="w-full justify-start gap-2 h-9 text-xs text-muted-foreground hover:text-indigo-600 hover:bg-indigo-500/5 group transition-all"
                  onClick={() => setIsWorkspacePickerOpen(true)}
                >
                  <Folder className="w-4 h-4 text-muted-foreground/50 group-hover:text-indigo-600 transition-colors" />
                  Switch Folder
                </Button>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
