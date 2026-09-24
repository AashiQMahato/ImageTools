import { rateLimit } from "express-rate-limit";

/** General API limiter: generous for now, tighten per-route once processing endpoints are live. */
export const apiRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { success: false, message: "Too many requests, please try again later.", code: "RATE_LIMITED" },
});
