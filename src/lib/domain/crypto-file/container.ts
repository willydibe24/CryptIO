// Cryptio binary crypto-file format v1.
//
// Layout (all multi-byte integers little-endian), 77-byte plaintext header
// followed by two AES-256-GCM sections:
//
//   0   4   magic            "CRIO"
//   4   1   version          must equal CRYPTIO_FORMAT_VERSION
//   5   16  uuid             raw crypto-file identifier
//   21  16  salt             PBKDF2 salt
//   37  4   kdfIterations    uint32
//   41  12  metadataIv       AES-GCM nonce for the metadata section
//   53  12  dataIv           AES-GCM nonce for the data section
//   65  4   metadataLength   uint32, includes the 16-byte GCM tag
//   69  8   dataLength       uint64, includes the 16-byte GCM tag
//   77      metadataCipherText (metadataLength bytes)
//   ...     dataCipherText     (dataLength bytes)
//
// The full header is passed as AAD to both AES-GCM operations, so none of
// it can be tampered with without invalidating both sections.

import { CryptioFormatError } from "@/lib/domain/exceptions/cryptio-format.exception";

export const CRYPTIO_MAGIC = new TextEncoder().encode("CRIO");
export const CRYPTIO_FORMAT_VERSION = 1;
export const AES_GCM_TAG_LENGTH = 16;

const MAGIC_LENGTH = CRYPTIO_MAGIC.length;
const VERSION_LENGTH = 1;
const UUID_LENGTH = 16;
const SALT_LENGTH = 16;
const KDF_ITERATIONS_LENGTH = 4;
const IV_LENGTH = 12;
const METADATA_LENGTH_FIELD_LENGTH = 4;
const DATA_LENGTH_FIELD_LENGTH = 8;

const MAGIC_OFFSET = 0;
const VERSION_OFFSET = MAGIC_OFFSET + MAGIC_LENGTH;
const UUID_OFFSET = VERSION_OFFSET + VERSION_LENGTH;
const SALT_OFFSET = UUID_OFFSET + UUID_LENGTH;
const KDF_ITERATIONS_OFFSET = SALT_OFFSET + SALT_LENGTH;
const METADATA_IV_OFFSET = KDF_ITERATIONS_OFFSET + KDF_ITERATIONS_LENGTH;
const DATA_IV_OFFSET = METADATA_IV_OFFSET + IV_LENGTH;
const METADATA_LENGTH_OFFSET = DATA_IV_OFFSET + IV_LENGTH;
const DATA_LENGTH_OFFSET = METADATA_LENGTH_OFFSET + METADATA_LENGTH_FIELD_LENGTH;

export const HEADER_BYTE_LENGTH = DATA_LENGTH_OFFSET + DATA_LENGTH_FIELD_LENGTH; // 77
export const UUID_BYTE_LENGTH = UUID_LENGTH;

export interface CryptioHeader {
    uuid: Uint8Array<ArrayBuffer>;
    salt: Uint8Array<ArrayBuffer>;
    kdfIterations: number;
    metadataIv: Uint8Array<ArrayBuffer>;
    dataIv: Uint8Array<ArrayBuffer>;
    metadataLength: number;
    dataLength: number;
}

export interface CryptioContainer {
    header: CryptioHeader;
    headerBytes: Uint8Array<ArrayBuffer>;
    metadataCipherText: Uint8Array<ArrayBuffer>;
    dataCipherText: Uint8Array<ArrayBuffer>;
}

export function encodeHeader(header: CryptioHeader): Uint8Array<ArrayBuffer> {
    const bytes = new Uint8Array(HEADER_BYTE_LENGTH);
    const view = new DataView(bytes.buffer);

    bytes.set(CRYPTIO_MAGIC, MAGIC_OFFSET);
    view.setUint8(VERSION_OFFSET, CRYPTIO_FORMAT_VERSION);
    bytes.set(header.uuid, UUID_OFFSET);
    bytes.set(header.salt, SALT_OFFSET);
    view.setUint32(KDF_ITERATIONS_OFFSET, header.kdfIterations, true);
    bytes.set(header.metadataIv, METADATA_IV_OFFSET);
    bytes.set(header.dataIv, DATA_IV_OFFSET);
    view.setUint32(METADATA_LENGTH_OFFSET, header.metadataLength, true);
    view.setBigUint64(DATA_LENGTH_OFFSET, BigInt(header.dataLength), true);

    return bytes;
}

export function decodeHeader(bytes: Uint8Array<ArrayBuffer>): CryptioHeader {
    if (bytes.length < HEADER_BYTE_LENGTH) {
        throw new CryptioFormatError("File is too short to be a valid Cryptio crypto-file.");
    }

    const magic = bytes.subarray(MAGIC_OFFSET, MAGIC_OFFSET + MAGIC_LENGTH);
    if (!magic.every((byte, i) => byte === CRYPTIO_MAGIC[i])) {
        throw new CryptioFormatError("Not a Cryptio crypto-file.");
    }

    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const version = view.getUint8(VERSION_OFFSET);
    if (version !== CRYPTIO_FORMAT_VERSION) {
        throw new CryptioFormatError(`Unsupported Cryptio file format version: ${version}.`);
    }

    return {
        uuid: bytes.slice(UUID_OFFSET, UUID_OFFSET + UUID_LENGTH),
        salt: bytes.slice(SALT_OFFSET, SALT_OFFSET + SALT_LENGTH),
        kdfIterations: view.getUint32(KDF_ITERATIONS_OFFSET, true),
        metadataIv: bytes.slice(METADATA_IV_OFFSET, METADATA_IV_OFFSET + IV_LENGTH),
        dataIv: bytes.slice(DATA_IV_OFFSET, DATA_IV_OFFSET + IV_LENGTH),
        metadataLength: view.getUint32(METADATA_LENGTH_OFFSET, true),
        dataLength: Number(view.getBigUint64(DATA_LENGTH_OFFSET, true)),
    };
}

export function decodeContainer(bytes: Uint8Array<ArrayBuffer>): CryptioContainer {
    const header = decodeHeader(bytes);
    const metadataStart = HEADER_BYTE_LENGTH;
    const metadataEnd = metadataStart + header.metadataLength;
    const dataEnd = metadataEnd + header.dataLength;

    if (dataEnd > bytes.length) {
        throw new CryptioFormatError("File is truncated or corrupted.");
    }

    return {
        header,
        headerBytes: bytes.slice(0, HEADER_BYTE_LENGTH),
        metadataCipherText: bytes.slice(metadataStart, metadataEnd),
        dataCipherText: bytes.slice(metadataEnd, dataEnd),
    };
}
