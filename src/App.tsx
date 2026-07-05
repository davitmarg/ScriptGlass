import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, 
  Folder, 
  FolderPlus,
  CloudUpload, 
  Plus, 
  Trash2, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  Globe, 
  Link as LinkIcon, 
  Download, 
  RefreshCw, 
  Loader2, 
  Type, 
  List, 
  Layout, 
  Sparkles, 
  Copy, 
  Check 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import { useMemo, useCallback } from 'react';
import { GoogleGenAI } from "@google/genai";
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
import { StatusBar } from '@/src/components/StatusBar';
import { TitleBar } from '@/src/components/TitleBar';
import { Sidebar } from '@/src/components/Sidebar';



export default function App() {
  const [activePath, setActivePath] = useState<string | null>(null);
  const [files, setFiles] = useState<string[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<ScriptBlock[]>([]);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<BlockType>('action');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [githubToken, setGithubToken] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [isFilesLoading, setIsFilesLoading] = useState(false);
  const [isEditorReady, setIsEditorReady] = useState(false);
  const [projectKey, setProjectKey] = useState(0);
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
  const [isWorkspacePickerOpen, setIsWorkspacePickerOpen] = useState(false);
  const [workspaceData, setWorkspaceData] = useState({ path: '', type: 'open' as 'open' | 'clone' | 'create', url: '', name: '' });
  const [recentFolders, setRecentFolders] = useState<string[]>([]);
  const [isNewScriptOpen, setIsNewScriptOpen] = useState(false);
  const [newScriptName, setNewScriptName] = useState('');
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);
  const [activeRightTab, setActiveRightTab] = useState<'formatting' | 'outline' | 'title' | 'ai'>('formatting');
  const [aiSnippet, setAiSnippet] = useState('');
  const [aiOptions, setAiOptions] = useState<string[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [history, setHistory] = useState<{ blocks: ScriptBlock[]; selection: { blockId: string | null; offset: number } }[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [terminalOutput, setTerminalOutput] = useState<TerminalOutput[]>([]);
  const [terminalInput, setTerminalInput] = useState('');
  const [terminalHistory, setTerminalHistory] = useState<string[]>([]);
  const [terminalHistoryIndex, setTerminalHistoryIndex] = useState(-1);
  const [isBrowserOpen, setIsBrowserOpen] = useState(false);
  const [browserData, setBrowserData] = useState<{ currentPath: string; parentPath: string; directories: string[]; sep: string; isRoot?: boolean }>({
    currentPath: '',
    parentPath: '',
    directories: [],
    sep: '/',
    isRoot: false
  });

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
      // Fallback to ROOT if stuck
      if (targetPath && targetPath !== 'ROOT') {
        fetchBrowseData('ROOT');
      }
    }
  };

  const handleBrowseNavigate = (dir: string) => {
    let newPath = '';
    
    if (browserData.currentPath === 'ROOT') {
      // dir already contains drive letter and separator
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
  const [currentPage, setCurrentPage] = useState(1);
  const [jumpPageInput, setJumpPageInput] = useState('1');
  const currentEditorFile = useRef<string | null>(null);

  const [autocompleteIndex, setAutocompleteIndex] = useState(0);
  const [autocompleteList, setAutocompleteList] = useState<string[]>([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [activeLineRect, setActiveLineRect] = useState<DOMRect | null>(null);

  const editorRef = useRef<HTMLDivElement>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const terminalScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (terminalScrollRef.current) {
      terminalScrollRef.current.scrollTop = terminalScrollRef.current.scrollHeight;
    }
  }, [terminalOutput]);

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

    const savedToken = localStorage.getItem('sg_github_token');
    if (savedToken) {
      setGithubToken(savedToken);
      setIsGitHubConnected(true);
    }

    if (lastPath && lastPath !== 'undefined' && lastPath !== 'null') {
      // Small timeout to allow basic init
      setTimeout(() => {
        handleOpenWorkspace(lastPath);
      }, 500);
    }
  }, []);

  const addToRecentFolders = (path: string) => {
    const recents = JSON.parse(localStorage.getItem('sg_recent_folders') || '[]');
    const filtered = [path, ...recents.filter((p: string) => p !== path)].slice(0, 3);
    setRecentFolders(filtered);
    localStorage.setItem('sg_recent_folders', JSON.stringify(filtered));
  };

  const executeTerminalCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!terminalInput.trim()) return;

    const cmd = terminalInput.trim();
    setTerminalOutput(prev => [...prev, { type: 'command', content: cmd }]);
    setTerminalHistory(prev => [cmd, ...prev.filter(c => c !== cmd)].slice(0, 50));
    setTerminalHistoryIndex(-1);
    setTerminalInput('');

    try {
      const data = await apiCall('/api/terminal/exec', {
        method: 'POST',
        body: { command: cmd, activePath }
      });
      
      if (data.stdout) setTerminalOutput(prev => [...prev, { type: 'stdout', content: data.stdout }]);
      if (data.stderr) setTerminalOutput(prev => [...prev, { type: 'stderr', content: data.stderr }]);
      if (data.error) setTerminalOutput(prev => [...prev, { type: 'error', content: data.error }]);
      
      if (activePath) {
        fetchGitStatus(activePath);
      }
    } catch (err) {
      setTerminalOutput(prev => [...prev, { type: 'error', content: String(err) }]);
    }
  };

  const getShortPath = (path: string) => {
    if (!path) return '';
    const parts = path.split(/[/\\]/);
    if (parts.length <= 2) return path;
    return `.../${parts.slice(-2).join('/')}`;
  };

  const handleTerminalKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (terminalHistory.length > 0) {
        const nextIndex = terminalHistoryIndex + 1;
        if (nextIndex < terminalHistory.length) {
          setTerminalHistoryIndex(nextIndex);
          setTerminalInput(terminalHistory[nextIndex]);
        }
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (terminalHistoryIndex > 0) {
        const nextIndex = terminalHistoryIndex - 1;
        setTerminalHistoryIndex(nextIndex);
        setTerminalInput(terminalHistory[nextIndex]);
      } else if (terminalHistoryIndex === 0) {
        setTerminalHistoryIndex(-1);
        setTerminalInput('');
      }
    } else if (e.ctrlKey && (e.key === 'l' || e.code === 'KeyL')) {
      e.preventDefault();
      setTerminalOutput([]);
    } else if (e.ctrlKey && (e.key === 'c' || e.code === 'KeyC')) {
      e.preventDefault();
      setTerminalInput('');
    }
  };

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
    try {
      const doc = new jsPDF({ unit: 'in', format: 'letter' });
      doc.setFont('courier', 'normal');
      doc.setFontSize(12);
      
      // Title Page logic
      if (titlePage.title || titlePage.author) {
        // Vertical center approximately
        let titleY = 4.0;
        
        if (titlePage.title) {
          doc.setFont('courier', 'bold');
          const titleLines = doc.splitTextToSize(titlePage.title, 5.0);
          titleLines.forEach((line: string) => {
            doc.text(line, 4.25, titleY, { align: 'center' });
            titleY += 0.25;
          });
          titleY += 0.5;
        }
        
        doc.setFont('courier', 'normal');
        if (titlePage.credit) {
          doc.text(titlePage.credit, 4.25, titleY, { align: 'center' });
          titleY += 0.25;
        }
        
        if (titlePage.author) {
          doc.text(titlePage.author, 4.25, titleY, { align: 'center' });
        }
        
        if (titlePage.source) {
          doc.text(titlePage.source, 4.25, titleY + 0.5, { align: 'center' });
        }
        
        if (titlePage.contact) {
          doc.setFontSize(10);
          const contactLines = doc.splitTextToSize(titlePage.contact, 3.0);
          doc.text(contactLines, 1.0, 10.0);
          doc.setFontSize(12);
        }
        
        doc.addPage();
      }

      let y = 1.0; // Start at top margin
      const bottomMargin = 10.0;
      const lineHeight = 1/6;

      blocks.forEach((block, index) => {
        let x = 1.5;
        let width = 6.0;
        let align = 'left';
        
        if (block.type === 'character') { 
          x = 3.7; 
          width = 3.8; 
          doc.setFont('courier', 'bold');
        } else if (block.type === 'scene') {
          doc.setFont('courier', 'bold');
        } else if (block.type === 'parenthetical') { 
          x = 3.1; 
          width = 2.0; 
          doc.setFont('courier', 'normal');
        } else if (block.type === 'dialogue') { 
          x = 2.5; 
          width = 3.5; 
          doc.setFont('courier', 'normal');
        } else if (block.type === 'transition') { 
          x = 5.5; 
          width = 2.0; 
          align = 'right'; 
          doc.setFont('courier', 'normal');
        } else {
          doc.setFont('courier', 'normal');
        }
        
        const splitText = doc.splitTextToSize(block.content, width);
        const blockHeight = splitText.length * lineHeight;
        
        // Spacing
        let spacing = lineHeight;
        if (index === 0) spacing = 0;
        else if (block.type === 'dialogue' || block.type === 'parenthetical') spacing = 0;
        else if (blocks[index-1].type === 'character' && (block.type === 'parenthetical' || block.type === 'dialogue')) spacing = 0;
        else if (blocks[index-1].type === 'parenthetical' && block.type === 'dialogue') spacing = 0;

        if (y + spacing + blockHeight > bottomMargin) {
          doc.addPage();
          y = 1.0;
          spacing = 0;
        }
        
        y += spacing;
        
        splitText.forEach((line: string) => {
          if (align === 'right') {
            doc.text(line, 7.5, y, { align: 'right' });
          } else {
            doc.text(line, x, y);
          }
          y += lineHeight;
        });
      });
      
      doc.save(`${activeFile?.replace('.fountain', '') || 'script'}.pdf`);
      toast.success('Script exported to PDF');
    } catch (error) {
      console.error('Export failed', error);
      toast.error('Failed to export PDF');
    }
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

  const getBasename = (pathStr: string | null) => {
    if (!pathStr) return '';
    const parts = pathStr.split(/[/\\]/);
    return parts[parts.length - 1] || parts[parts.length - 2] || pathStr;
  };

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
    setActiveFile(null);
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
    if (activePath) {
      setIsInitialLoading(true);
      fetchFiles(activePath);
      fetchGitStatus(activePath);
    } else {
      setFiles([]);
      setIsInitialLoading(false);
    }
  }, [activePath, projectKey]);

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

   const fetchFiles = async (absPath: string) => {
    setIsFilesLoading(true);
    try {
      const data = await apiCall(`/api/workspace/${encodePath(absPath)}/files`);
      const filesList = Array.isArray(data) ? data : [];
      setFiles(filesList);
      if (filesList.length > 0) {
        const lastFileKey = `sg_last_file_${absPath}`;
        const savedLastFile = localStorage.getItem(lastFileKey);
        
        // If we have a saved file and it's still in the list, use it.
        // Otherwise, if we don't have an active file or it's gone, default to the first one.
        if (savedLastFile && filesList.includes(savedLastFile)) {
          setActiveFile(savedLastFile);
        } else if (!activeFile || !filesList.includes(activeFile)) {
          setActiveFile(filesList[0]);
        }
      } else {
        setActiveFile(null);
        setBlocks([]);
        setIsInitialLoading(false);
      }
    } catch (error) {
      toast.error('Failed to fetch files');
    } finally {
      setIsFilesLoading(false);
    }
  };

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

  const fetchGitStatus = async (absPath: string) => {
    try {
      const data = await apiCall(`/api/workspace/${encodePath(absPath)}/git/status`);
      setGitStatus(data);
    } catch (error) {
      console.error('Failed to fetch git status');
    }
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

  const handleGetAiSuggestions = async () => {
    if (!aiSnippet.trim()) return;
    if (!settings.geminiKey) {
      toast.error("Please add your Gemini API Key in Settings");
      setIsSettingsOpen(true);
      return;
    }

    setIsAiLoading(true);
    setAiOptions([]);

    try {
      const trimmedKey = settings.geminiKey.trim();
      if (!trimmedKey) {
        toast.error("Please add your Gemini API Key in Settings");
        setIsSettingsOpen(true);
        return;
      }

      const ai = new GoogleGenAI({ apiKey: trimmedKey });
      const prompt = `You are a professional Hollywood script doctor. 
Enhance the following screenplay snippet. Provide 3 distinct variations that are better aligned with standard screenwriting conventions, tight dialogue, and evocative action descriptions.

CRITICAL INSTRUCTIONS:
- Do NOT add scene headings (sluglines), transitions, or any character names if not present in the input.
- Maintain the EXACT element type. If the input is dialogue, output ONLY enhanced dialogue. If it is action, output ONLY enhanced action.
- Do NOT add any surrounding context or framing.
- Return ONLY a valid JSON array of exactly 3 strings.

Snippet:
"${aiSnippet}"`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });
      
      const rawText = response.text || '[]';
      // Sanitize response to ensure it's just the JSON array
      const jsonMatch = rawText.match(/\[[\s\S]*\]/);
      const text = jsonMatch ? jsonMatch[0] : rawText;
      
      try {
        const parsed = JSON.parse(text);
        setAiOptions(Array.isArray(parsed) ? parsed : []);
      } catch (parseError) {
        console.error("JSON Parsing Error:", parseError, "Raw Text:", rawText);
        // Fallback: If it's not a JSON array, maybe it's just text?
        // But we expect JSON. Let's try to extract if it looks like an array.
        toast.error("AI returned malformed data. Please try again.");
      }
    } catch (error: any) {
      console.error(error);
      toast.error("Failed to get AI suggestions. Check your API key.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedIndex(null), 2000);
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
          <AnimatePresence>
            {isTerminalOpen && (
              <motion.div
                initial={{ width: 0, opacity: 0, x: -20 }}
                animate={{ width: 500, opacity: 1, x: 0 }}
                exit={{ width: 0, opacity: 0, x: -20 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="absolute left-[112px] top-1/2 -translate-y-1/2 z-50 glass-panel border rounded-[2.5rem] overflow-hidden flex flex-col shadow-2xl h-[calc(100%-8rem)]"
              >
                <div className="flex items-center justify-between px-6 py-1.5 border-b border-indigo-200/10 dark:border-border/50 bg-indigo-50/20 dark:bg-muted/30 backdrop-blur-md">
                  <div className="flex items-center gap-3 text-[10px] text-indigo-600/60 dark:text-muted-foreground/50 uppercase tracking-[1px] font-bold">
                    <span className="text-indigo-600 dark:text-foreground/40">Terminal</span>
                    <span className="opacity-30">|</span>
                    <span className="normal-case opacity-60 font-mono text-[9px] truncate max-w-[200px]">{activePath || 'no-workspace'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button 
                      className="p-1.5 hover:bg-destructive/10 rounded-lg text-muted-foreground/40 hover:text-destructive transition-colors group"
                      onClick={() => {
                        setTerminalOutput([]);
                      }}
                      title="Clear Terminal"
                    >
                      <Trash2 className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                    </button>
                    <button 
                      className="p-1.5 hover:bg-indigo-500/10 rounded-lg text-muted-foreground/40 hover:text-foreground transition-colors" 
                      onClick={() => setIsTerminalOpen(false)}
                      title="Minimize"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex-1 flex flex-col overflow-hidden bg-white/95 dark:bg-indigo-950/20 backdrop-blur-md">
                  <div 
                    ref={terminalScrollRef}
                    className="flex-1 overflow-y-auto p-6 font-mono text-[11px] selection:bg-indigo-100 dark:selection:bg-primary/30 scrollbar-hide text-indigo-900/70 dark:text-foreground/70"
                    onClick={() => {
                      const input = document.getElementById('terminal-input');
                      if (input) input.focus();
                    }}
                  >
                    {terminalOutput.map((line, i) => (
                      <div key={i} className={`whitespace-pre-wrap mb-0.5 ${
                        line.type === 'command' ? 'text-indigo-950 dark:text-foreground font-bold' :
                        line.type === 'stderr' ? 'text-amber-600' :
                        line.type === 'error' ? 'text-red-600' : 'text-indigo-900/60 dark:text-foreground/70'
                      }`}>
                        {line.type === 'command' && (
                          <span className="text-indigo-600 dark:text-indigo-400 mr-2 font-bold">
                            <span className="opacity-40">[{getShortPath(activePath)}]</span>
                            <span className="ml-1">$</span>
                          </span>
                        )}
                        {line.content}
                      </div>
                    ))}
                    
                    <form 
                      onSubmit={executeTerminalCommand}
                      className="mt-1 flex items-center gap-0"
                    >
                      <span className="text-indigo-600 dark:text-indigo-400 shrink-0 font-bold mr-2 whitespace-nowrap">
                        <span className="opacity-40 font-mono tracking-tighter">[{getShortPath(activePath || 'sg')}]</span>
                        <span className="ml-1 font-black shadow-sm">$</span>
                      </span>
                      <input
                        id="terminal-input"
                        value={terminalInput}
                        onChange={(e) => setTerminalInput(e.target.value)}
                        onKeyDown={handleTerminalKeyDown}
                        placeholder=""
                        autoComplete="off"
                        spellCheck="false"
                        className="flex-1 bg-transparent border-none outline-none text-indigo-950 dark:text-foreground font-mono caret-indigo-600 dark:caret-primary focus:ring-0"
                        autoFocus
                      />
                    </form>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

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
          <AnimatePresence>
            {isSidebarOpen && (
              <motion.div
                initial={{ width: 0, opacity: 0, x: -20 }}
                animate={{ width: 260, opacity: 1, x: 0 }}
                exit={{ width: 0, opacity: 0, x: -20 }}
                whileHover={{ scale: 1.01 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                className="absolute left-[108px] top-1/2 -translate-y-1/2 z-40 glass-panel border rounded-[2rem] overflow-hidden flex flex-col shrink-0 h-[calc(100%-8rem)] shadow-xl hover:shadow-2xl transition-shadow"
              >
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="p-4 flex items-center justify-between text-[11px] font-bold text-muted-foreground/40 uppercase tracking-widest border-b border-border/50">
                    <span className="truncate">{activePath ? getBasename(activePath) : 'Workspace'}</span>
                    <div className="flex items-center gap-1">
                      {activePath && (
                        <>
                          <Tooltip>
                            <TooltipTrigger 
                              onClick={() => {
                                if (activePath) {
                                  fetchFiles(activePath);
                                  fetchGitStatus(activePath);
                                }
                              }} 
                              disabled={isFilesLoading}
                              className={cn(
                                buttonVariants({ variant: "ghost", size: "icon" }),
                                "h-7 w-7 rounded-lg transition-all focus-visible:ring-0",
                                isFilesLoading ? 'text-indigo-600 bg-indigo-500/10' : 'text-muted-foreground/40 hover:text-indigo-600 hover:bg-indigo-500/5'
                              )}
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${isFilesLoading ? 'animate-spin' : ''}`} />
                            </TooltipTrigger>
                            <TooltipContent>Refresh Scripts</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger 
                              onClick={() => setIsNewScriptOpen(true)} 
                              className="hover:text-indigo-600 p-1"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </TooltipTrigger>
                            <TooltipContent>New Script</TooltipContent>
                          </Tooltip>
                        </>
                      )}
                      <Tooltip>
                        <TooltipTrigger 
                          onClick={() => setIsSidebarOpen(false)} 
                          className="hover:text-destructive p-1"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </TooltipTrigger>
                        <TooltipContent>Minimize</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-1 custom-scrollbar">
                    {!activePath ? (
                      <div className="p-8 flex flex-col items-center justify-center text-center space-y-4 h-full">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-500/5 flex items-center justify-center">
                          <FolderPlus className="w-6 h-6 text-indigo-400" />
                        </div>
                        <div className="space-y-1">
                          <div className="text-sm font-medium text-foreground">No Folder Open</div>
                          <p className="text-[10px] text-muted-foreground/60 leading-relaxed px-4">
                            Open a folder from your computer or clone a GitHub repository to start writing.
                          </p>
                        </div>
                        <Button 
                          onClick={() => setIsWorkspacePickerOpen(true)}
                          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-9 text-xs"
                        >
                          Open Folder
                        </Button>
                      </div>
                    ) : (
                      files.length > 0 ? files.map((file) => (
                        <div
                          key={file}
                          className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all text-sm ${
                            activeFile === file 
                              ? 'glass-card text-foreground font-medium shadow-sm' 
                              : 'hover:bg-indigo-500/10 text-foreground/60'
                          }`}
                          onClick={() => setActiveFile(file)}
                        >
                          <div className="flex items-center gap-2 overflow-hidden px-1">
                            <FileText className="w-4 h-4 flex-shrink-0" />
                            <span className="truncate">{file}</span>
                          </div>
                          <button
                            className="opacity-0 group-hover:opacity-100 h-6 w-6 flex items-center justify-center text-muted-foreground/60 hover:text-destructive rounded-md hover:bg-destructive/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              confirmDeleteFile(file);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )) : (
                        <div className="p-8 flex flex-col items-center justify-center text-center space-y-3">
                          <FileText className="w-8 h-8 text-indigo-200/50" />
                          <div className="text-xs text-muted-foreground/40 italic">
                            No scripts in this folder.
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" className="text-[10px]" onClick={() => setIsNewScriptOpen(true)}>
                              Create First Script
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-[10px] gap-1" 
                              onClick={() => activePath && fetchFiles(activePath)}
                              disabled={isFilesLoading}
                            >
                              <RefreshCw className={`w-3 h-3 ${isFilesLoading ? 'animate-spin' : ''}`} />
                              Reload
                            </Button>
                          </div>
                        </div>
                      )
                    )}
                  </div>

                  {activePath && (
                    <div className="p-3 border-t border-border/50 bg-muted/5">
                      <Button 
                        variant="ghost" 
                        className="w-full justify-start gap-2 h-9 text-xs text-muted-foreground hover:text-indigo-600 hover:bg-indigo-500/5 group transition-all"
                        onClick={() => setIsWorkspacePickerOpen(true)}
                      >
                        <Folder className="w-4 h-4 text-muted-foreground/50 group-hover:text-indigo-600 transition-colors" />
                        Switch Folder
                      </Button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Editor Canvas */}
          <main 
            id="editor-container"
            className="w-full h-full overflow-y-auto py-[15vh] px-10 bg-transparent scrollbar-hide cursor-text"
            onScroll={(e) => {
              if (activeFile && activePath) {
                const scrollTop = (e.currentTarget as HTMLElement).scrollTop;
                const fileKey = `${activePath}/${activeFile}`;
                const saved = localStorage.getItem(`sg_cursor_${fileKey}`);
                if (saved) {
                  try {
                    const data = JSON.parse(saved);
                    data.scrollTop = scrollTop;
                    data.timestamp = Date.now();
                    localStorage.setItem(`sg_cursor_${fileKey}`, JSON.stringify(data));
                  } catch (e) {}
                } else {
                  localStorage.setItem(`sg_cursor_${fileKey}`, JSON.stringify({
                    scrollTop,
                    timestamp: Date.now()
                  }));
                }
              }
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget && editorRef.current) {
                const lastLine = editorRef.current.lastElementChild as HTMLElement;
                if (lastLine) {
                  lastLine.focus();
                  const range = document.createRange();
                  const sel = window.getSelection();
                  range.selectNodeContents(lastLine);
                  range.collapse(false);
                  sel?.removeAllRanges();
                  sel?.addRange(range);
                } else {
                  editorRef.current.focus();
                }
              }
            }}
          >
            <motion.div 
              key={`${activePath}-${projectKey}`}
              style={{ scale: zoom, transformOrigin: 'top center' }}
              className="w-full max-w-[700px] mx-auto h-fit min-h-[500px] glass-panel script-paper rounded-2xl shadow-[0_20px_50px_rgba(31,38,135,0.15)] p-0 relative mb-[15vh] cursor-text flex flex-col overflow-hidden"
              onClick={(e) => {
                if (e.target === e.currentTarget && editorRef.current) {
                  const lastLine = editorRef.current.lastElementChild as HTMLElement;
                  if (lastLine) {
                    lastLine.focus();
                    const range = document.createRange();
                    const sel = window.getSelection();
                    range.selectNodeContents(lastLine);
                    range.collapse(false);
                    sel?.removeAllRanges();
                    sel?.addRange(range);
                  } else {
                    editorRef.current.focus();
                  }
                }
              }}
            >
              <AnimatePresence>
                {isInitialLoading && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-50 bg-background/60 backdrop-blur-md flex flex-col items-center justify-center space-y-4"
                  >
                    <div className="relative">
                      <Loader2 className="w-10 h-10 text-primary animate-spin opacity-40" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                      </div>
                    </div>
                    <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground/60">
                      Synchronizing Workspace
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {activeFile ? (
                <div 
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  className="outline-none min-h-full w-full p-16 md:p-20"
                  onInput={() => {
                    const newBlocks = updateFormatting();
                    setHasUnsavedChanges(true);
                    updateActiveTypeFromSelection();
                    
                    // Use a ref to debounce state updates that cause heavy re-renders
                    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
                    syncTimerRef.current = setTimeout(() => {
                      setBlocks(newBlocks);
                      saveToHistory(newBlocks);
                    }, 300);
                  }}
                  onPaste={handlePaste}
                  onKeyDown={(e) => {
                    const isMac = typeof window !== 'undefined' && /Mac|iPhone|iPod|iPad/.test(navigator.platform || navigator.userAgent);
                    // Use both Alt and Cmd on Mac, just Alt on Windows/others, to be more robust for different user habits
                    const cmdOrAlt = e.altKey || e.metaKey;
                    const isMod = e.metaKey || e.ctrlKey;

                    if (isMod && (e.key === 's' || e.code === 'KeyS')) {
                      e.preventDefault();
                      handleSave();
                    }
                    if (isMod && (e.key === 'z' || e.code === 'KeyZ')) {
                      e.preventDefault();
                      if (e.shiftKey) redo();
                      else undo();
                    }
                    if (isMod && (e.key === 'y' || e.code === 'KeyY')) {
                      e.preventDefault();
                      redo();
                    }

                    const getCurrentLine = () => {
                      const sel = window.getSelection();
                      if (!sel || !sel.rangeCount) return null;
                      let node: Node | null = sel.anchorNode;
                      
                      // If the anchorNode is the editor itself, we need to find the child at the offset
                      if (node === editorRef.current) {
                        const child = editorRef.current!.childNodes[sel.anchorOffset];
                        node = child || editorRef.current!.lastChild;
                      }

                      while (node && node.parentElement !== editorRef.current) {
                        node = node.parentElement;
                        if (node === document.body) return null;
                      }
                      
                      // Ensure the result is actually an HTMLElement from our editor
                      if (node instanceof HTMLElement && node.parentElement === editorRef.current) {
                        return node;
                      }
                      return null;
                    };

                    const setLineType = (el: HTMLElement, type: BlockType) => {
                      el.setAttribute('data-type', type);
                      setActiveType(type);
                      updateFormatting(true);
                      // Force a re-render/update of the active type indicator
                      updateActiveTypeFromSelection();
                    };

                    // Shortcuts (Alt+1, etc. or Cmd+1 on Mac)
                    if (cmdOrAlt) {
                      const key = e.key;
                      // Support both main keys and numpad, and handle case where key might be a string like 'Digit1'
                      const isDigit = /^[0-9]$/.test(key) || (e.code && e.code.startsWith('Digit'));
                      const digitValue = isDigit ? (key.length === 1 ? key : e.code.replace('Digit', '')) : null;
                      
                      if (digitValue) {
                        const line = getCurrentLine();
                        if (line) {
                          if (digitValue === '1') { e.preventDefault(); setLineType(line, 'scene'); }
                          else if (digitValue === '2') { e.preventDefault(); setLineType(line, 'action'); }
                          else if (digitValue === '3') { e.preventDefault(); setLineType(line, 'character'); }
                          else if (digitValue === '4') { e.preventDefault(); setLineType(line, 'parenthetical'); }
                          else if (digitValue === '5') { e.preventDefault(); setLineType(line, 'dialogue'); }
                          else if (digitValue === '6') { e.preventDefault(); setLineType(line, 'transition'); }
                          else if (digitValue === '7') { e.preventDefault(); setLineType(line, 'shot'); }
                          else if (digitValue === '0') { e.preventDefault(); setLineType(line, 'general'); }
                        }
                      }
                    }

                    // Natural Flow
                    if (e.key === 'Enter' && !e.shiftKey) {
                      const line = getCurrentLine();
                      if (line) {
                        const type = line.getAttribute('data-type') as BlockType || 'action';
                        const text = line.textContent || '';

                        // If Dialogue and empty, switch to Action
                        if (type === 'dialogue' && text.trim() === '') {
                          e.preventDefault();
                          setLineType(line, 'action');
                          return;
                        }

                        // Determine next type
                        let nextType: BlockType = 'action';
                        if (type === 'character') nextType = 'dialogue';
                        else if (type === 'parenthetical') nextType = 'dialogue';
                        else if (type === 'dialogue') nextType = 'action';
                        else if (type === 'transition') nextType = 'scene';
                        
                        // Let the browser handle creating the new node, then apply attributes
                        setTimeout(() => {
                          const newLine = getCurrentLine();
                          if (newLine && newLine !== line) {
                            setLineType(newLine, nextType);
                          }
                        }, 10);
                      }
                    }

                    if (showAutocomplete) {
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setAutocompleteIndex(prev => (prev + 1) % (autocompleteList?.length || 1));
                        return;
                      }
                      if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setAutocompleteIndex(prev => (prev - 1 + (autocompleteList?.length || 1)) % (autocompleteList?.length || 1));
                        return;
                      }
                      if (e.key === 'Enter' || e.key === 'Tab') {
                        e.preventDefault();
                        handleAutocompleteSelect(autocompleteList[autocompleteIndex]);
                        return;
                      }
                      if (e.key === 'Escape') {
                        setShowAutocomplete(false);
                        return;
                      }
                    }

                    if (e.key === 'Tab') {
                      e.preventDefault();
                      const line = getCurrentLine();
                      if (line) {
                        const type = line.getAttribute('data-type') as BlockType || 'action';
                        const cycle: BlockType[] = ['scene', 'action', 'character', 'parenthetical', 'dialogue', 'transition', 'shot', 'general'];
                        const idx = cycle.indexOf(type);
                        const nextTabType = cycle[(idx + 1) % cycle.length];
                        setLineType(line, nextTabType);
                      }
                    }
                  }}
                />
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground/60 space-y-4 py-32">
                  <FileText className="w-12 h-12 opacity-20" />
                  <p className="text-sm">Select or create a script to begin</p>
                  <Button variant="glass" onClick={() => setIsNewScriptOpen(true)}>Create New Script</Button>
                </div>
              )}
            </motion.div>
          </main>

          {/* Autocomplete Overlay */}
          <AnimatePresence>
            {showAutocomplete && activeLineRect && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                style={{
                  position: 'fixed',
                  top: activeLineRect.bottom + 5,
                  left: activeLineRect.left,
                  zIndex: 9999,
                }}
                className="w-64 glass-panel shadow-2xl rounded-xl border border-border/50 py-1 overflow-hidden"
              >
                <div className="text-[9px] text-foreground/40 px-3 py-1 uppercase tracking-wider font-bold">Suggestions</div>
                {autocompleteList.slice(0, 10).map((item, idx) => (
                  <button
                    key={item}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                      idx === autocompleteIndex ? 'bg-primary text-white shadow-lg' : 'hover:bg-primary/10 text-foreground'
                    }`}
                    onClick={() => handleAutocompleteSelect(item)}
                  >
                    {item}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Right Sidebar Panel */}
          <AnimatePresence>
            {isRightSidebarOpen && (
              <motion.aside
                initial={{ width: 0, opacity: 0, x: 20 }}
                animate={{ width: 280, opacity: 1, x: 0 }}
                exit={{ width: 0, opacity: 0, x: 20 }}
                whileHover={{ scale: 1.01 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                className="absolute right-[108px] top-1/2 -translate-y-1/2 z-40 glass-panel border rounded-[2rem] flex flex-col shrink-0 overflow-hidden h-[calc(100%-8rem)] shadow-xl hover:shadow-2xl transition-shadow"
              >
                <div className="p-4 border-b border-border/50 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
                    {activeRightTab === 'formatting' ? 'Formatting' : 
                     activeRightTab === 'outline' ? 'Scene Navigator' : 
                     activeRightTab === 'ai' ? 'AI Enhance' : 'Title Page'}
                  </span>
                </div>
                
                <ScrollArea className="flex-1 text-foreground overflow-hidden min-h-0">
                  {activeRightTab === 'formatting' ? (
                    <div className="p-4 space-y-6">
                      <div className="space-y-2">
                        <div className="text-[11px] text-muted-foreground/50 font-medium mb-3">ELEMENTS</div>
                        {[
                          { id: 'scene', label: 'Scene Heading', key: '1' },
                          { id: 'action', label: 'Action', key: '2' },
                          { id: 'character', label: 'Character', key: '3' },
                          { id: 'parenthetical', label: 'Parenthetical', key: '4' },
                          { id: 'dialogue', label: 'Dialogue', key: '5' },
                          { id: 'transition', label: 'Transition', key: '6' },
                          { id: 'shot', label: 'Shot', key: '7' },
                          { id: 'general', label: 'General', key: '0' },
                        ].map((item) => (
                          <button
                            key={item.id}
                            onMouseDown={(e) => {
                              e.preventDefault(); // Prevent focus loss
                              applyFormat(item.id as BlockType);
                              setActiveType(item.id as BlockType);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all text-left text-sm group ${
                              activeType === item.id 
                                ? 'bg-primary/10 text-primary font-medium' 
                                : 'hover:bg-primary/5 text-foreground'
                            }`}
                          >
                            <span>{item.label}</span>
                            <span className="text-[10px] text-muted-foreground/30 group-hover:text-muted-foreground/60 font-mono">
                              {navigator.platform.includes('Mac') ? '⌘' : 'Alt'}+{item.key}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : activeRightTab === 'ai' ? (
                    <div className="p-4 space-y-4">
                      <div className="space-y-3">
                        <Label className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">Script Snippet</Label>
                        <textarea 
                          value={aiSnippet}
                          onChange={(e) => setAiSnippet(e.target.value)}
                          placeholder="Paste a dialogue or action line here..."
                          className="w-full h-32 bg-secondary/50 border border-border rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none font-mono text-foreground"
                        />
                        <Button 
                          className="w-full h-9 bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20"
                          onClick={handleGetAiSuggestions}
                          disabled={isAiLoading || !aiSnippet.trim()}
                        >
                          {isAiLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5 mr-2" />
                              Enhance
                            </>
                          )}
                        </Button>
                      </div>

                      <div className="space-y-4 pt-2">
                        {aiOptions.map((opt, i) => (
                          <div key={i} className="group relative bg-secondary/40 border border-border rounded-xl p-3 hover:bg-background transition-all">
                            <div className="text-[10px] text-foreground/40 uppercase font-black mb-1">Option {i + 1}</div>
                            <p className="text-xs leading-relaxed italic pr-8 whitespace-pre-wrap text-foreground">{opt}</p>
                            <button 
                              onClick={() => copyToClipboard(opt, i)}
                              className="absolute top-3 right-3 p-1.5 rounded-md hover:bg-indigo-500/10 text-muted-foreground hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                            >
                              {copiedIndex === i ? (
                                <Check className="w-3.5 h-3.5 text-green-500" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : activeRightTab === 'outline' ? (
                    <div className="p-4">
                      <div className="space-y-1">
                        {blocks.filter(b => b.type === 'scene').map((block, idx) => (
                          <button
                            key={block.id}
                            onClick={() => {
                              const el = document.getElementById(block.id);
                              const container = document.getElementById('editor-container');
                              if (el && container) {
                                // Calculate target scroll position manually to avoid shifting the entire app layout
                                const containerRect = container.getBoundingClientRect();
                                const elRect = el.getBoundingClientRect();
                                const relativeTop = elRect.top - containerRect.top + container.scrollTop;
                                
                                container.scrollTo({
                                  top: relativeTop - (container.clientHeight / 2) + (el.clientHeight / 2),
                                  behavior: 'smooth'
                                });
                                
                                // Add a temporary highlight effect
                                el.style.backgroundColor = 'rgba(79, 70, 229, 0.1)';
                                setTimeout(() => {
                                  el.style.backgroundColor = '';
                                }, 2000);
                                el.focus({ preventScroll: true });
                              }
                              setActiveBlockId(block.id);
                            }}
                            className={`w-full text-left px-3 py-2 rounded-lg transition-all group ${activeBlockId === block.id ? 'bg-primary/10 border-l-2 border-primary' : 'hover:bg-primary/5'}`}
                          >
                            <div className="text-[10px] text-muted-foreground font-mono mb-0.5">SCENE {idx + 1}</div>
                            <div className="text-xs font-bold text-foreground truncate">
                              {block.content || 'Untitled Scene'}
                            </div>
                          </button>
                        ))}
                        {blocks.filter(b => b.type === 'scene').length === 0 && (
                          <div className="text-xs text-muted-foreground/40 italic p-3">
                            No scenes headings found.
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 space-y-4">
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">Title</Label>
                          <Input 
                            value={titlePage.title}
                            onChange={(e) => setTitlePage({...titlePage, title: e.target.value})}
                            placeholder="THE BIG SCREENPLAY"
                            className="text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">Credit</Label>
                          <Input 
                            value={titlePage.credit}
                            onChange={(e) => setTitlePage({...titlePage, credit: e.target.value})}
                            placeholder="written by"
                            className="text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">Author</Label>
                          <Input 
                            value={titlePage.author}
                            onChange={(e) => setTitlePage({...titlePage, author: e.target.value})}
                            placeholder="Jane Doe"
                            className="text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">Source</Label>
                          <Input 
                            value={titlePage.source}
                            onChange={(e) => setTitlePage({...titlePage, source: e.target.value})}
                            placeholder="Based on the novel by..."
                            className="text-xs h-16"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">Contact</Label>
                          <Input 
                            value={titlePage.contact}
                            onChange={(e) => setTitlePage({...titlePage, contact: e.target.value})}
                            placeholder="Agent Details etc."
                            className="text-xs h-20"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </ScrollArea>
              </motion.aside>
            )}
          </AnimatePresence>

          {/* Right Icons Bar */}
          <motion.aside 
            whileHover={{ scale: 1.02 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="absolute right-6 top-1/2 -translate-y-1/2 w-14 glass-panel border rounded-[2rem] flex flex-col items-center py-5 gap-6 shrink-0 h-[calc(100%-8rem)] shadow-lg hover:shadow-xl transition-shadow z-50"
          >
            <Tooltip>
              <TooltipTrigger 
                className={`transition-colors hover:text-indigo-600 ${isRightSidebarOpen && activeRightTab === 'formatting' ? 'text-indigo-600' : 'text-indigo-400/50'}`}
                onClick={() => {
                  if (isRightSidebarOpen && activeRightTab === 'formatting') {
                    setIsRightSidebarOpen(false);
                  } else {
                    setIsRightSidebarOpen(true);
                    setActiveRightTab('formatting');
                  }
                }}
              >
                <Type className="w-5 h-5" />
              </TooltipTrigger>
              <TooltipContent side="left">Formatting</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger 
                className={`transition-colors hover:text-indigo-600 ${isRightSidebarOpen && activeRightTab === 'outline' ? 'text-indigo-600' : 'text-indigo-400/50'}`}
                onClick={() => {
                  if (isRightSidebarOpen && activeRightTab === 'outline') {
                    setIsRightSidebarOpen(false);
                  } else {
                    setIsRightSidebarOpen(true);
                    setActiveRightTab('outline');
                  }
                }}
              >
                <List className="w-5 h-5" />
              </TooltipTrigger>
              <TooltipContent side="left">Outline</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger 
                className={`transition-colors hover:text-indigo-600 ${isRightSidebarOpen && activeRightTab === 'title' ? 'text-indigo-600' : 'text-indigo-400/50'}`}
                onClick={() => {
                  if (isRightSidebarOpen && activeRightTab === 'title') {
                    setIsRightSidebarOpen(false);
                  } else {
                    setIsRightSidebarOpen(true);
                    setActiveRightTab('title');
                  }
                }}
              >
                <Layout className="w-5 h-5" />
              </TooltipTrigger>
              <TooltipContent side="left">Title Page</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger 
                className={`transition-colors hover:text-indigo-600 ${isRightSidebarOpen && activeRightTab === 'ai' ? 'text-indigo-600' : 'text-indigo-400/50'}`}
                onClick={() => {
                  if (isRightSidebarOpen && activeRightTab === 'ai') {
                    setIsRightSidebarOpen(false);
                  } else {
                    setIsRightSidebarOpen(true);
                    setActiveRightTab('ai');
                  }
                }}
              >
                <Sparkles className="w-5 h-5" />
              </TooltipTrigger>
              <TooltipContent side="left">AI Enhance</TooltipContent>
            </Tooltip>
          </motion.aside>
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
        <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
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
              <Button variant="outline" onClick={() => setIsSettingsOpen(false)}>Cancel</Button>
              <Button onClick={handleUpdateSettings}>Save Settings</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Workspace Picker Dialog */}
        <Dialog open={isWorkspacePickerOpen} onOpenChange={setIsWorkspacePickerOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Workspace Management</DialogTitle>
              <DialogDescription>
                Open an existing folder, create a new one, or clone a repository.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="flex gap-1.5 p-1.5 bg-muted/50 rounded-xl border border-border/50">
                <Button 
                  variant={workspaceData.type === 'open' ? 'secondary' : 'ghost'} 
                  className={`flex-1 h-9 text-xs rounded-lg transition-all ${workspaceData.type === 'open' ? 'bg-background shadow-sm text-primary font-bold' : 'text-muted-foreground'}`}
                  onClick={() => setWorkspaceData({ ...workspaceData, type: 'open' })}
                >
                  <Folder className="w-3 h-3 mr-1.5" />
                  Open
                </Button>
                <Button 
                  variant={workspaceData.type === 'create' ? 'secondary' : 'ghost'} 
                  className={`flex-1 h-9 text-xs rounded-lg transition-all ${workspaceData.type === 'create' ? 'bg-background shadow-sm text-primary font-bold' : 'text-muted-foreground'}`}
                  onClick={() => setWorkspaceData({ ...workspaceData, type: 'create' })}
                >
                  <FolderPlus className="w-3 h-3 mr-1.5" />
                  Create
                </Button>
                <Button 
                  variant={workspaceData.type === 'clone' ? 'secondary' : 'ghost'} 
                  className={`flex-1 h-9 text-xs rounded-lg transition-all ${workspaceData.type === 'clone' ? 'bg-background shadow-sm text-primary font-bold' : 'text-muted-foreground'}`}
                  onClick={() => setWorkspaceData({ ...workspaceData, type: 'clone' })}
                >
                  <CloudUpload className="w-3 h-3 mr-1.5" />
                  Clone
                </Button>
              </div>

              {workspaceData.type === 'create' ? (
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="folderName" className="text-[10px] uppercase tracking-wider text-foreground/60 font-bold mb-1">New Folder Name</Label>
                    <Input 
                      id="folderName" 
                      placeholder="e.g. my-new-screenplay"
                      value={workspaceData.name}
                      onChange={(e) => setWorkspaceData({ ...workspaceData, name: e.target.value })}
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Will be created in: <span className="text-foreground/80 font-mono italic">{settings.baseProjectsDir || 'default location'}</span>
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="workspacePath" className="text-[10px] uppercase tracking-wider text-foreground/60 font-bold mb-1">{workspaceData.type === 'clone' ? 'Target Folder Path' : 'Absolute Folder Path'}</Label>
                    <div className="flex gap-2">
                      <Input 
                        id="workspacePath" 
                        placeholder={settings.baseProjectsDir || "/path/to/folder"}
                        value={workspaceData.path}
                        onChange={(e) => setWorkspaceData({ ...workspaceData, path: e.target.value })}
                        className="flex-1"
                      />
                      <Button 
                        variant="secondary" 
                        className="h-10 px-3"
                        onClick={() => {
                          setIsBrowserOpen(true);
                          fetchBrowseData(workspaceData.path);
                        }}
                      >
                        Browse...
                      </Button>
                    </div>
                  </div>

                  {recentFolders.length > 0 && workspaceData.type === 'open' && (
                    <div className="grid gap-2">
                      <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Recently Used</Label>
                      <div className="flex flex-col gap-1">
                        {recentFolders.map((p) => (
                          <button
                            key={p}
                            onClick={() => {
                              setWorkspaceData({ ...workspaceData, path: p, type: 'open' });
                              handleOpenWorkspace(p);
                            }}
                            className="text-left text-xs px-2 py-1.5 rounded hover:bg-secondary flex items-center gap-2 group overflow-hidden transition-colors"
                            title={p}
                          >
                            <Clock className="w-3 h-3 text-muted-foreground" />
                            <span className="truncate flex-1 text-foreground">{getBasename(p)}</span>
                            <span className="text-[9px] text-muted-foreground opacity-0 group-hover:opacity-100 truncate">{p}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {workspaceData.type === 'clone' && (
                <div className="grid gap-2">
                  <Label htmlFor="gitUrl" className="text-[10px] uppercase tracking-wider text-foreground/60 font-bold mb-1">Git Repository URL</Label>
                  <Input 
                    id="gitUrl" 
                    placeholder="https://github.com/user/repo.git"
                    value={workspaceData.url}
                    onChange={(e) => setWorkspaceData({ ...workspaceData, url: e.target.value })}
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsWorkspacePickerOpen(false)}>Cancel</Button>
              <Button onClick={handleOpenWorkspace}>
                {workspaceData.type === 'clone' ? 'Clone & Open' : 
                 workspaceData.type === 'create' ? 'Create & Open' : 'Open Folder'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Folder Browser Dialog */}
        <Dialog open={isBrowserOpen} onOpenChange={setIsBrowserOpen}>
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
                    onClick={handleBrowseBack}
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
                        onClick={() => handleBrowseNavigate(dir)}
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
              <Button variant="outline" onClick={() => setIsBrowserOpen(false)}>Cancel</Button>
              <Button onClick={handleSelectFolder} className="bg-primary hover:bg-primary/90 text-white">
                Select This Folder
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <Trash2 className="w-5 h-5" />
                Delete Script
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to delete <strong>{fileToDelete}</strong>? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setIsDeleteConfirmOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={performDeleteFile}>Delete Script</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>


        {/* New Script Dialog */}
        <Dialog open={isNewScriptOpen} onOpenChange={setIsNewScriptOpen}>
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
                    if (e.key === 'Enter') handleCreateFile();
                  }}
                />
                <p className="text-[10px] text-muted-foreground">
                  The .fountain extension will be added automatically.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsNewScriptOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateFile} disabled={!newScriptName}>
                Create Script
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
