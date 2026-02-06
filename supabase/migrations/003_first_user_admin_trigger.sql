-- Function to make first user an admin
CREATE OR REPLACE FUNCTION public.handle_first_user_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count INTEGER;
BEGIN
  -- Count existing profiles (not auth.users to avoid race conditions)
  SELECT COUNT(*) INTO user_count FROM public.profiles;
  
  -- If this is the first profile, make them admin
  IF user_count = 0 THEN
    NEW.role := 'admin';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger before insert on profiles
CREATE TRIGGER on_profile_created_check_first_admin
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_first_user_admin();
