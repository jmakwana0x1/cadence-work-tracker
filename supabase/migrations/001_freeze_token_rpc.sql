-- Atomically increment freeze_tokens (cap at 5) for a habit owned by the user
create or replace function increment_freeze_tokens(p_habit_id uuid, p_user_id uuid)
returns void
language sql
security definer
as $$
  update public.habits
  set freeze_tokens = least(freeze_tokens + 1, 5)
  where id = p_habit_id
    and user_id = p_user_id;
$$;
