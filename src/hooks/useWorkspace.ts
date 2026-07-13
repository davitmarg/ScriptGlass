import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { apiCall } from '@/src/lib/platform';

const encodePath = (path: string) => btoa(path);
const getBasename = (path: string | null) => {
  if (!path) return '';
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || parts[parts.length - 2] || path;
};

export const useWorkspace = (
  settings: { baseProjectsDir: string },
  githubToken: string,
  onClearEditor: () => void,
  onResetBlocks: () => void,
  onFileCreated: (id: string) => void
) => {
  const [activePath, setActivePath] = useState<string | null>(null);
  const [files, setFiles] = useState<string[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [gitStatus, setGitStatus] = useState<any>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [isFilesLoading, setIsFilesLoading] = useState(false);
  const [projectKey, setProjectKey] = useState(0);
  const [recentFolders, setRecentFolders] = useState<string[]>([]);
  const [isWorkspacePickerOpen, setIsWorkspacePickerOpen] = useState(false);
  const [workspaceData, setWorkspaceData] = useState({ path: '', type: 'open' as 'open' | 'clone' | 'create', url: '', name: '' });
  const [isBrowserOpen, setIsBrowserOpen] = useState(false);
  const [browserData, setBrowserData] = useState({
    currentPath: '',
    parentPath: '',
    directories: [] as string[],
    sep: '/',
    isRoot: false
  });

  // File Creation & Deletion Dialog States
  const [isNewScriptOpen, setIsNewScriptOpen] = useState(false);
  const [newScriptName, setNewScriptName] = useState('');
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);

  // Git Status Sync & Pull States
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [syncCommitMessage, setSyncCommitMessage] = useState('');

  const fetchGitStatus = async (absPath: string) => {
    try {
      const data = await apiCall(`/api/workspace/${encodePath(absPath)}/git/status`);
      setGitStatus(data);
    } catch (error) {
      console.error('Failed to fetch git status');
    }
  };

  const fetchFiles = async (absPath: string) => {
    setIsFilesLoading(true);
    try {
      const data = await apiCall(`/api/workspace/${encodePath(absPath)}/files`);
      const filesList = Array.isArray(data) ? data : [];
      setFiles(filesList);
      if (filesList.length > 0) {
        const lastFileKey = `sg_last_file_${absPath}`;
        const savedLastFile = localStorage.getItem(lastFileKey);
        if (savedLastFile && filesList.includes(savedLastFile)) {
          setActiveFile(savedLastFile);
        } else if (!activeFile || !filesList.includes(activeFile)) {
          setActiveFile(filesList[0]);
        }
      } else {
        setActiveFile(null);
        onResetBlocks();
        setIsInitialLoading(false);
      }
    } catch (error) {
      toast.error('Failed to fetch files');
    } finally {
      setIsFilesLoading(false);
    }
  };

  const fetchBrowseData = async (targetPath?: string) => {
    try {
      const url = targetPath ? `/api/browse?path=${encodeURIComponent(targetPath)}` : '/api/browse';
      const data = await apiCall(url);
      if (data.error) {
        toast.error(data.error);
        return;
      }
      setBrowserData(data);
    } catch (error) {
      console.error('Browse error:', error);
      toast.error(`Failed to browse: ${error instanceof Error ? error.message : 'Unknown error'}`);
      if (targetPath && targetPath !== 'ROOT') {
        fetchBrowseData('ROOT');
      }
    }
  };

  const handleBrowseNavigate = (dir: string) => {
    let newPath = '';
    if (browserData.currentPath === 'ROOT') {
      newPath = dir;
    } else {
      newPath = browserData.currentPath.endsWith(browserData.sep) 
        ? `${browserData.currentPath}${dir}` 
        : `${browserData.currentPath}${browserData.sep}${dir}`;
    }
    fetchBrowseData(newPath);
  };

  const handleBrowseBack = () => {
    if (browserData.parentPath) {
      fetchBrowseData(browserData.parentPath);
    }
  };

  const handleSelectFolder = () => {
    setWorkspaceData({ ...workspaceData, path: browserData.currentPath });
    setIsBrowserOpen(false);
  };

  const addToRecentFolders = (path: string) => {
    const filtered = [path, ...recentFolders.filter(x => x !== path)].slice(0, 5);
    setRecentFolders(filtered);
    localStorage.setItem('sg_recent_folders', JSON.stringify(filtered));
  };

  const handleOpenWorkspace = async (manualPath?: string | React.MouseEvent | React.KeyboardEvent) => {
    try {
      const isManualPath = typeof manualPath === 'string';
      let folderPath = isManualPath ? manualPath : workspaceData.path;
      
      if (!isManualPath) {
        const base = settings.baseProjectsDir || '';
        if (workspaceData.type === 'create') {
          const name = workspaceData.name || 'Untitled';
          folderPath = base ? (base.endsWith('/') || base.endsWith('\\') ? `${base}${name}` : `${base}/${name}`) : name;
        } else if (workspaceData.type === 'clone' && !folderPath) {
          if (!workspaceData.url) {
            toast.error('Please provide a repository URL');
            return;
          }
          const urlSegments = workspaceData.url.split('/');
          const repoName = urlSegments[urlSegments.length - 1]?.split('?')[0]?.replace('.git', '') || 'cloned-repo';
          folderPath = base ? (base.endsWith('/') || base.endsWith('\\') ? `${base}${repoName}` : `${base}/${repoName}`) : repoName;
        }
      }

      if (!folderPath) {
        if (!isManualPath) toast.error('Please provide a folder path');
        return;
      }

      const data = await apiCall('/api/workspace/open', {
        method: 'POST',
        body: { 
          folderPath: folderPath,
          type: isManualPath ? 'open' : workspaceData.type,
          url: workspaceData.url 
        },
      });
      setActivePath(data.path);
      setProjectKey(prev => prev + 1);
      if (data.path && data.path !== 'undefined' && data.path !== 'null') {
        localStorage.setItem('sg_last_path', data.path);
        addToRecentFolders(data.path);
      }
      setIsWorkspacePickerOpen(false);
      setWorkspaceData({ path: '', type: 'open', url: '', name: '' });

      if (!isManualPath) {
        toast.success(
          workspaceData.type === 'clone' ? 'Repository cloned and opened' : 
          workspaceData.type === 'create' ? 'Folder created and opened' : 'Folder opened'
        );
      }
    } catch (error: any) {
      if (typeof manualPath !== 'string') {
        toast.error(`Failed to handle workspace: ${error.message}`);
      } else {
        console.warn(`Last session path "${manualPath}" ignored: ${error.message}`);
      }
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
      await apiCall(`/api/workspace/${encodePath(activePath)}/files/${filename}`, {
        method: 'POST',
        body: { content: initialContent },
      });
      
      await fetchFiles(activePath);
      setActiveFile(filename);
      setIsNewScriptOpen(false);
      setNewScriptName('');
      
      const id = 'line-' + Date.now();
      onFileCreated(id);
      toast.success('File created');
    } catch (error: any) {
      toast.error(`Failed to create file: ${error.message}`);
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
      await fetchFiles(activePath);
      if (activeFile === fileToDelete) {
        setActiveFile(null);
        onResetBlocks();
      }
      toast.success('File deleted');
    } catch (error) {
      toast.error('Failed to delete file');
    } finally {
      setIsDeleteConfirmOpen(false);
      setFileToDelete(null);
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
      await apiCall(`/api/workspace/${encodePath(activePath)}/git/sync`, {
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
      
      setTimeout(() => {
        fetchFiles(activePath);
        fetchGitStatus(activePath);
      }, 500);
    } catch (error: any) {
      toast.error(`Failed to pull: ${error.message}`);
      console.error(error);
    } finally {
      setIsPulling(false);
    }
  };

  // Load last session and recent history
  useEffect(() => {
    const lastPath = localStorage.getItem('sg_last_path');
    const recentsRaw = localStorage.getItem('sg_recent_folders');
    let recents = [];
    try {
      recents = JSON.parse(recentsRaw || '[]');
      if (!Array.isArray(recents)) recents = [];
    } catch {
      recents = [];
    }
    setRecentFolders(recents);

    if (lastPath && lastPath !== 'undefined' && lastPath !== 'null') {
      setTimeout(() => {
        handleOpenWorkspace(lastPath);
      }, 500);
    }
  }, []);

  useEffect(() => {
    onClearEditor();
    if (activePath) {
      setIsInitialLoading(true);
      fetchFiles(activePath);
      fetchGitStatus(activePath);
    } else {
      setFiles([]);
      setIsInitialLoading(false);
    }
  }, [activePath, projectKey]);

  return {
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
  };
};
