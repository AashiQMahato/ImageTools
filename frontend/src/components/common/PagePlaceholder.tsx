import type { LucideIcon } from "lucide-react";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/base/badges/badges";
import { Button } from "@/components/ui/base/buttons/button";
import { ROUTES } from "@/lib/constants/routes";

interface PagePlaceholderProps {
    title: string;
    description: string;
    icon: LucideIcon;
}

/** Temporary page body for tools that are not implemented yet. */
export function PagePlaceholder({ title, description, icon: Icon }: PagePlaceholderProps) {
    return (
        <section className="mx-auto flex max-w-xl flex-col items-center py-16 text-center">
            <span className="flex size-12 items-center justify-center rounded-xl border border-secondary bg-primary text-fg-secondary shadow-xs">
                <Icon className="size-6" aria-hidden />
            </span>
            <Badge className="mt-6" type="pill-color" color="gray" size="sm">
                Coming soon
            </Badge>
            <h1 className="mt-3 text-display-xs font-semibold text-primary md:text-display-sm">{title}</h1>
            <p className="mt-3 text-md text-tertiary">{description}</p>
            <Button className="mt-8" color="secondary" size="md" href={ROUTES.home} iconLeading={ArrowLeft}>
                All tools
            </Button>
        </section>
    );
}
