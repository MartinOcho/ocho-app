'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import AppLogo from '@/components/AppLogo';
import Buttons from '@/app/(auth)/Buttons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface LegalPageProps {
  docType: 'privacy' | 'terms-of-use';
  title: {
    en: string;
    fr: string;
  };
}

/**
 * Composant pour afficher les documents légaux (Markdown) en fonction de la langue
 */
export default function LegalPageRenderer({ docType, title }: LegalPageProps) {
  const { language, isReady } = useLanguage();
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isReady) return;

    const fetchMarkdown = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/legal/${language}/${docType}.md`);
        if (!response.ok) {
          throw new Error(`Failed to load ${docType} for language ${language}`);
        }

        const markdown = await response.text();
        setContent(markdown);
      } catch (err) {
        console.error('Error loading legal document:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchMarkdown();
  }, [language, docType, isReady]);

  if (!isReady) {
    return <div className="text-center py-8">Loading...</div>;
  }

  if (loading) {
    return <div className="text-center py-8">Chargement...</div>;
  }

  if (error) {
    return <div className="text-center py-8 text-red-500">Error: {error}</div>;
  }

  return (
    <div className="privacy-policy container mx-auto px-4 max-w-4xl">
      <AppLogo size={100} logo="LOGO" className="text-primary mx-auto" />
      <h1 className="text-2xl font-bold text-center text-primary mb-4">
        {title[language]}
      </h1>

      {/* Rendu du Markdown avec react-markdown */}
      <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:text-muted-foreground prose-a:text-primary prose-a:underline hover:prose-a:no-underline prose-strong:font-bold prose-p:text-foreground prose-p:leading-relaxed prose-ul:list-disc prose-ul:list-inside prose-ol:list-decimal prose-ol:list-inside prose-li:text-foreground">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {content}
        </ReactMarkdown>
      </div>

      <section className="mt-8">
        <Buttons />
      </section>
    </div>
  );
}
