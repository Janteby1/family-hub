import { createClient } from "@/lib/supabase/server";
import type { FamilyMember } from "@/lib/types";

// Resolves the logged-in auth user (Jack or Emily) to their family_members row.
export async function getCurrentMember(): Promise<{
  authUserId: string;
  member: FamilyMember | null;
} | null> {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  if (!user) return null;

  const { data: member } = await supabase
    .from("family_members")
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  return { authUserId: user.id, member: member as FamilyMember | null };
}
