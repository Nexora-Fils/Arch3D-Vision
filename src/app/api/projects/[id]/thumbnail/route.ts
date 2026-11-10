import { NextResponse } from "next/server";
import { z } from "zod";
import { handleRouteError, readJsonBody } from "@/lib/api/respond";
import { authorizeProject } from "@/lib/auth/authorize";
import { setProjectThumbnail } from "@/lib/projects/repository";

/** ~300 KB of base64: enough for a 640 × 400 JPEG, small enough for a table column. */
const MAX_THUMBNAIL_LENGTH = 400_000;

const thumbnailSchema = z.object({
  dataUrl: z
    .string()
    .max(MAX_THUMBNAIL_LENGTH, "Miniature trop volumineuse")
    .regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/, "Une image JPEG encodée en base64 est attendue"),
});

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await authorizeProject(id, "write");
    const { dataUrl } = thumbnailSchema.parse(await readJsonBody(request));
    await setProjectThumbnail(id, dataUrl);
    return NextResponse.json({ id, updated: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
