# Cryptio

A tool for hiding file contents behind a password. No compression, no
hosting: the only job is encrypt/decrypt, and files always stay owned by
the user.

Everything runs **entirely client-side** in the browser via the Web Crypto
API — no server, no database, and no network call is ever made to encrypt
or decrypt a file. The password itself is never stored or logged; derived
keys live only in memory for the duration of a single operation.

## Features

- **Encrypt** one or more files at once, each with its own password,
  optional description, and editable output filename.
- **Decrypt** a batch of files with one shared password, with a per-file
  scoped retry if a particular file was encrypted with a different one.
- Peek at a file's name, type, and description before committing to a
  full decrypt — without ever reading its (potentially huge) data section
  into memory.
- Encrypted files are self-sufficient: password + `.cryptio` file is
  always enough to decrypt, with no server-side state to depend on.
- Localized UI (Italian default, English also supported), light/dark
  theme.

## Cryptography

- **AES-256-GCM** for encrypting data, **PBKDF2-SHA256** for deriving key
  material from the password (600,000 iterations by default, OWASP's
  current recommended minimum — configurable, and stored per-file so it
  can be raised later without breaking old files).
- One PBKDF2 pass produces a master secret, which HKDF-SHA256 splits into
  two independent AES-256-GCM subkeys — one for metadata, one for file
  data — so the two sections have no exploitable relationship.
- A random 16-byte salt and two random 12-byte IVs per file, never reused.
- The entire plaintext header (including the iteration count and section
  lengths) is authenticated as AAD on both AES-GCM operations, so nothing
  in the file can be tampered with without decryption failing.
- `fileName`, `mimeType`, and `description` live only inside the
  encrypted metadata section — never in the plaintext header.

Encrypted files are saved as `{fileName}.cryptio`, a compact binary
container (see [AGENTS.md § File format](./AGENTS.md#file-format) for the
exact byte layout). For a full walkthrough of what happens
cryptographically at each step, see [ENCRYPTION.md](./ENCRYPTION.md).

## Getting started

Requires Node 22+.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — it redirects to
`/encrypt`.

### Environment variables

Set in `.env.local` (validated against a Zod schema on startup):

| Variable                     | Default | Description                                          |
| ----------------------------- | ------- | ----------------------------------------------------- |
| `NEXT_PUBLIC_KDF_ITERATIONS` | 600000  | PBKDF2 iteration count (minimum 100,000).              |
| `NEXT_PUBLIC_LOCALE`         | `it`    | Fallback locale when the browser's isn't supported.    |

## Running with Docker

```bash
docker compose up --build
```

Serves the app at [http://localhost:3000](http://localhost:3000). The
image is a multi-stage Next.js standalone build; `NEXT_PUBLIC_*`
variables are inlined into the client bundle at build time straight from
`.env`, so nothing needs to be duplicated in `docker-compose.yml`. An
example nginx reverse-proxy config is included under `deploy/nginx/`.

## Stack

Next.js (App Router) with the React Compiler, Base UI + shadcn/ui,
Tailwind, next-intl for i18n, next-themes for dark mode.

## Project structure

```
src
├── app
│   ├── decrypt/page.tsx           # route, mode="decrypt"
│   ├── encrypt/page.tsx           # route, mode="encrypt"
│   └── page.tsx                   # redirect to /encrypt
├── components
│   ├── encrypter
│   │   ├── decrypt/                # decrypt-panel.tsx, decrypt-file-row.tsx
│   │   ├── encrypt/                # encrypt-panel.tsx, encrypt-file-row.tsx
│   │   ├── cryptio-view.tsx        # header + tabs, navigates between routes
│   │   └── password-field.tsx
│   ├── file/                       # file-name-field.tsx, multi-file-dropzone.tsx
│   ├── i18n/                       # locale provider + switcher
│   ├── theme/                      # theme provider + toggle
│   └── ui/                         # shadcn/ui primitives
└── lib
    ├── domain
    │   ├── crypto-file/            # crypto.ts, container.ts — the crypto core
    │   ├── schema/                 # env.schema.ts, file.schema.ts (Zod)
    │   ├── exceptions/             # cryptio-format.exception.ts
    │   └── errors/                 # classify-decrypt-error.ts
    ├── file/                       # file-io.ts, file-utils.ts
    ├── locale/                     # server-only locale resolution
    └── env.ts                      # parsed + validated env

messages/                           # en.json, it.json — all user-facing strings
deploy/nginx/                       # example reverse-proxy config
```

See [AGENTS.md](./AGENTS.md) for the full architecture, file format
specification, and the design decisions behind them.
