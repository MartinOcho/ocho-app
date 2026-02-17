import loginImage from "@/assets/login-image.jpg";
import Image from "next/image";
import LoginForm from "./LoginForm";
import Support from "./Support";
import { getTranslation } from "@/lib/language";
import OchoLink from "@/components/ui/OchoLink";

export async function generateMetadata() {
  const { login } = await getTranslation();
  return {
    title: login,
  };
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ switching?: string }>;
}) {
  const params = await searchParams;
  const switchingParam = params.switching ? `?switching=${params.switching}` : "";
  const {
    welcomeIntro,
    you: youText,
    login,
    newHere,
    register,
    orContinueWith,
  } = await getTranslation();
  const you =
    welcomeIntro.match(/-(.*?)-/)?.[1].replace(/-(.*?)-/, "") || youText;
  const divider = welcomeIntro.match(/-(.*?)-/)?.[0] || "-";
  const welcomeIntro0 = welcomeIntro.split(divider)[0];
  const welcomeIntro2 = welcomeIntro.split(divider)[1];

  return (
    <div className="flex h-full max-h-[40rem] w-full max-w-[64rem] overflow-hidden rounded-2xl bg-card shadow-2xl max-sm:relative max-sm:bg-card/80">
      <div className="w-full space-y-5 overflow-y-auto md:p-10 p-5 md:w-1/2">
        <div className="space-y-1 text-center">
          <h1 className="text-3xl font-bold">{login}</h1>
          <p className="text-muted-foreground">
            {welcomeIntro0} <span className="italic">{you}</span>
            {welcomeIntro2}
          </p>
        </div>
        <div className="space-y-5">
          <LoginForm />
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-muted-foreground"></div>
            <span>{orContinueWith}</span>
            <div className="h-px flex-1 bg-muted-foreground"></div>
          </div>
          <Support />
          <div className="text-center">
            {newHere}{" "}
            <OchoLink
              href={`/signup${switchingParam}`}
            >
              {register}
            </OchoLink>
          </div>
        </div>
      </div>
      <Image
        src={loginImage}
        alt="login-image"
        className="w-1/2 object-cover max-sm:absolute max-sm:-z-10 max-sm:h-full max-sm:w-full"
      />
    </div>
  );
}
