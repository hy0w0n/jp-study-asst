-- 일본어 학습 어시스턴트 초기 스키마
-- 익명 로그인 사용자도 authenticated 역할이므로 auth.uid() 기준 RLS로 본인 데이터만 접근

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text,
  mode text not null default 'free' check (mode in ('word', 'grammar', 'correct', 'interview', 'free')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.saved_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('word', 'kanji', 'grammar')),
  term text not null,
  reading text,
  meaning text,
  note text,
  created_at timestamptz not null default now(),
  unique (user_id, kind, term)
);

create index if not exists conversations_user_updated_idx on public.conversations (user_id, updated_at desc);
create index if not exists messages_conversation_created_idx on public.messages (conversation_id, created_at);
create index if not exists saved_items_user_created_idx on public.saved_items (user_id, created_at desc);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.saved_items enable row level security;

create policy "conversations: own rows" on public.conversations
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "messages: own rows" on public.messages
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "saved_items: own rows" on public.saved_items
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
