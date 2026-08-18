export async function readFileAsBytes(file: File): Promise<Uint8Array<ArrayBuffer>> {
    return new Uint8Array(await file.arrayBuffer());
}

export async function readFileSlice(file: File, start: number, end: number): Promise<Uint8Array<ArrayBuffer>> {
    return new Uint8Array(await file.slice(start, end).arrayBuffer());
}

export function downloadBinary(data: Uint8Array<ArrayBuffer>, filename: string, mimeType: string): void {
    triggerDownload(new Blob([data], { type: mimeType }), filename);
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
