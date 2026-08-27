import Image from "next/image";
import { cn } from "@/lib/utils";
import type { PreviewKind } from "@/lib/file/file-utils";

export function MediaPreview({ kind, src, alt, className }: { kind: PreviewKind; src: string; alt: string; className?: string }) {
    return (
        <div className={cn("relative overflow-hidden rounded-md border bg-muted", className)}>
            {kind === "image" ? (
                <Image src={src} alt={alt} fill unoptimized className="object-cover"/>
            ) : (
                <video src={src} muted playsInline preload="metadata" className="h-full w-full object-cover"/>
            )}
        </div>
    );
}
