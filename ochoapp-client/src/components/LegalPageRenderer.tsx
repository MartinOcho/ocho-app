'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import AppLogo from '@/components/AppLogo';
import Buttons from '@/app/(auth)/Buttons';
import ReactMarkdown, { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ReactNode } from 'react';
import kyInstance from '@/lib/ky';

interface LegalPageProps {
  docType: 'privacy' | 'terms-of-use';
  title: {
    en: string;
    fr: string;
  };
}

// Composants personnalisés pour un meilleur rendu du markdown
const markdownComponents: Components = {
  h1: ({ children, ...props }: { children?: ReactNode; [key: string]: any }) => (
    <h1 className="text-3xl font-bold mt-6 mb-4 text-primary" {...props}>{children}</h1>
  ),
  h2: ({ children, ...props }: { children?: ReactNode; [key: string]: any }) => (
    <h2 className="text-2xl font-bold mt-5 mb-3 text-primary" {...props}>{children}</h2>
  ),
  h3: ({ children, ...props }: { children?: ReactNode; [key: string]: any }) => (
    <h3 className="text-xl font-bold mt-4 mb-2 text-primary" {...props}>{children}</h3>
  ),
  p: ({ children, ...props }: { children?: ReactNode; [key: string]: any }) => (
    <p className="text-foreground leading-relaxed mb-3" {...props}>{children}</p>
  ),
  ul: ({ children, ...props }: { children?: ReactNode; [key: string]: any }) => (
    <ul className="list-disc list-outside ml-6 mb-3 space-y-2" {...props}>{children}</ul>
  ),
  ol: ({ children, ...props }: { children?: ReactNode; [key: string]: any }) => (
    <ol className="list-decimal list-outside ml-6 mb-3 space-y-2" {...props}>{children}</ol>
  ),
  li: ({ children, ...props }: { children?: ReactNode; [key: string]: any }) => (
    <li className="text-foreground ml-2" {...props}>{children}</li>
  ),
  strong: ({ children, ...props }: { children?: ReactNode; [key: string]: any }) => (
    <strong className="font-bold text-foreground" {...props}>{children}</strong>
  ),
  a: ({ children, href, ...props }: { children?: ReactNode; href?: string; [key: string]: any }) => (
    <a href={href} className="text-primary underline hover:no-underline" {...props}>{children}</a>
  ),
  blockquote: ({ children, ...props }: { children?: ReactNode; [key: string]: any }) => (
    <blockquote className="border-l-4 border-primary pl-4 italic my-3 text-muted-foreground" {...props}>{children}</blockquote>
  ),
  code: ({ inline, children, ...props }: { inline?: boolean; children?: ReactNode; [key: string]: any }) => 
    inline ? (
      <code className="bg-accent px-1 py-0.5 rounded text-sm font-mono" {...props}>{children}</code>
    ) : (
      <code className="bg-accent p-3 rounded block text-sm font-mono overflow-x-auto mb-3 text-foreground" {...props}>{children}</code>
    ),
  table: ({ children, ...props }: { children?: ReactNode; [key: string]: any }) => (
    <table className="border-collapse w-full mb-3" {...props}>{children}</table>
  ),
  th: ({ children, ...props }: { children?: ReactNode; [key: string]: any }) => (
    <th className="border border-muted-foreground bg-accent px-3 py-2 font-bold text-left" {...props}>{children}</th>
  ),
  td: ({ children, ...props }: { children?: ReactNode; [key: string]: any }) => (
    <td className="border border-muted-foreground px-3 py-2" {...props}>{children}</td>
  ),
};

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

        const markdown = await kyInstance(`/legal/${language}/${docType}.md`).text();
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
    <div className="privacy-policy container mx-auto px-4 max-w-4xl py-8">
      <AppLogo size={100} logo="LOGO" className="text-primary mx-auto mb-6" />
      <h1 className="text-3xl font-bold text-center text-primary mb-8">
        {title[language]}
      </h1>

      {/* Rendu du Markdown avec react-markdown et composants personnalisés */}
      <div className="space-y-4">
        <ReactMarkdown 
          components={markdownComponents}
          remarkPlugins={[remarkGfm]}
        >
          {content}
        </ReactMarkdown>
      </div>

      <section className="mt-12 pt-8 border-t border-muted-foreground">
        <Buttons />
      </section>
    </div>
  );
}
