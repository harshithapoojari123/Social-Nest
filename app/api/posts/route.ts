import { NextRequest, NextResponse } from "next/server";
import { getBearerToken, requireAuth } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase";
import { postSchema } from "@/lib/validators";

export async function GET(request: NextRequest) {
  const token = getBearerToken(request);
  const supabase = createServerSupabase(token ?? undefined);
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = Math.min(Number(searchParams.get("page_size") ?? "10"), 50);
  const scope = searchParams.get("scope") ?? "explore";
  const authorId = searchParams.get("author_id");
  const start = Math.max(0, (page - 1) * pageSize);
  const end = start + pageSize - 1;

  if (scope === "mine") {
    if (!token) {
      return NextResponse.json({ error: "Authorization token missing." }, { status: 401 });
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Invalid or expired token." }, { status: 401 });
    }

    const mineQuery = supabase
      .from("posts")
      .select("*, author:profiles(id, username, avatar_url)", { count: "exact" })
      .eq("is_active", true)
      .eq("author_id", user.id)
      .order("created_at", { ascending: false });

    const { data: mineData, error: mineError, count: mineCount } = await mineQuery.range(start, end);
    if (mineError) {
      return NextResponse.json({ error: mineError.message }, { status: 400 });
    }

    return NextResponse.json({
      page,
      page_size: pageSize,
      total: mineCount ?? 0,
      results: mineData ?? [],
    });
  }

  let query = supabase
    .from("posts")
    .select("*, author:profiles(id, username, avatar_url)", { count: "exact" })
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (authorId) {
    query = query.eq("author_id", authorId);
  }

  const { data: posts, error: postsError, count: postsCount } = await query.range(start, end);
  if (postsError) {
    return NextResponse.json({ error: postsError.message }, { status: 400 });
  }

  return NextResponse.json({
    page,
    page_size: pageSize,
    total: postsCount ?? 0,
    results: posts ?? [],
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const body = await request.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid post payload.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { data, error } = await auth.supabase
    .from("posts")
    .insert({
      author_id: auth.user.id,
      content: parsed.data.content,
      image_url: parsed.data.image_url ?? null,
    })
    .select("*")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Could not create post." }, { status: 400 });
  }

  return NextResponse.json(data, { status: 201 });
}
