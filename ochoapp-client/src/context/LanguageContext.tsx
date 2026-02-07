"use client";

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import {
  allVocabularyKeys,
  Language,
  vocabulary,
  VocabularyKey,
  VocabularyObject,
} from "@/lib/vocabulary";
import Cookies from "js-cookie";
import { useSession } from "@/app/(main)/SessionProvider";
import { useProgress } from "./ProgressContext";

type LanguageContextType = {
  language: Language;
  setLanguage: (lang: Language) => void;
  isReady: boolean; // Pour savoir si l'hydratation est terminée
};

const LanguageContext = createContext<LanguageContextType>({
  language: "en",
  setLanguage: () => {},
  isReady: false,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // On initialise toujours avec la langue par défaut pour le SSR
  const [language, setLanguage] = useState<Language>("en");
  const [isReady, setIsReady] = useState(false);
  const { user } = useSession();
  const { startNavigation: navigate } = useProgress();

  const userId = user?.id || "guest";

  useEffect(() => {
    // Cette partie ne s'exécute QUE sur le client après le premier rendu
    const browserLang = navigator.language.startsWith("fr") ? "fr" : "en";
    const storedLang =
      Cookies.get(`lang-${userId}`) ||
      localStorage.getItem(`lang-${userId}`) ||
      browserLang;

    const shortLang = (storedLang?.split("-")[0] as Language) || "en";
    
    setLanguage(shortLang);
    setIsReady(true);

    if (!Cookies.get(`lang-${userId}`)) {
      Cookies.set(`lang-${userId}`, shortLang, { expires: 365 });
    }
  }, [userId]);

  const changeLanguage = useCallback((lang: Language) => {
    setLanguage(lang);
    localStorage.setItem(`lang-${userId}`, lang);
    Cookies.set(`lang-${userId}`, lang, { expires: 365 });
    navigate();
  }, [userId, navigate]);

  const value = useMemo(() => ({
    language,
    setLanguage: changeLanguage,
    isReady
  }), [language, changeLanguage, isReady]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);

/**
 * Hook de traduction sécurisé pour l'hydratation
 */
export function useTranslation() {
  const { language, isReady } = useLanguage();

  // On définit la logique de traduction à l'intérieur du hook
  // pour qu'elle dépende de l'état "language" du contexte.
  const t = useCallback((
    keys?: VocabularyKey | VocabularyKey[],
    replacements?: Record<string, string | number>
  ): any => {
    // Note : Tant que isReady est faux, on pourrait forcer "en" 
    // pour garantir la correspondance avec le serveur
    const activeLang = isReady ? language : "en";

    if (keys === undefined) {
      return allVocabularyKeys.reduce((acc, key) => {
        acc[key] = vocabulary[activeLang][key];
        return acc;
      }, {} as VocabularyObject);
    }

    if (replacements && !Array.isArray(keys)) {
      let translation = vocabulary[activeLang][keys as VocabularyKey] || "";
      Object.entries(replacements).forEach(([key, value]) => {
        translation = translation.replace(new RegExp(`\\[${key}\\]`, 'g'), String(value));
        translation = translation.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
      });
      return translation;
    }

    const keysArray = Array.isArray(keys) ? keys : [keys as VocabularyKey];
    const result = keysArray.reduce((acc, key) => {
      acc[key] = vocabulary[activeLang][key];
      return acc;
    }, {} as Record<VocabularyKey, string>);

    return Array.isArray(keys) ? result : result[keys as VocabularyKey];
  }, [language, isReady]);

  return { t, language, isReady };
}