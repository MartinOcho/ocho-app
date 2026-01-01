"use client";

import { Button } from "@/components/ui/button";
import { useProgress } from "@/context/ProgressContext";

export default function Buttons() {
  const { startNavigation: navigate } = useProgress();
  return <div className="space-x-1">
    <Button onClick={() => navigate("/")}>Accueil</Button>
    <Button variant="secondary" onClick={() => navigate("/signup")}>
      Inscription
    </Button>
    <Button variant="secondary" onClick={() => navigate("/login")}>
      Connexion
    </Button>
  </div>;
}
