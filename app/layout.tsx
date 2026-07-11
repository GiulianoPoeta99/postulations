import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Postulaciones",
  description: "Seguimiento personal de postulaciones"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script
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
      <body>{children}</body>
    </html>
  );
}
