"use client";

import { CheckCircle2, Download, ExternalLink, Loader2, RotateCw, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { PasswordField } from "../password-field";
import { formatBytes } from "@/lib/file/file-utils";
import type { FileMetadata } from "@/lib/domain/schema/file.schema";
import type { DecryptErrorKind } from "@/lib/domain/errors/classify-decrypt-error";

export interface DecryptItem {
    id: string;
    file: File;
    status: "pending" | "decrypting" | "success" | "error";
    metadata?: FileMetadata;
    error?: DecryptErrorKind;
    resolvedPassword?: string;
    retryPassword: string;
    retrying: boolean;
    downloading: boolean;
    downloadError?: DecryptErrorKind;
    viewing: boolean;
    viewError?: DecryptErrorKind;
}

export function DecryptFileRow({
    item,
    onRetryPasswordChange,
    onRetry,
    onDownload,
    onView,
    onRemove,
}: {
    item: DecryptItem;
    onRetryPasswordChange: (id: string, value: string) => void;
    onRetry: (id: string) => void;
    onDownload: (id: string) => void;
    onView: (id: string) => void;
    onRemove: (id: string) => void;
}) {
    const t = useTranslations("DecryptPanel");

    return (
        <li className="rounded-md border bg-muted/40 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <p className="truncate font-mono text-sm">{item.file.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{formatBytes(item.file.size)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                    {item.status === "decrypting" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground"/>}
                    {item.status === "success" && <CheckCircle2 className="h-4 w-4 text-(--decrypt)"/>}
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

            {item.status === "success" && item.metadata && (
                <div className="mt-3 space-y-2 border-t pt-3">
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                        <dt className="text-muted-foreground">{t("metadataFileName")}</dt>
                        <dd className="truncate font-mono">{item.metadata.fileName}</dd>
                        <dt className="text-muted-foreground">{t("metadataMimeType")}</dt>
                        <dd className="truncate font-mono">{item.metadata.mimeType}</dd>
                        {item.metadata.description && (
                            <>
                                <dt className="text-muted-foreground">{t("metadataDescription")}</dt>
                                <dd className="break-words">{item.metadata.description}</dd>
                            </>
                        )}
                    </dl>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={item.downloading}
                            onClick={() => onDownload(item.id)}
                        >
                            <Download className="h-3.5 w-3.5"/>
                            {item.downloading ? t("downloading") : t("downloadAction")}
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={item.viewing}
                            onClick={() => onView(item.id)}
                        >
                            <ExternalLink className="h-3.5 w-3.5"/>
                            {item.viewing ? t("viewing") : t("viewAction")}
                        </Button>
                    </div>
                    {item.downloadError && (
                        <p className="text-sm text-destructive">{t(item.downloadError)}</p>
                    )}
                    {item.viewError && (
                        <p className="text-sm text-destructive">{t(item.viewError)}</p>
                    )}
                </div>
            )}

            {item.status === "error" && (
                <div className="mt-3 space-y-2 border-t pt-3">
                    <p className="text-sm text-destructive">{t(item.error ?? "generic")}</p>
                    {item.error === "wrongPassword" && (
                        <FieldGroup className="gap-2">
                            <PasswordField
                                id={`retry-password-${item.id}`}
                                label={t("retryLabel")}
                                value={item.retryPassword}
                                onChange={(value) => onRetryPasswordChange(item.id, value)}
                                autoComplete="current-password"
                            />
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={item.retrying || item.retryPassword.length === 0}
                                onClick={() => onRetry(item.id)}
                            >
                                <RotateCw className="h-3.5 w-3.5"/>
                                {t("retrySubmit")}
                            </Button>
                        </FieldGroup>
                    )}
                </div>
            )}
        </li>
    );
}
