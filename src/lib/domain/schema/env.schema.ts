import { z } from "zod";

export const LOCALE_COOKIE = "cryptio-locale";
export const supportedLocales = ["it", "en"] as const;
export type Locale = (typeof supportedLocales)[number];

export const envSchema = z.object({
    NEXT_PUBLIC_KDF_ITERATIONS: z.coerce.number().int().min(100_000).default(600_000),
    NEXT_PUBLIC_LOCALE: z.enum(supportedLocales).default("it"),
});
export type Env = z.infer<typeof envSchema>;
