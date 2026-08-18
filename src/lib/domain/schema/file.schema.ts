import { z } from "zod";

export const fileMetadataSchema = z.object({
    fileName: z.string().nonempty(),
    mimeType: z.string().nonempty(),
    description: z.string().optional(),
});
export type FileMetadata = z.infer<typeof fileMetadataSchema>;
