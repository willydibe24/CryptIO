# Encryption process

This document walks through exactly what happens, cryptographically, when
Cryptio encrypts or decrypts a file. For the on-disk byte layout, see
[AGENTS.md § File format](./AGENTS.md#file-format). For the primitive
choices and why they were made, see
[AGENTS.md § Non-negotiables](./AGENTS.md#non-negotiables).

Everything below runs client-side via the Web Crypto API
(`crypto.subtle`). Code: `src/lib/domain/crypto-file/crypto.ts` (key
derivation, encrypt/decrypt) and `src/lib/domain/crypto-file/container.ts`
(binary framing).

## 1. Key derivation

Cryptio never uses the password directly as an encryption key, and never
derives just one key. It's a two-stage process: PBKDF2 stretches the
password into a master secret, then HKDF splits that secret into two
independent AES keys.

```
password ──PBKDF2-SHA256──▶ masterSecret (256 bits)
                                   │
                                   ├──HKDF-SHA256, info="metadata"──▶ metadataKey (AES-256)
                                   └──HKDF-SHA256, info="data"──────▶ dataKey (AES-256)
```

**Stage 1 — PBKDF2 (password → master secret).**
`deriveKeys()` in `crypto.ts` imports the UTF-8 password bytes as raw
PBKDF2 key material, then calls `crypto.subtle.deriveBits` with:

- `salt`: 16 random bytes, freshly generated per file
  (`crypto.getRandomValues`), stored in the plaintext header.
- `iterations`: `NEXT_PUBLIC_KDF_ITERATIONS` (default 600,000, OWASP's
  current minimum), stored in the plaintext header too.
- `hash`: SHA-256.

This yields 256 bits of output — the **master secret**. It is never used
as an AES key itself.

**Stage 2 — HKDF (master secret → two AES keys).**
The master secret is imported as HKDF key material, then
`crypto.subtle.deriveKey` is called twice with a fixed empty HKDF salt and
two different `info` labels — the UTF-8 bytes `"metadata"` and `"data"` —
producing two independent, non-derivable-from-each-other AES-256-GCM
`CryptoKey`s: `metadataKey` and `dataKey`.

Why bother splitting instead of just using the master secret directly as
one AES key for everything? Domain separation. The metadata section and
the data section are encrypted under keys that have no exploitable
relationship, so:

- A future streaming/chunked data format could introduce its own nonce
  scheme for `dataKey` (e.g. a per-chunk counter) with zero risk of ever
  colliding with the metadata section's nonce — they're different key
  spaces entirely.
- Compromise of one section's key material in some hypothetical future
  side channel doesn't help an attacker with the other section.

This whole derivation (`deriveKeys`) runs identically for both encryption
and decryption — decryption just re-derives the same two keys from the
password plus the salt/iteration count read back out of the file's
plaintext header.

## 2. Encrypting a file (`encryptFile`)

Given a `File`, a password, and an optional `description`:

1. **Generate randomness.** A random 16-byte `uuid` (file identifier), a
   random 16-byte `salt`, and two random 12-byte IVs — `metadataIv` and
   `dataIv`, one per section, never reused between them or across files.
2. **Derive keys** as above, using the fresh salt and the configured
   iteration count.
3. **Build the metadata plaintext.** `{ fileName, mimeType, description? }`
   is assembled from the original `File` object and the user-supplied
   description, then `JSON.stringify`'d and UTF-8 encoded. This is the
   *only* place `fileName`/`mimeType`/`description` exist outside AES-GCM
   ciphertext, and only transiently in memory.
4. **Read the data plaintext.** The original file's raw bytes, via
   `file.arrayBuffer()` — no JSON, no base64, no serialization layer
   between "the file" and "the bytes about to be encrypted."
5. **Encode the plaintext header.** `uuid`, `salt`, `kdfIterations`, both
   IVs, and both section lengths (`metadataLength`/`dataLength` — plaintext
   length plus the 16-byte GCM tag) are packed into the fixed 77-byte
   header via `encodeHeader` (see AGENTS.md for the exact byte layout).
6. **Encrypt both sections in parallel**, each as an independent
   AES-256-GCM operation:
   - metadata: `metadataKey`, `metadataIv`, plaintext = the JSON bytes.
   - data: `dataKey`, `dataIv`, plaintext = the raw file bytes.
   - **Both calls pass the entire header (`headerBytes`) as `additionalData`
     (AAD).** AES-GCM's authentication tag then covers every plaintext
     header field — `kdfIterations`, both IVs, both lengths, the salt —
     even though those fields aren't themselves encrypted. Flip a single
     byte anywhere in the header and both decryptions fail their tag
     check.

     The tag itself isn't a separate encrypted blob — it's a 16-byte MAC
     GCM computes over the ciphertext + AAD and appends after the
     ciphertext. It doesn't hide the header (the header was never fed
     into the cipher, only checked against). It just means: **nothing in
     the file — header or either ciphertext section — can be modified
     without decryption failing.** The header stays readable, just not
     tamperable.
7. **Concatenate**: `headerBytes ‖ metadataCipherText ‖ dataCipherText`.
   This byte array is the entire `.cryptio` file, written straight to
   disk with no further encoding.

## 3. Decrypting a file (`decryptFile`)

Given the raw bytes of a `.cryptio` file and a password:

1. **Parse the container.** `decodeContainer` (in `container.ts`) checks
   the `CRIO` magic and version byte, reads the header fields back out,
   and slices out `metadataCipherText`/`dataCipherText` using the header's
   length fields. A bad magic, unsupported version, or a file too short
   to hold what the header claims throws `CryptioFormatError` — this is
   the "invalid file" case, detected *before* any password is involved.
2. **Re-derive the same two keys**, using the salt and iteration count
   read from the header (not the app's current default — a file always
   carries its own iteration count, so raising the default later doesn't
   break old files).
3. **Decrypt both sections in parallel**, passing the same `headerBytes`
   as AAD that was used at encryption time. If the password is wrong, or
   the header/ciphertext was tampered with, AES-GCM's tag check fails and
   `crypto.subtle.decrypt` throws a `DOMException` — this is the "wrong
   password" case, and it's indistinguishable (by design) from "someone
   tampered with the file," since GCM can't tell those apart.
4. **Validate the metadata shape.** The decrypted metadata JSON is parsed
   and checked against `fileMetadataSchema` (Zod). AES-GCM already
   guarantees the bytes are exactly what was encrypted; Zod guarantees
   the resulting JS object has the shape the app expects.
5. **Return** `{ metadata, data }` — `data` is hydrated straight into a
   `Blob` for download (`downloadBinary`), using `metadata.fileName` and
   `metadata.mimeType` from inside the decrypted section, not from
   anything an attacker could have seen in the plaintext header.

## 4. Inspecting metadata without decrypting the whole file (`inspectMetadata`)

Decrypt mode's batch flow uses this as its first phase for every file:
before committing to a full decrypt, it checks a `.cryptio` file's
`fileName`/`mimeType`/`description` without paying the cost of reading or
decrypting the (possibly huge) data section. `inspectMetadata()` does
this with exactly two byte-range reads, via `File.slice()`
(`readFileSlice` in `file-io.ts`), never `file.arrayBuffer()` on the
whole file:

1. **Read the header.** `readFileSlice(file, 0, 77)` — just the fixed
   77-byte plaintext header, decoded with the same `decodeHeader` the full
   decrypt path uses. A bad magic/version/too-short file throws
   `CryptioFormatError` here, before any password is involved and before
   any more bytes are read.
2. **Read only the metadata section.** The header's `metadataLength` field
   says exactly how many more bytes to request:
   `readFileSlice(file, 77, 77 + metadataLength)`. The data section
   (`dataCipherText`), which can be arbitrarily large, is never sliced,
   never read, never touched.
3. **Derive keys and decrypt, same as `decryptFile`.** `decryptMetadata()`
   derives `metadataKey` via the same PBKDF2→HKDF chain and decrypts with
   the same AAD (the header bytes) — this is not a weaker or different
   cryptographic path, just a narrower one. The `dataKey` is still derived
   alongside it (HKDF is cheap relative to PBKDF2, so there's no reason to
   special-case that), but it's never used to decrypt anything.

The saving is entirely in *what's read off disk*, not in the crypto: a
100 MB `.cryptio` file costs the same PBKDF2 pass to inspect as a 1 KB
one, but only ever a few hundred bytes get copied into memory, instead of
100 MB.

## 5. What an observer of the raw file can and can't learn

Without the password, someone holding a `.cryptio` file can see:

- It's a Cryptio file, and which format version.
- A random `uuid` (uncorrelated with content).
- The PBKDF2 salt and iteration count.
- Both IVs.
- The exact byte length of the encrypted metadata section and the
  encrypted data section (hence: an approximate bound on the original
  file's size — GCM ciphertext is plaintext length + 16 bytes).

They cannot recover, guess-and-check offline faster than PBKDF2 allows, or
tamper with any of the above without detection at decrypt time — the
`fileName`, `mimeType`, `description`, and file contents are opaque
ciphertext, and the whole header (including the lengths and iteration
count they *can* read) is authenticated as AAD.
