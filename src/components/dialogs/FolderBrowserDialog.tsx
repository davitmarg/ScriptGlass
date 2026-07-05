import React from 'react';
import { Folder, ChevronLeft } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface FolderBrowserDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  browserData: {
    currentPath: string;
    parentPath: string;
    directories: string[];
    sep: string;
    isRoot?: boolean;
  };
  onNavigate: (dir: string) => void;
  onBack: () => void;
  onSelect: () => void;
}

export const FolderBrowserDialog: React.FC<FolderBrowserDialogProps> = ({
  isOpen,
  onOpenChange,
  browserData,
  onNavigate,
  onBack,
  onSelect,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>Select Folder</DialogTitle>
          <DialogDescription>
            Navigate to the directory you want to open as your workspace.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-hidden flex flex-col gap-4 p-6">
          <div className="flex items-center gap-2 p-2 bg-secondary rounded-lg border border-border overflow-hidden shrink-0">
            <Folder className="w-4 h-4 text-primary shrink-0" />
            <span className="text-[11px] font-mono text-foreground truncate" title={browserData.currentPath}>
              {browserData.currentPath || 'Loading...'}
            </span>
          </div>
          
          <div className="flex flex-col border rounded-lg flex-1 min-h-[300px] max-h-[450px] overflow-hidden bg-card shadow-inner">
            <div className="p-2 border-b bg-muted/30 flex items-center justify-between shrink-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Directories</span>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 text-[10px] px-2 font-bold"
                onClick={onBack}
                disabled={browserData.currentPath === 'ROOT'}
              >
                <ChevronLeft className="w-3 h-3 mr-1" />
                Back
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-1 custom-scrollbar">
              {(browserData.directories || []).length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground italic">
                  No subdirectories found
                </div>
              ) : (
                (browserData.directories || []).map((dir) => (
                  <button
                    key={dir}
                    onClick={() => onNavigate(dir)}
                    className="w-full text-left text-xs px-3 py-2 rounded-md hover:bg-primary/10 hover:text-primary flex items-center gap-3 transition-colors group text-foreground"
                  >
                    <Folder className="w-3.5 h-3.5 text-primary/40 group-hover:text-primary" />
                    <span className="truncate">{dir}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
        <DialogFooter className="p-6 pt-0 gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onSelect} className="bg-primary hover:bg-primary/90 text-white">
            Select This Folder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
