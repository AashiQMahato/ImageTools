import { type ClassValue, clsx } from "clsx";
import { cx } from "./cx";

/** Combine conditional class names (clsx) and resolve Tailwind conflicts (Untitled UI's tailwind-merge config). */
export function cn(...inputs: ClassValue[]): string {
    return cx(clsx(inputs));
}
