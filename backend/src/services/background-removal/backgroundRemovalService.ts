import type { BackgroundRemovalProvider, ImageInput, ImageOutput } from "../../types/image.js";
import { NotImplementedError } from "../../utils/AppError.js";

/**
 * Placeholder until a real provider is integrated.
 * To add one, implement BackgroundRemovalProvider in this folder (reading its API key from config/env)
 * and return it from getProvider(). Controllers never talk to providers directly.
 */
const notImplementedProvider: BackgroundRemovalProvider = {
    name: "not-implemented",
    async removeBackground() {
        throw new NotImplementedError("Background removal");
    },
};

function getProvider(): BackgroundRemovalProvider {
    return notImplementedProvider;
}

export function removeBackground(input: ImageInput): Promise<ImageOutput> {
    return getProvider().removeBackground(input);
}
