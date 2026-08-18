"use client";

import { useLocale, useTranslations } from "next-intl";
import { supportedLocales, type Locale } from "@/lib/domain/schema/env.schema";
import { useSetLocale } from "./i18n-provider";
import { cn } from "@/lib/utils";

const LOCALE_LABELS: Record<Locale, string> = {
    it: "Italiano",
    en: "English",
};

export function LocaleSwitcher({ className }: { className?: string }) {
    const t = useTranslations("LocaleSwitcher");
    const locale = useLocale() as Locale;
    const setLocale = useSetLocale();

    return (
        <select
            value={locale}
            onChange={(e) => setLocale(e.target.value as Locale)}
            aria-label={t("label")}
            className={cn(
                "h-9 rounded-md border border-input bg-transparent px-2 py-1",
                "text-sm text-foreground cursor-pointer",
                "focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                "hover:bg-accent hover:text-accent-foreground transition-colors",
                className,
            )}
        >
            {supportedLocales.map((l) => (
                <option key={l} value={l} className="bg-popover text-popover-foreground">
                    {LOCALE_LABELS[l]}
                </option>
            ))}
        </select>
    );
}
