export interface Language {
  id: string;
  label: string;
  emoji: string;
  color: string;
  ext: string;
}

export interface RecentFile {
  nama: string;
  jenis: string;
  bahasa: string;
  status: string;
  tgl: string;
  ok: boolean;
}

export interface Stat {
  label: string;
  val: string;
  color: string;
}

export interface CodeBlock {
  index: number;
  lang: string;
  code: string;
  lines: number;
}

export interface ExtractResult {
  blocks: CodeBlock[];
  filename: string;
  size: number;
  total: number;
}
