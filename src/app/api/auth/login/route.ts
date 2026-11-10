import { NextResponse } from "next/server";
import { handleRouteError, jsonError, readJsonBody } from "@/lib/api/respond";
import { authenticate } from "@/lib/auth/accounts";
import { loginSchema } from "@/lib/auth/schema";
import { startSession } from "@/lib/auth/session";

export async function POST(request: Request) {
  try {
    const user = await authenticate(loginSchema.parse(await readJsonBody(request)));
    if (!user) return jsonError(401, "E-mail ou mot de passe incorrect");
    await startSession(user.id);
    return NextResponse.json(user);
  } catch (error) {
    return handleRouteError(error);
  }
}
