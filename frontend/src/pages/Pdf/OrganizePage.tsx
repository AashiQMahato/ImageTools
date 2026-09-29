import { PageOrganizer } from "@/features/documents/PageOrganizer";

export function OrganizePage() {
    return <PageOrganizer mode="organize" />;
}

export function RotatePage() {
    return <PageOrganizer mode="rotate" />;
}
