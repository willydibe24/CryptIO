import { zip, type AsyncZippable } from "fflate";

export async function readFileAsBytes(file: File): Promise<Uint8Array<ArrayBuffer>> {
    return new Uint8Array(await file.arrayBuffer());
}

export async function readFileSlice(file: File, start: number, end: number): Promise<Uint8Array<ArrayBuffer>> {
    return new Uint8Array(await file.slice(start, end).arrayBuffer());
}

export function downloadBinary(data: Uint8Array<ArrayBuffer>, filename: string, mimeType: string): void {
    triggerDownload(new Blob([data], { type: mimeType }), filename);
}

export function downloadZip(files: { name: string; data: Uint8Array<ArrayBuffer> }[], zipFilename: string): Promise<void> {
    const entries: AsyncZippable = {};
    for (const file of files) entries[file.name] = file.data;

    return new Promise((resolve, reject) => {
        // level: 0 (store, no compression) — contents are AES-GCM ciphertext and won't compress;
        // the async form runs in a Web Worker so zipping heavy/multiple files doesn't block the UI.
        zip(entries, { level: 0 }, (err, data) => {
            if (err) {
                reject(err);
                return;
            }
            triggerDownload(new Blob([data], { type: "application/zip" }), zipFilename);
            resolve();
        });
    });
}

export function openBinaryInNewWindow(win: Window, data: Uint8Array<ArrayBuffer>, mimeType: string): void {
    const url = URL.createObjectURL(new Blob([data], { type: mimeType }));
    win.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}
