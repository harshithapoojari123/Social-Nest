import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

type Params = { params: Promise<{ userId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const { userId } = await params;
  if (auth.user.id === userId) {
    return NextResponse.json({ error: "Cannot follow yourself." }, { status: 400 });
  }

  const { error } = await auth.supabase.from("follows").insert({
    follower_id: auth.user.id,
    following_id: userId,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ message: "Followed user." }, { status: 201 });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const { userId } = await params;
  const { error } = await auth.supabase
    .from("follows")
    .delete()
    .eq("follower_id", auth.user.id)
    .eq("following_id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ message: "Unfollowed user." });
}
