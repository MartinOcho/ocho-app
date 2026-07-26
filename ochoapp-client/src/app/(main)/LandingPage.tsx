import Link from "next/link";
import { Button } from "@/components/ui/button";
import OchoLink from "@/components/ui/OchoLink";
import AppLogo from "@/components/AppLogo";

export default function LandingPage() {
  return (
    <div className="flex min-h-full w-full items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
      <div className="bg-card w-full max-w-5xl overflow-hidden rounded-[2rem] shadow-2xl">
        <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-8 p-8 sm:p-10 lg:p-12">
            <div className="space-y-4">
              <OchoLink
                href="/"
                className="text-2xl font-bold"
              >
                <AppLogo size={70} />
              </OchoLink>
              <h1 className="text-foreground text-xl font-semibold tracking-tight sm:text-2xl">
                Un réseau social pour créer avec une infinité de possibilités.
              </h1>
              <p className="text-muted-foreground max-w-2xl leading-8 text-sm">
                Découvrez des personnes inspirantes, partagez vos moments et
                restez connecté à votre communauté grâce à une expérience
                simple, vivante et humaine.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="rounded-full px-6">
                <OchoLink href="/login">Se connecter</OchoLink>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="rounded-full px-6"
              >
                <OchoLink href="/signup">Créer un compte</OchoLink>
              </Button>
            </div>

            <div className="text-muted-foreground grid gap-3 text-sm sm:grid-cols-2">
              <div className="border-border/60 bg-background/70 rounded-2xl border p-4">
                <p className="text-foreground font-semibold">
                  Discutez
                </p>
                <p className="mt-1">
                  Échangez avec vos proches, vos amis et votre communauté.
                </p>
              </div>
              <div className="border-border/60 bg-background/70 rounded-2xl border p-4">
                <p className="text-foreground font-semibold">
                  Un fil d’actualité vivant
                </p>
                <p className="mt-1">
                  Suivez les posts qui comptent et découvrez de nouveaux
                  contenus.
                </p>
              </div>
            </div>
          </div>

          <div className="from-primary/15 via-background to-muted flex items-center justify-center bg-linear-to-br p-8 sm:p-10 lg:p-12">
            <div className="border-border/60 bg-background/90 w-full max-w-md rounded-[1.5rem] border p-6 shadow-lg backdrop-blur">
              <p className="text-primary text-sm font-semibold tracking-[0.2em] uppercase">
                Pourquoi rejoindre ?
              </p>
              <div className="mt-5 space-y-4">
                <div>
                  <p className="text-foreground font-semibold">
                    Partagez facilement
                  </p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Publiez des moments, des pensées et des idées en quelques
                    secondes.
                  </p>
                </div>
                <div>
                  <p className="text-foreground font-semibold">Restez proche</p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Recevez des notifications et interagissez en temps réel.
                  </p>
                </div>
                <div>
                  <p className="text-foreground font-semibold">
                    Découvrez votre cercle
                  </p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Trouvez des personnes qui partagent vos centres d’intérêt.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
