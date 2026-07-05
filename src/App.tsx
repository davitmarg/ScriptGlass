import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Globe, 
  Link as LinkIcon, 
  Download, 
  RefreshCw, 
  Loader2 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import { useMemo, useCallback } from 'react';
import { useWorkspace } from '@/src/hooks/useWorkspace';
import { useAi } from '@/src/hooks/useAi';
import { useEditor } from '@/src/hooks/useEditor';
import { exportToPDF as runExportToPDF } from '@/src/lib/pdf-exporter';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
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
import { parseFountain } from '@/src/lib/editor-engine';
import { GitStatus, GitLogEntry, BlockType, ScriptBlock, TerminalOutput } from '@/src/types';
import { apiCall, getPlatform, isDesktop } from '@/src/lib/platform';
import { fountainToBlocks, blocksToFountain } from '@/src/lib/fountain';
import { StatusBar } from '@/src/components/layout/StatusBar';
import { TitleBar } from '@/src/components/layout/TitleBar';
import { Sidebar } from '@/src/components/layout/Sidebar';
import { FileList } from '@/src/components/editor/FileList';
import { Terminal } from '@/src/components/editor/Terminal';
import { RightSidebar } from '@/src/components/layout/RightSidebar';
import { SettingsDialog } from '@/src/components/dialogs/SettingsDialog';
import { DeleteConfirmDialog } from '@/src/components/dialogs/DeleteConfirmDialog';
import { NewScriptDialog } from '@/src/components/dialogs/NewScriptDialog';
import { FolderBrowserDialog } from '@/src/components/dialogs/FolderBrowserDialog';
import { WorkspacePickerDialog } from '@/src/components/dialogs/WorkspacePickerDialog';
import { EditorCanvas } from '@/src/components/editor/EditorCanvas';



export default function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [githubToken, setGithubToken] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [titlePage, setTitlePage] = useState({
    title: '',
    credit: 'written by',
    author: '',
    source: '',
    notes: '',
    contact: ''
  });

  const [isGitHubConnected, setIsGitHubConnected] = useState(false);
  const [syncCommitMessage, setSyncCommitMessage] = useState('');
  const [settings, setSettings] = useState({ 
    baseProjectsDir: '', 
    geminiKey: '',
    theme: (localStorage.getItem('sg_theme') || 'system') as 'light' | 'dark' | 'system'
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNewScriptOpen, setIsNewScriptOpen] = useState(false);
  const [newScriptName, setNewScriptName] = useState('');
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);
  const [activeRightTab, setActiveRightTab] = useState<'formatting' | 'outline' | 'title' | 'ai'>('formatting');

  const editorRef = useRef<HTMLDivElement>(null);

  const clearEditorState = () => {
    if (editorRef.current) editorRef.current.innerHTML = '';
    setTitlePage({
      title: '',
      credit: 'written by',
      author: '',
      source: '',
      notes: '',
      contact: ''
    });
  };

  const {
    activePath,
    setActivePath,
    files,
    setFiles,
    activeFile,
    setActiveFile,
    gitStatus,
    setGitStatus,
    isInitialLoading,
    setIsInitialLoading,
    isFilesLoading,
    setIsFilesLoading,
    projectKey,
    setProjectKey,
    recentFolders,
    setRecentFolders,
    isWorkspacePickerOpen,
    setIsWorkspacePickerOpen,
    workspaceData,
    setWorkspaceData,
    isBrowserOpen,
    setIsBrowserOpen,
    browserData,
    setBrowserData,
    fetchGitStatus,
    fetchFiles,
    fetchBrowseData,
    handleBrowseNavigate,
    handleBrowseBack,
    handleSelectFolder,
    handleOpenWorkspace,
    getBasename,
  } = useWorkspace(settings, clearEditorState, () => {
    if (editorRef.current) editorRef.current.innerHTML = '';
  });

  const {
    aiSnippet,
    setAiSnippet,
    aiOptions,
    setAiOptions,
    isAiLoading,
    copiedIndex,
    handleGetAiSuggestions,
    copyToClipboard,
  } = useAi(settings, setIsSettingsOpen);

  const {
    blocks,
    setBlocks,
    activeBlockId,
    setActiveBlockId,
    activeType,
    setActiveType,
    isSaving,
    hasUnsavedChanges,
    setHasUnsavedChanges,
    currentPage,
    setCurrentPage,
    jumpPageInput,
    setJumpPageInput,
    isEditorReady,
    wordCount,
    pageCount,
    suggestions,
    autocompleteIndex,
    setAutocompleteIndex,
    autocompleteList,
    setAutocompleteList,
    showAutocomplete,
    setShowAutocomplete,
    activeLineRect,
    setActiveLineRect,
    syncTimerRef,
    updateFormatting,
    saveToHistory,
    undo,
    redo,
    handlePaste,
    applyFormat,
    handleAutocompleteSelect,
    updateActiveTypeFromSelection,
    handleJumpToPage,
    handleSave,
    initializeNewScript,
    fetchFileContent,
  } = useEditor({
    activePath,
    activeFile,
    projectKey,
    settings,
    onSaveSuccess: () => { if (activePath) fetchGitStatus(activePath); },
    editorRef,
    setIsInitialLoading,
  });


  useEffect(() => {
    const handleFocus = () => {
      if (activePath) fetchGitStatus(activePath);
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [activePath]);

  // Handle external links & GitHub Auth Callback
  useEffect(() => {
    if (isDesktop()) {
      const handleExternalClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const anchor = target.closest('a');
        if (anchor && anchor.href && (anchor.href.startsWith('http') || anchor.href.startsWith('https'))) {
          e.preventDefault();
          // Use our IPC bridge
          apiCall('open-external-url', { body: { url: anchor.href } });
        }
      };
      document.addEventListener('click', handleExternalClick);
      
      // Listen for GitHub token from Main Process
      const cleanupToken = (window as any).electronAPI?.onGitHubToken(async (token: string) => {
        setGithubToken(token);
        setIsGitHubConnected(true);
        localStorage.setItem('sg_github_token', token);
        
        // Also persist to server settings
        try {
          await apiCall('/api/settings', {
            method: 'POST',
            body: { githubToken: token },
          });
          toast.success('GitHub account connected');
        } catch (error) {
          console.error('Failed to persist GitHub token to server');
          toast.success('GitHub account connected (local session)');
        }
      });

      return () => {
        document.removeEventListener('click', handleExternalClick);
        if (cleanupToken) cleanupToken();
      };
    }
  }, []);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const isMod = e.ctrlKey || e.metaKey;

      if (isMod && (e.key === 'j' || e.code === 'KeyJ')) {
        e.preventDefault();
        setIsTerminalOpen(prev => !prev);
      }

      if (isMod && (e.key === 'o' || e.code === 'KeyO')) {
        e.preventDefault();
        setIsWorkspacePickerOpen(true);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Load github token
  useEffect(() => {
    const savedToken = localStorage.getItem('sg_github_token');
    if (savedToken) {
      setGithubToken(savedToken);
      setIsGitHubConnected(true);
    }
  }, []);



  const exportToPDF = () => {
    runExportToPDF(blocks, titlePage, activeFile);
  };



  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.05 : 0.05;
        setZoom(prev => Math.min(Math.max(prev + delta, 0.5), 2));
      }
    };
    
    const editorContainer = document.getElementById('editor-container');
    if (editorContainer) {
      editorContainer.addEventListener('wheel', handleWheel, { passive: false });
    }
    return () => {
      if (editorContainer) {
        editorContainer.removeEventListener('wheel', handleWheel);
      }
    };
  }, []);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) {
        return;
      }
      if (event.data?.type === 'GITHUB_AUTH_SUCCESS') {
        const token = event.data.token;
        setGithubToken(token);
        setIsGitHubConnected(true);
        localStorage.setItem('sg_github_token', token);
        
        // Persist token to server
        try {
          await apiCall('/api/settings', {
            method: 'POST',
            body: { githubToken: token },
          });
          toast.success('GitHub account connected and saved');
        } catch (error) {
          console.error('Failed to persist GitHub token');
          toast.success('GitHub account connected (local session only)');
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const encodePath = (path: string) => btoa(path);



  const fetchSettings = async () => {
    try {
      const data = await apiCall('/api/settings');
      setSettings(prev => {
        const next = { ...prev };
        if (data.baseProjectsDir !== undefined) next.baseProjectsDir = data.baseProjectsDir;
        if (data.geminiKey !== undefined) next.geminiKey = data.geminiKey;
        
        // If the server has a concrete choice (light or dark), it wins.
        // If the server has 'system' or nothing, the local choice (prev.theme) wins.
        if (data.theme === 'light' || data.theme === 'dark') {
          next.theme = data.theme;
        }
        
        return next;
      });
      if (data.githubToken) {
        setGithubToken(data.githubToken);
        setIsGitHubConnected(true);
        if (!localStorage.getItem('sg_github_token')) {
          localStorage.setItem('sg_github_token', data.githubToken);
        }
      }
    } catch (error) {
      console.error('Failed to fetch settings');
    }
  };

  useEffect(() => {
    const applyTheme = () => {
      const root = window.document.documentElement;
      let effectiveTheme = settings.theme;
      
      if (settings.theme === 'system') {
        effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      
      if (effectiveTheme === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
      localStorage.setItem('sg_theme', settings.theme);
    };

    applyTheme();
    
    // Listen for system theme changes if in system mode
    if (settings.theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyTheme();
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [settings.theme]);

  useEffect(() => {
    fetchSettings();
  }, []);



  const handleUpdateSettings = async () => {
    try {
      await apiCall('/api/settings', {
        method: 'POST',
        body: settings,
      });
      toast.success('Settings updated');
      setIsSettingsOpen(false);
      fetchFiles(activePath);
    } catch (error: any) {
      toast.error(`Failed to update settings: ${error.message}`);
    }
  };



  const handleCreateFile = async () => {
    if (!activePath) {
      toast.error('Please open a folder first');
      return;
    }
    if (!newScriptName) return;
    const filename = newScriptName.endsWith('.fountain') ? newScriptName : `${newScriptName}.fountain`;
    try {
      const initialContent = '';
      const data = await apiCall(`/api/workspace/${encodePath(activePath)}/files/${filename}`, {
        method: 'POST',
        body: { content: initialContent },
      });
      
      fetchFiles(activePath);
      setActiveFile(filename);
      setIsNewScriptOpen(false);
      setNewScriptName('');
      
      const id = 'line-' + Date.now();
      initializeNewScript(id);
      
      // syncEditorFromBlocks will be handled by useEffect
      toast.success('File created');
    } catch (error: any) {
      toast.error(`Failed to create file: ${error.message}`);
    }
  };

  const handleConnectGitHub = async () => {
    try {
      const data = await apiCall('/api/auth/github/url');
      if (data.error) throw new Error(data.error);

      if (data.isElectron && (window as any).electronAPI) {
        (window as any).electronAPI.startGitHubAuth(data.url);
      } else {
        window.open(data.url, 'github_oauth', 'width=600,height=700');
      }
    } catch (error) {
      toast.error('Failed to initiate GitHub connection');
    }
  };

  const handleSync = async () => {
    if (!activePath) return;
    if (!githubToken) {
      toast.error('Please connect your GitHub account first');
      return;
    }
    setIsSyncing(true);
    try {
      const data = await apiCall(`/api/workspace/${encodePath(activePath)}/git/sync`, {
        method: 'POST',
        body: { token: githubToken, commitMessage: syncCommitMessage },
      });
      
      toast.success('Successfully pushed to GitHub');
      setSyncCommitMessage('');
      fetchGitStatus(activePath);
    } catch (error: any) {
      toast.error(`Failed to push: ${error.message}`);
      console.error(error);
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePull = async () => {
    if (!activePath) return;
    if (!githubToken) {
      toast.error('Please connect your GitHub account first');
      return;
    }
    setIsPulling(true);
    try {
      const data = await apiCall(`/api/workspace/${encodePath(activePath)}/git/pull`, {
        method: 'POST',
        body: { token: githubToken },
      });
      
      if (data.message) {
        toast.info(data.message);
      } else {
        toast.success('Successfully retrieved latest from GitHub');
      }
      
      // Small delay to ensure FS is updated
      setTimeout(() => {
        fetchFiles(activePath);
        fetchGitStatus(activePath);
        if (activeFile) {
          fetchFileContent(activePath, activeFile);
        }
      }, 500);
    } catch (error: any) {
      toast.error(`Failed to pull: ${error.message}`);
      console.error(error);
    } finally {
      setIsPulling(false);
    }
  };

  const confirmDeleteFile = (filename: string) => {
    setFileToDelete(filename);
    setIsDeleteConfirmOpen(true);
  };

  const performDeleteFile = async () => {
    if (!activePath || !fileToDelete) return;
    try {
      await apiCall(`/api/workspace/${encodePath(activePath)}/files/${fileToDelete}`, { method: 'DELETE' });
      fetchFiles(activePath);
      if (activeFile === fileToDelete) {
        setActiveFile(null);
        setBlocks([]);
      }
      toast.success('File deleted');
    } catch (error) {
      toast.error('Failed to delete file');
    } finally {
      setIsDeleteConfirmOpen(false);
      setFileToDelete(null);
    }
  };

  return (
    <TooltipProvider>
      <div className="flex flex-col h-screen w-full bg-transparent text-foreground font-sans selection:bg-yellow-200/60 overflow-hidden">
        <Toaster position="top-center" />
        
        {/* Title Bar */}
        <TitleBar
          activePath={activePath}
          activeFile={activeFile}
          hasUnsavedChanges={hasUnsavedChanges}
          exportToPDF={exportToPDF}
          hasBlocks={blocks.length > 0}
          getBasename={getBasename}
        />

        <div className="flex flex-1 overflow-hidden relative">
          {/* Terminal Pane (Left Overlay) */}
          <Terminal
            isTerminalOpen={isTerminalOpen}
            setIsTerminalOpen={setIsTerminalOpen}
            activePath={activePath}
            fetchGitStatus={fetchGitStatus}
          />

          {/* Sidebar */}
          <Sidebar
            isSidebarOpen={isSidebarOpen}
            setIsSidebarOpen={setIsSidebarOpen}
            isTerminalOpen={isTerminalOpen}
            setIsTerminalOpen={setIsTerminalOpen}
            isSaving={isSaving}
            handleSave={handleSave}
            activeFile={activeFile}
            isSyncing={isSyncing}
            isPulling={isPulling}
            isGitHubConnected={isGitHubConnected}
            setIsGitHubConnected={setIsGitHubConnected}
            githubToken={githubToken}
            setGithubToken={setGithubToken}
            activePath={activePath}
            getBasename={getBasename}
            handleConnectGitHub={handleConnectGitHub}
            syncCommitMessage={syncCommitMessage}
            setSyncCommitMessage={setSyncCommitMessage}
            isFilesLoading={isFilesLoading}
            fetchFiles={fetchFiles}
            handlePull={handlePull}
            handleSync={handleSync}
            isSettingsOpen={isSettingsOpen}
            setIsSettingsOpen={setIsSettingsOpen}
          />

          {/* File List (Conditional) */}
          <FileList
            isSidebarOpen={isSidebarOpen}
            setIsSidebarOpen={setIsSidebarOpen}
            activePath={activePath}
            activeFile={activeFile}
            setActiveFile={setActiveFile}
            files={files}
            isFilesLoading={isFilesLoading}
            fetchFiles={fetchFiles}
            fetchGitStatus={fetchGitStatus}
            getBasename={getBasename}
            setIsNewScriptOpen={setIsNewScriptOpen}
            confirmDeleteFile={confirmDeleteFile}
            setIsWorkspacePickerOpen={setIsWorkspacePickerOpen}
          />

          {/* Editor Canvas */}
          <EditorCanvas
            editorRef={editorRef}
            activePath={activePath}
            projectKey={projectKey}
            zoom={zoom}
            isInitialLoading={isInitialLoading}
            activeFile={activeFile}
            syncTimerRef={syncTimerRef}
            showAutocomplete={showAutocomplete}
            setShowAutocomplete={setShowAutocomplete}
            activeLineRect={activeLineRect}
            autocompleteList={autocompleteList}
            autocompleteIndex={autocompleteIndex}
            setAutocompleteIndex={setAutocompleteIndex}
            updateFormatting={updateFormatting}
            setHasUnsavedChanges={setHasUnsavedChanges}
            updateActiveTypeFromSelection={updateActiveTypeFromSelection}
            setBlocks={setBlocks}
            saveToHistory={saveToHistory}
            handlePaste={handlePaste}
            handleSave={handleSave}
            undo={undo}
            redo={redo}
            setActiveType={setActiveType}
            handleAutocompleteSelect={handleAutocompleteSelect}
            setIsNewScriptOpen={setIsNewScriptOpen}
          />

          <RightSidebar
            isRightSidebarOpen={isRightSidebarOpen}
            setIsRightSidebarOpen={setIsRightSidebarOpen}
            activeRightTab={activeRightTab}
            setActiveRightTab={setActiveRightTab}
            activeType={activeType}
            setActiveType={setActiveType}
            applyFormat={applyFormat}
            aiSnippet={aiSnippet}
            setAiSnippet={setAiSnippet}
            handleGetAiSuggestions={handleGetAiSuggestions}
            isAiLoading={isAiLoading}
            aiOptions={aiOptions}
            copyToClipboard={copyToClipboard}
            copiedIndex={copiedIndex}
            blocks={blocks}
            activeBlockId={activeBlockId}
            setActiveBlockId={setActiveBlockId}
            titlePage={titlePage}
            setTitlePage={setTitlePage}
          />
        </div>

        {/* Status Bar */}
        <StatusBar
          gitStatus={gitStatus}
          isGitHubConnected={isGitHubConnected}
          jumpPageInput={jumpPageInput}
          setJumpPageInput={setJumpPageInput}
          currentPage={currentPage}
          handleJumpToPage={handleJumpToPage}
          pageCount={pageCount}
          wordCount={wordCount}
        />

        {/* Settings Dialog */}
        <SettingsDialog
          isOpen={isSettingsOpen}
          onOpenChange={setIsSettingsOpen}
          settings={settings}
          setSettings={setSettings}
          onSave={handleUpdateSettings}
        />

        {/* Workspace Picker Dialog */}
        <WorkspacePickerDialog
          isOpen={isWorkspacePickerOpen}
          onOpenChange={setIsWorkspacePickerOpen}
          workspaceData={workspaceData}
          setWorkspaceData={setWorkspaceData}
          recentFolders={recentFolders}
          getBasename={getBasename}
          settings={settings}
          onOpenBrowser={() => {
            setIsBrowserOpen(true);
            fetchBrowseData(workspaceData.path);
          }}
          onOpenWorkspace={handleOpenWorkspace}
        />

        {/* Folder Browser Dialog */}
        <FolderBrowserDialog
          isOpen={isBrowserOpen}
          onOpenChange={setIsBrowserOpen}
          browserData={browserData}
          onNavigate={handleBrowseNavigate}
          onBack={handleBrowseBack}
          onSelect={handleSelectFolder}
        />

        {/* Delete Confirmation Dialog */}
        <DeleteConfirmDialog
          isOpen={isDeleteConfirmOpen}
          onOpenChange={setIsDeleteConfirmOpen}
          fileToDelete={fileToDelete}
          onConfirm={performDeleteFile}
        />


        {/* New Script Dialog */}
        <NewScriptDialog
          isOpen={isNewScriptOpen}
          onOpenChange={setIsNewScriptOpen}
          activePath={activePath}
          getBasename={getBasename}
          newScriptName={newScriptName}
          setNewScriptName={setNewScriptName}
          onCreate={handleCreateFile}
        />
      </div>
    </TooltipProvider>
  );
}
