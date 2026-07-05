import React from 'react';
import { Download, Minus, Square, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isDesktop } from '@/src/lib/platform';

interface TitleBarProps {
  activePath: string | null;
  activeFile: string | null;
  hasUnsavedChanges: boolean;
  exportToPDF: () => void;
  hasBlocks: boolean;
  getBasename: (path: string | null) => string;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  activePath,
  activeFile,
  hasUnsavedChanges,
  exportToPDF,
  hasBlocks,
  getBasename,
}) => {
  return (
    <div 
      className="h-[38px] glass-panel border-b flex items-center px-4 shrink-0 select-none z-50 overflow-hidden" 
      style={{ WebkitAppRegion: 'drag' } as any}
    >
      {/* Mac-style Window Controls (Left) - Hidden on Windows Desktop */}
      {(!navigator.platform.includes('Win') || !isDesktop()) && (
        <div className="flex gap-2 mr-6 shrink-0" style={{ WebkitAppRegion: 'no-drag' } as any}>
          <button 
            onClick={() => isDesktop() && (window as any).electronAPI.close()}
            className={`w-3 h-3 rounded-full transition-colors ${isDesktop() ? 'bg-red-400/80 hover:bg-red-500 cursor-pointer' : 'bg-indigo-900/10'}`} 
          />
          <button 
            onClick={() => isDesktop() && (window as any).electronAPI.minimize()}
            className={`w-3 h-3 rounded-full transition-colors ${isDesktop() ? 'bg-amber-400/80 hover:bg-amber-500 cursor-pointer' : 'bg-indigo-900/10'}`} 
          />
          <button 
            onClick={() => isDesktop() && (window as any).electronAPI.maximize()}
            className={`w-3 h-3 rounded-full transition-colors ${isDesktop() ? 'bg-emerald-400/80 hover:bg-emerald-500 cursor-pointer' : 'bg-indigo-900/10'}`} 
          />
        </div>
      )}

      <div className="text-[12px] font-semibold text-foreground/60 flex-1 flex items-center gap-2 overflow-hidden tracking-wider">
        <span className="shrink-0 uppercase">ScriptGlass</span>
        {activePath && (
          <>
            <span className="opacity-40 shrink-0">/</span>
            <span className="text-foreground/80 truncate max-w-[200px]">{getBasename(activePath)}</span>
          </>
        )}
        {activeFile && (
          <>
            <span className="opacity-40 shrink-0">/</span>
            <span className="text-foreground font-bold flex items-center gap-2 truncate font-mono">
              {activeFile}
              {hasUnsavedChanges && <span className="text-indigo-600 dark:text-indigo-400 drop-shadow-sm shrink-0">*</span>}
            </span>
          </>
        )}
      </div>

      <div className="flex items-center" style={{ WebkitAppRegion: 'no-drag' } as any}>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-7 text-[10px] uppercase tracking-widest font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:bg-indigo-50/50 dark:hover:bg-indigo-500/10 gap-2 mr-2"
          onClick={exportToPDF}
          disabled={!activeFile || !hasBlocks}
        >
          <Download className="w-3.5 h-3.5" />
          Export PDF
        </Button>

        {/* Windows-style Window Controls (Right) */}
        {navigator.platform.includes('Win') && isDesktop() && (
          <div className="flex h-full border-l border-border/50">
            <button 
              onClick={() => (window as any).electronAPI.minimize()} 
              className="px-4 h-[38px] flex items-center justify-center hover:bg-secondary text-muted-foreground/50 hover:text-foreground transition-colors"
            >
              <Minus className="w-4 h-4" />
            </button>
            <button 
              onClick={() => (window as any).electronAPI.maximize()} 
              className="px-4 h-[38px] flex items-center justify-center hover:bg-secondary/80 text-muted-foreground/50 hover:text-foreground transition-colors"
            >
              <Square className="w-3 h-3" />
            </button>
            <button 
              onClick={() => (window as any).electronAPI.close()} 
              className="px-4 h-[38px] flex items-center justify-center hover:bg-destructive text-muted-foreground/50 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
