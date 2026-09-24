import { env } from "../../config/env.js";
import type { BackgroundRemovalProvider, ImageInput, ImageOutput, ProcessingContext } from "../../types/image.js";
import { ConcurrencyLimiter } from "../../utils/concurrency.js";
import { rembgProvider } from "./rembgProvider.js";

/** Swap providers here; controllers only ever call this service. */
const provider: BackgroundRemovalProvider = rembgProvider;
const limiter = new ConcurrencyLimiter(env.rembg.concurrency, env.maxQueuedJobs);

export const backgroundRemoval = {
    isAvailable: () => provider.isAvailable(),
    stats: () => limiter.stats,
    remove: (input: ImageInput, context: ProcessingContext): Promise<ImageOutput> =>
        limiter.run(() => provider.removeBackground(input, context), context.signal),
};
