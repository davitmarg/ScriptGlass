import React, { useState, useEffect, useRef } from 'react';
import { Trash2, ChevronLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { apiCall } from '@/src/lib/platform';
import { TerminalOutput } from '@/src/types';

interface TerminalProps {
  isTerminalOpen: boolean;
  setIsTerminalOpen: (open: boolean) => void;
  activePath: string | null;
  fetchGitStatus: (path: string) => Promise<void>;
}

export const Terminal: React.FC<TerminalProps> = ({
  isTerminalOpen,
  setIsTerminalOpen,
  activePath,
  fetchGitStatus,
}) => {
  const [terminalOutput, setTerminalOutput] = useState<TerminalOutput[]>([]);
  const [terminalInput, setTerminalInput] = useState('');
  const [terminalHistory, setTerminalHistory] = useState<string[]>([]);
  const [terminalHistoryIndex, setTerminalHistoryIndex] = useState(-1);
  const terminalScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (terminalScrollRef.current) {
      terminalScrollRef.current.scrollTop = terminalScrollRef.current.scrollHeight;
    }
  }, [terminalOutput]);

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

  const getShortPath = (path: string | null) => {
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

  return (
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
  );
};
