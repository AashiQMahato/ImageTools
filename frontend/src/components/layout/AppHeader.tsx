import { ImageIcon, Moon, Sun } from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import { Button } from "@/components/ui/base/buttons/button";
import { useTheme } from "@/hooks/useTheme";
import { ROUTES } from "@/lib/constants/routes";
import { TOOLS } from "@/lib/constants/tools";
import { cn } from "@/lib/utils/cn";

export function AppHeader() {
    const { theme, toggleTheme } = useTheme();

    return (
        <header className="sticky top-0 z-10 border-b border-secondary bg-primary">
            <div className="mx-auto flex h-16 w-full max-w-container items-center gap-6 px-4 md:px-8">
                <Link
                    to={ROUTES.home}
                    className="flex items-center gap-2 rounded-md text-md font-semibold text-primary outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                    <span className="flex size-8 items-center justify-center rounded-lg bg-brand-solid text-white">
                        <ImageIcon className="size-4" aria-hidden />
                    </span>
                    Image Tools
                </Link>

                <nav aria-label="Tools" className="hidden flex-1 items-center gap-1 md:flex">
                    {TOOLS.map((tool) => (
                        <NavLink
                            key={tool.id}
                            to={tool.href}
                            className={({ isActive }) =>
                                cn(
                                    "rounded-md px-3 py-2 text-sm font-semibold text-quaternary transition duration-100 ease-linear hover:bg-primary_hover hover:text-secondary_hover",
                                    "outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2",
                                    isActive && "bg-active text-secondary",
                                )
                            }
                        >
                            {tool.name}
                        </NavLink>
                    ))}
                </nav>

                <Button
                    className="ml-auto"
                    color="tertiary"
                    size="sm"
                    iconLeading={theme === "dark" ? Sun : Moon}
                    aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                    onPress={toggleTheme}
                />
            </div>
        </header>
    );
}
