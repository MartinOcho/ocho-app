import { NextResponse } from "next/server";

export async function GET() {
  const assetLinks = [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: "com.ochokom.ochoapp",
        sha256_cert_fingerprints: [
          "DB:80:0F:2B:3B:EF:71:0E:51:CF:3F:22:BA:AA:F7:0C:3F:41:5F:DE:CC:4C:00:6F:79:A4:DD:A7:95:85:C7:E7",
          "93:12:8B:F3:73:2E:34:C8:BB:8A:94:CE:E7:61:64:DA:25:BE:B3:81:9F:D3:73:7C:00:23:83:1D:F8:64:F0:21"
        ],
      },
    },
  ];

  return NextResponse.json(assetLinks, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
