import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendAccountDeletionRequestEmails } from "@/lib/email";

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
    const scheduledDeletionAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const request = await prisma.accountDeletionRequest.create({
      data: {
        email,
        details,
        scheduledDeletionAt,
      },
    });

    await sendAccountDeletionRequestEmails({
      email,
      details,
      scheduledDeletionAt,
    });

    return NextResponse.json({
      message: "Votre demande a été enregistrée. Un e-mail de confirmation a été envoyé.",
      requestId: request.id,
      scheduledDeletionAt: scheduledDeletionAt.toISOString(),
    });
  } catch (error) {
    console.error("Delete account request error:", error);

    if (error instanceof Error && error.message.includes("SMTP configuration")) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
