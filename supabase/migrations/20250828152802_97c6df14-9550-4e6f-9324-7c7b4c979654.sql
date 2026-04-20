-- Add foreign key constraints with CASCADE DELETE to automatically clean up when users are deleted
-- First, clean up any existing orphaned records

-- Clean up orphaned player_ranking records
DELETE FROM public.player_ranking 
WHERE user_id NOT IN (SELECT id FROM auth.users);

-- Clean up orphaned player_profiles records  
DELETE FROM public.player_profiles 
WHERE user_id NOT IN (SELECT id FROM auth.users);

-- Clean up orphaned game_progress records
DELETE FROM public.game_progress 
WHERE user_id NOT IN (SELECT id FROM auth.users);

-- Clean up orphaned centralized_game_progress records
DELETE FROM public.centralized_game_progress 
WHERE user_id NOT IN (SELECT id FROM auth.users);

-- Clean up orphaned simple_game_progress records
DELETE FROM public.simple_game_progress 
WHERE user_id NOT IN (SELECT id FROM auth.users);

-- Clean up orphaned game_backups records
DELETE FROM public.game_backups 
WHERE user_id NOT IN (SELECT id FROM auth.users);

-- Clean up orphaned activity_logs records
DELETE FROM public.activity_logs 
WHERE user_id NOT IN (SELECT id FROM auth.users);

-- Now add proper foreign key constraints with CASCADE DELETE
-- Note: We can't directly reference auth.users in foreign keys due to Supabase restrictions
-- Instead, we'll create a function to clean up orphaned records periodically

-- Create a function to clean up orphaned records
CREATE OR REPLACE FUNCTION public.cleanup_orphaned_records()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Clean up orphaned records from all tables
    DELETE FROM public.player_ranking WHERE user_id NOT IN (SELECT id FROM auth.users);
    DELETE FROM public.player_profiles WHERE user_id NOT IN (SELECT id FROM auth.users);
    DELETE FROM public.game_progress WHERE user_id NOT IN (SELECT id FROM auth.users);
    DELETE FROM public.centralized_game_progress WHERE user_id NOT IN (SELECT id FROM auth.users);
    DELETE FROM public.simple_game_progress WHERE user_id NOT IN (SELECT id FROM auth.users);
    DELETE FROM public.game_backups WHERE user_id NOT IN (SELECT id FROM auth.users);
    DELETE FROM public.activity_logs WHERE user_id NOT IN (SELECT id FROM auth.users);
    
    RAISE NOTICE 'Orphaned records cleanup completed';
END;
$$;

-- Create a function that runs automatically on user deletion
-- This will be triggered by a webhook or edge function when a user is deleted
CREATE OR REPLACE FUNCTION public.handle_user_deletion(deleted_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Remove all records for the deleted user
    DELETE FROM public.player_ranking WHERE user_id = deleted_user_id;
    DELETE FROM public.player_profiles WHERE user_id = deleted_user_id;
    DELETE FROM public.game_progress WHERE user_id = deleted_user_id;
    DELETE FROM public.centralized_game_progress WHERE user_id = deleted_user_id;
    DELETE FROM public.simple_game_progress WHERE user_id = deleted_user_id;
    DELETE FROM public.game_backups WHERE user_id = deleted_user_id;
    DELETE FROM public.activity_logs WHERE user_id = deleted_user_id;
    
    RAISE NOTICE 'All records for user % have been deleted', deleted_user_id;
END;
$$;