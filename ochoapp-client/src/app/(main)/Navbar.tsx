import AppLogo from "@/components/AppLogo";
import SearchField from "@/components/SearchField";
import UserButton from "@/components/UserButton";
import OchoLink from "@/components/ui/OchoLink";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-10 bg-card shadow-sm">
      <nav className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-3 px-5 py-3 max-sm:justify-between">
        <OchoLink
          href="/"
          className="text-2xl font-bold max-sm:hidden"
        >
          <AppLogo size={70} />
        </OchoLink>
        <OchoLink href="/" className="text-2xl font-bold sm:hidden">
          <AppLogo logo="LOGO" size={70} />
        </OchoLink>
        <SearchField />
        <UserButton className="sm:ms-auto" />
      </nav>
    </header>
  );
}
