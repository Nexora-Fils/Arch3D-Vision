import { NextResponse } from "next/server";
import { handleRouteError, readJsonBody } from "@/lib/api/respond";
import { createAccount } from "@/lib/auth/accounts";
import { signupSchema } from "@/lib/auth/schema";
import { startSession } from "@/lib/auth/session";

export async function POST(request: Request) {
  try {
    const user = await createAccount(signupSchema.parse(await readJsonBody(request)));
    await startSession(user.id);
    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
