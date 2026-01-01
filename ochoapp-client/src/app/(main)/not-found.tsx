import { Cable } from "lucide-react";

export default function NotFound() {
  return (
    <main className="my-12 w-full space-y-3 p-3 text-center">
      <div className="my-8 flex w-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
        <Cable size={150} />
        <h1 className="text-3xl font-bold text-foreground">404 Not found</h1>
        <p className="text-foreground">
          La page que vous recherchez n&apos;existe pas{" "}
          <a href="/" className="text-primary hover:underline">
            revenir à l&apos;accueil
          </a>
        </p>
      </div>
    </main>
  );
}
