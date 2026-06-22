import type { Metadata } from "next";
import { Inter, Inter_Tight } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import "./gradients.css";
import { ThemeProvider } from "next-themes";
import ReactQueryProvider from "./ReactQueryProvider";

const interSans = Inter({
  variable: "--font-inter-sans",
  subsets: ["latin"],
});

const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
});

const emojiFont = localFont({
  src: "./fonts/Emoji.ttf",
  variable: "--font-emoji",
  preload: true,
  display: 'swap',
});


const isXmas = (): boolean => {
  const today = new Date();
  const start = new Date(today.getFullYear(), 11, 24); // 24 décembre
  const end = new Date(today.getFullYear() + 1, 0, 2, 23, 59, 59); // 2 janvier inclus

  return today >= start && today <= end;
};

const favicons = isXmas()
  ? [
      { url: '/favicon-xmas.svg', type: 'image/svg+xml' },
      { url: '/favicon-xmas.ico', type: 'image/x-icon' },
      { url: '/favicon-xmas.png', type: 'image/png' },
    ]
  : [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', type: 'image/x-icon' },
      { url: '/favicon.png', type: 'image/png' },
    ];


export const metadata: Metadata = {
  // 1. Informations de base
  title: {
    default: "OchoApp - Partagez à l'infini vos moments avec vos amis.",
    template: "%s | OchoApp", 
  },
  description: "Connectez-vous avec vos amis, partagez vos moments et discutez sur OchoApp.",
  keywords: ["OchoApp", "réseau social", "communauté", "ochokom", "nextjs", "partage", "messagerie"],
  authors: [{ name: "Martin Ocho", url: "https://ochoapp.ochokom.com" }],
  creator: "Martin Ocho",

  // 2. Configuration pour les moteurs de recherche (SEO)
  robots: {
    index: true,
    follow: true,
    nocache: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },

  // 3. Open Graph (Affichage sur Facebook, Discord, WhatsApp, LinkedIn)
  openGraph: {
    title: "OchoApp - Connectez-vous et partagez",
    description: "Rejoignez OchoApp pour découvrir des publications captivantes et suivre vos créateurs préférés.",
    url: "https://ochoapp.ochokom.com",
    siteName: "OchoApp",
    locale: "fr_FR",
    type: "website",
    images: [
      {
        url: "https://ochoapp.ochokom.com/og-image.png", // Image par défaut à mettre dans votre dossier public
        width: 1200,
        height: 630,
        alt: "Aperçu de la plateforme OchoApp",
      },
    ],
  },

  // 4. Configuration pour X (anciennement Twitter)
  twitter: {
    card: "summary_large_image",
    title: "OchoApp - Connectez-vous et partagez",
    description: "Découvrez ce qui se passe en ce moment sur OchoApp. Discutez, partagez et restez connecté.",
    creator: "@ochomartin13", // Optionnel : Votre handle X
    images: ["https://ochoapp.ochokom.com/og-image.png"],
  },

  // 5. Icônes du site (Favicons)
  icons: {
    icon: favicons,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html suppressHydrationWarning={true}>
      <body className={`${interSans.variable} ${interTight.variable} ${emojiFont.variable}`}>
        <ReactQueryProvider>
          <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          >
            {children}
          </ThemeProvider>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
