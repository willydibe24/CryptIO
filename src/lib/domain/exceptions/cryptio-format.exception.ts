export class CryptioFormatError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "CryptioFormatError";
    }
}
