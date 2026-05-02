import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "iFind — Find Your Perfect Internship",
  description:
    "Discover thousands of internships matched to your skills. iFind connects students with top companies across India.",
  keywords: ["internship", "jobs", "students", "placement", "career"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full`}>
      <body className="min-h-full flex flex-col antialiased">
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
