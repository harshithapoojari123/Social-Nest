import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

type Params = { params: Promise<{ postId: string; commentId: string }> };

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const { postId, commentId } = await params;
  const { error } = await auth.supabase
    .from("comments")
    .delete()
    .eq("id", commentId)
    .eq("post_id", postId)
    .eq("author_id", auth.user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const { error: countError } = await auth.supabase.rpc("sync_post_comment_count", {
    post_id_input: postId,
  });
  if (countError) {
    return NextResponse.json(
      { error: countError.message ?? "Comment deleted, but count update failed." },
      { status: 400 }
    );
  }
  return NextResponse.json({ message: "Comment deleted." });
}
