import React from 'react';
import { 
  Type, 
  List, 
  Layout, 
  Sparkles, 
  Loader2, 
  Check, 
  Copy 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BlockType, ScriptBlock } from '@/src/types';

interface RightSidebarProps {
  isRightSidebarOpen: boolean;
  setIsRightSidebarOpen: (open: boolean) => void;
  activeRightTab: 'formatting' | 'outline' | 'title' | 'ai';
  setActiveRightTab: (tab: 'formatting' | 'outline' | 'title' | 'ai') => void;
  activeType: BlockType;
  setActiveType: (type: BlockType) => void;
  applyFormat: (type: BlockType) => void;
  aiSnippet: string;
  setAiSnippet: (snippet: string) => void;
  handleGetAiSuggestions: () => void;
  isAiLoading: boolean;
  aiOptions: string[];
  copyToClipboard: (text: string, index: number) => void;
  copiedIndex: number | null;
  blocks: ScriptBlock[];
  activeBlockId: string | null;
  setActiveBlockId: (id: string | null) => void;
  titlePage: {
    title: string;
    credit: string;
    author: string;
    source: string;
    notes: string;
    contact: string;
  };
  setTitlePage: (page: any) => void;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({
  isRightSidebarOpen,
  setIsRightSidebarOpen,
  activeRightTab,
  setActiveRightTab,
  activeType,
  setActiveType,
  applyFormat,
  aiSnippet,
  setAiSnippet,
  handleGetAiSuggestions,
  isAiLoading,
  aiOptions,
  copyToClipboard,
  copiedIndex,
  blocks,
  activeBlockId,
  setActiveBlockId,
  titlePage,
  setTitlePage,
}) => {
  return (
    <>
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
                            const containerRect = container.getBoundingClientRect();
                            const elRect = el.getBoundingClientRect();
                            const relativeTop = elRect.top - containerRect.top + container.scrollTop;
                            
                            container.scrollTo({
                              top: relativeTop - (container.clientHeight / 2) + (el.clientHeight / 2),
                              behavior: 'smooth'
                            });
                            
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
    </>
  );
};
