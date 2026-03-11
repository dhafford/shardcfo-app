"use server";

import { requireAuth } from "@/lib/supabase/require-auth";

export interface UpdateProfileState {
  error?: string;
  success?: boolean;
  fields?: {
    full_name?: string;
    firm_name?: string;
  };
}

export async function updateProfile(
  _prev: UpdateProfileState,
  formData: FormData
): Promise<UpdateProfileState> {
  let user: Awaited<ReturnType<typeof requireAuth>>["user"];
  let supabase: Awaited<ReturnType<typeof requireAuth>>["supabase"];
  try {
    ({ user, supabase } = await requireAuth({ redirect: false }));
  } catch {
    return { error: "You must be signed in." };
  }

  const full_name = (formData.get("full_name") as string | null)?.trim() ?? "";
  const firm_name = (formData.get("firm_name") as string | null)?.trim() ?? "";

  if (!full_name) {
    return {
      error: "Full name is required.",
      fields: { full_name, firm_name },
    };
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      full_name,
      firm_name: firm_name || null,
    })
    .eq("id", user.id);

  if (profileError) {
    return {
      error: profileError.message,
      fields: { full_name, firm_name },
    };
  }

  return { success: true };
}
