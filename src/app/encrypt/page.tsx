import { CryptioView } from "@/components/encrypter/cryptio-view";

export default function EncryptPage() {
    return (
        <main className="flex min-h-screen items-center justify-center bg-background px-4 py-16">
            <CryptioView mode="encrypt"/>
        </main>
    );
}
