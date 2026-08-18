"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function PasswordField({
    id,
    label,
    value,
    onChange,
    error,
    autoComplete,
}: {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    error?: string;
    autoComplete?: string;
}) {
    const t = useTranslations("PasswordField");
    const [visible, setVisible] = useState(false);

    return (
        <Field data-invalid={Boolean(error)}>
            <FieldLabel htmlFor={id}>{label}</FieldLabel>
            <div className="relative">
                <Input
                    id={id}
                    type={visible ? "text" : "password"}
                    value={value}
                    autoComplete={autoComplete}
                    aria-invalid={Boolean(error)}
                    onChange={(e) => onChange(e.target.value)}
                    className="pr-10 font-mono"
                    placeholder={t("placeholder")}
                />
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setVisible((v) => !v)}
                    className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
                    aria-label={visible ? t("hide") : t("show")}
                    tabIndex={-1}
                >
                    {visible ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}
                </Button>
            </div>
            {error && <FieldError>{error}</FieldError>}
        </Field>
    );
}
