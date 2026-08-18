"use client";

import type { ChangeEvent, DragEvent } from "react";
import { useState } from "react";
import { Upload } from "lucide-react";
import { useTranslations } from "next-intl";

export function MultiFileDropzone({
    onFilesSelected,
    accentBorderClassName,
    inputId,
    titleLabel,
    description,
}: {
    onFilesSelected: (files: File[]) => void;
    accentBorderClassName: string;
    inputId: string;
    titleLabel: string;
    description: string;
}) {
    const t = useTranslations("MultiFileDropzone");
    const [isDragging, setIsDragging] = useState(false);

    function handleDrop(e: DragEvent<HTMLLabelElement>) {
        e.preventDefault();
        setIsDragging(false);
        const dropped = Array.from(e.dataTransfer.files ?? []);
        if (dropped.length > 0) onFilesSelected(dropped);
    }

    function handleChange(e: ChangeEvent<HTMLInputElement>) {
        const selected = Array.from(e.target.files ?? []);
        if (selected.length > 0) onFilesSelected(selected);
        e.target.value = "";
    }

    return (
        <label
            htmlFor={inputId}
            onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed px-4 py-8 text-center transition-colors ${
                isDragging ? `${accentBorderClassName} bg-muted/40` : "border-input hover:border-muted-foreground/40"
            }`}
        >
            <Upload className="h-5 w-5 text-muted-foreground" aria-hidden="true"/>
            <span className="text-sm text-foreground/80">
                {t("drag", { label: titleLabel })} <span className="underline">{t("browse")}</span>
            </span>
            <span className="text-xs text-muted-foreground">{description}</span>
            <input id={inputId} type="file" multiple className="sr-only" onChange={handleChange}/>
        </label>
    );
}
