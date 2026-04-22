import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

type Params = { params: Promise<{ postId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const { postId } = await params;
  const { error } = await auth.supabase.from("likes").insert({
    post_id: postId,
    user_id: auth.user.id,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const { error: countError } = await auth.supabase.rpc("sync_post_like_count", {
    post_id_input: postId,
  });
  if (countError) {
    return NextResponse.json(
      { error: countError.message ?? "Like saved, but count update failed." },
      { status: 400 }
    );
  }
  return NextResponse.json({ message: "Post liked." }, { status: 201 });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const { postId } = await params;
  const { error } = await auth.supabase
    .from("likes")
    .delete()
    .eq("post_id", postId)
    .eq("user_id", auth.user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const { error: countError } = await auth.supabase.rpc("sync_post_like_count", {
    post_id_input: postId,
  });
  if (countError) {
    return NextResponse.json(
      { error: countError.message ?? "Like removed, but count update failed." },
      { status: 400 }
    );
  }
  return NextResponse.json({ message: "Post unliked." });
}
