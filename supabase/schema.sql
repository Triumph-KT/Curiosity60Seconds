create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type app_role as enum ('user', 'admin');
  end if;
  if not exists (select 1 from pg_type where typname = 'post_status') then
    create type post_status as enum ('draft', 'published', 'unpublished');
  end if;
  if not exists (select 1 from pg_type where typname = 'user_status') then
    create type user_status as enum ('active', 'suspended', 'deleted');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_enum e
    join pg_type t on e.enumtypid = t.oid
    where t.typname = 'post_status' and e.enumlabel = 'unpublished'
  ) then
    alter type post_status add value 'unpublished';
  end if;
end $$;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  name text,
  username text unique,
  photo_url text,
  bio text,
  preferences text,
  writing_samples text[] default '{}',
  voice_prompt text,
  onboarded boolean not null default false,
  status user_status not null default 'active',
  role app_role not null default 'user',
  daily_generation_count integer not null default 0,
  daily_generation_limit integer not null default 10,
  last_generation_date date,
  last_digest_sent_at timestamptz,
  show_online_status boolean not null default true,
  last_seen_at timestamptz,
  is_online boolean not null default false,
  deletion_requested_at timestamptz,
  deletion_approved_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.users
  add column if not exists status user_status;

update public.users
set status = 'active'
where status is null;

alter table public.users
  alter column status set default 'active',
  alter column status set not null;

alter table public.users
  add column if not exists last_generation_date date;

alter table public.users
  add column if not exists last_digest_sent_at timestamptz;

alter table public.users
  add column if not exists show_online_status boolean not null default true,
  add column if not exists last_seen_at timestamptz,
  add column if not exists is_online boolean not null default false;

alter table public.users
  add column if not exists deletion_requested_at timestamptz;

alter table public.users
  add column if not exists deletion_approved_at timestamptz;

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null default 'Untitled',
  slug text not null,
  body_md text not null default '',
  raw_input jsonb not null default '{}'::jsonb,
  status post_status not null default 'draft',
  published_at timestamptz,
  deletion_requested_at timestamptz,
  deletion_approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, slug)
);

alter table public.posts
  add column if not exists deletion_requested_at timestamptz;

alter table public.posts
  add column if not exists deletion_approved_at timestamptz;

create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  url text,
  quote text,
  image_url text,
  image_caption text,
  source_label text,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  action text not null,
  table_name text not null,
  record_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  "timestamp" timestamptz not null default now()
);

create table if not exists public.system_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  type text not null,
  message text not null,
  category text not null default 'system',
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references public.users(id) on delete cascade,
  following_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (follower_id, following_id),
  check (follower_id <> following_id)
);

create index if not exists follows_follower_id_idx on public.follows (follower_id);
create index if not exists follows_following_id_idx on public.follows (following_id);

create table if not exists public.reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null,
  created_at timestamptz not null default now(),
  unique (post_id, user_id, type)
);

create index if not exists reactions_post_id_idx on public.reactions (post_id);
create index if not exists reactions_user_id_idx on public.reactions (user_id);

create table if not exists public.reposts (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create index if not exists reposts_post_id_idx on public.reposts (post_id);
create index if not exists reposts_user_id_idx on public.reposts (user_id);
create index if not exists reposts_created_at_idx on public.reposts (created_at desc);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null,
  actor_id uuid references public.users(id) on delete set null,
  post_id uuid references public.posts(id) on delete cascade,
  message text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_id_idx on public.notifications (user_id);
create index if not exists notifications_created_at_idx on public.notifications (created_at desc);

create table if not exists public.shares (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  sender_id uuid not null references public.users(id) on delete cascade,
  recipient_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, sender_id, recipient_id)
);

create index if not exists shares_post_id_idx on public.shares (post_id);

create table if not exists public.collaborations (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  requester_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'pending',
  requested_at timestamptz not null default now(),
  author_approved_at timestamptz,
  admin_approved_at timestamptz,
  rejected_at timestamptz,
  unique (post_id, requester_id),
  check (status in ('pending', 'author_approved', 'admin_approved', 'rejected'))
);

create index if not exists collaborations_post_id_idx on public.collaborations (post_id);
create index if not exists collaborations_status_idx on public.collaborations (status);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  parent_id uuid references public.comments(id) on delete cascade,
  body text not null,
  reported boolean not null default false,
  deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists comments_post_id_idx on public.comments (post_id);
create index if not exists comments_parent_id_idx on public.comments (parent_id);
create index if not exists comments_user_id_idx on public.comments (user_id);

create table if not exists public.comment_reports (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments(id) on delete cascade,
  reporter_id uuid not null references public.users(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  unique (comment_id, reporter_id)
);

create index if not exists comment_reports_comment_id_idx on public.comment_reports (comment_id);
create index if not exists comment_reports_reporter_id_idx on public.comment_reports (reporter_id);

create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade unique,
  notify_reactions boolean not null default true,
  notify_comments boolean not null default true,
  notify_replies boolean not null default true,
  notify_follows boolean not null default true,
  notify_reposts boolean not null default true,
  notify_shares boolean not null default true,
  notify_collaborations boolean not null default true,
  notify_system boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists notification_preferences_user_id_idx on public.notification_preferences (user_id);

alter table public.notification_preferences
  add column if not exists notify_messages boolean not null default true;

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  name text,
  is_group boolean not null default false,
  hidden_for uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversation_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  last_read_at timestamptz,
  typing_until timestamptz,
  muted_until timestamptz,
  is_request boolean not null default true,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  unique (conversation_id, user_id)
);

create index if not exists conversation_participants_conversation_id_idx
  on public.conversation_participants (conversation_id);
create index if not exists conversation_participants_user_id_idx
  on public.conversation_participants (user_id);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.users(id) on delete cascade,
  body text,
  post_id uuid references public.posts(id) on delete set null,
  image_url text,
  parent_message_id uuid references public.messages(id) on delete set null,
  link_preview jsonb,
  type text not null default 'text',
  reported boolean not null default false,
  deleted boolean not null default false,
  edited_at timestamptz,
  hidden_for uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  check (type in ('text', 'post_share', 'image')),
  check (
    (type = 'text' and body is not null and length(trim(body)) > 0)
    or (type = 'post_share' and post_id is not null)
    or (type = 'image' and image_url is not null and length(trim(image_url)) > 0)
  )
);

create index if not exists messages_conversation_id_idx on public.messages (conversation_id);
create index if not exists messages_sender_id_idx on public.messages (sender_id);
create index if not exists messages_created_at_idx on public.messages (conversation_id, created_at desc);
create index if not exists messages_parent_message_id_idx on public.messages (parent_message_id);

create table if not exists public.message_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  reporter_id uuid not null references public.users(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  unique (message_id, reporter_id)
);

create index if not exists message_reports_message_id_idx on public.message_reports (message_id);

alter table public.messages
  add column if not exists parent_message_id uuid references public.messages(id) on delete set null,
  add column if not exists deleted boolean not null default false,
  add column if not exists edited_at timestamptz,
  add column if not exists image_url text,
  add column if not exists link_preview jsonb;

alter table public.conversation_participants
  add column if not exists muted_until timestamptz,
  add column if not exists is_request boolean not null default true,
  add column if not exists is_admin boolean not null default false;

alter table public.conversations
  add column if not exists name text,
  add column if not exists is_group boolean not null default false,
  add column if not exists hidden_for uuid[] not null default '{}';

create table if not exists public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (message_id, user_id, emoji)
);

create index if not exists message_reactions_message_id_idx on public.message_reactions (message_id);

create table if not exists public.blocked_users (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.users(id) on delete cascade,
  blocked_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index if not exists blocked_users_blocker_idx on public.blocked_users (blocker_id);
create index if not exists blocked_users_blocked_idx on public.blocked_users (blocked_id);

alter table public.notifications
  add column if not exists conversation_id uuid references public.conversations(id) on delete set null;

create index if not exists notifications_conversation_id_idx on public.notifications (conversation_id);

create or replace function public.touch_conversation_on_message()
returns trigger as $$
begin
  update public.conversations
  set updated_at = now()
  where id = new.conversation_id;
  return new;
end;
$$ language plpgsql;

drop trigger if exists messages_touch_conversation_updated_at on public.messages;
create trigger messages_touch_conversation_updated_at
after insert on public.messages
for each row execute function public.touch_conversation_on_message();

create or replace function public.unread_message_count()
returns integer
language sql
stable
security invoker
set search_path = public
as $$
  select count(*)::int
  from public.messages m
  inner join public.conversation_participants cp
    on cp.conversation_id = m.conversation_id and cp.user_id = auth.uid()
  where m.sender_id is distinct from auth.uid()
    and not (auth.uid() = any (m.hidden_for))
    and not exists (
      select 1 from public.blocked_users b
      where b.blocker_id = auth.uid() and b.blocked_id = m.sender_id
    )
    and (cp.last_read_at is null or m.created_at > cp.last_read_at);
$$;

grant execute on function public.unread_message_count() to authenticated;

create table if not exists public.post_views (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  viewer_id uuid references public.users(id) on delete set null,
  viewed_at timestamptz not null default now(),
  duration_seconds integer
);

create index if not exists post_views_post_id_idx on public.post_views (post_id);
create index if not exists post_views_viewer_id_idx on public.post_views (viewer_id);

create table if not exists public.profile_views (
  id uuid primary key default gen_random_uuid(),
  profile_user_id uuid not null references public.users(id) on delete cascade,
  viewer_id uuid references public.users(id) on delete set null,
  viewed_at timestamptz not null default now()
);

create index if not exists profile_views_profile_user_id_idx on public.profile_views (profile_user_id);

alter table public.system_alerts
  add column if not exists category text;

update public.system_alerts
set category = 'system'
where category is null;

alter table public.system_alerts
  alter column category set default 'system',
  alter column category set not null;

-- Auto-update updated_at on posts
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists posts_set_updated_at on public.posts;
create trigger posts_set_updated_at
before update on public.posts
for each row execute function public.touch_updated_at();

-- Audit log trigger function
create or replace function public.write_audit_log()
returns trigger as $$
declare
  actor uuid;
  affected uuid;
  payload jsonb;
begin
  actor := coalesce(auth.uid(), new.id, old.id);
  affected := coalesce(new.id, old.id);
  payload := case
    when tg_op = 'DELETE' then to_jsonb(old)
    else to_jsonb(new)
  end;

  insert into public.audit_log (user_id, action, table_name, record_id, metadata)
  values (
    actor,
    lower(tg_op),
    tg_table_name,
    affected,
    payload
  );

  return coalesce(new, old);
end;
$$ language plpgsql security definer;

drop trigger if exists users_audit_iud on public.users;
create trigger users_audit_iud
after insert or update or delete on public.users
for each row execute function public.write_audit_log();

drop trigger if exists posts_audit_iud on public.posts;
create trigger posts_audit_iud
after insert or update or delete on public.posts
for each row execute function public.write_audit_log();

-- Auto-create public.users row when a new auth user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Enable RLS on all tables
alter table public.users enable row level security;
alter table public.posts enable row level security;
alter table public.sources enable row level security;
alter table public.audit_log enable row level security;
alter table public.system_alerts enable row level security;
alter table public.follows enable row level security;
alter table public.reactions enable row level security;
alter table public.reposts enable row level security;
alter table public.notifications enable row level security;
alter table public.shares enable row level security;
alter table public.collaborations enable row level security;
alter table public.comments enable row level security;
alter table public.comment_reports enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.post_views enable row level security;
alter table public.profile_views enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.message_reports enable row level security;
alter table public.message_reactions enable row level security;
alter table public.blocked_users enable row level security;

drop policy if exists "post views read all" on public.post_views;
create policy "post views read all" on public.post_views
for select using (true);

drop policy if exists "post views insert all" on public.post_views;
create policy "post views insert all" on public.post_views
for insert with check (true);

drop policy if exists "profile views read all" on public.profile_views;
create policy "profile views read all" on public.profile_views
for select using (true);

drop policy if exists "profile views insert all" on public.profile_views;
create policy "profile views insert all" on public.profile_views
for insert with check (true);

-- Messaging: conversations (participants read; participants update for activity triggers)
drop policy if exists "conversations select participant" on public.conversations;
create policy "conversations select participant" on public.conversations
for select to authenticated
using (
  exists (
    select 1 from public.conversation_participants cp
    where cp.conversation_id = id and cp.user_id = auth.uid()
  )
);

drop policy if exists "conversations update participant" on public.conversations;
create policy "conversations update participant" on public.conversations
for update to authenticated
using (
  exists (
    select 1 from public.conversation_participants cp
    where cp.conversation_id = id and cp.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.conversation_participants cp
    where cp.conversation_id = id and cp.user_id = auth.uid()
  )
);

-- Messaging: participants (see all rows in shared conversations; update own row)
drop policy if exists "conversation_participants select shared" on public.conversation_participants;
create policy "conversation_participants select shared" on public.conversation_participants
for select to authenticated
using (
  exists (
    select 1 from public.conversation_participants me
    where me.conversation_id = conversation_participants.conversation_id
      and me.user_id = auth.uid()
  )
);

drop policy if exists "conversation_participants update own" on public.conversation_participants;
create policy "conversation_participants update own" on public.conversation_participants
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Messaging: messages
drop policy if exists "messages select participant visible" on public.messages;
create policy "messages select participant visible" on public.messages
for select to authenticated
using (
  exists (
    select 1 from public.conversation_participants cp
    where cp.conversation_id = messages.conversation_id and cp.user_id = auth.uid()
  )
  and not (auth.uid() = any (messages.hidden_for))
  and not exists (
    select 1 from public.blocked_users b
    where b.blocker_id = auth.uid() and b.blocked_id = messages.sender_id
  )
);

drop policy if exists "messages insert participant self" on public.messages;
create policy "messages insert participant self" on public.messages
for insert to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1 from public.conversation_participants cp
    where cp.conversation_id = messages.conversation_id and cp.user_id = auth.uid()
  )
);

drop policy if exists "messages update own sent" on public.messages;
create policy "messages update own sent" on public.messages
for update to authenticated
using (sender_id = auth.uid())
with check (sender_id = auth.uid());

-- Messaging: message reports
drop policy if exists "message reports insert own" on public.message_reports;
create policy "message reports insert own" on public.message_reports
for insert to authenticated
with check (auth.uid() = reporter_id);

drop policy if exists "message reports read admin" on public.message_reports;
create policy "message reports read admin" on public.message_reports
for select to authenticated
using (
  exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'admin'
  )
);

-- Messaging: message reactions
drop policy if exists "message reactions read conversation participants" on public.message_reactions;
create policy "message reactions read conversation participants" on public.message_reactions
for select to authenticated
using (
  exists (
    select 1
    from public.messages m
    inner join public.conversation_participants cp on cp.conversation_id = m.conversation_id
    where m.id = message_reactions.message_id
      and cp.user_id = auth.uid()
  )
);

drop policy if exists "message reactions insert own" on public.message_reactions;
create policy "message reactions insert own" on public.message_reactions
for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.messages m
    inner join public.conversation_participants cp on cp.conversation_id = m.conversation_id
    where m.id = message_reactions.message_id
      and cp.user_id = auth.uid()
  )
);

drop policy if exists "message reactions delete own" on public.message_reactions;
create policy "message reactions delete own" on public.message_reactions
for delete to authenticated
using (user_id = auth.uid());

-- Messaging: blocked users
drop policy if exists "blocked_users select own" on public.blocked_users;
create policy "blocked_users select own" on public.blocked_users
for select to authenticated
using (blocker_id = auth.uid());

drop policy if exists "blocked_users insert own" on public.blocked_users;
create policy "blocked_users insert own" on public.blocked_users
for insert to authenticated
with check (blocker_id = auth.uid());

drop policy if exists "blocked_users delete own" on public.blocked_users;
create policy "blocked_users delete own" on public.blocked_users
for delete to authenticated
using (blocker_id = auth.uid());

drop policy if exists "notification prefs read own" on public.notification_preferences;
create policy "notification prefs read own" on public.notification_preferences
for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "notification prefs insert own" on public.notification_preferences;
create policy "notification prefs insert own" on public.notification_preferences
for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "notification prefs update own" on public.notification_preferences;
create policy "notification prefs update own" on public.notification_preferences
for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Comment reports: authenticated users can insert own reports; admins can read all
drop policy if exists "comment reports insert own" on public.comment_reports;
create policy "comment reports insert own" on public.comment_reports
for insert to authenticated
with check (auth.uid() = reporter_id);

drop policy if exists "comment reports read admin only" on public.comment_reports;
create policy "comment reports read admin only" on public.comment_reports
for select to authenticated
using (
  exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'admin'
  )
);

-- Comments: public can read non-deleted comments on published posts
drop policy if exists "comments read public non-deleted on published" on public.comments;
create policy "comments read public non-deleted on published" on public.comments
for select
using (
  deleted = false
  and exists (
    select 1 from public.posts p
    where p.id = post_id and p.status = 'published'
  )
);

-- Comments: comment owner/post author/admin can read all comments for moderation/thread context
drop policy if exists "comments read owner author admin all" on public.comments;
create policy "comments read owner author admin all" on public.comments
for select to authenticated
using (
  auth.uid() = user_id
  or exists (
    select 1 from public.posts p
    where p.id = post_id and p.user_id = auth.uid()
  )
  or exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'admin'
  )
);

drop policy if exists "comments insert own" on public.comments;
create policy "comments insert own" on public.comments
for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "comments update owner_or_author_or_admin" on public.comments;
create policy "comments update owner_or_author_or_admin" on public.comments
for update to authenticated
using (
  auth.uid() = user_id
  or exists (
    select 1 from public.posts p
    where p.id = post_id and p.user_id = auth.uid()
  )
  or exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'admin'
  )
)
with check (
  auth.uid() = user_id
  or exists (
    select 1 from public.posts p
    where p.id = post_id and p.user_id = auth.uid()
  )
  or exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'admin'
  )
);

drop policy if exists "comments delete own_or_author_or_admin" on public.comments;
create policy "comments delete own_or_author_or_admin" on public.comments
for delete to authenticated
using (
  auth.uid() = user_id
  or exists (
    select 1 from public.posts p
    where p.id = post_id and p.user_id = auth.uid()
  )
  or exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'admin'
  )
);

-- Collaborations: requester can insert own; requester/post-author/admin can read; post-author/admin can update
drop policy if exists "collaborations insert own requester" on public.collaborations;
create policy "collaborations insert own requester" on public.collaborations
for insert to authenticated
with check (auth.uid() = requester_id);

drop policy if exists "collaborations read requester_or_author_or_admin" on public.collaborations;
create policy "collaborations read requester_or_author_or_admin" on public.collaborations
for select to authenticated
using (
  auth.uid() = requester_id
  or exists (
    select 1 from public.posts p
    where p.id = post_id and p.user_id = auth.uid()
  )
  or exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'admin'
  )
);

drop policy if exists "collaborations update author_or_admin" on public.collaborations;
create policy "collaborations update author_or_admin" on public.collaborations
for update to authenticated
using (
  exists (
    select 1 from public.posts p
    where p.id = post_id and p.user_id = auth.uid()
  )
  or exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.posts p
    where p.id = post_id and p.user_id = auth.uid()
  )
  or exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'admin'
  )
);

-- Shares: anyone can read; authenticated users can insert only their own rows as sender
drop policy if exists "shares select all" on public.shares;
create policy "shares select all" on public.shares
for select using (true);

drop policy if exists "shares insert own" on public.shares;
create policy "shares insert own" on public.shares
for insert to authenticated
with check (auth.uid() = sender_id);

-- Reposts: anyone can read; authenticated users can insert/delete only their own rows
drop policy if exists "reposts select all" on public.reposts;
create policy "reposts select all" on public.reposts
for select using (true);

drop policy if exists "reposts insert own" on public.reposts;
create policy "reposts insert own" on public.reposts
for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "reposts delete own" on public.reposts;
create policy "reposts delete own" on public.reposts
for delete to authenticated
using (auth.uid() = user_id);

-- Notifications: users can read and update only their own rows (inserts via service role)
drop policy if exists "notifications select own" on public.notifications;
create policy "notifications select own" on public.notifications
for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "notifications update own" on public.notifications;
create policy "notifications update own" on public.notifications
for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Reactions: anyone can read; authenticated users can insert/delete only their own rows
drop policy if exists "reactions select all" on public.reactions;
create policy "reactions select all" on public.reactions
for select using (true);

drop policy if exists "reactions insert own" on public.reactions;
create policy "reactions insert own" on public.reactions
for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "reactions delete own" on public.reactions;
create policy "reactions delete own" on public.reactions
for delete to authenticated
using (auth.uid() = user_id);

-- Follows: anyone can read; authenticated users can insert/delete only their own rows as follower
drop policy if exists "follows select all" on public.follows;
create policy "follows select all" on public.follows
for select using (true);

drop policy if exists "follows insert own" on public.follows;
create policy "follows insert own" on public.follows
for insert to authenticated
with check (
  auth.uid() = follower_id
  and follower_id <> following_id
);

drop policy if exists "follows delete own" on public.follows;
create policy "follows delete own" on public.follows
for delete to authenticated
using (auth.uid() = follower_id);

-- Users: self can manage own row; admins can manage any row
drop policy if exists "users self or admin" on public.users;
create policy "users self or admin" on public.users
for all using (
  auth.uid() = id
  or exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
)
with check (
  auth.uid() = id
  or exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
);

-- Users: anyone can read onboarded user profiles (for public pages)
drop policy if exists "public can read onboarded users" on public.users;
create policy "public can read onboarded users" on public.users
for select using (onboarded = true and status = 'active');

-- Posts: readable if published, or owner, or admin
drop policy if exists "posts readable when published or owner/admin" on public.posts;
create policy "posts readable when published or owner/admin" on public.posts
for select using (
  status = 'published'
  or auth.uid() = user_id
  or exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
);

-- Posts: writable by owner or admin
drop policy if exists "posts writable owner or admin" on public.posts;
create policy "posts writable owner or admin" on public.posts
for all using (
  auth.uid() = user_id
  or exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
)
with check (
  auth.uid() = user_id
  or exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
);

-- Sources: readable based on post visibility
drop policy if exists "sources readable with post visibility" on public.sources;
create policy "sources readable with post visibility" on public.sources
for select using (
  exists (
    select 1 from public.posts p
    where p.id = post_id
      and (
        p.status = 'published'
        or p.user_id = auth.uid()
        or exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
      )
  )
);

-- Sources: writable by post owner or admin
drop policy if exists "sources writable owner or admin" on public.sources;
create policy "sources writable owner or admin" on public.sources
for all using (
  exists (
    select 1 from public.posts p
    where p.id = post_id
      and (
        p.user_id = auth.uid()
        or exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
      )
  )
)
with check (
  exists (
    select 1 from public.posts p
    where p.id = post_id
      and (
        p.user_id = auth.uid()
        or exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
      )
  )
);

-- Audit log: admin only
drop policy if exists "audit admin only" on public.audit_log;
create policy "audit admin only" on public.audit_log
for select using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
);

-- System alerts: admin read/update only
drop policy if exists "system alerts admin read" on public.system_alerts;
create policy "system alerts admin read" on public.system_alerts
for select using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
);

drop policy if exists "system alerts admin update" on public.system_alerts;
create policy "system alerts admin update" on public.system_alerts
for update using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
)
with check (
  exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
);

-- Feed timeline: union of published posts and reposts (used by /feed)
create or replace function public.feed_timeline(
  p_viewer uuid,
  p_mode text,
  p_limit int,
  p_offset int
)
returns table (
  item_kind text,
  sort_at timestamptz,
  repost_id uuid,
  reposter_id uuid,
  reposter_name text,
  reposter_username text,
  reposter_photo_url text,
  post_id uuid,
  post_title text,
  post_slug text,
  post_body_md text,
  post_published_at timestamptz,
  author_name text,
  author_username text,
  author_photo_url text,
  author_id uuid
)
language sql
stable
as $$
  select * from (
    select
      'post'::text as item_kind,
      p.published_at as sort_at,
      null::uuid as repost_id,
      null::uuid as reposter_id,
      null::text as reposter_name,
      null::text as reposter_username,
      null::text as reposter_photo_url,
      p.id as post_id,
      p.title as post_title,
      p.slug as post_slug,
      p.body_md as post_body_md,
      p.published_at as post_published_at,
      author.name as author_name,
      author.username as author_username,
      author.photo_url as author_photo_url,
      author.id as author_id
    from public.posts p
    inner join public.users author on author.id = p.user_id
    where p.status = 'published'
      and author.onboarded = true
      and author.status = 'active'
      and (
        (
          p_mode = 'everyone'
          and (p_viewer is null or p.user_id <> p_viewer)
        )
        or (
          p_mode = 'following'
          and p_viewer is not null
          and p.user_id in (
            select f.following_id from public.follows f where f.follower_id = p_viewer
          )
        )
      )
    union all
    select
      'repost'::text,
      r.created_at,
      r.id,
      r.user_id,
      reposter.name,
      reposter.username,
      reposter.photo_url,
      p.id,
      p.title,
      p.slug,
      p.body_md,
      p.published_at,
      author.name,
      author.username,
      author.photo_url,
      author.id
    from public.reposts r
    inner join public.posts p on p.id = r.post_id and p.status = 'published'
    inner join public.users author on author.id = p.user_id
    inner join public.users reposter on reposter.id = r.user_id
    where author.onboarded = true
      and author.status = 'active'
      and reposter.onboarded = true
      and reposter.status = 'active'
      and (
        (
          p_mode = 'everyone'
          and (p_viewer is null or r.user_id <> p_viewer)
        )
        or (
          p_mode = 'following'
          and p_viewer is not null
          and r.user_id in (
            select f.following_id from public.follows f where f.follower_id = p_viewer
          )
        )
      )
  ) sub
  order by sub.sort_at desc
  limit p_limit
  offset p_offset;
$$;

create or replace function public.feed_timeline_count(
  p_viewer uuid,
  p_mode text
)
returns bigint
language sql
stable
as $$
  select count(*)::bigint from (
    select 1
    from public.posts p
    inner join public.users author on author.id = p.user_id
    where p.status = 'published'
      and author.onboarded = true
      and author.status = 'active'
      and (
        (
          p_mode = 'everyone'
          and (p_viewer is null or p.user_id <> p_viewer)
        )
        or (
          p_mode = 'following'
          and p_viewer is not null
          and p.user_id in (
            select f.following_id from public.follows f where f.follower_id = p_viewer
          )
        )
      )
    union all
    select 1
    from public.reposts r
    inner join public.posts p on p.id = r.post_id and p.status = 'published'
    inner join public.users author on author.id = p.user_id
    inner join public.users reposter on reposter.id = r.user_id
    where author.onboarded = true
      and author.status = 'active'
      and reposter.onboarded = true
      and reposter.status = 'active'
      and (
        (
          p_mode = 'everyone'
          and (p_viewer is null or r.user_id <> p_viewer)
        )
        or (
          p_mode = 'following'
          and p_viewer is not null
          and r.user_id in (
            select f.following_id from public.follows f where f.follower_id = p_viewer
          )
        )
      )
  ) t;
$$;

grant execute on function public.feed_timeline(uuid, text, int, int) to anon, authenticated;
grant execute on function public.feed_timeline_count(uuid, text) to anon, authenticated;