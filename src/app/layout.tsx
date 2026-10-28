import type { Metadata, Viewport } from "next";
import { Heebo } from "next/font/google";
import { AppProvider } from "@/components/AppProvider";
import { Shell } from "@/components/Shell";
import "./globals.css";

const heebo = Heebo({ variable: "--font-heebo", subsets: ["hebrew", "latin"] });

export const metadata: Metadata = {
  title: "כוחות ⚽",
  description: "חלוקה מאוזנת לקבוצות בכדורגל השכונתי",
  appleWebApp: { capable: true, title: "כוחות", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#047857",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        <AppProvider>
          <Shell>{children}</Shell>
        </AppProvider>
      </body>
    </html>
  );
}
