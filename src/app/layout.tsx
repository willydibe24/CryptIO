import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { I18nProvider } from "@/components/i18n/i18n-provider";
import "./globals.css";
import { JetBrains_Mono, Manrope, Space_Grotesk } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { getInitialLocale } from "@/lib/locale/locale";

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-display" });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-sans" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
    title: "CryptIO",
    icons: {
        icon: "/cryptio.svg",
    },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
    const locale = await getInitialLocale();

    return (
        <html
            lang={locale}
            suppressHydrationWarning
            className={`${spaceGrotesk.variable} ${manrope.variable} ${jetbrainsMono.variable}`}
        >
        <body className="font-sans">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <I18nProvider initialLocale={locale}>
                {children}
            </I18nProvider>
            <Toaster/>
        </ThemeProvider>
        </body>
        </html>
    );
}
