import type { ImageInput } from "../types/image.js";

/** Map a multer file to the provider-agnostic ImageInput. File validation happens once processing is implemented. */
export function toImageInput(file: Express.Multer.File | undefined): ImageInput {
    return {
        buffer: file?.buffer ?? Buffer.alloc(0),
        mimeType: file?.mimetype ?? "",
        originalName: file?.originalname ?? "",
    };
}
