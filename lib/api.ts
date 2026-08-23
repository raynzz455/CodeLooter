// API client helper untuk FE — panggil BE Render.
//
// Strategi auth:
// - Setelah login: simpan JWT di cookie (httpOnly idealnya, tapi FE Next.js
//   client-side butuh akses token untuk Authorization header)
// - Cookie: 'cl_token' = JWT, 'cl_user' = JSON {id, email, name}
// - Untuk request yang butuh auth: tambah header `Authorization: Bearer <jwt>`
import Cookies from "js-cookie";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000/api";

export interface User {
  id: string;
  email: string;
  name?: string;
}

export interface CodeBlock {
  index: number;
  lang: string;
  code: string;
  lines: number;
  source: string;
}

export interface ExtractResult {
  blocks: CodeBlock[];
  filename: string;
  size: number;
  total: number;
}

export interface SnippetListItem {
  id: string;
  filename: string;
  total_blocks: number;
  created_at: string;
}

export interface Snippet extends SnippetListItem {
  blocks: CodeBlock[];
  user_id: string;
}

// ─── Auth helpers ───
export function getToken(): string | null {
  return Cookies.get("cl_token") ?? null;
}

export function getUser(): User | null {
  const raw = Cookies.get("cl_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function setAuth(token: string, user: User) {
  Cookies.set("cl_token", token, { expires: 7, sameSite: "lax" });
  Cookies.set("cl_user", JSON.stringify(user), { expires: 7, sameSite: "lax" });
}

export function clearAuth() {
  Cookies.remove("cl_token");
  Cookies.remove("cl_user");
}

// ─── API calls ───
async function apiFetch(path: string, options: RequestInit = {}) {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      msg = data.detail || data.message || msg;
    } catch { /* ignore */ }
    throw new Error(msg);
  }

  if (res.status === 204) return null;
  return res.json();
}

// ─── Auth endpoints ───
export async function register(email: string, password: string, name?: string) {
  const data = await apiFetch("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, name }),
  });
  setAuth(data.access_token, data.user);
  return data.user as User;
}

export async function login(email: string, password: string) {
  const data = await apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setAuth(data.access_token, data.user);
  return data.user as User;
}

export async function getMe() {
  return await apiFetch("/auth/me") as User;
}

export function logout() {
  clearAuth();
}

// ─── Extract ───
export async function extractCode(file: File): Promise<ExtractResult> {
  const fd = new FormData();
  fd.append("file", file);
  return await apiFetch("/extract", { method: "POST", body: fd }) as ExtractResult;
}

// ─── Snippets ───
export async function listSnippets(): Promise<SnippetListItem[]> {
  return await apiFetch("/snippets") as SnippetListItem[];
}

export async function getSnippet(id: string): Promise<Snippet> {
  return await apiFetch(`/snippets/${id}`) as Snippet;
}

export async function saveSnippet(filename: string, blocks: CodeBlock[]): Promise<Snippet> {
  return await apiFetch("/snippets", {
    method: "POST",
    body: JSON.stringify({
      filename,
      blocks,
      total_blocks: blocks.length,
    }),
  }) as Snippet;
}

export async function deleteSnippet(id: string): Promise<void> {
  await apiFetch(`/snippets/${id}`, { method: "DELETE" });
}

export async function downloadSnippet(snippetId: string, blockIndex: number = -1): Promise<{ blob: Blob; filename: string }> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/snippets/${snippetId}/download?block=${blockIndex}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  const blob = await res.blob();
  const cd = res.headers.get("Content-Disposition") ?? "";
  const match = cd.match(/filename="?([^"]+)"?/);
  const filename = match?.[1] ?? "snippet";
  return { blob, filename };
}

export { API_BASE };
