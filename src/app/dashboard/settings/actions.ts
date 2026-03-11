"use server";

import { createClient } from "@/lib/supabase/server";

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
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
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
    } as never)
    .eq("id", user.id);

  if (profileError) {
    return {
      error: profileError.message,
      fields: { full_name, firm_name },
    };
  }

  return { success: true };
}
