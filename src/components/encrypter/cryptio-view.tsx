"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EncryptPanel } from "./encrypt/encrypt-panel";
import { DecryptPanel } from "./decrypt/decrypt-panel";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { LocaleSwitcher } from "@/components/i18n/locale-switcher";

type Mode = "encrypt" | "decrypt";

const ROUTE_BY_MODE: Record<Mode, string> = {
    encrypt: "/encrypt",
    decrypt: "/decrypt",
};

export function CryptioView({ mode }: { mode: Mode }) {
    const router = useRouter();
    const t = useTranslations("Header");

    return (
        <div className="w-full max-w-md">
            <header className="mb-8 flex items-start justify-between gap-4">
                <div>
                    <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        {t("tagline")}
                    </p>
                    <h1 className="mt-2 font-display text-2xl font-semibold">CryptIO</h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                        {t("description")}
                    </p>
                </div>
                <div className="flex items-center gap-1">
                    <LocaleSwitcher/>
                    <ThemeToggle/>
                </div>
            </header>

            <Tabs
                value={mode}
                onValueChange={(value) => router.push(ROUTE_BY_MODE[value as Mode])}
                className="rounded-lg border bg-card p-6"
            >
                <TabsList className="mb-6 grid w-full grid-cols-2">
                    <TabsTrigger value="encrypt">{t("encryptTab")}</TabsTrigger>
                    <TabsTrigger value="decrypt">{t("decryptTab")}</TabsTrigger>
                </TabsList>
                <TabsContent value="encrypt">
                    <EncryptPanel/>
                </TabsContent>
                <TabsContent value="decrypt">
                    <DecryptPanel/>
                </TabsContent>
            </Tabs>
        </div>
    );
}
