import { NextRequest, NextResponse } from "next/server";

interface DeleteAccountRequestBody {
  email: string;
  details?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as DeleteAccountRequestBody;

    if (!body?.email?.trim()) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 },
      );
    }

    const email = body.email.trim();
    const details = body.details?.trim() ?? "";

    // Currently this endpoint only validates the request.
    // Email sending is not implemented in the client repository.
    // It can be connected later to an email service using the provided contact emails.

    return NextResponse.json({
      message: "Your request has been received. We will contact you soon.",
      email,
      details,
    });
  } catch (error) {
    console.error("Delete account request error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
