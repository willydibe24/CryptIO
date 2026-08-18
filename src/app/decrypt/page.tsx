import { CryptioView } from "@/components/encrypter/cryptio-view";

export default function DecryptPage() {
    return (
        <main className="flex min-h-screen items-center justify-center bg-background px-4 py-16">
            <CryptioView mode="decrypt"/>
        </main>
    );
}
