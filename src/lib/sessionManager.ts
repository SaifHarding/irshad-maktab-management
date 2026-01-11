import { supabase } from "@/integrations/supabase/client";

export const performLogout = async () => {
  // Clear session expiry data
  localStorage.removeItem('session_expiry');
  localStorage.removeItem('keep_signed_in');
  
  // Sign out from Supabase
  const { error } = await supabase.auth.signOut();
  
  return { error };
};

export const checkSessionExpiry = () => {
  const sessionExpiry = localStorage.getItem('session_expiry');
  if (sessionExpiry && Date.now() > parseInt(sessionExpiry)) {
    return true; // Session has expired
  }
  return false;
};
