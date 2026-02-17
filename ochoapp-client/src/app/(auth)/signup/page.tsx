import signupImage from "@/assets/signup-image.jpg";
import Image from "next/image";
import OchoLink from "@/components/ui/OchoLink";
import SignUpForm from "./SignUpForm";
import { getLanguage, getTranslation } from "@/lib/language";

export async function generateMetadata() {
  const { signup } = await getTranslation();
  return {
    title: signup,
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
    signup,
    alreadyHave,
    signIn,
  } = await getTranslation();
  const you =
    welcomeIntro.match(/-(.*?)-/)?.[1].replace(/-(.*?)-/, "") || youText;
  const divider = welcomeIntro.match(/-(.*?)-/)?.[0] || "-";
  const welcomeIntro0 = welcomeIntro.split(divider)[0];
  const welcomeIntro2 = welcomeIntro.split(divider)[1];
  return (
    <div className="flex h-full max-h-[40rem] w-full max-w-[64rem] overflow-hidden rounded-2xl bg-card shadow-2xl max-sm:relative max-sm:bg-card/80">
      <div className="w-full space-y-5 overflow-y-auto p-5 md:w-1/2 md:p-10">
        <div className="space-y-1 text-center">
          <h1 className="text-3xl font-bold">{signup}</h1>
          <p className="text-muted-foreground">
            {welcomeIntro0} <span className="italic">{you}</span>
            {welcomeIntro2}
          </p>
        </div>
        <div className="space-y-5">
          <SignUpForm />
          <div className="text-center">
            {alreadyHave}{" "}
            <OchoLink
              href={`/login${switchingParam}`}
            >
              {signIn}
            </OchoLink>
          </div>
        </div>
      </div>
      <Image
        src={signupImage}
        alt="signup-image"
        className="w-1/2 object-cover max-sm:absolute max-sm:-z-10 max-sm:h-full max-sm:w-full"
      />
    </div>
  );
}
