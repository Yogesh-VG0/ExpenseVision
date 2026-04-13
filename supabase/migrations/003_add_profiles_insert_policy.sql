-- Add missing INSERT policy for profiles table
-- The handle_new_user() trigger creates profiles with SECURITY DEFINER,
-- but upsert calls from the client also need INSERT permission.

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);
