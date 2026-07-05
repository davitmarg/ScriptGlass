import React from 'react';
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

interface NewScriptDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  activePath: string | null;
  getBasename: (path: string | null) => string;
  newScriptName: string;
  setNewScriptName: (name: string) => void;
  onCreate: () => void;
}

export const NewScriptDialog: React.FC<NewScriptDialogProps> = ({
  isOpen,
  onOpenChange,
  activePath,
  getBasename,
  newScriptName,
  setNewScriptName,
  onCreate,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Script</DialogTitle>
          <DialogDescription>
            Create a new Fountain script in folder: <strong>{getBasename(activePath)}</strong>
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="scriptName" className="text-[10px] uppercase tracking-wider text-foreground/60 font-bold mb-1">Script Name</Label>
            <Input 
              id="scriptName" 
              placeholder="e.g. pilot_episode" 
              value={newScriptName}
              onChange={(e) => setNewScriptName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newScriptName) onCreate();
              }}
            />
            <p className="text-[10px] text-muted-foreground">
              The .fountain extension will be added automatically.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onCreate} disabled={!newScriptName}>
            Create Script
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
