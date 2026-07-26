import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { validateRequest } from "@/auth";
import { PrivacyType, PrivacyValue } from "@/lib/types";

export async function GET() {
  return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
}

export async function POST(request: NextRequest) {
   return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
}
