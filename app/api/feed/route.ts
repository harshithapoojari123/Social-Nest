import { NextRequest, NextResponse } from "next/server";
import { getBearerToken } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const token = getBearerToken(request);
  const supabase = createServerSupabase(token ?? undefined);
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = Math.min(Number(searchParams.get("page_size") ?? "10"), 50);
  const start = Math.max(0, (page - 1) * pageSize);
  const end = start + pageSize - 1;

  let query = supabase
    .from("posts")
    .select("*, author:profiles(id, username, avatar_url)", { count: "exact" })
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (token) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: followingRows } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user.id);
      const followingIds = followingRows?.map((row) => row.following_id) ?? [];
      if (followingIds.length > 0) {
        query = query.in("author_id", followingIds);
      }
    }
  }

  const { data, error, count } = await query.range(start, end);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    page,
    page_size: pageSize,
    total: count ?? 0,
    results: data ?? [],
  });
}
