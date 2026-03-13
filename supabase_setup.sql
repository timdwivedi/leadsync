-- Run this script in your Supabase SQL Editor (Dashboard -> SQL Editor -> New Query)

-- 1. Create Profiles Table (for storing configuration and API keys)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  apify_key text,
  openai_key text,
  anthropic_key text,
  prospeo_key text,
  personalization_prompt text,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Enable Row Level Security (RLS) on profiles
alter table public.profiles enable row level security;
create policy "Users can view own profile" on profiles for select using ( auth.uid() = id );
create policy "Users can update own profile" on profiles for update using ( auth.uid() = id );
create policy "Users can insert own profile" on profiles for insert with check ( auth.uid() = id );

-- 2. Create Orders Table (for tracking scraping job history)
create table if not exists public.orders (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  query text not null,
  status text not null default 'processing',
  count integer default 0,
  parameters jsonb,
  downloadUrl text,
  error text,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Enable RLS on orders
alter table public.orders enable row level security;
create policy "Users can view own orders" on orders for select using ( auth.uid() = user_id );
create policy "Users can insert own orders" on orders for insert with check ( auth.uid() = user_id );
create policy "Users can update own orders" on orders for update using ( auth.uid() = user_id );

-- 3. Setup Storage for CSV Results
insert into storage.buckets (id, name, public) 
values ('results', 'results', true)
on conflict (id) do nothing;

-- Enable RLS on Storage Bucket
create policy "Anyone can read results" on storage.objects for select using ( bucket_id = 'results' );
create policy "Auth users can upload results" on storage.objects for insert with check ( bucket_id = 'results' and auth.role() = 'authenticated' );
create policy "Auth users can update results" on storage.objects for update using ( bucket_id = 'results' and auth.role() = 'authenticated' );

-- 4. Automatically create a profile when a new user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
