import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, 
  Folder, 
  Terminal as TerminalIcon, 
  GitBranch, 
  CloudUpload, 
  Plus, 
  Trash2, 
  ChevronLeft, 
  ChevronRight,
  Save,
  Clock,
  Settings as SettingsIcon,
  Globe,
  Link as LinkIcon,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import { useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
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
import { GitStatus, GitLogEntry } from '@/src/types';

type BlockType = 'scene' | 'action' | 'character' | 'parenthetical' | 'dialogue' | 'transition' | 'shot' | 'general';

interface ScriptBlock {
  id: string;
  type: BlockType;
  content: string;
}

export default function App() {
  const [projects, setProjects] = useState<string[]>([]);
  const [activeProject, setActiveProject] = useState<string | null>(null);
  const [files, setFiles] = useState<string[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<ScriptBlock[]>([]);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<BlockType>('action');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [gitLog, setGitLog] = useState<GitLogEntry[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [githubToken, setGithubToken] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isGitHubConnected, setIsGitHubConnected] = useState(false);
  const [syncCommitMessage, setSyncCommitMessage] = useState('');
  const [settings, setSettings] = useState({ baseProjectsDir: '' });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [newProjectData, setNewProjectData] = useState({ name: '', type: 'create', url: '', path: '' });
  const [isNewScriptOpen, setIsNewScriptOpen] = useState(false);
  const [newScriptName, setNewScriptName] = useState('');
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  const [history, setHistory] = useState<{ blocks: ScriptBlock[]; selection: { blockId: string | null; offset: number } }[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const editorRef = useRef<HTMLDivElement>(null);

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
        if (!text) return;
        
        words += text.split(/\s+/).filter(Boolean).length;
        
        let width = 6.0; // Default for Scene/Action
        if (block.type === 'character') width = 3.8;
        else if (block.type === 'parenthetical') width = 2.0;
        else if (block.type === 'dialogue') width = 3.5;
        else if (block.type === 'transition') width = 2.0;
        
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
      
      let y = 1.0; // Start at top margin
      const bottomMargin = 10.0;
      const lineHeight = 1/6;

      blocks.forEach((block, index) => {
        if (!block.content.trim()) return;

        let x = 1.5;
        let width = 6.0;
        let align = 'left';
        
        if (block.type === 'character') { x = 3.7; width = 3.8; }
        else if (block.type === 'parenthetical') { x = 3.1; width = 2.0; }
        else if (block.type === 'dialogue') { x = 2.5; width = 3.5; }
        else if (block.type === 'transition') { x = 5.5; width = 2.0; align = 'right'; }
        
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

  const updateFormatting = () => {
    if (!editorRef.current) return;
    
    // Ensure all text is wrapped in divs
    if (editorRef.current.childNodes.length > 0 && editorRef.current.firstChild?.nodeType === Node.TEXT_NODE) {
      const text = editorRef.current.firstChild.textContent;
      const div = document.createElement('div');
      div.textContent = text;
      editorRef.current.replaceChild(div, editorRef.current.firstChild);
    }

    const lines = Array.from(editorRef.current.children) as HTMLElement[];
    const newBlocks: ScriptBlock[] = [];

    lines.forEach((line, i) => {
      const text = line.textContent || '';
      let type: BlockType = 'action';

      // Fountain-style auto-detection
      if (text.startsWith('.') || /^(INT\.|EXT\.|INT\/EXT\.|EST\.)/i.test(text)) {
        type = 'scene';
      } else if (text.startsWith('>') && !text.endsWith('<')) {
        type = 'transition';
      } else if (text.startsWith('!')) {
        type = 'shot';
      } else if (text.startsWith('(') && text.endsWith(')')) {
        type = 'parenthetical';
      } else if (text === text.toUpperCase() && text.trim().length > 0 && !/^\d+$/.test(text)) {
        // Heuristic: Uppercase line is likely a character if followed by dialogue
        // or if it's just a standalone character name
        type = 'character';
      } else if (i > 0) {
        const prevType = newBlocks[i-1].type;
        if (prevType === 'character' || prevType === 'parenthetical') {
          type = 'dialogue';
        }
      }

      // Preserve manual overrides if they exist (we'll store type in data attribute)
      const manualType = line.getAttribute('data-type') as BlockType;
      if (manualType) type = manualType;

      const id = line.id || Math.random().toString(36).substr(2, 9);
      line.id = id;
      line.setAttribute('data-type', type);
      line.className = `script-line script-${type} ${type === 'character' ? 'font-bold' : ''}`;
      newBlocks.push({ id, type, content: text });
    });

    setBlocks(newBlocks);
    return newBlocks;
  };

  useEffect(() => {
    if (activeFile && editorRef.current) {
      // Only initial load if editor is empty
      if (editorRef.current.children.length === 0 && blocks.length > 0) {
        syncEditorFromBlocks(blocks);
        
        // Focus first line
        setTimeout(() => {
          const el = editorRef.current?.firstChild as HTMLElement;
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
            setActiveBlockId(el.id);
            const type = el.getAttribute('data-type') as BlockType;
            if (type) setActiveType(type);
          }
        }, 100);
      }
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
      editorRef.current.innerHTML = newBlocks.map(b => 
        `<div id="${b.id}" class="script-line script-${b.type} ${b.type === 'character' ? 'font-bold' : ''}" data-type="${b.type}">${b.content}</div>`
      ).join('');
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
    
    // Use insertText to maintain undo history and strip formatting
    document.execCommand('insertText', false, text);
    
    // Update state and history
    const newBlocks = updateFormatting();
    saveToHistory(newBlocks);
    updateActiveTypeFromSelection();
  };

  const fountainToBlocks = (fountain: string): ScriptBlock[] => {
    if (!fountain.trim()) return [{ id: Math.random().toString(36).substr(2, 9), type: 'scene', content: '' }];
    
    // Split by double newlines to get potential blocks
    const rawBlocks = fountain.split(/\n\n+/);
    const result: ScriptBlock[] = [];

    rawBlocks.forEach((raw) => {
      const lines = raw.split('\n').map(l => l.trim()).filter(l => l);
      if (lines.length === 0) return;

      lines.forEach((line, i) => {
        let type: BlockType = 'action';
        let content = line;

        if (line.startsWith('.') || /^(INT\.|EXT\.|INT\/EXT\.|EST\.)/i.test(line)) {
          type = 'scene';
          content = line.replace(/^\.\s*/, '');
        } else if (line.startsWith('>') && !line.endsWith('<')) {
          type = 'transition';
          content = line.replace(/^>\s*/, '');
        } else if (line.startsWith('!')) {
          type = 'shot';
          content = line.replace(/^!\s*/, '');
        } else if (line.startsWith('(') && line.endsWith(')')) {
          type = 'parenthetical';
        } else if (line === line.toUpperCase() && i === 0) {
          // Heuristic: Uppercase line at start of a block is likely a character
          type = 'character';
        } else if (result.length > 0 && (result[result.length - 1].type === 'character' || result[result.length - 1].type === 'parenthetical')) {
          type = 'dialogue';
        }

        result.push({ id: Math.random().toString(36).substr(2, 9), type, content });
      });
    });

    return result.length > 0 ? result : [{ id: Math.random().toString(36).substr(2, 9), type: 'action', content: '' }];
  };

  const blocksToFountain = (blocks: ScriptBlock[]): string => {
    let fountain = '';
    blocks.forEach((block, index) => {
      let prefix = '';
      let content = block.content;

      switch (block.type) {
        case 'scene': prefix = '. '; break;
        case 'transition': prefix = '> '; break;
        case 'shot': prefix = '! '; break;
      }

      const prevBlock = blocks[index - 1];
      const needsDoubleNewline = prevBlock && (
        (block.type === 'scene') || 
        (block.type === 'character') || 
        (block.type === 'action') ||
        (block.type === 'transition') ||
        (block.type === 'shot')
      );

      fountain += (needsDoubleNewline ? '\n\n' : (index > 0 ? '\n' : '')) + prefix + content;
    });
    return fountain;
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
        
        // Persist token to server
        try {
          await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ githubToken: token }),
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

  useEffect(() => {
    fetchProjects();
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      setSettings({ baseProjectsDir: data.baseProjectsDir });
      if (data.githubToken) {
        setGithubToken(data.githubToken);
        setIsGitHubConnected(true);
      }
    } catch (error) {
      console.error('Failed to fetch settings');
    }
  };

  useEffect(() => {
    if (activeProject) {
      fetchFiles(activeProject);
      fetchGitStatus(activeProject);
    } else {
      setFiles([]);
      setActiveFile(null);
      setBlocks([]);
    }
  }, [activeProject]);

  useEffect(() => {
    if (activeProject && activeFile) {
      fetchFileContent(activeProject, activeFile);
    }
  }, [activeProject, activeFile]);

  const updateActiveTypeFromSelection = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    let node = sel.anchorNode;
    if (!node) return;
    
    if (node.nodeType === 3) node = node.parentElement;
    
    let current = node;
    while (current && current !== editorRef.current) {
      if (current.nodeType === 1 && (current as HTMLElement).classList.contains('script-line')) {
        const id = (current as HTMLElement).id;
        const type = (current as HTMLElement).getAttribute('data-type') as BlockType;
        if (id) setActiveBlockId(id);
        if (type) setActiveType(type);
        return;
      }
      current = current.parentElement;
    }
  }, [activeBlockId, activeType]);

  useEffect(() => {
    document.addEventListener('selectionchange', updateActiveTypeFromSelection);
    return () => document.removeEventListener('selectionchange', updateActiveTypeFromSelection);
  }, [updateActiveTypeFromSelection]);

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      setProjects(data);
      if (data.length > 0 && !activeProject) {
        setActiveProject(data[0]);
      }
    } catch (error) {
      toast.error('Failed to fetch projects');
    }
  };

  const fetchFiles = async (project: string) => {
    try {
      const res = await fetch(`/api/projects/${project}/files`);
      const data = await res.json();
      setFiles(data);
      if (data.length > 0 && !activeFile) {
        setActiveFile(data[0]);
      }
    } catch (error) {
      toast.error('Failed to fetch files');
    }
  };

  const fetchFileContent = async (project: string, filename: string) => {
    try {
      const res = await fetch(`/api/projects/${project}/files/${filename}`);
      const data = await res.json();
      const loadedBlocks = fountainToBlocks(data.content || '');
      setBlocks(loadedBlocks);
      setHistory([{ blocks: JSON.parse(JSON.stringify(loadedBlocks)), selection: { blockId: loadedBlocks[0]?.id || null, offset: 0 } }]);
      setHistoryIndex(0);
      setActiveBlockId(loadedBlocks[0]?.id || null);
      if (loadedBlocks[0]) setActiveType(loadedBlocks[0].type);
      
      // syncEditorFromBlocks will be handled by useEffect
    } catch (error) {
      toast.error('Failed to fetch file content');
      const initialBlocks = [{ id: Math.random().toString(36).substr(2, 9), type: 'action' as BlockType, content: '' }];
      setBlocks(initialBlocks);
    }
  };

  const fetchGitStatus = async (project: string) => {
    try {
      const res = await fetch(`/api/projects/${project}/git/status`);
      const data = await res.json();
      setGitStatus(data);
    } catch (error) {
      console.error('Failed to fetch git status');
    }
  };

  const fetchGitLog = async (project: string) => {
    try {
      const res = await fetch(`/api/projects/${project}/git/log`);
      const data = await res.json();
      setGitLog(data.all);
    } catch (error) {
      console.error('Failed to fetch git log');
    }
  };

  const handleCreateProject = async () => {
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProjectData),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      fetchProjects();
      setActiveProject(data.name);
      setIsNewProjectOpen(false);
      setNewProjectData({ name: '', type: 'create', url: '', path: '' });
      toast.success(newProjectData.type === 'clone' ? 'Project cloned' : (newProjectData.type === 'link' ? 'Project linked' : 'Project created'));
    } catch (error: any) {
      toast.error(`Failed to create project: ${error.message}`);
    }
  };

  const handleUpdateSettings = async () => {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success('Settings updated');
      setIsSettingsOpen(false);
      fetchProjects(); // Re-fetch projects from new location
    } catch (error: any) {
      toast.error(`Failed to update settings: ${error.message}`);
    }
  };

  const handleSave = async () => {
    if (!activeProject || !activeFile || !editorRef.current) return;
    setIsSaving(true);
    try {
      // Re-parse current editor content to ensure we have the latest blocks
      updateFormatting();
      const fountainContent = blocksToFountain(blocks);
      await fetch(`/api/projects/${activeProject}/files/${activeFile}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: fountainContent }),
      });
      toast.success('Saved locally');
    } catch (error) {
      toast.error('Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateFile = async () => {
    if (!activeProject) {
      toast.error('Please select or create a project first');
      return;
    }
    if (!newScriptName) return;
    const filename = newScriptName.endsWith('.fountain') ? newScriptName : `${newScriptName}.fountain`;
    try {
      const initialContent = '';
      const res = await fetch(`/api/projects/${activeProject}/files/${filename}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: initialContent }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      fetchFiles(activeProject);
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
      const res = await fetch('/api/auth/github/url');
      const { url, error } = await res.json();
      if (error) throw new Error(error);

      window.open(url, 'github_oauth', 'width=600,height=700');
    } catch (error) {
      toast.error('Failed to initiate GitHub connection');
    }
  };

  const handleSync = async () => {
    if (!activeProject) return;
    if (!githubToken) {
      toast.error('Please connect your GitHub account first');
      return;
    }
    setIsSyncing(true);
    try {
      const res = await fetch(`/api/projects/${activeProject}/git/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: githubToken, commitMessage: syncCommitMessage }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      toast.success('Successfully pushed to GitHub');
      setSyncCommitMessage('');
      fetchGitStatus(activeProject);
    } catch (error: any) {
      toast.error(`Failed to push: ${error.message}`);
      console.error(error);
    } finally {
      setIsSyncing(false);
    }
  };

  const confirmDeleteFile = (filename: string) => {
    setFileToDelete(filename);
    setIsDeleteConfirmOpen(true);
  };

  const performDeleteFile = async () => {
    if (!activeProject || !fileToDelete) return;
    try {
      await fetch(`/api/projects/${activeProject}/files/${fileToDelete}`, { method: 'DELETE' });
      fetchFiles(activeProject);
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
      <div className="flex flex-col h-screen w-full bg-transparent text-indigo-950 font-sans selection:bg-indigo-100 overflow-hidden">
        <Toaster position="top-center" />
        
        {/* Title Bar */}
        <div className="h-[38px] glass-panel border-b flex items-center px-4 shrink-0">
          <div className="flex gap-2 mr-6">
            <div className="w-3 h-3 rounded-full bg-red-400/80" />
            <div className="w-3 h-3 rounded-full bg-amber-400/80" />
            <div className="w-3 h-3 rounded-full bg-emerald-400/80" />
          </div>
          <div className="text-[12px] font-semibold text-indigo-900/60 uppercase tracking-wider flex-1">
            ScriptGlass — {activeFile || 'Untitled'}
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 text-[10px] uppercase tracking-widest font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50/50 gap-2"
            onClick={exportToPDF}
            disabled={!activeFile || blocks.length === 0}
          >
            <Download className="w-3.5 h-3.5" />
            Export PDF
          </Button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <aside className="w-12 glass-panel border-r flex flex-col items-center py-5 gap-6 shrink-0">
            <Tooltip>
              <TooltipTrigger 
                className={`transition-colors ${isSidebarOpen ? 'text-indigo-600' : 'text-indigo-400/50'}`}
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              >
                <Folder className="w-5 h-5" />
              </TooltipTrigger>
              <TooltipContent side="right">Explorer</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger 
                className="text-indigo-900/40 hover:text-indigo-600 transition-colors"
                onClick={() => setIsNewProjectOpen(true)}
              >
                <Plus className="w-5 h-5" />
              </TooltipTrigger>
              <TooltipContent side="right">New Project</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger 
                className="text-indigo-900/40 hover:text-indigo-600 transition-colors"
                onClick={() => {
                  if (!activeProject) {
                    toast.error('Please select or create a project first');
                    return;
                  }
                  setIsNewScriptOpen(true);
                }}
              >
                <FileText className="w-5 h-5" />
              </TooltipTrigger>
              <TooltipContent side="right">New Script</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger 
                className={`transition-colors ${isTerminalOpen ? 'text-indigo-600' : 'text-indigo-900/40'}`}
                onClick={() => {
                  setIsTerminalOpen(!isTerminalOpen);
                  if (!isTerminalOpen && activeProject) fetchGitLog(activeProject);
                }}
              >
                <Clock className="w-5 h-5" />
              </TooltipTrigger>
              <TooltipContent side="right">History</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger 
                className={`transition-colors ${isSettingsOpen ? 'text-indigo-600' : 'text-indigo-900/40'}`}
                onClick={() => setIsSettingsOpen(true)}
              >
                <SettingsIcon className="w-5 h-5" />
              </TooltipTrigger>
              <TooltipContent side="right">Settings</TooltipContent>
            </Tooltip>

            <div className="mt-auto pb-4 flex flex-col gap-6">
              <Tooltip>
                <TooltipTrigger 
                  className={`transition-colors ${isSaving ? 'text-indigo-600 animate-pulse' : 'text-indigo-900/40'}`}
                  onClick={handleSave}
                  disabled={isSaving || !activeFile}
                >
                  <Save className="w-5 h-5" />
                </TooltipTrigger>
                <TooltipContent side="right">Save Locally</TooltipContent>
              </Tooltip>

              <Dialog>
                <Tooltip>
                  <TooltipTrigger 
                    render={
                      <DialogTrigger 
                        render={
                          <button className={`transition-colors ${isSyncing ? 'text-indigo-600 animate-spin' : 'text-indigo-900/40'}`} />
                        } 
                      />
                    }
                  >
                    <CloudUpload className="w-5 h-5" />
                  </TooltipTrigger>
                  <TooltipContent side="right">GitHub Sync</TooltipContent>
                </Tooltip>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>GitHub Integration</DialogTitle>
                    <DialogDescription>
                      {isGitHubConnected 
                        ? `Syncing project "${activeProject}" to GitHub.`
                        : "Connect your GitHub account to sync your scripts to a private repository."}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    {!isGitHubConnected ? (
                      <div className="flex flex-col items-center gap-4 py-4">
                        <p className="text-sm text-indigo-900/60 text-center">
                          Sign in with GitHub to sync your scripts to a private repository.
                        </p>
                        <Button onClick={handleConnectGitHub} className="bg-indigo-950 hover:bg-indigo-900 text-white gap-2">
                          <CloudUpload className="w-4 h-4" />
                          Connect GitHub
                        </Button>
                      </div>
                    ) : (
                      <div className="grid gap-4">
                        <div className="flex items-center justify-between p-3 bg-green-50 border border-green-100 rounded-md">
                          <div className="flex items-center gap-2 text-green-700 text-sm font-medium">
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                            Connected to GitHub
                          </div>
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-gray-500" onClick={async () => {
                            setGithubToken('');
                            setIsGitHubConnected(false);
                            try {
                              await fetch('/api/settings', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ githubToken: null }),
                              });
                              toast.success('GitHub account disconnected');
                            } catch (error) {
                              console.error('Failed to clear GitHub token on server');
                            }
                          }}>
                            Disconnect
                          </Button>
                        </div>
                        
                        <div className="grid gap-2">
                          <Label htmlFor="commitMessage">Commit Message (Optional)</Label>
                          <Input 
                            id="commitMessage" 
                            placeholder="e.g. Added new scene" 
                            value={syncCommitMessage}
                            onChange={(e) => setSyncCommitMessage(e.target.value)}
                          />
                        </div>

                        <p className="text-[10px] text-gray-500">
                          This will create/update a repository named <strong>{activeProject}</strong> on your GitHub account.
                        </p>
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button onClick={handleSync} disabled={isSyncing || !isGitHubConnected || !activeProject}>
                      {isSyncing ? 'Syncing...' : 'Sync Now'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </aside>

          {/* File List (Conditional) */}
          <AnimatePresence>
            {isSidebarOpen && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 240, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                className="glass-panel border-r overflow-hidden flex flex-col shrink-0"
              >
                <div className="flex flex-col h-1/2 border-b border-indigo-100/20">
                  <div className="p-4 flex items-center justify-between text-[11px] font-bold text-indigo-900/40 uppercase tracking-widest border-b border-indigo-100/20">
                    <span>Projects</span>
                    <button onClick={() => setIsNewProjectOpen(true)} className="hover:text-indigo-600">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <ScrollArea className="flex-1">
                    <div className="p-2 space-y-1">
                      {projects.map((project) => (
                        <div
                          key={project}
                          className={`p-2 rounded-lg cursor-pointer transition-all text-sm truncate ${
                            activeProject === project ? 'glass-card text-indigo-900 font-medium' : 'hover:bg-white/20 text-indigo-900/60'
                          }`}
                          onClick={() => setActiveProject(project)}
                        >
                          {project}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>

                <div className="flex flex-col h-1/2">
                  <div className="p-4 flex items-center justify-between text-[11px] font-bold text-indigo-900/40 uppercase tracking-widest border-b border-indigo-100/20">
                    <span>Files</span>
                    <button onClick={() => setIsNewScriptOpen(true)} className="hover:text-indigo-600">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <ScrollArea className="flex-1">
                    <div className="p-2 space-y-1">
                      {files.map((file) => (
                        <div
                          key={file}
                          className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all text-sm ${
                            activeFile === file ? 'glass-card text-indigo-900 font-medium' : 'hover:bg-white/20 text-indigo-900/60'
                          }`}
                          onClick={() => setActiveFile(file)}
                        >
                          <div className="flex items-center gap-2 overflow-hidden">
                            <FileText className="w-4 h-4 flex-shrink-0" />
                            <span className="truncate">{file}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="opacity-0 group-hover:opacity-100 h-6 w-6 text-gray-400 hover:text-red-500"
                            onClick={(e) => {
                              e.stopPropagation();
                              confirmDeleteFile(file);
                            }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Editor Canvas */}
          <main 
            id="editor-container"
            className="flex-1 flex justify-center overflow-y-auto p-10 bg-transparent scrollbar-hide cursor-text"
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
              style={{ scale: zoom, transformOrigin: 'top center' }}
              className="w-full max-w-[700px] h-fit min-h-full glass-panel rounded-2xl shadow-[0_20px_50px_rgba(31,38,135,0.15)] p-16 md:p-20 relative mb-10 cursor-text"
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
              {activeFile ? (
                <div 
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  className="outline-none min-h-full w-full"
                  onInput={() => {
                    const newBlocks = updateFormatting();
                    saveToHistory(newBlocks);
                    updateActiveTypeFromSelection();
                  }}
                  onPaste={handlePaste}
                  onKeyDown={(e) => {
                    const isMac = navigator.platform.includes('Mac');
                    const cmdOrAlt = isMac ? e.metaKey : e.altKey;

                    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                      e.preventDefault();
                      handleSave();
                    }
                    if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
                      e.preventDefault();
                      if (e.shiftKey) redo();
                      else undo();
                    }
                    if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
                      e.preventDefault();
                      redo();
                    }

                    const getCurrentLine = () => {
                      const sel = window.getSelection();
                      if (!sel || !sel.rangeCount) return null;
                      let node = sel.anchorNode;
                      while (node && node.parentElement !== editorRef.current) {
                        node = node.parentElement;
                      }
                      return node as HTMLElement;
                    };

                    const setLineType = (el: HTMLElement, type: BlockType) => {
                      el.setAttribute('data-type', type);
                      setActiveType(type);
                      updateFormatting();
                    };

                    // Fade In Shortcuts
                    if (cmdOrAlt) {
                      const line = getCurrentLine();
                      if (line) {
                        const key = e.key;
                        if (key === '1') { e.preventDefault(); setLineType(line, 'scene'); }
                        else if (key === '2') { e.preventDefault(); setLineType(line, 'action'); }
                        else if (key === '3') { e.preventDefault(); setLineType(line, 'character'); }
                        else if (key === '4') { e.preventDefault(); setLineType(line, 'parenthetical'); }
                        else if (key === '5') { e.preventDefault(); setLineType(line, 'dialogue'); }
                        else if (key === '6') { e.preventDefault(); setLineType(line, 'transition'); }
                        else if (key === '7') { e.preventDefault(); setLineType(line, 'shot'); }
                        else if (key === '0') { e.preventDefault(); setLineType(line, 'general'); }
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
                        else if (type === 'transition') nextType = 'scene';
                        
                        // We let the browser create the new div, but we'll style it in the next tick
                        setTimeout(() => {
                          const newLine = getCurrentLine();
                          if (newLine && newLine !== line) {
                            newLine.setAttribute('data-type', nextType);
                            updateFormatting();
                          }
                        }, 0);
                      }
                    }

                    if (e.key === 'Tab') {
                      e.preventDefault();
                      const line = getCurrentLine();
                      if (line) {
                        const type = line.getAttribute('data-type') as BlockType || 'action';
                        if (type === 'action') setLineType(line, 'character');
                        else if (type === 'character') setLineType(line, 'parenthetical');
                        else if (type === 'dialogue') setLineType(line, 'parenthetical');
                        else setLineType(line, 'action');
                      }
                    }
                  }}
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4">
                  <FileText className="w-12 h-12 opacity-20" />
                  <p className="text-sm">Select or create a script to begin</p>
                  <Button variant="glass" onClick={() => setIsNewScriptOpen(true)}>Create New Script</Button>
                </div>
              )}
            </motion.div>
          </main>

          {/* Right Sidebar */}
          <AnimatePresence>
            {isRightSidebarOpen && (
              <motion.aside
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 256, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                className="glass-panel border-l flex flex-col shrink-0 overflow-hidden"
              >
                <div className="p-4 border-b border-indigo-100/20 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-900/40">Formatting</span>
                  <button onClick={() => setIsRightSidebarOpen(false)} className="text-indigo-900/40 hover:text-indigo-900">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                
                <ScrollArea className="flex-1">
                  <div className="p-4 space-y-6">
                    <div className="space-y-2">
                      <div className="text-[11px] text-indigo-900/40 font-medium mb-3">ELEMENTS</div>
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
                              ? 'bg-indigo-100 text-indigo-900 font-medium' 
                              : 'hover:bg-indigo-50/50 text-indigo-950'
                          }`}
                        >
                          <span>{item.label}</span>
                          <span className="text-[10px] text-indigo-900/30 group-hover:text-indigo-900/60 font-mono">
                            {navigator.platform.includes('Mac') ? '⌘' : 'Alt'}+{item.key}
                          </span>
                        </button>
                      ))}
                    </div>

                    <Separator className="bg-indigo-100/20" />

                    <div className="space-y-2">
                      <div className="text-[11px] text-indigo-900/40 font-medium mb-3">STATS</div>
                      <div className="px-3 py-2 rounded-lg bg-indigo-50/30 space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-indigo-900/60">Pages</span>
                          <span className="font-mono text-indigo-950">{pageCount}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-indigo-900/60">Words</span>
                          <span className="font-mono text-indigo-950">{wordCount}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-indigo-900/60">Zoom</span>
                          <span className="font-mono text-indigo-950">{Math.round(zoom * 100)}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </motion.aside>
            )}
          </AnimatePresence>

          {!isRightSidebarOpen && (
            <button 
              onClick={() => setIsRightSidebarOpen(true)}
              className="fixed right-4 top-1/2 -translate-y-1/2 w-8 h-8 glass-panel rounded-full flex items-center justify-center text-indigo-900/40 hover:text-indigo-900 z-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Terminal Pane */}
        <AnimatePresence>
          {isTerminalOpen && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 160 }}
              exit={{ height: 0 }}
              className="glass-panel border-t overflow-hidden flex flex-col shrink-0"
            >
              <div className="flex items-center justify-between px-4 py-2 border-b border-indigo-100/20">
                <div className="flex items-center gap-2 text-[10px] text-indigo-900/40 uppercase tracking-[1px]">
                  <span>Terminal</span>
                  <Separator orientation="vertical" className="h-2 bg-indigo-100/20" />
                  <span>git-log --oneline -n 5</span>
                </div>
                <button className="text-indigo-900/40 hover:text-indigo-900" onClick={() => setIsTerminalOpen(false)}>
                  <ChevronLeft className="w-4 h-4 rotate-[-90deg]" />
                </button>
              </div>
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-1 text-[12px]">
                  {gitLog.length > 0 ? gitLog.map((log) => (
                    <div key={log.hash} className="flex gap-4">
                      <span className="text-indigo-500 font-bold">$</span>
                      <span className="text-indigo-900/30">{log.hash.substring(0, 7)}</span>
                      <span className="text-indigo-900/80">{log.message}</span>
                    </div>
                  )) : (
                    <div className="text-indigo-900/30 italic">No commit history yet.</div>
                  )}
                </div>
              </ScrollArea>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Status Bar */}
        <footer className="h-[28px] glass-panel border-t flex items-center justify-between px-4 text-[11px] text-indigo-900/60 shrink-0">
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-1.5 text-indigo-900 font-medium">
              <GitBranch className="w-3.5 h-3.5" />
              <span>{gitStatus?.branch || 'main'}</span>
            </div>
            <span>Page {pageCount} of {pageCount}</span>
            <span>{wordCount} words</span>
          </div>
          
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-1.5 text-[#22c55e] font-semibold">
              <span>Synced to GitHub</span>
            </div>
            <span>UTF-8</span>
            <span>Fountain 1.1</span>
          </div>
        </footer>

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
                <Label htmlFor="baseDir">Default Projects Location</Label>
                <Input 
                  id="baseDir" 
                  value={settings.baseProjectsDir}
                  onChange={(e) => setSettings({ ...settings, baseProjectsDir: e.target.value })}
                  placeholder="/path/to/your/projects"
                />
                <p className="text-[10px] text-gray-500">
                  Projects will be stored and searched in this directory.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsSettingsOpen(false)}>Cancel</Button>
              <Button onClick={handleUpdateSettings}>Save Settings</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* New Project Dialog */}
        <Dialog open={isNewProjectOpen} onOpenChange={setIsNewProjectOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Project</DialogTitle>
              <DialogDescription>
                Create a new project, clone from GitHub, or link an existing folder.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="flex gap-2 p-1 bg-[#ebebeb] rounded-md">
                <Button 
                  variant={newProjectData.type === 'create' ? 'secondary' : 'ghost'} 
                  className="flex-1 h-8 text-xs"
                  onClick={() => setNewProjectData({ ...newProjectData, type: 'create' })}
                >
                  Create
                </Button>
                <Button 
                  variant={newProjectData.type === 'clone' ? 'secondary' : 'ghost'} 
                  className="flex-1 h-8 text-xs"
                  onClick={() => setNewProjectData({ ...newProjectData, type: 'clone' })}
                >
                  Clone
                </Button>
                <Button 
                  variant={newProjectData.type === 'link' ? 'secondary' : 'ghost'} 
                  className="flex-1 h-8 text-xs"
                  onClick={() => setNewProjectData({ ...newProjectData, type: 'link' })}
                >
                  Link
                </Button>
              </div>

              {newProjectData.type === 'create' && (
                <div className="grid gap-2">
                  <Label htmlFor="projName">Project Name</Label>
                  <Input 
                    id="projName" 
                    placeholder="My New Script" 
                    value={newProjectData.name}
                    onChange={(e) => setNewProjectData({ ...newProjectData, name: e.target.value })}
                  />
                </div>
              )}

              {newProjectData.type === 'clone' && (
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="cloneUrl">GitHub Repository URL</Label>
                    <Input 
                      id="cloneUrl" 
                      placeholder="https://github.com/user/repo.git" 
                      value={newProjectData.url}
                      onChange={(e) => setNewProjectData({ ...newProjectData, url: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="projNameClone">Project Name (Optional)</Label>
                    <Input 
                      id="projNameClone" 
                      placeholder="Leave empty to use repo name" 
                      value={newProjectData.name}
                      onChange={(e) => setNewProjectData({ ...newProjectData, name: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {newProjectData.type === 'link' && (
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="linkPath">Local Folder Path</Label>
                    <Input 
                      id="linkPath" 
                      placeholder="/Users/name/Documents/MyProject" 
                      value={newProjectData.path}
                      onChange={(e) => setNewProjectData({ ...newProjectData, path: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="projNameLink">Project Name (Optional)</Label>
                    <Input 
                      id="projNameLink" 
                      placeholder="Leave empty to use folder name" 
                      value={newProjectData.name}
                      onChange={(e) => setNewProjectData({ ...newProjectData, name: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsNewProjectOpen(false)}>Cancel</Button>
              <Button 
                onClick={handleCreateProject} 
                disabled={
                  (newProjectData.type === 'create' && !newProjectData.name) ||
                  (newProjectData.type === 'clone' && !newProjectData.url) ||
                  (newProjectData.type === 'link' && !newProjectData.path)
                }
              >
                {newProjectData.type === 'clone' ? 'Clone Project' : (newProjectData.type === 'link' ? 'Link Project' : 'Create Project')}
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
                Create a new Fountain script in project: <strong>{activeProject}</strong>
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="scriptName">Script Name</Label>
                <Input 
                  id="scriptName" 
                  placeholder="e.g. pilot_episode" 
                  value={newScriptName}
                  onChange={(e) => setNewScriptName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateFile();
                  }}
                />
                <p className="text-[10px] text-gray-500">
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
