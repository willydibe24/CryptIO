import { CryptioFormatError } from "@/lib/domain/exceptions/cryptio-format.exception";

export type DecryptErrorKind = "invalidFile" | "wrongPassword" | "generic";

export function classifyDecryptError(err: unknown): DecryptErrorKind {
    if (err instanceof CryptioFormatError) return "invalidFile";
    if (err instanceof DOMException) return "wrongPassword";
    return "generic";
}
