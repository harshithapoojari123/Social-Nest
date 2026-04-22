import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Social Nest",
  description: "A dark-mode social feed for posts, profiles, and discovery.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-[var(--background)] text-[var(--foreground)] flex flex-col">
        {children}
      </body>
    </html>
  );
}
