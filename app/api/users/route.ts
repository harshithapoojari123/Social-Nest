import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";

export async function GET() {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, username, first_name, last_name, avatar_url, bio, posts_count, follower_count, following_count"
    )
    .order("username", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ results: data ?? [] });
}
