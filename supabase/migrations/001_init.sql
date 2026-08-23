-- CodeLooter Database Schema
-- ────────────────────────────────────────────────────────────────────────────
-- Tabel:
--   1. profiles    — user account (email + bcrypt password hash)
--   2. snippets    — hasil ekstraksi user (filename + blocks JSON)
--
-- Penting: file PDF/dokumen asli TIDAK disimpan ke DB.
-- Hanya filename (string) + text code (JSONB) yang disimpan,
-- supaya bisa di-regenerate jadi file saat user download.

-- ─── 1. profiles ───
create table if not exists public.profiles (
    id              uuid primary key default gen_random_uuid(),
    email           text unique not null,
    password_hash   text not null,
    name            text,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create index if not exists profiles_email_idx on public.profiles(email);

-- Trigger: auto-update updated_at
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
    before update on public.profiles
    for each row execute function public.handle_updated_at();

-- ─── 2. snippets ───
create table if not exists public.snippets (
    id                  uuid primary key default gen_random_uuid(),
    user_id             uuid not null references public.profiles(id) on delete cascade,
    original_filename   text not null,           -- e.g. "laporan.pdf"
    blocks              jsonb not null,          -- [{index, lang, code, lines, source}, ...]
    total_blocks        int not null default 0,
    created_at          timestamptz not null default now()
);

create index if not exists snippets_user_id_idx on public.snippets(user_id);
create index if not exists snippets_created_at_idx on public.snippets(created_at desc);

-- ─── RLS (Row Level Security) ───
-- Setiap user hanya bisa akses snippet miliknya sendiri.
alter table public.snippets enable row level security;

drop policy if exists "Users can view own snippets" on public.snippets;
create policy "Users can view own snippets"
    on public.snippets for select
    using (auth.uid() = user_id);

drop policy if exists "Users can insert own snippets" on public.snippets;
create policy "Users can insert own snippets"
    on public.snippets for insert
    with check (auth.uid() = user_id);

drop policy if exists "Users can update own snippets" on public.snippets;
create policy "Users can update own snippets"
    on public.snippets for update
    using (auth.uid() = user_id);

drop policy if exists "Users can delete own snippets" on public.snippets;
create policy "Users can delete own snippets"
    on public.snippets for delete
    using (auth.uid() = user_id);

-- Catatan: BE pakai service_role_key yang BYPASS RLS untuk operasi
-- write ke snippets. RLS tetap aktif untuk operasi langsung dari FE
-- (kalau FE pakai anon key + user JWT dari Supabase Auth).
-- Tapi BE kita tidak pakai Supabase Auth bawaan, jadi RLS di atas
-- lebih untuk defense-in-depth.
