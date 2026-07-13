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
import { apiCall } from '@/src/lib/platform';

interface SettingsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  settings: {
    baseProjectsDir: string;
    geminiKey: string;
    theme: 'light' | 'dark' | 'system';
  };
  setSettings: (settings: any) => void;
  onSave: () => void;
}

export const SettingsDialog: React.FC<SettingsDialogProps> = ({
  isOpen,
  onOpenChange,
  settings,
  setSettings,
  onSave,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure your workspace preferences.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="baseDir" className="text-[10px] uppercase tracking-wider text-foreground/60 font-bold mb-1">Default Projects Location</Label>
            <Input 
              id="baseDir" 
              value={settings.baseProjectsDir}
              onChange={(e) => setSettings({ ...settings, baseProjectsDir: e.target.value })}
              placeholder="/path/to/your/projects"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="geminiKey" className="text-[10px] uppercase tracking-wider text-foreground/60 font-bold mb-1">Gemini API Key</Label>
            <Input 
              id="geminiKey" 
              type="password"
              value={settings.geminiKey}
              onChange={(e) => setSettings({ ...settings, geminiKey: e.target.value })}
              placeholder="Paste your API key here"
            />
            <p className="text-[10px] text-muted-foreground">
              Required for AI Enhance features. Your key is stored locally in your browser.
            </p>
          </div>
          <div className="grid gap-2">
            <Label className="text-[10px] uppercase tracking-wider text-foreground/60 font-bold mb-1">Theme</Label>
            <div className="flex bg-indigo-50/50 dark:bg-white/5 rounded-lg p-1 gap-1">
              {(['light', 'dark', 'system'] as const).map((t) => (
                <button
                  key={t}
                  onClick={async () => {
                    const newSettings = { ...settings, theme: t };
                    setSettings(newSettings);
                    // Save immediately to server as well
                    try {
                      await apiCall('/api/settings', {
                        method: 'POST',
                        body: newSettings,
                      });
                    } catch (e) {
                      console.error("Failed to sync theme to server", e);
                    }
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-medium transition-all ${
                    settings.theme === t 
                      ? 'bg-white dark:bg-indigo-500 text-indigo-600 dark:text-white shadow-sm' 
                      : 'text-muted-foreground hover:text-indigo-900 dark:hover:text-gray-200'
                  }`}
                >
                  <span className="capitalize">{t === 'system' ? 'Same as system' : t}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onSave}>Save Settings</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
