import { Segmented } from "@/components/common/Segmented";
import { useT } from "@/i18n";
import { PageRangeInput } from "./PageRangeInput";
import type { usePageScope } from "./usePageScope";

export function PageScopeControl({ scope, pageCount, label, rangesLabel }: { scope: ReturnType<typeof usePageScope>; pageCount: number; label: string; rangesLabel: string }) {
    const t = useT();
    const copy = t.documents.toImages;
    return (
        <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-primary">{label}</h3>
            <Segmented label={label} value={scope.scope} onChange={scope.setScope} options={(["all", "choose"] as const).map((value) => ({ value, label: copy.scopes[value] }))} />
            {scope.scope === "choose" && pageCount > 0 && <PageRangeInput value={scope.ranges} onChange={scope.type} count={pageCount} label={rangesLabel} hint={copy.chooseHint} />}
        </section>
    );
}
