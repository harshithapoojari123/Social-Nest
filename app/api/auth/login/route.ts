import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";
import { loginSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid login payload.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { identifier, password } = parsed.data;
  const supabase = createServerSupabase();

  let email = identifier;
  if (!identifier.includes("@")) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("email")
      .eq("username", identifier)
      .maybeSingle();

    if (profileError || !profile?.email) {
      return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
    }
    email = profile.email;
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session || !data.user) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  await supabase
    .from("profiles")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", data.user.id);

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", data.user.id)
    .maybeSingle();

  return NextResponse.json({
    access_token: data.session.access_token,
    user: profile,
  });
}
