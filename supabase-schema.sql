-- supabase-schema.sql
-- Chạy toàn bộ nội dung file này trong Supabase Dashboard → SQL Editor →
-- New query → dán vào → Run. Chỉ cần chạy 1 lần khi mới tạo project.

create table public.aicf_configs (
  user_id uuid references auth.users(id) on delete cascade primary key,
  tools jsonb not null default '[]'::jsonb,
  kits jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- Bật Row Level Security — bắt buộc, nếu không mọi người dùng đều đọc/ghi
-- được dữ liệu của nhau (rất nguy hiểm với bảng public như thế này).
alter table public.aicf_configs enable row level security;

-- Mỗi user CHỈ được đọc đúng hàng của chính mình.
create policy "Users can view own config"
  on public.aicf_configs for select
  using (auth.uid() = user_id);

-- Mỗi user CHỈ được tạo hàng với user_id = chính mình (không tạo hộ người khác).
create policy "Users can insert own config"
  on public.aicf_configs for insert
  with check (auth.uid() = user_id);

-- Mỗi user CHỈ được sửa đúng hàng của chính mình.
create policy "Users can update own config"
  on public.aicf_configs for update
  using (auth.uid() = user_id);
