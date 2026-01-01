import AppLogo from "@/components/AppLogo";
import LoaderMain from "@/components/LoaderMain";
import OchoKOMLogo from "@/components/OchoKOMLogo";

export default function Loading() {
  return (
    <div className="flex h-screen max-h-vh w-full flex-col gap-3 p-3">
      <div className="flex h-full flex-1 flex-col items-center justify-center gap-2 text-center text-[#2463eb]">
        <AppLogo size={150}/>
        <LoaderMain />
      </div>
      <OchoKOMLogo/>
    </div>
  );
}
