import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "ScoutforU ATS",
  description: "Applicant Tracking System for ScoutforU Consultants",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${jakarta.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        {children}
        <Toaster
          position="bottom-center"
          toastOptions={{
            style: {
              background: "#0E1320",
              color: "#fff",
              border: "none",
              borderRadius: "12px",
              fontWeight: 700,
              boxShadow: "0 12px 32px rgba(16,24,40,.35)",
            },
          }}
        />
      </body>
    </html>
  );
}
