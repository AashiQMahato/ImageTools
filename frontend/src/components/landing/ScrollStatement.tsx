import { useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { enterProgress, useScrollProgress } from "@/hooks/useScrollProgress";
import { cn } from "@/lib/utils/cn";

const STATEMENT =
    "Designed for creators, teams and anyone who works with images. Powerful editing, without the complexity — so the photo is always the focus.";
const WORDS = STATEMENT.split(" ");

/** A statement that fills in word by word as it moves up through the viewport, pacing the reading. */
export function ScrollStatement() {
    const ref = useRef<HTMLParagraphElement>(null);
    const reduceMotion = usePrefersReducedMotion();
    const [filled, setFilled] = useState(0);

    useScrollProgress(ref, enterProgress(0.9, 0.35), (progress) => setFilled(Math.round(progress * WORDS.length)), !reduceMotion);

    return (
        <section aria-label="About Image Tools" className="py-28 md:py-44">
            <div className="page-container">
                <p ref={ref} className="max-w-[46rem] text-statement text-pretty">
                    {WORDS.map((word, index) => (
                        <span
                            // Words are static; the index is a stable key.
                            key={index}
                            className={cn(
                                "transition-colors duration-500 ease-[var(--ease-out)]",
                                reduceMotion || index < filled ? "text-primary" : "text-primary/18",
                            )}
                        >
                            {word}{" "}
                        </span>
                    ))}
                </p>
            </div>
        </section>
    );
}
