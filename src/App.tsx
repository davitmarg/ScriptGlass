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
  const [blocks, setBlocks] = useState<ScriptBlock[]>([]);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<BlockType>('action');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [githubToken, setGithubToken] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [isEditorReady, setIsEditorReady] = useState(false);
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
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [history, setHistory] = useState<{ blocks: ScriptBlock[]; selection: { blockId: string | null; offset: number } }[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const clearEditorState = () => {
    setBlocks([]);
    setIsEditorReady(false);
    if (editorRef.current) editorRef.current.innerHTML = '';
    currentEditorFile.current = null;
    setHistory([]);
    setHistoryIndex(-1);
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
  } = useWorkspace(settings, clearEditorState, () => setBlocks([]));

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

  const [currentPage, setCurrentPage] = useState(1);
  const [jumpPageInput, setJumpPageInput] = useState('1');


  const currentEditorFile = useRef<string | null>(null);

  const [autocompleteIndex, setAutocompleteIndex] = useState(0);
  const [autocompleteList, setAutocompleteList] = useState<string[]>([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [activeLineRect, setActiveLineRect] = useState<DOMRect | null>(null);

  const editorRef = useRef<HTMLDivElement>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);


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

  const suggestions = useMemo(() => {
    const characters = new Set<string>();
    const locations = new Set<string>(['INT. ', 'EXT. ', 'INT./EXT. ', 'EST. ']);
    const transitions = new Set<string>(['FADE IN:', 'CUT TO:', 'FADE OUT:', 'DISSOLVE TO:', 'MATCH CUT TO:', 'SMASH CUT TO:']);
    const shots = new Set<string>(['ANGLE ON', 'CLOSE UP', 'EXTREME CLOSE UP', 'WIDE SHOT', 'POV', 'TRACKING SHOT', 'AERIAL SHOT']);

    blocks.forEach(block => {
      if (block.type === 'character') {
        const char = block.content.trim().toUpperCase();
        if (char) characters.add(char);
      }
      if (block.type === 'scene') {
        const loc = block.content.trim().toUpperCase();
        if (loc) locations.add(loc);
      }
      if (block.type === 'transition') {
        const trans = block.content.trim().toUpperCase();
        if (trans) transitions.add(trans);
      }
      if (block.type === 'shot') {
        const s = block.content.trim().toUpperCase();
        if (s) shots.add(s);
      }
    });

    return {
      characters: Array.from(characters).sort(),
      locations: Array.from(locations).sort(),
      transitions: Array.from(transitions).sort(),
      shots: Array.from(shots).sort()
    };
  }, [blocks]);

  const { wordCount, pageCount } = useMemo(() => {
    let words = 0;
    let lines = 0;
    let pages = 1;
    const maxLinesPerPage = 54;
    
    // Create a dummy jsPDF instance for calculations
    // We use a try-catch because jsPDF might not be available during SSR if that ever happens
    try {
      const doc = new jsPDF({ unit: 'in', format: 'letter' });
      doc.setFont('courier', 'normal');
      doc.setFontSize(12);

      blocks.forEach((block, index) => {
        const text = block.content.trim();
        if (text) {
          words += text.split(/\s+/).filter(Boolean).length;
        }
        
        let width = 6.0; // Default for Scene/Action
        if (block.type === 'character') width = 3.8;
        else if (block.type === 'parenthetical') width = 2.0;
        else if (block.type === 'dialogue') width = 3.5;
        else if (block.type === 'transition') width = 2.0;
        
        if (block.type === 'character' || block.type === 'scene') {
          doc.setFont('courier', 'bold');
        } else {
          doc.setFont('courier', 'normal');
        }
        
        const splitText = doc.splitTextToSize(block.content, width);
        const blockLines = splitText.length;
        
        // Add spacing before blocks
        let spacing = 1;
        if (index === 0) spacing = 0;
        else if (block.type === 'dialogue' || block.type === 'parenthetical') spacing = 0;
        else if (blocks[index-1].type === 'character' && (block.type === 'parenthetical' || block.type === 'dialogue')) spacing = 0;
        else if (blocks[index-1].type === 'parenthetical' && block.type === 'dialogue') spacing = 0;
        
        if (lines + spacing + blockLines > maxLinesPerPage) {
          pages++;
          lines = blockLines;
        } else {
          lines += spacing + blockLines;
        }
      });
    } catch (e) {
      console.error('PDF calculation error', e);
    }
    
    return { wordCount: words, pageCount: blocks.length === 0 ? 0 : pages };
  }, [blocks]);

  const exportToPDF = () => {
    runExportToPDF(blocks, titlePage, activeFile);
  };

  const updateFormatting = (forceSyncState = false) => {
    if (!editorRef.current) return [];
    
    const editor = editorRef.current;
    let needsDirectSync = false;

    // Phase 1: Wrap any "orphaned" nodes (text nodes, loose BR tags, or non-script-line elements)
    // This ensures every piece of content is contained within a properly tagged div.
    const nodes = Array.from(editor.childNodes) as Node[];
    nodes.forEach(node => {
      const isScriptLine = node instanceof HTMLElement && node.classList.contains('script-line');
      
      if (!isScriptLine) {
        // Skip purely whitespace nodes that aren't content
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent || '';
          if (text.trim() === '' && text !== '') {
            // These are likely just formatting newlines between divs
          }
        }

        const div = document.createElement('div');
        div.id = 'block-' + Math.random().toString(36).substring(2, 11);
        div.className = 'script-line script-action';
        
        if (node.nodeType === Node.TEXT_NODE) {
          div.textContent = node.textContent;
          editor.replaceChild(div, node);
          needsDirectSync = true;
        } else if (node instanceof HTMLElement) {
          const htmlEl = node as HTMLElement;
          if (htmlEl.tagName === 'BR') {
            div.innerHTML = '<br>';
          } else {
            div.innerHTML = htmlEl.innerHTML || htmlEl.textContent || '<br>';
          }
          editor.replaceChild(div, node);
          needsDirectSync = true;
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          // Fallback for other element types
          const el = node as HTMLElement;
          div.innerHTML = el.innerHTML || el.textContent || '<br>';
          editor.replaceChild(div, node);
          needsDirectSync = true;
        }
      }
    });

    if (needsDirectSync) {
      // If we did wrapping, the DOM changed and we should update references before proceeding
    }

      // Phase 2: Extract blocks from the now-normalized DOM
    const editorLines = Array.from(editor.children) as HTMLElement[];
    const newBlocks: ScriptBlock[] = [];
    const seenIds = new Set<string>();

    editorLines.forEach((lineEl) => {
      // Normalize line element structure
      if (!lineEl.id) lineEl.id = 'block-' + Math.random().toString(36).substring(2, 11);
      
      let rawText = lineEl.innerText;
      // innerText often appends a newline in contenteditable
      if (rawText.endsWith('\n')) rawText = rawText.slice(0, -1);
      
      const subLines = rawText.split('\n');
      
      subLines.forEach((text, subIdx) => {
        let type: BlockType = 'action';
        let content = text.trim();
        const forcedScene = content.startsWith('.');
        const naturalScene = /^(INT|EXT|INT\/EXT|INT\.\/EXT\.|I\/E|EST|SCENE|SHOT)([. ]|$)/i.test(content);

        if (content.startsWith('!')) {
          type = 'action';
          content = content.substring(1).trim();
        }
        else if (content.startsWith('~')) {
          type = 'dialogue';
          content = content.substring(1).trim();
        }
        else if (forcedScene || naturalScene) {
          type = 'scene';
          if (forcedScene) {
            // Strip the dot for the editor view
            content = content.substring(1).trim();
          }
        } 
        else if (content.startsWith('>') || content.toUpperCase().endsWith(' TO:')) {
          type = 'transition';
        }
        else if (content.startsWith('(') && content.endsWith(')')) {
          type = 'parenthetical';
        }
        else if (content.startsWith('@')) {
          type = 'character';
        }
        else if (content === content.toUpperCase() && content.length > 0 && !/^\d+$/.test(content)) {
          type = 'character';
        }
        else if (content.length > 0) {
          let j = newBlocks.length - 1;
          if (j >= 0) {
            const prev = newBlocks[j];
            if ((prev.type === 'character' || prev.type === 'parenthetical' || prev.type === 'dialogue') && prev.content.trim() !== '') {
              type = 'dialogue';
            }
          }
        }

        // Handle manual override
        const manualType = lineEl.getAttribute('data-type') as BlockType;
        if (manualType) {
          type = manualType;
        }

        let id = subIdx === 0 ? lineEl.id : '';
        if (!id || seenIds.has(id)) {
          id = 'block-' + Math.random().toString(36).substring(2, 11);
          if (subIdx === 0) lineEl.id = id;
        }
        seenIds.add(id);
        
        newBlocks.push({ id, type, content });
      });
    });

    // Check if we need to split blocks (internal newlines found)
    const hasSubLines = editorLines.some(line => {
      const text = line.innerText;
      return text.length > 0 && text.includes('\n', 0) && text.lastIndexOf('\n') < text.length - 1;
    });
    
    if (hasSubLines) {
      const selection = window.getSelection();
      let offset = 0;
      let focusNodeId = '';
      
      if (selection && selection.anchorNode) {
        let currentNode: Node | null = selection.anchorNode;
        while (currentNode && !(currentNode instanceof HTMLElement && currentNode.id)) {
          currentNode = currentNode.parentNode;
        }
        if (currentNode instanceof HTMLElement && currentNode.id) {
          focusNodeId = currentNode.id;
          offset = selection.anchorOffset;
        }
      }

      syncEditorFromBlocks(newBlocks);

      if (focusNodeId) {
        const el = document.getElementById(focusNodeId);
        if (el) {
          const range = document.createRange();
          const sel = window.getSelection();
          const node = el.firstChild || el;
          try {
            const finalOffset = Math.min(offset, node.textContent?.length || 0);
            range.setStart(node, finalOffset);
            range.collapse(true);
            sel?.removeAllRanges();
            sel?.addRange(range);
          } catch(e) {
            setTimeout(() => {
              const retryEl = document.getElementById(focusNodeId);
              if (retryEl) {
                const retryNode = retryEl.firstChild || retryEl;
                try {
                  const retryRange = document.createRange();
                  const retrySel = window.getSelection();
                  retryRange.setStart(retryNode, Math.min(offset, retryNode.textContent?.length || 0));
                  retryRange.collapse(true);
                  retrySel?.removeAllRanges();
                  retrySel?.addRange(retryRange);
                } catch(e2) {}
              }
            }, 0);
          }
        }
      }
    } else {
      // Sync classes for existing elements
      editorLines.forEach((lineEl, i) => {
        const block = newBlocks.find(b => b.id === lineEl.id) || newBlocks[i];
        if (block) {
          const type = block.type;
          const targetClass = `script-line script-${type} ${type === 'character' ? 'font-bold' : ''}`;
          if (lineEl.className !== targetClass) {
            lineEl.className = targetClass;
          }
          if (lineEl.getAttribute('data-type') !== type) {
            lineEl.setAttribute('data-type', type);
          }
        }
      });
    }

    if (forceSyncState) {
      setBlocks(newBlocks);
      saveToHistory(newBlocks);
    }
    return newBlocks;
  };

  useEffect(() => {
    if (activeFile && editorRef.current && blocks.length > 0) {
      // Periodic safety check: if the editor is empty but we have blocks, sync them.
      // Most syncing now happens DIRECTLY in fetchFileContent for speed and reliability.
      if (editorRef.current.children.length === 0) {
        syncEditorFromBlocks(blocks);
      }
    } else if (!activeFile && editorRef.current) {
      editorRef.current.innerHTML = '';
      currentEditorFile.current = null;
    }
  }, [activeFile, blocks]);

  const saveToHistory = (newBlocks: ScriptBlock[]) => {
    const sel = window.getSelection();
    let blockId = null;
    let offset = 0;
    if (sel && sel.rangeCount > 0) {
      let node = sel.anchorNode;
      while (node && (node.nodeType !== 1 || !(node as HTMLElement).classList.contains('script-line'))) {
        node = node.parentElement;
        if (node === editorRef.current || !node) break;
      }
      if (node && (node as HTMLElement).classList.contains('script-line')) {
        blockId = (node as HTMLElement).id;
        offset = sel.anchorOffset;
      }
    }

    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ blocks: JSON.parse(JSON.stringify(newBlocks)), selection: { blockId, offset } });
    if (newHistory.length > 50) newHistory.shift();
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const restoreSelection = (selection: { blockId: string | null; offset: number }) => {
    if (!selection.blockId) return;
    setTimeout(() => {
      const el = document.getElementById(selection.blockId!);
      if (el) {
        el.focus();
        const sel = window.getSelection();
        if (sel) {
          const range = document.createRange();
          let textNode = el.firstChild;
          if (!textNode) {
            // If empty, just focus the element
            return;
          }
          const finalOffset = Math.min(selection.offset, textNode.textContent?.length || 0);
          try {
            range.setStart(textNode, finalOffset);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
          } catch (e) {
            // Fallback
            range.selectNodeContents(el);
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
          }
        }
      }
    }, 0);
  };

  const syncEditorFromBlocks = (newBlocks: ScriptBlock[]) => {
    if (editorRef.current) {
      editorRef.current.innerHTML = newBlocks.map(b => {
        const content = b.content === '' ? '<br>' : b.content;
        return `<div id="${b.id}" class="script-line script-${b.type} ${b.type === 'character' ? 'font-bold' : ''}" data-type="${b.type}">${content}</div>`;
      }).join('');
    }
  };

  const undo = () => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      const item = history[prevIndex];
      setBlocks(JSON.parse(JSON.stringify(item.blocks)));
      setHistoryIndex(prevIndex);
      syncEditorFromBlocks(item.blocks);
      restoreSelection(item.selection);
      toast.info('Undo');
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      const item = history[nextIndex];
      setBlocks(JSON.parse(JSON.stringify(item.blocks)));
      setHistoryIndex(nextIndex);
      syncEditorFromBlocks(item.blocks);
      restoreSelection(item.selection);
      toast.info('Redo');
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
    // Force sync state on paste to ensure and update correctly
    updateFormatting(true);
    updateActiveTypeFromSelection();
  };



  const updateBlock = (id: string, updates: Partial<ScriptBlock>) => {
    const newBlocks = blocks.map(b => b.id === id ? { ...b, ...updates } : b);
    setBlocks(newBlocks);
    saveToHistory(newBlocks);
  };

  const applyFormat = (type: BlockType, blockId?: string) => {
    let el: HTMLElement | null = null;
    
    if (blockId) {
      el = document.getElementById(blockId);
    } else {
      // Try to find the element where the cursor is
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        let node = sel.anchorNode;
        while (node && (node.nodeType !== 1 || !(node as HTMLElement).classList.contains('script-line'))) {
          node = node.parentElement;
          if (node === editorRef.current || !node) break;
        }
        if (node && (node as HTMLElement).classList.contains('script-line')) {
          el = node as HTMLElement;
        }
      }
      
      // Fallback to activeBlockId
      if (!el && activeBlockId) {
        el = document.getElementById(activeBlockId);
      }
    }

    if (el) {
      el.setAttribute('data-type', type);
      setActiveType(type);
      const newBlocks = updateFormatting();
      saveToHistory(newBlocks);
      // Refocus just in case
      el.focus();
    }
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



  useEffect(() => {
    if (activePath && activeFile) {
      localStorage.setItem(`sg_last_file_${activePath}`, activeFile);
      fetchFileContent(activePath, activeFile);
      setIsEditorReady(false);
    }
  }, [activePath, activeFile, projectKey]);

  const handleAutocompleteSelect = (value: string) => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      let node = sel.anchorNode;
      while (node && (node.nodeType !== 3 && !(node as HTMLElement).classList.contains('script-line'))) {
        node = node.parentElement;
        if (node === editorRef.current || !node) break;
      }
      if (node) {
        (node as HTMLElement).textContent = value;
        setShowAutocomplete(false);
        updateFormatting(true);
        // Move cursor to end
        const range = document.createRange();
        const textNode = (node as HTMLElement).firstChild || node;
        range.selectNodeContents(textNode);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
  };

  const updateActiveTypeFromSelection = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    let node = sel.anchorNode;
    if (!node) return;
    
    const offset = sel.anchorOffset;
    if (node.nodeType === 3) node = node.parentElement;
    
    let current = node;
    while (current && current !== editorRef.current) {
      if (current.nodeType === 1 && (current as HTMLElement).classList.contains('script-line')) {
        const id = (current as HTMLElement).id;
        const type = (current as HTMLElement).getAttribute('data-type') as BlockType;
        const text = (current as HTMLElement).textContent || '';

        if (id) {
          setActiveBlockId(id);
          // Save persistence info
          if (activeFile && activePath) {
            const container = document.getElementById('editor-container');
            const lines = Array.from(editorRef.current?.children || []);
            const index = lines.indexOf(current as HTMLElement);

            const persistenceData = {
              blockId: id,
              blockIndex: index,
              offset: offset,
              scrollTop: container?.scrollTop || 0,
              timestamp: Date.now()
            };
            const fileKey = `${activePath}/${activeFile}`;
            localStorage.setItem(`sg_cursor_${fileKey}`, JSON.stringify(persistenceData));
          }
        }
        if (type) setActiveType(type || 'general');
        setActiveLineRect((current as HTMLElement).getBoundingClientRect());

        if (type === 'character' || type === 'scene' || type === 'transition' || type === 'shot') {
          let list: string[] = [];
          if (type === 'character') list = suggestions.characters;
          else if (type === 'scene') list = suggestions.locations;
          else if (type === 'transition') list = suggestions.transitions;
          else if (type === 'shot') list = suggestions.shots;

          if (type === 'scene') {
            const defaultTimes = ['DAY', 'NIGHT', 'MOMENTS LATER', 'CONTINUOUS', 'AFTERNOON', 'EVENING', 'LATER'];
            
            // Check for hyphen to suggest times of day specifically
            const lastHyphenIndex = text.lastIndexOf(' - ');
            if (lastHyphenIndex !== -1) {
              const base = text.substring(0, lastHyphenIndex + 3);
              const suffixSearch = text.substring(lastHyphenIndex + 3).toUpperCase();
              const filteredTimes = defaultTimes
                .filter(t => t.startsWith(suffixSearch) && t !== suffixSearch)
                .map(t => base + t);
              
              if (filteredTimes.length > 0) {
                setAutocompleteList(filteredTimes);
                setShowAutocomplete(true);
                setAutocompleteIndex(0);
                return;
              }
            }

            if (text.length === 0) {
              const defaultIntros = ['INT. ', 'EXT. ', 'INT./EXT. ', 'EST. '];
              setAutocompleteList(defaultIntros);
              setShowAutocomplete(true);
              setAutocompleteIndex(0);
              return;
            }
          }

          const filtered = list.filter(s => s.startsWith(text.toUpperCase()) && s !== text.toUpperCase());
          if (filtered.length > 0 && text.length > 0) {
            setAutocompleteList(filtered);
            setShowAutocomplete(true);
            setAutocompleteIndex(0);
          } else {
            setShowAutocomplete(false);
          }
        } else {
          setShowAutocomplete(false);
        }

        // Calculate current page based on index of current line
        const lineIndex = blocks.findIndex(b => b.id === id);
        if (lineIndex !== -1) {
          let lines = 0;
          let pages = 1;
          const maxLinesPerPage = 54;
          
          try {
            const doc = new jsPDF({ unit: 'in', format: 'letter' });
            doc.setFont('courier', 'normal');
            doc.setFontSize(12);

            for (let i = 0; i <= lineIndex; i++) {
              const block = blocks[i];
              
              let width = 6.0;
              if (block.type === 'character') width = 3.8;
              else if (block.type === 'parenthetical') width = 2.0;
              else if (block.type === 'dialogue') width = 3.5;
              else if (block.type === 'transition') width = 2.0;
              
              const splitText = doc.splitTextToSize(block.content, width);
              const blockLines = splitText.length;
              
              let spacing = 1;
              if (i === 0) spacing = 0;
              else if (block.type === 'dialogue' || block.type === 'parenthetical') spacing = 0;
              else if (blocks[i-1].type === 'character' && (block.type === 'parenthetical' || block.type === 'dialogue')) spacing = 0;
              else if (blocks[i-1].type === 'parenthetical' && block.type === 'dialogue') spacing = 0;
              
              if (lines + spacing + blockLines > maxLinesPerPage) {
                pages++;
                lines = blockLines;
              } else {
                lines += spacing + blockLines;
              }
            }
            setCurrentPage(pages);
          } catch (e) {}
        }
        return;
      }
      current = current.parentElement;
    }
    setShowAutocomplete(false);
  }, [suggestions, activeBlockId, activeType]);

  useEffect(() => {
    document.addEventListener('selectionchange', updateActiveTypeFromSelection);
    return () => document.removeEventListener('selectionchange', updateActiveTypeFromSelection);
  }, [updateActiveTypeFromSelection]);

  useEffect(() => {
    setJumpPageInput(currentPage.toString());
  }, [currentPage]);

  const handleJumpToPage = useCallback(() => {
    const pageNum = parseInt(jumpPageInput);
    if (isNaN(pageNum) || pageNum < 1 || pageNum > pageCount) {
      setJumpPageInput(currentPage.toString());
      return;
    }

    let currentLines = 0;
    let currentPages = 1;
    const maxLinesPerPage = 54;
    let targetBlockId = blocks[0]?.id;

    try {
      const doc = new jsPDF({ unit: 'in', format: 'letter' });
      doc.setFont('courier', 'normal');
      doc.setFontSize(12);

      for (let i = 0; i < blocks.length; i++) {
        if (currentPages === pageNum) {
          targetBlockId = blocks[i].id;
          break;
        }

        const block = blocks[i];
        let width = 6.0;
        if (block.type === 'character') width = 3.8;
        else if (block.type === 'parenthetical') width = 2.0;
        else if (block.type === 'dialogue') width = 3.5;
        else if (block.type === 'transition') width = 2.0;
        
        const splitText = doc.splitTextToSize(block.content, width);
        const blockLines = splitText.length;
        
        let spacing = 1;
        if (i === 0) spacing = 0;
        else if (block.type === 'dialogue' || block.type === 'parenthetical') spacing = 0;
        else if (blocks[i-1].type === 'character' && (block.type === 'parenthetical' || block.type === 'dialogue')) spacing = 0;
        else if (blocks[i-1].type === 'parenthetical' && block.type === 'dialogue') spacing = 0;
        
        if (currentLines + spacing + blockLines > maxLinesPerPage) {
          currentPages++;
          currentLines = blockLines;
        } else {
          currentLines += spacing + blockLines;
        }
      }
    } catch (e) {}

    if (targetBlockId) {
      setActiveBlockId(targetBlockId);
      setTimeout(() => {
        const el = document.getElementById(targetBlockId);
        const container = document.getElementById('editor-container');
        if (el && container) {
          // Calculate target scroll position manually to avoid shifting the entire app layout
          const containerRect = container.getBoundingClientRect();
          const elRect = el.getBoundingClientRect();
          const relativeTop = elRect.top - containerRect.top + container.scrollTop;
          
          container.scrollTo({
            top: relativeTop - 100, // Show with some top padding
            behavior: 'auto'
          });

          el.focus({ preventScroll: true });
          
          // Set cursor at the end
          const range = document.createRange();
          const sel = window.getSelection();
          if (sel) {
            range.selectNodeContents(el);
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
          }
        }
      }, 50);
    }
  }, [jumpPageInput, pageCount, currentPage, blocks]);



  const fetchFileContent = async (absPath: string, filename: string) => {
    try {
      const data = await apiCall(`/api/workspace/${encodePath(absPath)}/files/${filename}`);
      const loadedBlocks = fountainToBlocks(data.content || '');
      
      // Update state
      setBlocks(loadedBlocks);
      setHistory([{ blocks: JSON.parse(JSON.stringify(loadedBlocks)), selection: { blockId: loadedBlocks[0]?.id || null, offset: 0 } }]);
      setHistoryIndex(0);
      setActiveBlockId(loadedBlocks[0]?.id || null);
      if (loadedBlocks[0]) setActiveType(loadedBlocks[0].type);
      
      // CRITICAL: Direct DOM sync. Don't wait for useEffect.
      // This ensures the editor is populated the moment the data arrives.
      if (editorRef.current) {
        syncEditorFromBlocks(loadedBlocks);
        currentEditorFile.current = filename;
        
        // Restore cursor position if exists
        const fileKey = `${absPath}/${filename}`;
        const saved = localStorage.getItem(`sg_cursor_${fileKey}`);
        let restored = false;
        
        if (saved) {
          restored = true;
          try {
            const { blockId, blockIndex, offset, scrollTop } = JSON.parse(saved);
            
            setTimeout(() => {
              let el = document.getElementById(blockId);
              if (!el && blockIndex !== undefined && editorRef.current) {
                el = editorRef.current.children[blockIndex] as HTMLElement;
              }

              if (el) {
                el.focus();
                const range = document.createRange();
                const sel = window.getSelection();
                if (sel) {
                  const textNode = el.firstChild || el;
                  const finalOffset = Math.min(offset || 0, el.textContent?.length || 0);
                  try {
                    if (textNode.nodeType === 3) {
                      range.setStart(textNode, finalOffset);
                    } else {
                      range.selectNodeContents(el);
                    }
                    range.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(range);
                  } catch (e) {}
                }
                
                const container = document.getElementById('editor-container');
                if (container && scrollTop !== undefined) {
                  container.scrollTop = scrollTop;
                }
              } else {
                // Element not found fallback
                const lastEl = editorRef.current?.lastElementChild as HTMLElement;
                if (lastEl) {
                  lastEl.focus();
                  lastEl.scrollIntoView({ behavior: 'smooth', block: 'end' });
                }
              }
            }, 60);
          } catch (e) {
            console.error('Failed to restore cursor position', e);
            restored = false;
          }
        }

        if (!restored) {
          // Auto-focus last line and scroll to bottom ONLY if no saved position
          setTimeout(() => {
            const el = editorRef.current?.lastElementChild as HTMLElement;
            if (el) {
              el.focus();
              const range = document.createRange();
              const sel = window.getSelection();
              if (sel) {
                range.selectNodeContents(el);
                range.collapse(false);
                sel.removeAllRanges();
                sel.addRange(range);
              }
              // Ensure smooth scroll to the newly focused last line
              el.scrollIntoView({ behavior: 'smooth', block: 'end' });
            }
          }, 100);
        }
      }

      setIsInitialLoading(false);
      setIsEditorReady(true);
    } catch (error) {
      toast.error('Failed to fetch file content');
      const initialBlocks = [{ id: Math.random().toString(36).substr(2, 9), type: 'action' as BlockType, content: '' }];
      setBlocks(initialBlocks);
      setIsInitialLoading(false);
    }
  };



  const handleUpdateSettings = async () => {
    try {
      const data = await apiCall('/api/settings', {
        method: 'POST',
        body: settings,
      });
      toast.success('Settings updated');
      setIsSettingsOpen(false);
      fetchFiles(activePath); // Re-fetch from new location if needed, but works on abs paths now
    } catch (error: any) {
      toast.error(`Failed to update settings: ${error.message}`);
    }
  };

  const handleSave = async () => {
    if (!activePath || !activeFile || !editorRef.current) return;
    setIsSaving(true);
    try {
      // Re-parse current editor content to ensure we have the latest blocks
      const latestBlocks = updateFormatting(true);
      const fountainContent = blocksToFountain(latestBlocks);
      await apiCall(`/api/workspace/${encodePath(activePath)}/files/${activeFile}`, {
        method: 'POST',
        body: { content: fountainContent },
      });
      setHasUnsavedChanges(false);
      toast.success('Saved locally');
      if (activePath) fetchGitStatus(activePath);
    } catch (error) {
      toast.error('Failed to save');
    } finally {
      setIsSaving(false);
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
      const initialBlocks: ScriptBlock[] = [{ id, type: 'scene', content: '' }];
      setBlocks(initialBlocks);
      setActiveBlockId(id);
      setActiveType('scene');
      setHistory([{ blocks: initialBlocks, selection: { blockId: id, offset: 0 } }]);
      setHistoryIndex(0);
      
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
