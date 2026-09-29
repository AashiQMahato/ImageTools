import { Eye, EyeOff } from "lucide-react";
import { useId, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { useT } from "@/i18n";

/** A password box with a show / hide switch. Never autofilled from, or saved to, the browser's passwords. */
export function PasswordField({ label, value, onChange, invalid, hint, autoFocus, autoComplete = "new-password" }: { label: string; value: string; onChange: (value: string) => void; invalid?: string | null; hint?: string; autoFocus?: boolean; autoComplete?: "new-password" | "off" }) {
    const t = useT();
    const id = useId();
    const [shown, setShown] = useState(false);
    return (
        <div className="flex flex-col gap-1.5">
            <label htmlFor={id} className="text-sm font-medium text-secondary">
                {label}
            </label>
            <div className="relative">
                <input
                    id={id}
                    type={shown ? "text" : "password"}
                    value={value}
                    maxLength={256}
                    autoFocus={autoFocus}
                    autoComplete={autoComplete}
                    spellCheck={false}
                    autoCapitalize="off"
                    aria-invalid={invalid ? true : undefined}
                    aria-describedby={invalid || hint ? `${id}-note` : undefined}
                    onChange={(event) => onChange(event.target.value)}
                    className={cn(
                        "h-10 w-full rounded-lg border bg-primary pr-11 pl-3 text-sm text-primary outline-focus-ring placeholder:text-quaternary focus-visible:outline-2 pointer-coarse:h-11",
                        invalid ? "border-error_subtle" : "border-[var(--card-line)]",
                    )}
                />
                <button
                    type="button"
                    onClick={() => setShown((value_) => !value_)}
                    aria-label={shown ? t.documents.password.hide : t.documents.password.show}
                    aria-pressed={shown}
                    aria-controls={id}
                    className="absolute top-1/2 right-1 grid size-8 -translate-y-1/2 cursor-pointer place-items-center rounded-md text-tertiary outline-focus-ring hover:bg-primary_hover hover:text-primary focus-visible:outline-2 pointer-coarse:size-9"
                >
                    {shown ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
                </button>
            </div>
            {(invalid || hint) && (
                <p id={`${id}-note`} className={cn("text-xs", invalid ? "text-error-primary" : "text-tertiary")}>
                    {invalid || hint}
                </p>
            )}
        </div>
    );
}
