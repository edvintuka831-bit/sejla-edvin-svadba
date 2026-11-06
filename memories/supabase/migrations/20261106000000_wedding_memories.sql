-- =====================================================================
--  Šejla & Edvin · Wedding Memories
--  Kompletna šema baze, Row Level Security i Storage (jedna migracija).
--
--  Pokretanje na Supabaseu: Dashboard → SQL Editor → New query →
--  zalijepite CIJELI sadržaj ove datoteke → Run.
--  Skripta je napisana tako da se smije pokrenuti više puta.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Administratori (najviše DVA računa)
-- ---------------------------------------------------------------------
create table if not exists public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  email      text not null unique,
  created_at timestamptz not null default now()
);

create or replace function public.enforce_admin_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.admins) >= 2 then
    raise exception 'Dozvoljena su najviše dva administratorska računa.';
  end if;
  return new;
end;
$$;

drop trigger if exists admins_limit on public.admins;
create trigger admins_limit
  before insert on public.admins
  for each row execute function public.enforce_admin_limit();

-- Da li je trenutno prijavljeni korisnik administrator?
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admins where user_id = (select auth.uid())
  );
$$;

-- ---------------------------------------------------------------------
-- 2. Fotografije i videozapisi
-- ---------------------------------------------------------------------
create table if not exists public.media (
  id                  uuid primary key default gen_random_uuid(),
  kind                text not null check (kind in ('image', 'video')),
  status              text not null default 'uploading'
                        check (status in ('uploading', 'pending', 'approved', 'rejected')),
  guest_name          text not null check (char_length(guest_name) between 1 and 60),
  caption             text check (caption is null or char_length(caption) <= 300),
  original_name       text not null check (char_length(original_name) <= 255),
  mime_type           text not null,
  size_bytes          bigint not null check (size_bytes > 0),
  width               integer,
  height              integer,
  duration_seconds    numeric(8, 2),
  -- privatni bucket "uploads"
  original_path       text not null,
  preview_path        text,
  thumb_path          text,
  -- javni bucket "gallery" (popunjava se tek nakon odobrenja)
  public_preview_path text,
  public_thumb_path   text,
  public_video_path   text,
  batch_id            uuid not null,
  batch_key_hash      text not null,
  consent_at          timestamptz not null,
  created_at          timestamptz not null default now(),
  completed_at        timestamptz,
  reviewed_at         timestamptz,
  reviewed_by         uuid references auth.users (id) on delete set null
);

create index if not exists media_status_created_idx on public.media (status, created_at desc);
create index if not exists media_batch_idx on public.media (batch_id);

-- ---------------------------------------------------------------------
-- 3. Čestitke
-- ---------------------------------------------------------------------
create table if not exists public.wishes (
  id          uuid primary key default gen_random_uuid(),
  guest_name  text not null check (char_length(guest_name) between 1 and 60),
  message     text not null check (char_length(message) between 1 and 1000),
  status      text not null default 'pending'
                check (status in ('pending', 'approved', 'rejected')),
  consent_at  timestamptz not null,
  created_at  timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null
);

create index if not exists wishes_status_created_idx on public.wishes (status, created_at desc);

-- ---------------------------------------------------------------------
-- 4. Zaštita od masovnog slanja (koristi je samo serverska funkcija)
-- ---------------------------------------------------------------------
create table if not exists public.rate_events (
  id          bigint generated always as identity primary key,
  client_hash text not null,
  action      text not null,
  units       integer not null default 1,
  created_at  timestamptz not null default now()
);

create index if not exists rate_events_lookup_idx
  on public.rate_events (action, client_hash, created_at desc);

-- Atomski provjeri i upiši: vraća true ako je zahtjev dozvoljen.
create or replace function public.consume_rate(
  p_client_hash text,
  p_action      text,
  p_units       integer,
  p_limit       integer,
  p_window      interval
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  used integer;
begin
  perform pg_advisory_xact_lock(hashtext(p_action || ':' || p_client_hash));

  select coalesce(sum(units), 0) into used
  from public.rate_events
  where action = p_action
    and client_hash = p_client_hash
    and created_at > now() - p_window;

  if used + p_units > p_limit then
    return false;
  end if;

  insert into public.rate_events (client_hash, action, units)
  values (p_client_hash, p_action, p_units);

  -- povremeno čišćenje starih zapisa
  if random() < 0.02 then
    delete from public.rate_events where created_at < now() - interval '3 days';
  end if;

  return true;
end;
$$;

-- Ukupno zauzeće prostora (oba bucketa) u bajtovima.
create or replace function public.storage_usage_bytes()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum((metadata ->> 'size')::bigint), 0)::bigint
  from storage.objects
  where bucket_id in ('uploads', 'gallery');
$$;

-- ---------------------------------------------------------------------
-- 5. Javni (gostinski) pristup – ISKLJUČIVO odobren sadržaj, preko funkcija
-- ---------------------------------------------------------------------
create or replace function public.gallery_media(
  p_kind   text default null,
  p_limit  integer default 30,
  p_before timestamptz default null
)
returns table (
  id                  uuid,
  kind                text,
  guest_name          text,
  caption             text,
  width               integer,
  height              integer,
  duration_seconds    numeric,
  public_preview_path text,
  public_thumb_path   text,
  public_video_path   text,
  approved_at         timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.kind, m.guest_name, m.caption, m.width, m.height, m.duration_seconds,
         m.public_preview_path, m.public_thumb_path, m.public_video_path, m.reviewed_at
  from public.media m
  where m.status = 'approved'
    and (p_kind is null or m.kind = p_kind)
    and (p_before is null or m.reviewed_at < p_before)
  order by m.reviewed_at desc, m.id
  limit least(greatest(coalesce(p_limit, 30), 1), 60);
$$;

create or replace function public.gallery_wishes(
  p_limit  integer default 30,
  p_before timestamptz default null
)
returns table (id uuid, guest_name text, message text, approved_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select w.id, w.guest_name, w.message, w.reviewed_at
  from public.wishes w
  where w.status = 'approved'
    and (p_before is null or w.reviewed_at < p_before)
  order by w.reviewed_at desc, w.id
  limit least(greatest(coalesce(p_limit, 30), 1), 60);
$$;

create or replace function public.gallery_counts()
returns table (photos bigint, videos bigint, wishes bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*) from public.media where status = 'approved' and kind = 'image'),
    (select count(*) from public.media where status = 'approved' and kind = 'video'),
    (select count(*) from public.wishes where status = 'approved');
$$;

-- Statistika za administratore
create or replace function public.admin_stats()
returns table (
  pending_photos  bigint, pending_videos  bigint,
  approved_photos bigint, approved_videos bigint,
  rejected_media  bigint, total_uploaded  bigint,
  total_bytes     bigint, uploaders       bigint,
  pending_wishes  bigint, approved_wishes bigint, rejected_wishes bigint,
  storage_bytes   bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Nemate administratorska prava.' using errcode = '42501';
  end if;
  return query
  select
    count(*) filter (where m.status = 'pending'  and m.kind = 'image'),
    count(*) filter (where m.status = 'pending'  and m.kind = 'video'),
    count(*) filter (where m.status = 'approved' and m.kind = 'image'),
    count(*) filter (where m.status = 'approved' and m.kind = 'video'),
    count(*) filter (where m.status = 'rejected'),
    count(*) filter (where m.status <> 'uploading'),
    coalesce(sum(m.size_bytes) filter (where m.status <> 'uploading'), 0)::bigint,
    count(distinct m.batch_id) filter (where m.status <> 'uploading'),
    (select count(*) from public.wishes w where w.status = 'pending'),
    (select count(*) from public.wishes w where w.status = 'approved'),
    (select count(*) from public.wishes w where w.status = 'rejected'),
    public.storage_usage_bytes()
  from public.media m;
end;
$$;

-- ---------------------------------------------------------------------
-- 6. Row Level Security
-- ---------------------------------------------------------------------
alter table public.admins      enable row level security;
alter table public.media       enable row level security;
alter table public.wishes      enable row level security;
alter table public.rate_events enable row level security;

-- Gosti (anon) nemaju NIKAKAV direktan pristup tabelama.
revoke all on public.admins, public.media, public.wishes, public.rate_events from anon;
revoke all on public.admins, public.media, public.wishes, public.rate_events from authenticated;

-- Prijavljeni korisnici: samo ono što RLS dozvoli administratorima.
grant select on public.admins to authenticated;
grant select, update, delete on public.media  to authenticated;
grant select, update, delete on public.wishes to authenticated;

drop policy if exists "admin vidi svoj zapis" on public.admins;
create policy "admin vidi svoj zapis" on public.admins
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "admin čita medije" on public.media;
create policy "admin čita medije" on public.media
  for select to authenticated using ((select public.is_admin()));

drop policy if exists "admin mijenja medije" on public.media;
create policy "admin mijenja medije" on public.media
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "admin briše medije" on public.media;
create policy "admin briše medije" on public.media
  for delete to authenticated using ((select public.is_admin()));

drop policy if exists "admin čita čestitke" on public.wishes;
create policy "admin čita čestitke" on public.wishes
  for select to authenticated using ((select public.is_admin()));

drop policy if exists "admin mijenja čestitke" on public.wishes;
create policy "admin mijenja čestitke" on public.wishes
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "admin briše čestitke" on public.wishes;
create policy "admin briše čestitke" on public.wishes
  for delete to authenticated using ((select public.is_admin()));

-- rate_events: bez ijedne politike → dostupno samo serverskom (secret) ključu.

-- Prava na funkcije
revoke execute on function public.consume_rate(text, text, integer, integer, interval) from public, anon, authenticated;
revoke execute on function public.storage_usage_bytes() from public, anon, authenticated;
revoke execute on function public.enforce_admin_limit() from public, anon, authenticated;
revoke execute on function public.admin_stats() from public, anon;
revoke execute on function public.is_admin() from public, anon;
grant  execute on function public.consume_rate(text, text, integer, integer, interval) to service_role;
grant  execute on function public.storage_usage_bytes() to service_role;
grant  execute on function public.admin_stats() to authenticated;
grant  execute on function public.is_admin() to authenticated;
grant  execute on function public.gallery_media(text, integer, timestamptz) to anon, authenticated;
grant  execute on function public.gallery_wishes(integer, timestamptz) to anon, authenticated;
grant  execute on function public.gallery_counts() to anon, authenticated;

-- ---------------------------------------------------------------------
-- 7. Storage
--    uploads  – PRIVATNI: originali + pregledi svih poslanih datoteka
--    gallery  – JAVNI za čitanje po tačnoj putanji: samo kopije ODOBRENOG sadržaja
--               (pregledi bez EXIF/GPS podataka i videozapisi)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('uploads', 'uploads', false, 52428800, array[
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
    'video/mp4', 'video/quicktime', 'video/webm', 'video/3gpp'
  ]),
  ('gallery', 'gallery', true, 52428800, array[
    'image/jpeg', 'image/png', 'image/webp',
    'video/mp4', 'video/quicktime', 'video/webm', 'video/3gpp'
  ])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Administratori smiju čitati privatne datoteke (pregled i preuzimanje originala
-- preko kratkotrajnih potpisanih linkova). Gosti nemaju nijednu politiku:
-- upload ide isključivo preko jednokratnih potpisanih linkova koje izdaje server.
drop policy if exists "admin čita uploads" on storage.objects;
create policy "admin čita uploads" on storage.objects
  for select to authenticated
  using (bucket_id = 'uploads' and (select public.is_admin()));
