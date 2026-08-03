import React, { createContext, useContext, useRef, useState, useEffect } from 'react';
import { useSettings } from '../hooks/useSettings';
import { useWorkspace } from '../hooks/useWorkspace';
import { useEditor } from '../hooks/useEditor';

const AppContext = createContext<any>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [isSyncDialogOpen, setIsSyncDialogOpen] = useState(false);
  
  const editorRef = useRef<HTMLDivElement>(null);

  const clearEditorState = () => {
    if (editorRef.current) editorRef.current.innerHTML = '';
  };

  // Late-binding refs to break circular dependency between useWorkspace and useEditor
  const resetBlocksRef = useRef<(() => void) | null>(null);
  const initializeNewScriptRef = useRef<((id: string) => void) | null>(null);

  const settingsState = useSettings();

  const workspaceState = useWorkspace(
    settingsState.settings,
    settingsState.githubToken,
    clearEditorState,
    () => {
      if (resetBlocksRef.current) resetBlocksRef.current();
    },
    (id) => {
      if (initializeNewScriptRef.current) initializeNewScriptRef.current(id);
    }
  );

  const editorState = useEditor({
    activePath: workspaceState.activePath,
    activeFile: workspaceState.activeFile,
    projectKey: workspaceState.projectKey,
    settings: settingsState.settings,
    onSaveSuccess: () => {
      if (workspaceState.activePath) {
        workspaceState.fetchGitStatus(workspaceState.activePath);
      }
    },
    editorRef,
    setIsInitialLoading: workspaceState.setIsInitialLoading,
  });

  // Bind the refs to editor state actions
  resetBlocksRef.current = () => editorState.setBlocks([]);
  initializeNewScriptRef.current = (id) => editorState.initializeNewScript(id);

  // Global focus updates
  useEffect(() => {
    const handleFocus = () => {
      if (workspaceState.activePath) {
        workspaceState.fetchGitStatus(workspaceState.activePath);
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [workspaceState.activePath, workspaceState.fetchGitStatus]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const isMod = e.ctrlKey || e.metaKey;

      if (isMod && (e.key === 'j' || e.code === 'KeyJ')) {
        e.preventDefault();
        setIsTerminalOpen((prev) => !prev);
      }

      if (isMod && (e.key === 'o' || e.code === 'KeyO')) {
        e.preventDefault();
        workspaceState.setIsWorkspacePickerOpen(true);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [workspaceState.setIsWorkspacePickerOpen]);

  const value = {
    editorRef,
    isSidebarOpen,
    setIsSidebarOpen,
    isTerminalOpen,
    setIsTerminalOpen,
    isSyncDialogOpen,
    setIsSyncDialogOpen,
    ...settingsState,
    ...workspaceState,
    ...editorState,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
