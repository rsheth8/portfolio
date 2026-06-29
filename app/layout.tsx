import type { Metadata } from "next";
import "./globals.css";
import { LenisProvider } from "@/components/LenisProvider";

const SITE_URL = "https://portfolio-rsheth8s-projects.vercel.app";
const TITLE = "Rahil Sheth — Portfolio";
const DESCRIPTION =
  "An audio-reactive portfolio. Full-stack systems, machine learning, and the messy bits in between — scroll through, play something, and let the work react.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  metadataBase: new URL(SITE_URL),
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: SITE_URL,
    title: TITLE,
    description: DESCRIPTION,
    siteName: "Rahil Sheth",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="bg-ink text-cream">
      <body className="bg-ink text-cream antialiased" suppressHydrationWarning>
        <LenisProvider>{children}</LenisProvider>
      </body>
    </html>
  );
}
