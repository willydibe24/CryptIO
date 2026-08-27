"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { Unlock } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { MultiFileDropzone } from "../../file/multi-file-dropzone";
import { PasswordField } from "../password-field";
import { DecryptFileRow, type DecryptItem } from "./decrypt-file-row";
import { decryptFile, inspectMetadata } from "@/lib/domain/crypto-file/crypto";
import { downloadBinary, openBinaryInNewWindow, readFileAsBytes } from "@/lib/file/file-io";
import { getPreviewKind } from "@/lib/file/file-utils";
import { classifyDecryptError } from "@/lib/domain/errors/classify-decrypt-error";

export function DecryptPanel() {
    const t = useTranslations("DecryptPanel");
    const [items, setItems] = useState<DecryptItem[]>([]);
    const [password, setPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const pendingCount = items.filter((i) => i.status === "pending" || i.status === "error").length;
    const canSubmit = pendingCount > 0 && password.length > 0;

    function handleFilesSelected(files: File[]) {
        setItems((prev) => [
            ...prev,
            ...files.map((file) => ({
                id: crypto.randomUUID(),
                file,
                status: "pending" as const,
                retryPassword: "",
                retrying: false,
                downloading: false,
                viewing: false,
            })),
        ]);
    }

    async function performDownload(id: string, file: File, filePassword: string) {
        setItems((prev) => prev.map((i) => (i.id === id ? { ...i, downloading: true, downloadError: undefined } : i)));
        try {
            const container = await readFileAsBytes(file);
            const { metadata, data } = await decryptFile(container, filePassword);
            downloadBinary(data, metadata.fileName, metadata.mimeType);
        }
        catch (err) {
            setItems((prev) => prev.map((i) =>
                i.id === id ? { ...i, downloadError: classifyDecryptError(err) } : i,
            ));
        }
        finally {
            setItems((prev) => prev.map((i) => (i.id === id ? { ...i, downloading: false } : i)));
        }
    }

    async function performView(id: string, file: File, filePassword: string, win: Window | null) {
        setItems((prev) => prev.map((i) => (i.id === id ? { ...i, viewing: true, viewError: undefined } : i)));
        try {
            const container = await readFileAsBytes(file);
            const { metadata, data } = await decryptFile(container, filePassword);
            if (win) openBinaryInNewWindow(win, data, metadata.mimeType);
            if (getPreviewKind(metadata.mimeType)) {
                const url = URL.createObjectURL(new Blob([data], { type: metadata.mimeType }));
                setItems((prev) => prev.map((i) => {
                    if (i.id !== id) return i;
                    if (i.previewUrl) URL.revokeObjectURL(i.previewUrl);
                    return { ...i, previewUrl: url };
                }));
            }
        }
        catch (err) {
            win?.close();
            setItems((prev) => prev.map((i) =>
                i.id === id ? { ...i, viewError: classifyDecryptError(err) } : i,
            ));
        }
        finally {
            setItems((prev) => prev.map((i) => (i.id === id ? { ...i, viewing: false } : i)));
        }
    }

    async function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const toProcess = items.filter((i) => i.status === "pending" || i.status === "error");
        if (toProcess.length === 0 || !password) return;

        setSubmitting(true);
        setItems((prev) => prev.map((i) =>
            toProcess.some((p) => p.id === i.id) ? { ...i, status: "decrypting", error: undefined } : i,
        ));

        await Promise.allSettled(toProcess.map(async (item) => {
            try {
                const metadata = await inspectMetadata(item.file, password);
                setItems((prev) => prev.map((i) =>
                    i.id === item.id
                        ? { ...i, status: "success", metadata, resolvedPassword: password, error: undefined }
                        : i,
                ));
            }
            catch (err) {
                setItems((prev) => prev.map((i) =>
                    i.id === item.id ? { ...i, status: "error", error: classifyDecryptError(err) } : i,
                ));
            }
        }));

        setSubmitting(false);
    }

    async function handleRetry(id: string) {
        const item = items.find((i) => i.id === id);
        if (!item || !item.retryPassword) return;

        setItems((prev) => prev.map((i) => (i.id === id ? { ...i, retrying: true } : i)));
        try {
            const metadata = await inspectMetadata(item.file, item.retryPassword);
            setItems((prev) => prev.map((i) =>
                i.id === id
                    ? { ...i, status: "success", metadata, resolvedPassword: item.retryPassword, error: undefined }
                    : i,
            ));
        }
        catch (err) {
            setItems((prev) => prev.map((i) =>
                i.id === id ? { ...i, status: "error", error: classifyDecryptError(err) } : i,
            ));
        }
        finally {
            setItems((prev) => prev.map((i) => (i.id === id ? { ...i, retrying: false } : i)));
        }
    }

    async function handleDownload(id: string) {
        const item = items.find((i) => i.id === id);
        if (!item || !item.resolvedPassword) return;
        await performDownload(id, item.file, item.resolvedPassword);
    }

    function handleView(id: string) {
        const item = items.find((i) => i.id === id);
        if (!item || !item.resolvedPassword) return;
        const win = window.open("", "_blank");
        void performView(id, item.file, item.resolvedPassword, win);
    }

    function handleRemove(id: string) {
        setItems((prev) => {
            const item = prev.find((i) => i.id === id);
            if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
            return prev.filter((i) => i.id !== id);
        });
    }

    function handleRetryPasswordChange(id: string, value: string) {
        setItems((prev) => prev.map((i) => (i.id === id ? { ...i, retryPassword: value } : i)));
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <FieldGroup>
                <MultiFileDropzone
                    onFilesSelected={handleFilesSelected}
                    accentBorderClassName="border-[var(--decrypt)]"
                    inputId="decrypt-file-input"
                    titleLabel={t("dropzoneLabel")}
                    description={t("onlyEncryptedFileType")}
                />
                <PasswordField
                    id="decrypt-password"
                    label={t("passwordLabel")}
                    value={password}
                    onChange={setPassword}
                    autoComplete="current-password"
                />
            </FieldGroup>

            {items.length > 0 ? (
                <ul className="flex flex-col gap-2">
                    {items.map((item) => (
                        <DecryptFileRow
                            key={item.id}
                            item={item}
                            onRetryPasswordChange={handleRetryPasswordChange}
                            onRetry={handleRetry}
                            onDownload={handleDownload}
                            onView={handleView}
                            onRemove={handleRemove}
                        />
                    ))}
                </ul>
            ) : (
                <p className="text-sm text-muted-foreground">{t("empty")}</p>
            )}

            <Button
                type="submit"
                disabled={!canSubmit || submitting}
                className="bg-(--decrypt) text-white hover:opacity-90"
            >
                <Unlock className="h-4 w-4"/>
                {submitting ? t("submitting") : t("submit")}
            </Button>
        </form>
    );
}
