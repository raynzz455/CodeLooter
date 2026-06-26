export interface Language {
  id: string;
  label: string;
  emoji: string;
  color: string;
  ext: string; // file extension for download
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
