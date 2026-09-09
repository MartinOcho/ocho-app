import { cookies } from "next/headers";
import {
  allVocabularyKeys,
  Language,
  vocabulary,
  VocabularyKey,
  VocabularyObject,
} from "./vocabulary";
import { validateRequest } from "@/auth";

// Vocabulaire par langue
const translations = vocabulary;

// Récupérer la langue côté serveur
export const getLanguage = async (): Promise<Language> => {
  const { user } = await validateRequest();
  const userId = user?.id || "guest";
  const cookieStore = await cookies();
  const langCookie = cookieStore.get(`lang-${userId}`);
  const browserLang =
    typeof navigator === "undefined"
      ? "en"
      : (navigator.language.split("-")[0] as Language);

  return (langCookie?.value as Language) || browserLang || "en";
};

// Récupérer une ou plusieurs traductions côté serveur
export const getTranslation = async (
  keys: VocabularyKey | VocabularyKey[] = allVocabularyKeys,
): Promise<VocabularyObject> => {
  const language = await getLanguage();

  // Convertir une clé unique en tableau pour simplifier le traitement
  const keysArray = Array.isArray(keys) ? keys : [keys];

  // Construire un objet avec les traductions demandées
  return keysArray.reduce(
    (acc, key) => {
      acc[key] = translations[language][key];
      return acc;
    },
    {} as Record<string, string>,
  );
};
