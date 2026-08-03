import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BlockType, ScriptBlock } from '@/src/types';

import { useApp } from '@/src/contexts/AppContext';

export const EditorCanvas: React.FC = () => {
  const {
    editorRef,
    activePath,
    projectKey,
    isInitialLoading,
    activeFile,
    syncTimerRef,
    showAutocomplete,
    setShowAutocomplete,
    activeLineRect,
    autocompleteList,
    autocompleteIndex,
    setAutocompleteIndex,
    updateFormatting,
    setHasUnsavedChanges,
    updateActiveTypeFromSelection,
    setBlocks,
    saveToHistory,
    handlePaste,
    handleSave,
    undo,
    redo,
    setActiveType,
    handleAutocompleteSelect,
    setIsNewScriptOpen,
  } = useApp();
  const [zoom, setZoom] = React.useState(1);

  React.useEffect(() => {
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
  return (
    <>
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
              } catch (err) {}
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
              ref={editorRef as any}
              contentEditable
              suppressContentEditableWarning
              className="outline-none min-h-full w-full p-16 md:p-20"
              onInput={() => {
                const newBlocks = updateFormatting();
                setBlocks(newBlocks);
                setHasUnsavedChanges(true);
                updateActiveTypeFromSelection();
                
                if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
                syncTimerRef.current = setTimeout(() => {
                  saveToHistory(newBlocks);
                }, 300);
              }}
              onPaste={handlePaste}
              onKeyDown={(e) => {
                const isMac = typeof window !== 'undefined' && /Mac|iPhone|iPod|iPad/.test(navigator.platform || navigator.userAgent);
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
                  
                  if (node === editorRef.current) {
                    const child = editorRef.current!.childNodes[sel.anchorOffset];
                    node = child || editorRef.current!.lastChild;
                  }

                  while (node && node.parentElement !== editorRef.current) {
                    node = node.parentElement;
                    if (node === document.body) return null;
                  }
                  
                  if (node instanceof HTMLElement && node.parentElement === editorRef.current) {
                    return node;
                  }
                  return null;
                };

                const setLineType = (el: HTMLElement, type: BlockType, isManual = true) => {
                  el.setAttribute('data-type', type);
                  if (isManual) {
                    el.setAttribute('data-manual', 'true');
                  } else {
                    el.removeAttribute('data-manual');
                  }
                  setActiveType(type);
                  const newBlocks = updateFormatting(true);
                  setBlocks(newBlocks);
                  updateActiveTypeFromSelection();
                };

                if (cmdOrAlt) {
                  const key = e.key;
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

                if (e.key === 'Enter' && !e.shiftKey) {
                  const line = getCurrentLine();
                  if (line) {
                    const type = line.getAttribute('data-type') as BlockType || 'action';
                    const text = line.textContent || '';

                    if (type === 'dialogue' && text.trim() === '') {
                      e.preventDefault();
                      setLineType(line, 'action');
                      return;
                    }

                    let nextType: BlockType = 'action';
                    if (type === 'character') nextType = 'dialogue';
                    else if (type === 'parenthetical') nextType = 'dialogue';
                    else if (type === 'dialogue') nextType = 'action';
                    else if (type === 'transition') nextType = 'scene';
                    
                    setTimeout(() => {
                      const newLine = getCurrentLine();
                      if (newLine && newLine !== line) {
                        setLineType(newLine, nextType, false);
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
    </>
  );
};
