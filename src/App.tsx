import React from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { AppProvider } from '@/src/contexts/AppContext';
import { StatusBar } from '@/src/components/layout/StatusBar';
import { TitleBar } from '@/src/components/layout/TitleBar';
import { Sidebar } from '@/src/components/layout/Sidebar';
import { FileList } from '@/src/components/editor/FileList';
import { Terminal } from '@/src/components/editor/Terminal';
import { RightSidebar } from '@/src/components/layout/RightSidebar';
import { WorkspacePickerDialog } from '@/src/components/dialogs/WorkspacePickerDialog';
import { EditorCanvas } from '@/src/components/editor/EditorCanvas';

function AppContent() {
  return (
    <div className="flex flex-col h-screen w-full bg-transparent text-foreground font-sans selection:bg-yellow-200/60 overflow-hidden">
      <Toaster position="top-center" />
      
      {/* Title Bar */}
      <TitleBar />

      <div className="flex flex-1 overflow-hidden relative">
        {/* Terminal Pane (Left Overlay) */}
        <Terminal />

        {/* Sidebar */}
        <Sidebar />

        {/* File List (Conditional) */}
        <FileList />

        {/* Editor Canvas */}
        <EditorCanvas />

        {/* Right Sidebar */}
        <RightSidebar />
      </div>

      {/* Status Bar */}
      <StatusBar />

      {/* Workspace Picker Dialog */}
      <WorkspacePickerDialog />
    </div>
  );
}

export default function App() {
  return (
    <TooltipProvider>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </TooltipProvider>
  );
}
