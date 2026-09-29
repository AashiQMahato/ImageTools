import { ArrowRight, Search, ShieldCheck, X } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Segmented } from "@/components/common/Segmented";
import { TOOL_ICONS } from "@/components/layout/toolIcons";
import { type CatalogTool, DOCUMENT_CATEGORIES, isDocumentTool, searchTools, TOOL_CATALOG, type ToolCategory } from "@/lib/constants/toolCatalog";
import { useT } from "@/i18n";

type Filter = "all" | ToolCategory;

/** The document suite's front door: what it does, every tool, and a search across all tools. */
export function DocumentsPage() {
    const t = useT();
    const copy = t.documents.landing;
    const [query, setQuery] = useState("");
    const [filter, setFilter] = useState<Filter>("all");
    const searchId = useId();
    const text = (tool: CatalogTool) => t.nav.toolItems[tool.key];

    const documentTools = useMemo(() => TOOL_CATALOG.filter(isDocumentTool), []);
    const searching = query.trim().length > 0;
    // A search looks across every tool (so "compress" finds the image compressor too).
    const found = searching ? searchTools(query, TOOL_CATALOG, text) : [];
    const shown = searching ? found : documentTools.filter((tool) => filter === "all" || tool.categories.includes(filter));
    const groups = searching
        ? ([
              ["documents", found.filter(isDocumentTool)],
              ["image", found.filter((tool) => !isDocumentTool(tool))],
          ] as const)
        : ([["documents", shown]] as const);

    return (
        <div className="page-container pt-10 pb-20 md:pt-16 md:pb-28">
            <header className="mx-auto max-w-3xl text-center">
                <p className="section-badge">{copy.badge}</p>
                <h1 className="mt-4 text-hero text-balance text-primary">{copy.title}</h1>
                <p className="mx-auto mt-4 max-w-2xl text-lead text-pretty text-tertiary">{copy.description}</p>
            </header>

            <div className="mx-auto mt-10 flex max-w-2xl flex-col items-center gap-4">
                <div role="search" className="relative w-full">
                    <label htmlFor={searchId} className="sr-only">
                        {copy.searchLabel}
                    </label>
                    <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-quaternary" aria-hidden />
                    <input
                        id={searchId}
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder={copy.search}
                        autoComplete="off"
                        className="h-13 w-full rounded-2xl border border-[var(--card-line)] bg-primary pr-12 pl-12 text-md text-primary shadow-xs outline-focus-ring placeholder:text-quaternary focus-visible:outline-2 [&::-webkit-search-cancel-button]:hidden"
                    />
                    {searching && (
                        <button type="button" onClick={() => setQuery("")} aria-label={copy.clearSearch} className="absolute top-1/2 right-3 grid size-8 -translate-y-1/2 cursor-pointer place-items-center rounded-lg text-tertiary outline-focus-ring hover:bg-primary_hover hover:text-primary focus-visible:outline-2">
                            <X className="size-4" aria-hidden />
                        </button>
                    )}
                </div>
                {!searching && (
                    <Segmented
                        label={copy.categoriesLabel}
                        value={filter}
                        onChange={setFilter}
                        options={(["all", ...DOCUMENT_CATEGORIES] as const).map((value) => ({ value, label: copy.categories[value] }))}
                        scrollable
                    />
                )}
            </div>

            <div className="mt-10 flex flex-col gap-10" aria-live="polite">
                {searching && !found.length && <p className="text-center text-sm text-tertiary">{copy.noResults(query.trim())}</p>}
                {groups.map(([group, tools]) =>
                    tools.length ? (
                        <section key={group} aria-label={copy.groups[group]}>
                            {searching && <h2 className="mb-4 text-sm font-semibold text-secondary">{copy.groups[group]}</h2>}
                            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {tools.map((tool) => {
                                    const Icon = TOOL_ICONS[tool.key];
                                    const { title, description } = text(tool);
                                    return (
                                        <li key={tool.key}>
                                            <Link
                                                to={tool.href}
                                                className="group flex h-full items-start gap-4 rounded-2xl border border-[var(--card-line)] bg-primary p-4 outline-focus-ring transition-[border-color,box-shadow] duration-200 hover:border-[var(--color-border-primary)] hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2"
                                            >
                                                <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-[var(--card-line)] bg-secondary text-secondary transition-colors duration-200 group-hover:text-[var(--brand)]">
                                                    <Icon className="size-5" strokeWidth={1.8} aria-hidden />
                                                </span>
                                                <span className="min-w-0 flex-1">
                                                    <span className="flex items-center gap-1.5 text-md font-semibold text-primary">
                                                        {title}
                                                        <ArrowRight className="size-4 -translate-x-1 text-quaternary opacity-0 transition-[opacity,translate] duration-200 group-hover:translate-x-0 group-hover:opacity-100" aria-hidden />
                                                    </span>
                                                    <span className="mt-0.5 block text-sm text-tertiary">{description}</span>
                                                </span>
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ul>
                        </section>
                    ) : null,
                )}
            </div>

            <p className="mx-auto mt-14 flex max-w-xl items-start justify-center gap-2 text-center text-sm text-tertiary">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success-primary" aria-hidden />
                {t.documents.privacy}
            </p>
        </div>
    );
}
