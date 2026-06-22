import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import OAuthCompleteForm from "./OAuthCompleteForm";
import { getTranslation } from "@/lib/language";

export default async function OAuthCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ switching?: string }>;
}) {
  const params = await searchParams;
  const switchingParam = params.switching ? `?switching=${params.switching}` : "";
  const cookieStore = await cookies();
  const pendingData = cookieStore.get("oauth_pending")?.value;
  const { completeProfile, completeProfileDescription } = await getTranslation();

  if (!pendingData) {
    redirect(`/login${switchingParam}`);
  }

  let parsedData;

  try {
    parsedData = JSON.parse(pendingData);
  } catch {
    redirect(`/login${switchingParam}`);
  }

  if (!parsedData || typeof parsedData !== "object") {
    redirect(`/login${switchingParam}`);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-sm">
        <div className="mb-6 space-y-2 text-center">
          <h1 className="text-2xl font-semibold">{completeProfile}</h1>
          <p className="text-sm text-muted-foreground">
            {completeProfileDescription}
          </p>
        </div>
        <OAuthCompleteForm pendingData={parsedData} />
      </div>
    </main>
  );
}
