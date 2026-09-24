import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/base/badges/badges";
import { TOOLS } from "@/lib/constants/tools";

export function HomePage() {
    return (
        <div className="flex flex-col gap-12">
            <section className="max-w-3xl">
                <h1 className="text-display-sm font-semibold text-primary md:text-display-md">Professional image tools, in one place</h1>
                <p className="mt-4 text-lg text-tertiary md:text-xl">
                    Remove backgrounds, upscale, crop and edit your images with fast, focused tools.
                </p>
            </section>

            <section aria-label="Tools" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {TOOLS.map(({ id, name, description, href, icon: Icon, isAi }) => (
                    <Link
                        key={id}
                        to={href}
                        className="group flex flex-col rounded-xl border border-secondary bg-primary p-5 shadow-xs transition duration-100 ease-linear outline-focus-ring hover:border-primary hover:bg-primary_hover focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                        <div className="flex items-center justify-between">
                            <span className="flex size-10 items-center justify-center rounded-lg border border-secondary bg-primary text-fg-secondary">
                                <Icon className="size-5" aria-hidden />
                            </span>
                            {isAi && (
                                <Badge type="pill-color" color="brand" size="sm">
                                    AI
                                </Badge>
                            )}
                        </div>
                        <h2 className="mt-5 text-md font-semibold text-primary">{name}</h2>
                        <p className="mt-1 flex-1 text-sm text-tertiary">{description}</p>
                        <span className="mt-5 flex items-center gap-1.5 text-sm font-semibold text-brand-secondary">
                            Open tool
                            <ArrowRight className="size-4 transition-transform duration-100 ease-linear group-hover:translate-x-0.5" aria-hidden />
                        </span>
                    </Link>
                ))}
            </section>
        </div>
    );
}
