import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import { apiCall } from '@/src/lib/platform';
import { BlockType, ScriptBlock } from '@/src/types';
import { fountainToBlocks, blocksToFountain } from '@/src/lib/fountain';

const encodePath = (path: string) => btoa(path);

interface UseEditorProps {
  activePath: string | null;
  activeFile: string | null;
  projectKey: number;
  settings: {
    baseProjectsDir: string;
    geminiKey: string;
    theme: 'light' | 'dark' | 'system';
  };
  onSaveSuccess?: () => void;
  editorRef: React.RefObject<HTMLDivElement | null>;
  setIsInitialLoading: (loading: boolean) => void;
}

export const useEditor = ({
  activePath,
  activeFile,
  projectKey,
  settings,
  onSaveSuccess,
  editorRef,
  setIsInitialLoading,
}: UseEditorProps) => {
  const [blocks, setBlocks] = useState<ScriptBlock[]>([]);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<BlockType>('action');
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [history, setHistory] = useState<{ blocks: ScriptBlock[]; selection: { blockId: string | null; offset: number } }[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [currentPage, setCurrentPage] = useState(1);
  const [jumpPageInput, setJumpPageInput] = useState('1');
  const [isEditorReady, setIsEditorReady] = useState(false);
  const [titlePage, setTitlePage] = useState({
    title: '',
    credit: 'written by',
    author: '',
    source: '',
    notes: '',
    contact: ''
  });

  const [autocompleteIndex, setAutocompleteIndex] = useState(0);
  const [autocompleteList, setAutocompleteList] = useState<string[]>([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [activeLineRect, setActiveLineRect] = useState<DOMRect | null>(null);
  
  const currentEditorFile = useRef<string | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    
    try {
      const doc = new jsPDF({ unit: 'in', format: 'letter' });
      doc.setFont('courier', 'normal');
      doc.setFontSize(12);

      blocks.forEach((block, index) => {
        const text = block.content.trim();
        if (text) {
          words += text.split(/\s+/).filter(Boolean).length;
        }
        
        let width = 6.0;
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

  const escapeHtml = useCallback((text: string): string => {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }, []);

  const syncEditorFromBlocks = useCallback((newBlocks: ScriptBlock[]) => {
    if (editorRef.current) {
      editorRef.current.innerHTML = newBlocks.map(b => {
        const content = b.content === '' ? '<br>' : escapeHtml(b.content);
        return `<div id="${b.id}" class="script-line script-${b.type} ${b.type === 'character' ? 'font-bold' : ''}" data-type="${b.type}">${content}</div>`;
      }).join('');
    }
  }, [editorRef, escapeHtml]);

  const saveToHistory = useCallback((newBlocks: ScriptBlock[]) => {
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

    setHistory(prev => {
      const currentIndex = prev.length > 0 ? prev.length - 1 : 0;
      const newHistory = prev.slice(0, currentIndex + 1);
      newHistory.push({ blocks: JSON.parse(JSON.stringify(newBlocks)), selection: { blockId, offset } });
      if (newHistory.length > 50) newHistory.shift();
      return newHistory;
    });
    setHistoryIndex(prev => {
      const size = Math.min(50, prev + 2);
      return size - 1;
    });
  }, [editorRef]);

  const updateFormatting = useCallback((forceSyncState = false) => {
    if (!editorRef.current) return [];
    
    const elements = Array.from(editorRef.current.childNodes) as Node[];
    const newBlocks: ScriptBlock[] = [];
    const seenIds = new Set<string>();
    
    const editorLines: HTMLElement[] = [];
    
    elements.forEach((el, index) => {
      if (el.nodeType === 3) {
        const text = el.textContent || '';
        if (text.trim() === '' && index === elements.length - 1 && elements.length > 1) {
          return;
        }
        const div = document.createElement('div');
        div.id = 'block-' + Math.random().toString(36).substring(2, 11);
        div.className = 'script-line script-action';
        div.setAttribute('data-type', 'action');
        div.textContent = text;
        editorRef.current!.replaceChild(div, el);
        editorLines.push(div);
      } else if (el instanceof HTMLElement) {
        if (el.tagName === 'BR') {
          const div = document.createElement('div');
          div.id = 'block-' + Math.random().toString(36).substring(2, 11);
          div.className = 'script-line script-action';
          div.setAttribute('data-type', 'action');
          div.innerHTML = '<br>';
          editorRef.current!.replaceChild(div, el);
          editorLines.push(div);
        } else {
          editorLines.push(el);
        }
      }
    });

    editorLines.forEach((lineEl, idx) => {
      const text = lineEl.innerText || '';
      
      const parts = text.split('\n');
      parts.forEach((part, subIdx) => {
        const content = part;
        let type: BlockType = 'action';
        
        const trimmed = content.trim();
        const uppercase = trimmed.toUpperCase();
        
        if (trimmed === '') {
          type = 'action';
        } else if (
          uppercase.startsWith('INT.') || 
          uppercase.startsWith('EXT.') || 
          uppercase.startsWith('INT/EXT') || 
          uppercase.startsWith('I/E') || 
          uppercase.startsWith('EST.')
        ) {
          type = 'scene';
        } else if (
          uppercase.startsWith('TO:') || 
          uppercase.endsWith('TO:') || 
          uppercase === 'FADE IN:' || 
          uppercase === 'FADE OUT:' || 
          uppercase === 'FADE TO BLACK.'
        ) {
          type = 'transition';
        } else if (
          uppercase.startsWith('ANGLE ON') || 
          uppercase.startsWith('CLOSE UP') || 
          uppercase.startsWith('WIDE SHOT') || 
          uppercase.startsWith('POV') || 
          uppercase.startsWith('CAMERA')
        ) {
          type = 'shot';
        } else if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
          type = 'parenthetical';
        } else if (trimmed === trimmed.toUpperCase() && !/^\d+$/.test(trimmed) && trimmed.length > 1) {
          type = 'character';
        } else {
          type = 'action';
          
          if (idx > 0) {
            let j = idx - 1;
            while (j >= 0 && editorLines[j].innerText.trim() === '') {
              j--;
            }
            if (j >= 0) {
              const prevType = editorLines[j].getAttribute('data-type');
              if (prevType === 'character' || prevType === 'parenthetical') {
                type = 'dialogue';
              }
            }
          }
          
          if (type === 'action' && newBlocks.length > 0) {
            let j = newBlocks.length - 1;
            while (j >= 0 && newBlocks[j].content.trim() === '') {
              j--;
            }
            if (j >= 0) {
              const prev = newBlocks[j];
              if ((prev.type === 'character' || prev.type === 'parenthetical' || prev.type === 'dialogue') && prev.content.trim() !== '') {
                type = 'dialogue';
              }
            }
          }
        }

        const isManual = lineEl.getAttribute('data-manual') === 'true';
        if (isManual) {
          const manualType = lineEl.getAttribute('data-type') as BlockType;
          if (manualType) {
            type = manualType;
          }
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

    const hasSubLines = editorLines.some(line => {
      const text = line.innerText;
      // Only trigger full rebuild when there are actual multiline splits
      // (text contains newline characters that aren't just trailing)
      const stripped = text.replace(/\n$/, '');
      return stripped.includes('\n');
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
  }, [editorRef, syncEditorFromBlocks, saveToHistory]);

  const restoreSelection = useCallback((selection: { blockId: string | null; offset: number }) => {
    if (!selection.blockId) return;
    setTimeout(() => {
      const el = document.getElementById(selection.blockId!);
      if (el) {
        el.focus();
        const sel = window.getSelection();
        if (sel) {
          const range = document.createRange();
          let textNode = el.firstChild;
          if (!textNode) return;
          const finalOffset = Math.min(selection.offset, textNode.textContent?.length || 0);
          try {
            range.setStart(textNode, finalOffset);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
          } catch (e) {
            range.selectNodeContents(el);
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
          }
        }
      }
    }, 0);
  }, []);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      const item = history[prevIndex];
      setBlocks(JSON.parse(JSON.stringify(item.blocks)));
      setHistoryIndex(prevIndex);
      syncEditorFromBlocks(item.blocks);
      restoreSelection(item.selection);
      toast.info('Undo');
    }
  }, [history, historyIndex, syncEditorFromBlocks, restoreSelection]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      const item = history[nextIndex];
      setBlocks(JSON.parse(JSON.stringify(item.blocks)));
      setHistoryIndex(nextIndex);
      syncEditorFromBlocks(item.blocks);
      restoreSelection(item.selection);
      toast.info('Redo');
    }
  }, [history, historyIndex, syncEditorFromBlocks, restoreSelection]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
    updateFormatting(true);
  }, [updateFormatting]);

  const applyFormat = useCallback((type: BlockType, blockId?: string) => {
    let el: HTMLElement | null = null;
    
    if (blockId) {
      el = document.getElementById(blockId);
    } else {
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
      
      if (!el && activeBlockId) {
        el = document.getElementById(activeBlockId);
      }
    }

    if (el) {
      el.setAttribute('data-type', type);
      el.setAttribute('data-manual', 'true');
      setActiveType(type);
      const newBlocks = updateFormatting();
      saveToHistory(newBlocks);
      el.focus();
    }
  }, [editorRef, activeBlockId, updateFormatting, saveToHistory]);

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

        const lineIndex = blocks.findIndex(b => b.id === id);
        if (lineIndex !== -1) {
          let linesCount = 0;
          let pagesCount = 1;
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
              
              if (linesCount + spacing + blockLines > maxLinesPerPage) {
                pagesCount++;
                linesCount = blockLines;
              } else {
                linesCount += spacing + blockLines;
              }
            }
            setCurrentPage(pagesCount);
          } catch (e) {}
        }
        return;
      }
      current = current.parentElement;
    }
    setShowAutocomplete(false);
  }, [editorRef, activePath, activeFile, suggestions, blocks]);

  const handleAutocompleteSelect = useCallback((value: string) => {
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
        const range = document.createRange();
        const textNode = (node as HTMLElement).firstChild || node;
        range.selectNodeContents(textNode);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
  }, [editorRef, updateFormatting]);

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

      if (targetBlockId) {
        const el = document.getElementById(targetBlockId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          el.focus();
          const range = document.createRange();
          const sel = window.getSelection();
          if (sel) {
            range.selectNodeContents(el);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
          }
        }
      }
    } catch (e) {}
  }, [blocks, jumpPageInput, pageCount, currentPage]);

  const handleSave = useCallback(async () => {
    if (!activePath || !activeFile || !editorRef.current) return;
    setIsSaving(true);
    try {
      const latestBlocks = updateFormatting(true);
      const fountainContent = blocksToFountain(latestBlocks);
      await apiCall(`/api/workspace/${encodePath(activePath)}/files/${activeFile}`, {
        method: 'POST',
        body: { content: fountainContent },
      });
      setHasUnsavedChanges(false);
      toast.success('Saved locally');
      if (onSaveSuccess) onSaveSuccess();
    } catch (error) {
      toast.error('Failed to save');
    } finally {
      setIsSaving(false);
    }
  }, [activePath, activeFile, editorRef, updateFormatting, onSaveSuccess]);

  const initializeNewScript = useCallback((id: string) => {
    const initialBlocks: ScriptBlock[] = [{ id, type: 'scene', content: '' }];
    setBlocks(initialBlocks);
    setActiveBlockId(id);
    setActiveType('scene');
    setHistory([{ blocks: initialBlocks, selection: { blockId: id, offset: 0 } }]);
    setHistoryIndex(0);
    setTitlePage({
      title: '',
      credit: 'written by',
      author: '',
      source: '',
      notes: '',
      contact: ''
    });
  }, []);

  const fetchFileContent = useCallback(async (absPath: string, filename: string) => {
    try {
      const data = await apiCall(`/api/workspace/${encodePath(absPath)}/files/${filename}`);
      const loadedBlocks = fountainToBlocks(data.content || '');
      
      setBlocks(loadedBlocks);
      setHistory([{ blocks: JSON.parse(JSON.stringify(loadedBlocks)), selection: { blockId: loadedBlocks[0]?.id || null, offset: 0 } }]);
      setHistoryIndex(0);
      setActiveBlockId(loadedBlocks[0]?.id || null);
      if (loadedBlocks[0]) setActiveType(loadedBlocks[0].type);
      
      if (editorRef.current) {
        syncEditorFromBlocks(loadedBlocks);
        currentEditorFile.current = filename;
        
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
  }, [editorRef, syncEditorFromBlocks, setIsInitialLoading, setIsEditorReady]);

  useEffect(() => {
    if (activeFile && editorRef.current && blocks.length > 0) {
      if (editorRef.current.children.length === 0) {
        syncEditorFromBlocks(blocks);
      }
    } else if (!activeFile && editorRef.current) {
      editorRef.current.innerHTML = '';
      currentEditorFile.current = null;
    }
  }, [activeFile, blocks, editorRef, syncEditorFromBlocks]);

  useEffect(() => {
    document.addEventListener('selectionchange', updateActiveTypeFromSelection);
    return () => document.removeEventListener('selectionchange', updateActiveTypeFromSelection);
  }, [updateActiveTypeFromSelection]);

  useEffect(() => {
    setJumpPageInput(currentPage.toString());
  }, [currentPage]);

  useEffect(() => {
    if (activePath && activeFile) {
      localStorage.setItem(`sg_last_file_${activePath}`, activeFile);
      fetchFileContent(activePath, activeFile);
      setIsEditorReady(false);
    } else {
      setBlocks([]);
      setTitlePage({
        title: '',
        credit: 'written by',
        author: '',
        source: '',
        notes: '',
        contact: ''
      });
    }
  }, [activePath, activeFile, projectKey, fetchFileContent]);

  return {
    blocks,
    setBlocks,
    activeBlockId,
    setActiveBlockId,
    activeType,
    setActiveType,
    isSaving,
    hasUnsavedChanges,
    setHasUnsavedChanges,
    history,
    historyIndex,
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
    titlePage,
    setTitlePage,
  };
};
