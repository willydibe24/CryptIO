"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { Archive, Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { MultiFileDropzone } from "../../file/multi-file-dropzone";
import { EncryptFileRow, type EncryptItem } from "./encrypt-file-row";
import { encryptFile } from "@/lib/domain/crypto-file/crypto";
import { downloadBinary, downloadZip } from "@/lib/file/file-io";
import { ENCRYPTED_FILE_EXTENSION, generateFileName } from "@/lib/file/file-utils";

function isRowReady(item: EncryptItem): boolean {
    return item.password.length > 0 && item.password === item.confirmPassword;
}

export function EncryptPanel() {
    const t = useTranslations("EncryptPanel");
    const [items, setItems] = useState<EncryptItem[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [downloadingAll, setDownloadingAll] = useState(false);

    const canSubmit = items.some((i) => (i.status === "pending" || i.status === "error") && isRowReady(i));
    const downloadableItems = items.filter(
        (i): i is EncryptItem & { encryptedContainer: Uint8Array<ArrayBuffer> } =>
            i.status === "success" && !i.downloaded && i.encryptedContainer !== undefined,
    );

    function handleFilesSelected(files: File[]) {
        setItems((prev) => [
            ...prev,
            ...files.map((file) => ({
                id: crypto.randomUUID(),
                file,
                fileName: generateFileName(),
                description: "",
                password: "",
                confirmPassword: "",
                status: "pending" as const,
                downloaded: false,
            })),
        ]);
    }

    function handleFieldChange(id: string, patch: Partial<Pick<EncryptItem, "fileName" | "description" | "password" | "confirmPassword">>) {
        setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    }

    async function processItem(item: EncryptItem, autoDownload: boolean) {
        setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: "encrypting" } : i)));
        try {
            const encrypted = await encryptFile(item.file, item.password, {
                description: item.description.trim() || undefined,
            });
            if (autoDownload) {
                downloadBinary(encrypted, `${item.fileName}.${ENCRYPTED_FILE_EXTENSION}`, "application/octet-stream");
                setItems((prev) => prev.map((i) =>
                    i.id === item.id ? { ...i, status: "success", downloaded: true } : i,
                ));
            }
            else {
                setItems((prev) => prev.map((i) =>
                    i.id === item.id ? {
                        ...i,
                        status: "success",
                        encryptedContainer: encrypted,
                        downloaded: false,
                    } : i,
                ));
            }
        }
        catch {
            setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: "error" } : i)));
        }
    }

    async function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const toProcess = items.filter((i) => (i.status === "pending" || i.status === "error") && isRowReady(i));
        if (toProcess.length === 0) return;

        setSubmitting(true);
        const autoDownload = toProcess.length === 1;
        await Promise.allSettled(toProcess.map((item) => processItem(item, autoDownload)));
        setSubmitting(false);
    }

    async function handleRetry(id: string) {
        const item = items.find((i) => i.id === id);
        if (!item || !isRowReady(item)) return;
        await processItem(item, true);
    }

    function handleDownload(id: string) {
        const item = items.find((i) => i.id === id);
        if (!item?.encryptedContainer) return;
        downloadBinary(item.encryptedContainer, `${item.fileName}.${ENCRYPTED_FILE_EXTENSION}`, "application/octet-stream");
        setItems((prev) => prev.map((i) => (i.id === id ? { ...i, downloaded: true } : i)));
    }

    function handleRemove(id: string) {
        setItems((prev) => prev.filter((i) => i.id !== id));
    }

    async function handleDownloadAll() {
        if (downloadableItems.length === 0) return;

        const usedNames = new Set<string>();
        const entries = downloadableItems.map((item) => {
            let name = `${item.fileName}.${ENCRYPTED_FILE_EXTENSION}`;
            let suffix = 2;
            while (usedNames.has(name)) {
                name = `${item.fileName} (${suffix}).${ENCRYPTED_FILE_EXTENSION}`;
                suffix++;
            }
            usedNames.add(name);
            return { name, data: item.encryptedContainer };
        });
        const downloadedIds = new Set(downloadableItems.map((i) => i.id));

        setDownloadingAll(true);
        try {
            await downloadZip(entries, "cryptio-files.zip");
            setItems((prev) => prev.map((i) => (downloadedIds.has(i.id) ? { ...i, downloaded: true } : i)));
        }
        finally {
            setDownloadingAll(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <FieldGroup>
                <MultiFileDropzone
                    onFilesSelected={handleFilesSelected}
                    accentBorderClassName="border-[var(--encrypt)]"
                    inputId="encrypt-file-input"
                    titleLabel={t("dropzoneLabel")}
                    description={t("anyFileType")}
                />
            </FieldGroup>

            {items.length > 0 ? (
                <ul className="flex flex-col gap-2">
                    {items.map((item) => (
                        <EncryptFileRow
                            key={item.id}
                            item={item}
                            onFieldChange={handleFieldChange}
                            onRetry={handleRetry}
                            onDownload={handleDownload}
                            onRemove={handleRemove}
                        />
                    ))}
                </ul>
            ) : (
                <p className="text-sm text-muted-foreground">{t("empty")}</p>
            )}

            {downloadableItems.length > 0 && (
                <div className="flex justify-end">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={downloadingAll}
                        onClick={handleDownloadAll}
                    >
                        <Archive className="h-3.5 w-3.5"/>
                        {downloadingAll ? t("downloadingAll") : t("downloadAll")}
                    </Button>
                </div>
            )}

            <p className="text-xs text-muted-foreground">{t("disclaimer")}</p>

            <Button
                type="submit"
                disabled={!canSubmit || submitting}
                className="bg-(--encrypt) text-white hover:opacity-90"
            >
                <Lock className="h-4 w-4"/>
                {submitting ? t("submitting") : t("submit")}
            </Button>
        </form>
    );
}
