"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Download, Loader2, RotateCw, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { FileNameField } from "../../file/file-name-field";
import { MediaPreview } from "../../file/media-preview";
import { PasswordField } from "../password-field";
import { ENCRYPTED_FILE_EXTENSION, formatBytes, getPreviewKind } from "@/lib/file/file-utils";

export interface EncryptItem {
    id: string;
    file: File;
    fileName: string;
    description: string;
    password: string;
    confirmPassword: string;
    status: "pending" | "encrypting" | "success" | "error";
    encryptedContainer?: Uint8Array<ArrayBuffer>;
    downloaded: boolean;
}

export function EncryptFileRow({
    item,
    onFieldChange,
    onRetry,
    onDownload,
    onRemove,
}: {
    item: EncryptItem;
    onFieldChange: (id: string, patch: Partial<Pick<EncryptItem, "fileName" | "description" | "password" | "confirmPassword">>) => void;
    onRetry: (id: string) => void;
    onDownload: (id: string) => void;
    onRemove: (id: string) => void;
}) {
    const t = useTranslations("EncryptPanel");
    const passwordsMismatch = item.confirmPassword.length > 0 && item.password !== item.confirmPassword;
    const needsPassword = item.password.length === 0;

    const previewKind = getPreviewKind(item.file.type);

    const [previewUrl, setPreviewUrl] = useState<string>();

    useEffect(() => {
        if (!previewKind) return;
        const url = URL.createObjectURL(item.file);
        // eslint-disable-next-line react-hooks/set-state-in-effect -- object URL creation and revocation must be paired within the same effect run, so a Strict Mode remount revokes only the URL it created
        setPreviewUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [item.file, previewKind]);

    return (
        <li className="rounded-md border bg-muted/40 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                    {previewKind && previewUrl && (
                        <MediaPreview kind={previewKind} src={previewUrl} alt={item.file.name} className="h-10 w-10 shrink-0"/>
                    )}
                    <div className="min-w-0">
                        <p className="truncate font-mono text-sm">{item.file.name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{formatBytes(item.file.size)}</p>
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                    {item.status === "encrypting" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground"/>}
                    {item.status === "success" && <CheckCircle2 className="h-4 w-4 text-(--encrypt)"/>}
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => onRemove(item.id)}
                        aria-label={t("remove")}
                    >
                        <X className="h-4 w-4"/>
                    </Button>
                </div>
            </div>

            {(item.status === "pending" || item.status === "error") && (
                <div className="mt-3 space-y-3 border-t pt-3">
                    <FileNameField
                        id={`file-name-${item.id}`}
                        value={item.fileName}
                        onChange={(value) => onFieldChange(item.id, { fileName: value })}
                        onRegenerate={() => onFieldChange(item.id, { fileName: crypto.randomUUID() })}
                    />
                    <Field>
                        <FieldLabel htmlFor={`description-${item.id}`}>{t("descriptionLabel")}</FieldLabel>
                        <Input
                            id={`description-${item.id}`}
                            value={item.description}
                            onChange={(e) => onFieldChange(item.id, { description: e.target.value })}
                            placeholder={t("descriptionPlaceholder")}
                        />
                    </Field>
                    <PasswordField
                        id={`password-${item.id}`}
                        label={t("passwordLabel")}
                        value={item.password}
                        onChange={(value) => onFieldChange(item.id, { password: value })}
                        autoComplete="new-password"
                    />
                    <PasswordField
                        id={`confirm-password-${item.id}`}
                        label={t("confirmPasswordLabel")}
                        value={item.confirmPassword}
                        onChange={(value) => onFieldChange(item.id, { confirmPassword: value })}
                        error={passwordsMismatch ? t("passwordMismatch") : undefined}
                        autoComplete="new-password"
                    />
                    {needsPassword && !passwordsMismatch && (
                        <p className="text-xs text-muted-foreground">{t("needsPassword")}</p>
                    )}
                    {item.status === "error" && (
                        <div className="space-y-2">
                            <p className="text-sm text-destructive">{t("rowError")}</p>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={needsPassword || passwordsMismatch}
                                onClick={() => onRetry(item.id)}
                            >
                                <RotateCw className="h-3.5 w-3.5"/>
                                {t("retry")}
                            </Button>
                        </div>
                    )}
                </div>
            )}

            {item.status === "success" && (
                <div className="mt-3 space-y-2 border-t pt-3">
                    <p className="truncate font-mono text-sm text-muted-foreground">
                        {item.fileName}.{ENCRYPTED_FILE_EXTENSION}
                    </p>
                    {item.encryptedContainer && !item.downloaded && (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => onDownload(item.id)}
                        >
                            <Download className="h-3.5 w-3.5"/>
                            {t("download")}
                        </Button>
                    )}
                </div>
            )}
        </li>
    );
}
