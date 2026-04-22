import { NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase";

export function getBearerToken(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.slice(7);
}

export async function requireAuth(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) {
    return { error: "Authorization token missing." };
  }

  const supabase = createServerSupabase(token);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { error: "Invalid or expired token." };
  }

  return { token, user, supabase };
}
