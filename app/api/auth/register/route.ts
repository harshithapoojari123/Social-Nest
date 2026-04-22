import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";
import { registerSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid registration payload.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { email, password, username, first_name, last_name } = parsed.data;
  const supabase = createServerSupabase();

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (existingProfile) {
    return NextResponse.json({ error: "Username already exists." }, { status: 409 });
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username,
        first_name,
        last_name,
      },
    },
  });

  if (error || !data.user) {
    return NextResponse.json({ error: error?.message ?? "Registration failed." }, { status: 400 });
  }

  await supabase.from("profiles").upsert({
    id: data.user.id,
    email,
    username,
    first_name,
    last_name,
  });

  return NextResponse.json(
    {
      access_token: data.session?.access_token ?? null,
      user: {
        id: data.user.id,
        email,
        username,
        first_name,
        last_name,
      },
    },
    { status: 201 }
  );
}
