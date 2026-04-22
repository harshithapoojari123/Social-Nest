import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";

type Params = { params: Promise<{ userId: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { userId } = await params;
  const supabase = createServerSupabase();
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  return NextResponse.json(data);
}
