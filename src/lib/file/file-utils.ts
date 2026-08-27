export const ENCRYPTED_FILE_EXTENSION = "cryptio";

export type PreviewKind = "image" | "video";

export function getPreviewKind(mimeType: string): PreviewKind | undefined {
    if (mimeType.startsWith("image/")) return "image";
    if (mimeType.startsWith("video/")) return "video";
    return undefined;
}

export function generateFileName(): string {
    return crypto.randomUUID();
}

export function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
