"use client";

import { Shuffle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ENCRYPTED_FILE_EXTENSION } from "@/lib/file/file-utils";

export function FileNameField({
    id,
    value,
    onChange,
    onRegenerate,
}: {
    id: string;
    value: string;
    onChange: (value: string) => void;
    onRegenerate: () => void;
}) {
    const t = useTranslations("FileNameField");

    return (
        <Field>
            <FieldLabel htmlFor={id}>{t("label")}</FieldLabel>
            <div
                className="flex items-center gap-1 rounded-md border border-input pr-1 focus-within:ring-1 focus-within:ring-ring">
                <Input
                    id={id}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    spellCheck={false}
                    className="border-0 font-mono shadow-none focus-visible:ring-0"
                    placeholder={t("placeholder")}
                />
                <span className="shrink-0 font-mono text-sm text-muted-foreground">
                    .{ENCRYPTED_FILE_EXTENSION}
                </span>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={onRegenerate}
                    className="shrink-0"
                    aria-label={t("regenerate")}
                >
                    <Shuffle className="h-4 w-4"/>
                </Button>
            </div>
            <FieldDescription>{t("description")}</FieldDescription>
        </Field>
    );
}
