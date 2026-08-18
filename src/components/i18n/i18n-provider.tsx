"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { NextIntlClientProvider } from "next-intl";
import Cookies from "js-cookie";
import { LOCALE_COOKIE, type Locale } from "@/lib/domain/schema/env.schema";
import en from "../../../messages/en.json";
import it from "../../../messages/it.json";

const messagesByLocale: Record<Locale, object> = { en, it };

function writeLocaleCookie(locale: Locale): void {
    Cookies.set(LOCALE_COOKIE, locale, { expires: 365, path: "/", sameSite: "lax" });
}

const LocaleSetterContext = createContext<((locale: Locale) => void) | null>(null);

export function useSetLocale(): (locale: Locale) => void {
    const setter = useContext(LocaleSetterContext);
    if (!setter) throw new Error("I18nProvider not found");
    return setter;
}

export function I18nProvider({ initialLocale, children }: { initialLocale: Locale; children: React.ReactNode }) {
    const [locale, setLocale] = useState<Locale>(initialLocale);

    useEffect(() => {
        document.documentElement.lang = locale;
    }, [locale]);

    function handleSetLocale(next: Locale) {
        writeLocaleCookie(next);
        setLocale(next);
    }

    return (
        <LocaleSetterContext.Provider value={handleSetLocale}>
            <NextIntlClientProvider timeZone={Intl.DateTimeFormat().resolvedOptions().timeZone} locale={locale} messages={messagesByLocale[locale]}>
                {children}
            </NextIntlClientProvider>
        </LocaleSetterContext.Provider>
    );
}
