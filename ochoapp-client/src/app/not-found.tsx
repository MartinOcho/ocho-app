import { Button } from "@/components/ui/button";
import { Cable } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="fixed inset-0 my-8 flex h-full w-full flex-col items-center justify-center gap-4 p-3 text-center text-muted-foreground">
      <Cable size={150} />
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">404 Not found</h1>
        <p className="text-foreground">
          La page que vous recherchez n&apos;existe pas ou n&apos;est pas disponible
          pour un utilisateur déconnecté.
        </p>
      </div>
      <Button asChild size="lg" className="rounded-full px-6">
        <Link href="/">Retour à l&apos;accueil</Link>
      </Button>
    </main>
  );
}
