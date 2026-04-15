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
