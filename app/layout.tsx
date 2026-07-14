import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { SidebarLayout } from "./components/SidebarLayout";
import { listApplications } from "@/lib/db";

export const metadata: Metadata = {
  title: "Postulaciones",
  description: "Seguimiento personal de postulaciones"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const applications = listApplications();

  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <Script
          id="theme-initializer"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme');
                  var systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                  var activeTheme = theme || systemTheme;
                  document.documentElement.setAttribute('data-theme', activeTheme);
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body>
        <SidebarLayout applicationsCount={applications.length}>
          {children}
        </SidebarLayout>
      </body>
    </html>
  );
}
