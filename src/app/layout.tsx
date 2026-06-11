import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import LayoutClient from "@/components/LayoutClient";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Health 360 Physiotherapy Dashboard",
  description: "AI-powered outbound calling dashboard for clinic follow-ups and patient check-ins",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('health360_theme');
                  if (!saved) return;
                  document.documentElement.classList.remove('dark', 'theme-sage', 'theme-blue', 'theme-ruby');
                  if (saved !== 'light') document.documentElement.classList.add(saved);
                } catch (e) {}
              })();
            `,
          }}
        />
        <LayoutClient>{children}</LayoutClient>
      </body>
    </html>
  );
}
