import { Link } from "react-router-dom";
import { LogoMark } from "@/components/common/Logo";
import { PRIMARY_NAV } from "@/lib/constants/navigation";

// About / Privacy / Terms pages don't exist yet, so they render as plain text until they do.
const RESOURCES = ["About", "Privacy", "Terms"] as const;

const linkClass =
    "rounded text-sm text-tertiary transition-colors duration-150 hover:text-primary outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2";

export function Footer() {
    return (
        <footer className="bg-secondary">
            <div className="page-container grid grid-cols-2 gap-x-8 gap-y-10 py-14 md:grid-cols-[1fr_auto_auto] md:gap-x-20">
                <div className="col-span-2 flex flex-col gap-3 md:col-span-1">
                    <span className="flex items-center gap-2 text-sm font-semibold text-primary">
                        <LogoMark className="size-5" />
                        Image Tools
                    </span>
                    <p className="max-w-60 text-sm text-quaternary">Simple, focused tools for better images.</p>
                </div>

                <nav aria-label="Product" className="flex flex-col gap-3">
                    <h2 className="text-xs font-medium text-quaternary">Product</h2>
                    <ul className="flex flex-col gap-2.5 text-sm">
                        {PRIMARY_NAV.map((item) => (
                            <li key={item.href}>
                                <Link to={item.href} className={linkClass}>
                                    {item.fullLabel}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </nav>

                <div className="flex flex-col gap-3">
                    <h2 className="text-xs font-medium text-quaternary">Resources</h2>
                    <ul className="flex flex-col gap-2.5 text-sm">
                        {RESOURCES.map((label) => (
                            <li key={label} className="text-tertiary">
                                {label}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            <div className="page-container pb-10">
                <p className="text-xs text-quaternary">© {new Date().getFullYear()} Image Tools</p>
            </div>
        </footer>
    );
}
