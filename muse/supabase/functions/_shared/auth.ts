import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface AuthenticatedUser {
  id: string;
  email: string;
}

export async function getAuthenticatedUser(
  supabase: SupabaseClient,
  authHeader: string | null
): Promise<AuthenticatedUser> {
  if (!authHeader) {
    throw new Error("Missing authorization header");
  }

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    throw new Error(error?.message ?? "Invalid token");
  }

  return {
    id: user.id,
    email: user.email ?? "",
  };
}
