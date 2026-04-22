import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { profileUpdateSchema } from "@/lib/validators";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const { data, error } = await auth.supabase
    .from("profiles")
    .select("*")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const body = await request.json();
  const parsed = profileUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid profile data.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { data, error } = await auth.supabase
    .from("profiles")
    .update(parsed.data)
    .eq("id", auth.user.id)
    .select("*")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Could not update profile." }, { status: 400 });
  }

  return NextResponse.json(data);
}

export const PUT = PATCH;
