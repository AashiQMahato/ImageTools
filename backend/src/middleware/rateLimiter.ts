import { rateLimit } from "express-rate-limit";
import { env } from "../config/env.js";

const message = (text: string) => ({ success: false, message: text, code: "RATE_LIMITED" });

/** General API limiter: generous. */
export const apiRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: message("Too many requests, please try again later."),
});

/** Image processing is expensive, so it gets its own, tighter budget per client. */
export const processingRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: env.processingRateLimit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: message("You've processed a lot of images in a short time. Please wait a few minutes and try again."),
});
