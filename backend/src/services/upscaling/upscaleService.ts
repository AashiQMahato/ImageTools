import type { ImageInput, ImageOutput, UpscaleOptions, UpscaleProvider } from "../../types/image.js";
import { NotImplementedError } from "../../utils/AppError.js";

/**
 * Placeholder until a real provider is integrated.
 * To add one, implement UpscaleProvider in this folder (reading its API key from config/env)
 * and return it from getProvider(). Controllers never talk to providers directly.
 */
const notImplementedProvider: UpscaleProvider = {
    name: "not-implemented",
    async upscale() {
        throw new NotImplementedError("Image upscaling");
    },
};

function getProvider(): UpscaleProvider {
    return notImplementedProvider;
}

export function upscaleImage(input: ImageInput, options: UpscaleOptions): Promise<ImageOutput> {
    return getProvider().upscale(input, options);
}
