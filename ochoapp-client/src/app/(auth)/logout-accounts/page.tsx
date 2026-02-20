import { validateRequest } from "@/auth";
import { redirect } from "next/navigation";
import { getTranslation } from "@/lib/language";
import LogoutAccountsClient from "./LogoutAccountsClient";

export async function generateMetadata() {
  const { manageAccounts, logoutAllDescription } = await getTranslation([
    "manageAccounts",
    "logoutAllDescription",
  ]);
  return {
    title: manageAccounts,
    description: logoutAllDescription,
  };
}

export default async function LogoutAccountsPage() {
  const { user } = await validateRequest();

  // Rediriger vers la page de connexion si l'utilisateur n'est pas authentifié
  if (!user) {
    return redirect("/login");
  }

  return <LogoutAccountsClient />;
}
