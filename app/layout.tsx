import { Geist, Geist_Mono } from 'next/font/google'
import React from "react";
import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { ErrorToastProvider } from "@/components/error-toast-provider";
import { PwaInstallListener } from "@/components/pwa-install-listener";
import "./globals.css";
import "../loader.css";

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "BariFutbol - Organiza tus partidos",
  description: "Organizador de partidos de futbol entre amigos",
  generator: "v0.app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-AR" className="scroll-smooth">
      <body
        className="font-sans antialiased app-bg"
      >
        <div className='bg-white/20'>

        <PwaInstallListener />
        <ErrorToastProvider>{children}</ErrorToastProvider>
        <Analytics />
        </div>
      </body>
    </html>
  );
}
