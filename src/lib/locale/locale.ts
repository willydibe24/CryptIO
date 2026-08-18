import "server-only";

import { cookies } from "next/headers";
import { env } from "@/lib/env";
import {
    LOCALE_COOKIE,
    supportedLocales,
    type Locale,
} from "@/lib/domain/schema/env.schema";

export async function getInitialLocale(): Promise<Locale> {
    const cookieStore = await cookies();
    const value = cookieStore.get(LOCALE_COOKIE)?.value;

    if (value && (supportedLocales as readonly string[]).includes(value)) {
        return value as Locale;
    }
    return env.NEXT_PUBLIC_LOCALE;
}