import React, { useState, useEffect, useRef } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { useWorkspace } from '@/src/hooks/useWorkspace';
import { useAi } from '@/src/hooks/useAi';
import { useEditor } from '@/src/hooks/useEditor';
import { useSettings } from '@/src/hooks/useSettings';
import { exportToPDF as runExportToPDF } from '@/src/lib/pdf-exporter';
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
  const [zoom, setZoom] = useState(1);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);
  const [activeRightTab, setActiveRightTab] = useState<'formatting' | 'outline' | 'title' | 'ai'>('formatting');
  const [titlePage, setTitlePage] = useState({
    title: '',
    credit: 'written by',
    author: '',
    source: '',
    notes: '',
    contact: ''
  });

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
    settings,
    setSettings,
    isSettingsOpen,
    setIsSettingsOpen,
    githubToken,
    setGithubToken,
    isGitHubConnected,
    setIsGitHubConnected,
    handleUpdateSettings,
    handleConnectGitHub
  } = useSettings();

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

    // File creation / deletion
    isNewScriptOpen,
    setIsNewScriptOpen,
    newScriptName,
    setNewScriptName,
    isDeleteConfirmOpen,
    setIsDeleteConfirmOpen,
    fileToDelete,
    setFileToDelete,
    handleCreateFile,
    confirmDeleteFile,
    performDeleteFile,

    // Git Operations
    isSyncing,
    isPulling,
    syncCommitMessage,
    setSyncCommitMessage,
    handleSync,
    handlePull
  } = useWorkspace(
    settings,
    githubToken,
    clearEditorState,
    () => setBlocks([]),
    (id) => initializeNewScript(id)
  );

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

  const encodePath = (path: string) => btoa(path);

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
          onSave={() => handleUpdateSettings(fetchFiles, activePath)}
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
