import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";

type Params = { params: Promise<{ userId: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { userId } = await params;
  const supabase = createServerSupabase();

  const { data, error } = await supabase
    .from("follows")
    .select("created_at, follower:profiles!follows_follower_id_fkey(id, username, avatar_url)")
    .eq("following_id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ results: data ?? [] });
}
