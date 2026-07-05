export interface ScriptFile {
  name: string;
  content: string;
}

export interface GitStatus {
  branch: string;
  status: any;
}

export interface GitLogEntry {
  hash: string;
  date: string;
  message: string;
  author_name: string;
}

export type BlockType = 'scene' | 'action' | 'character' | 'parenthetical' | 'dialogue' | 'transition' | 'shot' | 'general';

export interface ScriptBlock {
  id: string;
  type: BlockType;
  content: string;
}

export interface TerminalOutput {
  type: 'command' | 'stdout' | 'stderr' | 'error';
  content: string;
}
