import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase";
import { commentSchema } from "@/lib/validators";

type Params = { params: Promise<{ postId: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { postId } = await params;
  const supabase = createServerSupabase();

  const { data, error } = await supabase
    .from("comments")
    .select("*, author:profiles(id, username, avatar_url)")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ results: data ?? [] });
}

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const { postId } = await params;
  const body = await request.json();
  const parsed = commentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid comment payload.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { data, error } = await auth.supabase
    .from("comments")
    .insert({
      post_id: postId,
      author_id: auth.user.id,
      content: parsed.data.content,
    })
    .select("*")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Could not add comment." }, { status: 400 });
  }

  const { error: countError } = await auth.supabase.rpc("sync_post_comment_count", {
    post_id_input: postId,
  });
  if (countError) {
    return NextResponse.json(
      { error: countError.message ?? "Comment saved, but count update failed." },
      { status: 400 }
    );
  }
  return NextResponse.json(data, { status: 201 });
}
