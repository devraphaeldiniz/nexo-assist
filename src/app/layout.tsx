import { Newsreader, Schibsted_Grotesk, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

export const newsreader = Newsreader({
  subsets: ['latin'],
  variable: '--font-newsreader',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700', '800'],
});

export const schibstedGrotesk = Schibsted_Grotesk({
  subsets: ['latin'],
  variable: '--font-schibsted-grotesk',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

export const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-ibm-plex-mono',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`${newsreader.variable} ${schibstedGrotesk.variable} ${ibmPlexMono.variable}`}>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}