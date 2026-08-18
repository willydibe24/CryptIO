import { envSchema } from "@/lib/domain/schema/env.schema";

export const env = envSchema.parse({
    NEXT_PUBLIC_KDF_ITERATIONS: process.env.NEXT_PUBLIC_KDF_ITERATIONS,
    NEXT_PUBLIC_LOCALE: process.env.NEXT_PUBLIC_LOCALE,
});
