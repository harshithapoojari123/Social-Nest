import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase";
import { postSchema } from "@/lib/validators";

type Params = { params: Promise<{ postId: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { postId } = await params;
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("posts")
    .select("*, author:profiles(id, username, avatar_url)")
    .eq("id", postId)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Post not found." }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const { postId } = await params;
  const body = await request.json();
  const parsed = postSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid post data.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { data, error } = await auth.supabase
    .from("posts")
    .update(parsed.data)
    .eq("id", postId)
    .eq("author_id", auth.user.id)
    .select("*")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Could not update post." }, { status: 400 });
  }

  return NextResponse.json(data);
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const auth = await requireAuth(_request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const { postId } = await params;

  const rpcDelete = await auth.supabase.rpc("delete_post_owned", { post_id_input: postId });
  if (!rpcDelete.error && rpcDelete.data === true) {
    return NextResponse.json({ message: "Post deleted." });
  }

  const hardDelete = await auth.supabase
    .from("posts")
    .delete()
    .eq("id", postId)
    .eq("author_id", auth.user.id)
    .select("id")
    .maybeSingle();

  if (!hardDelete.error && hardDelete.data) {
    return NextResponse.json({ message: "Post deleted." });
  }

  const softDelete = await auth.supabase
    .from("posts")
    .update({ is_active: false })
    .eq("id", postId)
    .eq("author_id", auth.user.id)
    .select("id")
    .maybeSingle();

  if (!softDelete.error && softDelete.data) {
    return NextResponse.json({ message: "Post deleted." });
  }

  if (hardDelete.error && softDelete.error) {
    return NextResponse.json(
      { error: softDelete.error.message || hardDelete.error.message },
      { status: 400 }
    );
  }

  return NextResponse.json({ error: "Post not found or not owned." }, { status: 404 });
}

export const PUT = PATCH;
