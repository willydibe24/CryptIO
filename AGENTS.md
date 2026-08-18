# Cryptio

A tool for hiding file contents behind a password. No compression, no
hosting: the only job is encrypt/decrypt, and files always stay owned by
the user.

(Note: the project used to be called "encrypter", now it's "Cryptio" — the
main component is `CryptioView`, formerly `EncrypterView`.)

## Non-negotiables

These decisions have already been made and discussed: don't re-propose or
change them without an explicit conversation first.

- **Everything is client-side.** Encryption/decryption via `crypto.subtle`
  (Web Crypto API), entirely in the browser. No server, no database, no
  network call to encrypt or decrypt a file.
- **The password is never stored or logged.** Derived keys live only in
  memory for the duration of a single operation.
- **AES-256-GCM** for encrypting data, **PBKDF2-SHA256** for deriving key
  material from the password. The default iteration count (600,000 —
  OWASP's current recommended minimum) is configured via
  `NEXT_PUBLIC_KDF_ITERATIONS` in `.env.local`, validated against a Zod
  schema (`lib/domain/schema/env.schema.ts`) with a minimum of 100,000.
  It's a moving target (roughly 10× every ~4 years as hardware gets
  faster), which is exactly why the count is stored per-file instead of
  assumed: it can be raised later without breaking old files. PBKDF2 was
  picked over Argon2id (OWASP's actual top choice) specifically because
  `crypto.subtle` supports it natively in every browser — Argon2id would
  need a WASM dependency.
- **One PBKDF2 pass, two AES-256-GCM subkeys.** The PBKDF2 output is a
  master secret, not used directly as a key — HKDF-SHA256 splits it into
  two independent subkeys (metadata, data) via distinct info strings. This
  is deliberate domain separation, not just extra ceremony: it means the
  data section's nonce scheme can evolve independently (e.g. a future
  chunked/streaming format) with zero chance of ever colliding with the
  metadata section's nonce, since they live under different keys entirely.
- **Random 16-byte salt, and two random 12-byte IVs per file** (one for
  the metadata section, one for the data section), never reused.
- **The full plaintext header is authenticated as AAD** on both AES-GCM
  operations. Every plaintext field — including `kdfIterations` and the
  section-length fields — is bound to the ciphertext; none of it can be
  tampered with without invalidating decryption.
- **`fileName`, `mimeType`, and `description` live inside the encrypted
  metadata section**, never in the plaintext header. The plaintext header
  only ever exposes: `magic`, `version`, `uuid`, `salt`, `kdfIterations`,
  `metadataIv`, `dataIv`, `metadataLength`, `dataLength`.
- Encrypted files are saved as **`{fileName}.cryptio`** (a raw binary
  container — see File format below).

## File format

Cryptio files are a single binary container: a fixed-size plaintext header
(all multi-byte integers little-endian) followed by two independently
AES-256-GCM-encrypted sections.

```
Offset  Size  Field             Description
0       4     magic             ASCII "CRIO"
4       1     version           format version (currently 1)
5       16    uuid              random file identifier
21      16    salt              PBKDF2 salt
37      4     kdfIterations     uint32
41      12    metadataIv        AES-GCM nonce, metadata section
53      12    dataIv            AES-GCM nonce, data section
65      4     metadataLength    uint32, includes the 16-byte GCM tag
69      8     dataLength        uint64, includes the 16-byte GCM tag
77      —     metadataCipherText   (metadataLength bytes)
—       —     dataCipherText       (dataLength bytes)
```

```ts
// Decrypted metadata section — the only place fileName/mimeType/description
// ever appear, always inside AES-GCM ciphertext, never in the plaintext header.
type FileMetadata = {
  fileName: string;
  mimeType: string;
  description?: string;
};
```

Validated with Zod (`lib/domain/schema/file.schema.ts`, `fileMetadataSchema`)
after decryption — AES-GCM already guarantees the bytes weren't tampered
with, Zod guarantees the resulting JS shape is what the app expects. The raw
file bytes in `dataCipherText` are never JSON- or base64-encoded: no
serialization indirection between "decrypt" and "here are the original
bytes."

Format encode/decode lives in `lib/domain/crypto-file/container.ts`
(`encodeHeader` / `decodeContainer`). A bad magic, unsupported version, or
truncated file throws `CryptioFormatError`
(`lib/domain/exceptions/cryptio-format.exception.ts`) — the UI maps that to
an "invalid file" message, distinct from "wrong password" (an AES-GCM tag
failure, surfaced natively as `DOMException`).

There is exactly one version today. Adding a v2 means a new, separate codec
module plus a thin version-dispatch entry point — not retrofitting these
constants to be generic across versions we haven't specified yet (see
Rejected ideas).

## Internationalization

The app is localized via **next-intl** with **Italian as the default locale**
and English also supported. Locale is detected client-side from
`navigator.languages`, falling back to `NEXT_PUBLIC_LOCALE` (`.env.local`).

- **No hardcoded strings in components.** Every user-facing string lives in
  `messages/{locale}.json` and is accessed via `useTranslations(namespace)`.
  This applies to visible copy, `aria-label`s, `placeholder`s, and toast
  messages alike.
- `lib/locale/locale.ts` (`"server-only"`) reads the locale cookie
  server-side via `getInitialLocale()` and is called from `app/layout.tsx`.
- `components/i18n/i18n-provider.tsx` receives `initialLocale` from the
  layout, manages locale state, persists changes via `js-cookie`, and wraps
  the tree with `NextIntlClientProvider`.
- `components/i18n/locale-switcher.tsx` exposes a dropdown for manual
  locale selection; it writes the cookie and updates state via
  `useSetLocale()`.
- Supported locales are declared in `lib/domain/schema/env.schema.ts`
  (`supportedLocales`). Adding a new locale means: adding the JSON file,
  importing it in `i18n-provider.tsx`, and extending the enum.
- Code, comments, commit messages, and internal docs (this file included)
  are in English.

## Structure

```
messages/
  en.json                  # English translations
  it.json                  # Italian translations
app/
  encrypt/page.tsx         # route, mode="encrypt"
  decrypt/page.tsx         # route, mode="decrypt"
  page.tsx                 # redirect to /encrypt
components/
  encrypter/
    cryptio-view.tsx       # header + tabs, navigates between routes
    encrypt-panel.tsx      # multi-file, per-file password, bulk-submit-with-per-row-state
    encrypt-file-row.tsx   # one row's fileName/description/password fields + status, state lifted to encrypt-panel.tsx
    decrypt-panel.tsx      # multi-file, shared batch password, per-file retry
    decrypt-file-row.tsx   # one row's status/metadata/retry/download UI, state lifted to decrypt-panel.tsx
    multi-file-dropzone.tsx # multi-file drop target (Encrypt/Decrypt)
    file-id-field.tsx
    password-field.tsx
  i18n/
    i18n-provider.tsx      # locale state + NextIntlClientProvider wrapper
    locale-switcher.tsx
  theme/
    theme-provider.tsx
    theme-toggle.tsx
lib/
  env.ts                    # parsed + validated env (reads NEXT_PUBLIC_* via Zod)
  domain/
    crypto-file/
      crypto.ts             # encryptFile, decryptFile, decryptMetadata, inspectMetadata — PBKDF2+HKDF key derivation, AES-256-GCM
      container.ts           # binary container v1: header encode/decode, AAD framing
    errors/
      classify-decrypt-error.ts  # classifyDecryptError — shared invalidFile/wrongPassword/generic triage for Decrypt
    exceptions/
      cryptio-format.exception.ts  # CryptioFormatError — bad magic/version/truncated file
    schema/
      env.schema.ts          # Zod schema + supportedLocales + Locale type
      file.schema.ts          # fileMetadataSchema/FileMetadata (decrypted metadata shape)
  file/
    file-io.ts               # readFileAsBytes, readFileSlice, downloadBinary
    file-utils.ts             # ENCRYPTED_FILE_EXTENSION, generateFileName, formatBytes
  locale/
    locale.ts                 # server-only getInitialLocale() — reads cookie via next/headers
```

Both Encrypt and Decrypt accept one or more files at once, each dropped
into a list where every file gets its own row, but the two modes handle
passwords differently:

- **Encrypt** requires a **separate password per file** (plus its own
  optional description and editable output filename via `FileNameField`).
  A row without a valid, matching password/confirm-password is simply
  skipped when the bulk "Encrypt files" button is clicked — it stays
  untouched with an inline hint, other ready rows still process. When the
  submitted batch is exactly one file, it auto-downloads immediately on
  success; multi-file batches get a manual per-row "Download" button
  instead (browsers throttle/block several near-simultaneous
  auto-triggered downloads).
- **Decrypt** uses **one shared password** for the whole batch (a file
  encrypted with a different password gets its own scoped retry-password
  field, without disturbing the rest of the batch). Submitting decrypts
  only each file's metadata section — `inspectMetadata()` (`crypto.ts`)
  reads just the 77-byte header plus `metadataLength` more bytes via
  `readFileSlice()` (`file-io.ts`, backed by `File.slice()`), so the
  (potentially large) data section is never read into memory just to see
  a file's name/type/description. Metadata is shown per row with a manual
  "Decrypt & download" button — decrypting never happens automatically as
  a side effect of inspecting metadata, regardless of batch size.

Neither panel uses toast notifications — every row's own pending/
encrypting-or-decrypting/success/error state already conveys the outcome,
and a single toast can't meaningfully summarize a mixed-result batch.

## Stack and conventions

- Next.js (App Router), React with **React Compiler enabled** — no manual
  `useMemo`/`useCallback`, the compiler handles it.
- Base UI + shadcn/ui, Tailwind. Dark mode via `next-themes`.
- Toasts via **Sonner** (`@/components/ui/sonner`) — don't use shadcn's
  `Toast` component, it's deprecated.
- Accent colors (encrypt/decrypt) as CSS variables `--encrypt` /
  `--decrypt` in `globals.css`, not as TypeScript constants.

## Rejected ideas (so they don't get re-proposed)

- Encoding content type in the filename/UUID — rejected: a weak side
  channel, and redundant anyway (the real leak would have been
  extension/mimeType in plaintext, already solved by putting them in the
  encrypted metadata section).
- A per-file symmetric key held in a server-side DB (SQLite) — rejected in
  favor of fully self-sufficient files: password + file must be enough on
  their own, without depending on server-side state that might no longer
  exist or be reachable.
- Backward-compatible parsing of the old JSON/base64 envelope format —
  rejected: that format was pre-release and never a supported public
  format. Files that don't start with the `CRIO` magic bytes are rejected
  outright as invalid, no fallback JSON parsing path exists.
- A version-parametrized layout object in `container.ts` (offsets/lengths
  keyed by version, driving generic encode/decode functions) — rejected
  for now: it only pays off if future versions change field *widths*, not
  the field *set*, and we don't know that yet (the one anticipated
  evolution, chunked/streaming data, would likely add a field, not resize
  one). Revisit once a v2 is actually specified.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
