import { FileMetadata, fileMetadataSchema } from "@/lib/domain/schema/file.schema";
import {
    AES_GCM_TAG_LENGTH,
    CryptioHeader,
    decodeContainer,
    decodeHeader,
    encodeHeader,
    HEADER_BYTE_LENGTH,
    UUID_BYTE_LENGTH,
} from "@/lib/domain/crypto-file/container";
import { CryptioFormatError } from "@/lib/domain/exceptions/cryptio-format.exception";
import { readFileSlice } from "@/lib/file/file-io";
import { env } from "@/lib/env";

const KDF_ITERATIONS = env.NEXT_PUBLIC_KDF_ITERATIONS;
const METADATA_HKDF_INFO = new TextEncoder().encode("metadata");
const DATA_HKDF_INFO = new TextEncoder().encode("data");

interface DerivedKeys {
    metadataKey: CryptoKey;
    dataKey: CryptoKey;
}

async function deriveKeys(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<DerivedKeys> {
    const passwordKeyMaterial = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(password),
        "PBKDF2",
        false,
        ["deriveBits"],
    );
    const masterSecret = await crypto.subtle.deriveBits(
        { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
        passwordKeyMaterial,
        256,
    );
    const hkdfKeyMaterial = await crypto.subtle.importKey("raw", masterSecret, "HKDF", false, ["deriveKey"]);

    const deriveSubKey = (info: Uint8Array<ArrayBuffer>) => crypto.subtle.deriveKey(
        { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info },
        hkdfKeyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"],
    );

    const [metadataKey, dataKey] = await Promise.all([
        deriveSubKey(METADATA_HKDF_INFO),
        deriveSubKey(DATA_HKDF_INFO),
    ]);

    return { metadataKey, dataKey };
}

export async function encryptFile(file: File, password: string, info: Pick<FileMetadata, "description">): Promise<Uint8Array<ArrayBuffer>> {
    const uuid = crypto.getRandomValues(new Uint8Array(UUID_BYTE_LENGTH));
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const metadataIv = crypto.getRandomValues(new Uint8Array(12));
    const dataIv = crypto.getRandomValues(new Uint8Array(12));
    const { metadataKey, dataKey } = await deriveKeys(password, salt, KDF_ITERATIONS);

    const metadata: FileMetadata = {
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        ...info,
    };
    const metadataPlaintext = new TextEncoder().encode(JSON.stringify(metadata));
    const dataPlaintext = new Uint8Array(await file.arrayBuffer());

    const header: CryptioHeader = {
        uuid,
        salt,
        kdfIterations: KDF_ITERATIONS,
        metadataIv,
        dataIv,
        metadataLength: metadataPlaintext.length + AES_GCM_TAG_LENGTH,
        dataLength: dataPlaintext.length + AES_GCM_TAG_LENGTH,
    };
    const headerBytes = encodeHeader(header);

    const [metadataCipherText, dataCipherText] = await Promise.all([
        crypto.subtle.encrypt({ name: "AES-GCM", iv: metadataIv, additionalData: headerBytes }, metadataKey, metadataPlaintext),
        crypto.subtle.encrypt({ name: "AES-GCM", iv: dataIv, additionalData: headerBytes }, dataKey, dataPlaintext),
    ]);

    const container = new Uint8Array(headerBytes.length + metadataCipherText.byteLength + dataCipherText.byteLength);
    container.set(headerBytes, 0);
    container.set(new Uint8Array(metadataCipherText), headerBytes.length);
    container.set(new Uint8Array(dataCipherText), headerBytes.length + metadataCipherText.byteLength);

    return container;
}

export async function decryptFile(container: Uint8Array<ArrayBuffer>, password: string): Promise<{ metadata: FileMetadata; data: Uint8Array<ArrayBuffer> }> {
    const { header, headerBytes, metadataCipherText, dataCipherText } = decodeContainer(container);
    const { metadataKey, dataKey } = await deriveKeys(password, header.salt, header.kdfIterations);

    const [metadataPlaintext, dataPlaintext] = await Promise.all([
        crypto.subtle.decrypt({ name: "AES-GCM", iv: header.metadataIv, additionalData: headerBytes }, metadataKey, metadataCipherText),
        crypto.subtle.decrypt({ name: "AES-GCM", iv: header.dataIv, additionalData: headerBytes }, dataKey, dataCipherText),
    ]);

    const metadata = fileMetadataSchema.parse(JSON.parse(new TextDecoder().decode(metadataPlaintext)));

    return { metadata, data: new Uint8Array(dataPlaintext) };
}

export async function decryptMetadata(
    header: CryptioHeader,
    headerBytes: Uint8Array<ArrayBuffer>,
    metadataCipherText: Uint8Array<ArrayBuffer>,
    password: string,
): Promise<FileMetadata> {
    const { metadataKey } = await deriveKeys(password, header.salt, header.kdfIterations);
    const metadataPlaintext = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: header.metadataIv, additionalData: headerBytes },
        metadataKey,
        metadataCipherText,
    );

    return fileMetadataSchema.parse(JSON.parse(new TextDecoder().decode(metadataPlaintext)));
}

export async function inspectMetadata(file: File, password: string): Promise<FileMetadata> {
    const headerBytes = await readFileSlice(file, 0, HEADER_BYTE_LENGTH);
    const header = decodeHeader(headerBytes);
    const metadataEnd = HEADER_BYTE_LENGTH + header.metadataLength;
    if (file.size < metadataEnd) {
        throw new CryptioFormatError("File is truncated or corrupted.");
    }
    const metadataCipherText = await readFileSlice(file, HEADER_BYTE_LENGTH, metadataEnd);

    return decryptMetadata(header, headerBytes, metadataCipherText, password);
}
