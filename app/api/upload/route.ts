import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

const ALLOWED_TYPES = ["image/jpeg", "image/png"];
const MAX_SIZE_BYTES = 2 * 1024 * 1024;
const BUCKET_NAME = "files";

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const folder = String(formData.get("folder") ?? "posts");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File is required." }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Only JPEG and PNG files are allowed." }, { status: 400 });
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "File size must be <= 2MB." }, { status: 400 });
  }

  const ext = file.type === "image/png" ? "png" : "jpg";
  const filePath = `${folder}/${auth.user.id}/${randomUUID()}.${ext}`;
  const { error } = await auth.supabase.storage.from(BUCKET_NAME).upload(filePath, file, {
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const {
    data: { publicUrl },
  } = auth.supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);

  return NextResponse.json({ url: publicUrl, path: filePath }, { status: 201 });
}
