import React from 'react';
import { GitBranch } from 'lucide-react';
import { useApp } from '@/src/contexts/AppContext';

export const StatusBar: React.FC = () => {
  const {
    gitStatus,
    isGitHubConnected,
    jumpPageInput,
    setJumpPageInput,
    currentPage,
    handleJumpToPage,
    pageCount,
    wordCount,
    setIsSyncDialogOpen,
  } = useApp();
  return (
    <footer className="h-[28px] glass-panel border-t flex items-center justify-between px-4 text-[11px] text-foreground/60 shrink-0">
      <div className="flex items-center gap-5">
        <div 
          className="flex items-center gap-1.5 text-foreground font-medium cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors" 
          title={gitStatus?.isRepo ? (gitStatus.status?.files?.length > 0 ? "Uncommitted changes" : gitStatus.status?.ahead > 0 ? "Unpushed changes" : "Up to date") : "Not a git repository"}
          onClick={() => setIsSyncDialogOpen(true)}
        >
          <GitBranch className={`w-3.5 h-3.5 ${isGitHubConnected ? (gitStatus?.isRepo ? 'text-indigo-600 dark:text-indigo-400' : 'text-muted-foreground/40') : 'text-muted-foreground/20'}`} />
          <span className="flex items-center">
            {!isGitHubConnected ? (
              <span className="text-muted-foreground/40 font-normal italic select-none">GitHub Disconnected</span>
            ) : !gitStatus?.isRepo ? (
              <span className="text-muted-foreground/40 font-normal italic select-none">No Git Repo</span>
            ) : (
              <>
                <span className="max-w-[80px] truncate">{gitStatus.branch || 'main'}</span>
                {(gitStatus.status?.files?.length > 0 || (gitStatus.status?.ahead || 0) > 0) && (
                  <span className="ml-1 w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                )}
              </>
            )}
          </span>
        </div>
        <div className="flex items-center gap-1.5 min-w-[120px]">
          <span>Page</span>
          <input
            type="text"
            value={jumpPageInput}
            onChange={(e) => setJumpPageInput(e.target.value)}
            onBlur={() => setJumpPageInput(currentPage.toString())}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleJumpToPage();
                (e.target as HTMLInputElement).blur();
              }
            }}
            className="w-10 h-6 bg-transparent border-b border-border/50 hover:border-indigo-400 focus:border-indigo-500 text-center outline-none transition-all font-medium pt-0.5 text-foreground"
          />
          <span className="opacity-60">of {pageCount}</span>
        </div>
        <span>{wordCount} words</span>
      </div>
      
      <div className="flex items-center gap-5">
        <span>UTF-8</span>
        <span>Fountain 1.1</span>
      </div>
    </footer>
  );
};
