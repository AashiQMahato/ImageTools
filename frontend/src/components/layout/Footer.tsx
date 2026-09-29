import { Link } from "react-router-dom";
import { LogoMark } from "@/components/common/Logo";
import { PRIMARY_NAV, type ToolKey } from "@/lib/constants/navigation";
import { type AppRoute, ROUTES as PAGES } from "@/lib/constants/routes";
import { useT } from "@/i18n";

// About / Privacy / Terms pages don't exist yet, so they render as plain text until they do.
const COMPANY = ["about", "privacy", "terms"] as const;

/** The most-used document tools; the rest are one click away on the Documents page. */
const DOCUMENT_LINKS: readonly { key: ToolKey; href: AppRoute }[] = [
    { key: "pdfEditor", href: PAGES.pdfEditor },
    { key: "pdfSign", href: PAGES.pdfSign },
    { key: "pdfToWord", href: PAGES.pdfToWord },
    { key: "pdfMerge", href: PAGES.pdfMerge },
    { key: "pdfCompress", href: PAGES.pdfCompress },
    { key: "ocr", href: PAGES.ocr },
    { key: "textEditor", href: PAGES.textEditor },
];

const linkClass =
    "group inline-flex items-center gap-2.5 rounded text-[0.9375rem] text-tertiary transition-colors duration-150 hover:text-primary outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2";
const dot = <span aria-hidden className="size-1 rounded-full bg-fg-quaternary transition-colors group-hover:bg-[var(--brand)]" />;

/** A deep navy footer in both themes. */
export function Footer() {
    const t = useT();
    return (
        <footer className="dark-mode bg-[linear-gradient(160deg,#141a2e_0%,#0b0f1c_60%,#0a0d18_100%)] text-primary">
            <div className="page-container grid gap-12 py-16 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))] md:gap-8 md:py-20">
                <div className="sm:col-span-2 lg:col-span-1">
                    <span className="inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/5 py-1.5 pr-4 pl-1.5">
                        <LogoMark className="size-7" />
                        <span className="text-xs font-semibold tracking-[0.08em] text-secondary uppercase">{t.common.appName}</span>
                    </span>
                    <p className="mt-6 max-w-sm text-2xl font-semibold tracking-[-0.01em] text-primary">{t.footer.tagline}</p>
                    <p className="mt-3 max-w-sm text-[0.9375rem] leading-relaxed text-tertiary">{t.footer.blurb}</p>
                </div>

                <nav aria-label={t.footer.product}>
                    <h2 className="text-label text-quaternary">{t.footer.product}</h2>
                    <ul className="mt-5 flex flex-col gap-3.5">
                        {PRIMARY_NAV.map((item) => (
                            <li key={item.href}>
                                <Link to={item.href} className={linkClass}>
                                    {dot}
                                    {t.nav[item.fullLabel]}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </nav>

                <nav aria-label={t.footer.documents}>
                    <h2 className="text-label text-quaternary">{t.footer.documents}</h2>
                    <ul className="mt-5 flex flex-col gap-3.5">
                        {DOCUMENT_LINKS.map((item) => (
                            <li key={item.href}>
                                <Link to={item.href} className={linkClass}>
                                    {dot}
                                    {t.nav.toolItems[item.key].title}
                                </Link>
                            </li>
                        ))}
                        <li>
                            <Link to={PAGES.documents} className={`${linkClass} font-medium text-secondary`}>
                                {dot}
                                {t.footer.allDocuments}
                            </Link>
                        </li>
                    </ul>
                </nav>

                <nav aria-label={t.footer.resources}>
                    <h2 className="text-label text-quaternary">{t.footer.resources}</h2>
                    <ul className="mt-5 flex flex-col gap-3.5">
                        <li>
                            <Link to={`${PAGES.home}#faq`} className={linkClass}>
                                {dot}
                                {t.footer.faq}
                            </Link>
                        </li>
                    </ul>
                </nav>

                <div>
                    <h2 className="text-label text-quaternary">{t.footer.company}</h2>
                    <ul className="mt-5 flex flex-col gap-3.5">
                        {COMPANY.map((label) => (
                            <li key={label} className="inline-flex items-center gap-2.5 text-[0.9375rem] text-tertiary">
                                {dot}
                                {t.footer[label]}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            <div className="border-t border-white/8">
                <div className="page-container flex flex-col gap-3 py-6 text-sm text-quaternary sm:flex-row sm:items-center sm:justify-between">
                    <p>{t.footer.rights(new Date().getFullYear())}</p>
                    <p>{t.footer.privacyNote}</p>
                </div>
            </div>
        </footer>
    );
}
