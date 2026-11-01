-- =====================================================================
--  ĐƠN NGUYÊN CƠ XƯƠNG KHỚP – tạo database
--  Cách dùng: Supabase → SQL Editor → New query → dán toàn bộ → Run
-- =====================================================================

-- 1) Các bảng dữ liệu (mỗi dòng lưu 1 bản ghi dạng JSON)
create table if not exists public.patients (id bigint primary key, data jsonb not null, ts bigint, updated_at timestamptz not null default now());
create table if not exists public.recs     (id bigint primary key, data jsonb not null, ts bigint, updated_at timestamptz not null default now());
create table if not exists public.scheds   (id bigint primary key, data jsonb not null, ts bigint, updated_at timestamptz not null default now());
create table if not exists public.reports  (id bigint primary key, data jsonb not null, ts bigint, updated_at timestamptz not null default now());
create table if not exists public.settings (id bigint primary key, data jsonb not null, ts bigint, updated_at timestamptz not null default now());
create index if not exists recs_ts_idx on public.recs (ts);

-- 2) Bảo mật: chỉ người đã đăng nhập mới đọc/ghi được
alter table public.patients enable row level security;
alter table public.recs     enable row level security;
alter table public.scheds   enable row level security;
alter table public.reports  enable row level security;
alter table public.settings enable row level security;

drop policy if exists staff_all on public.patients;
drop policy if exists staff_all on public.recs;
drop policy if exists staff_all on public.scheds;
drop policy if exists staff_all on public.reports;
drop policy if exists staff_all on public.settings;
create policy staff_all on public.patients for all to authenticated using (true) with check (true);
create policy staff_all on public.recs     for all to authenticated using (true) with check (true);
create policy staff_all on public.scheds   for all to authenticated using (true) with check (true);
create policy staff_all on public.reports  for all to authenticated using (true) with check (true);
create policy staff_all on public.settings for all to authenticated using (true) with check (true);

-- 3) Nhật ký thay đổi: lưu lại mọi lần thêm/sửa/xóa để khôi phục khi cần
--    (chỉ xem được trong trang quản trị Supabase, app không đọc được)
create table if not exists public.audit_log (
  id bigserial primary key, tbl text not null, row_id bigint, op text not null, data jsonb, at timestamptz not null default now()
);
alter table public.audit_log enable row level security;

create or replace function public.log_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    insert into public.audit_log (tbl, row_id, op, data) values (tg_table_name, old.id, tg_op, old.data);
  else
    insert into public.audit_log (tbl, row_id, op, data) values (tg_table_name, new.id, tg_op, new.data);
  end if;
  return null;
end $$;

drop trigger if exists log_patients on public.patients;
drop trigger if exists log_recs on public.recs;
drop trigger if exists log_scheds on public.scheds;
drop trigger if exists log_reports on public.reports;
drop trigger if exists log_settings on public.settings;
create trigger log_patients after insert or update or delete on public.patients for each row execute function public.log_change();
create trigger log_recs     after insert or update or delete on public.recs     for each row execute function public.log_change();
create trigger log_scheds   after insert or update or delete on public.scheds   for each row execute function public.log_change();
create trigger log_reports  after insert or update or delete on public.reports  for each row execute function public.log_change();
create trigger log_settings after insert or update or delete on public.settings for each row execute function public.log_change();

-- 4) Cập nhật trực tiếp: máy này nhập, máy khác thấy ngay
do $$
declare t text;
begin
  foreach t in array array['patients','recs','scheds','reports','settings'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Xong. Kiểm tra: Table Editor sẽ thấy 6 bảng patients, recs, scheds, reports, settings, audit_log.
