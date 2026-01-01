import { NextRequest, NextResponse } from "next/server";
import { ApiResponse } from "../android/utils/dTypes";

export async function GET(req: NextRequest) {
  const version = req.nextUrl.searchParams.get("version") || "";
  const platform = req.nextUrl.searchParams.get("platform") || "";
  const androidCurrentVersion = parseInt(
    process.env.ANDROID_CURRENT_VERSION || "1",
  );
  const iosCurrentVersion = parseInt(process.env.IOS_CURRENT_VERSION || "1");
  let isUpToDate = true;
  if (platform.toLowerCase() === "android") {
    isUpToDate = parseInt(version) >= androidCurrentVersion;
  } else if (platform.toLowerCase() === "ios") {
    isUpToDate = parseInt(version) >= iosCurrentVersion;
  }
  return NextResponse.json<
    ApiResponse<{
      isUpToDate: boolean;
      currentVersion: number;
      downloadUrl: string;
    }>
  >({
    success: true,
    data: {
      isUpToDate: isUpToDate,
      currentVersion:
        platform.toLowerCase() === "android"
          ? androidCurrentVersion
          : iosCurrentVersion,
        downloadUrl: "https://github.com/devTeam222/OchoApp/releases/tag/app",
    },
    message: isUpToDate
      ? "L'application est à jour."
      : "Une mise à jour est disponible.",
  });
}
