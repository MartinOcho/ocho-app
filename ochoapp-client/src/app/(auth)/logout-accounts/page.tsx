import { validateRequest } from "@/auth";
import { redirect } from "next/navigation";
import LogoutAccountsClient from "./LogoutAccountsClient";

export const metadata = {
  title: "Gérer les comptes",
  description: "Gérez vos sessions connectées et déconnectez les appareils",
};

export default async function LogoutAccountsPage() {
  const { user } = await validateRequest();

  // Rediriger vers la page de connexion si l'utilisateur n'est pas authentifié
  if (!user) {
    return redirect("/login");
  }

  return <LogoutAccountsClient />;
}
