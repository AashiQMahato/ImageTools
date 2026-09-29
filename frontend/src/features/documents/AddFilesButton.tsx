import { Plus } from "lucide-react";
import { useStudio } from "@/components/studio/StudioShell";
import { Button } from "@/components/ui/base/buttons/button";

/** Opens the file picker for more files (inside a document tool's studio). */
export function AddFilesButton({ label }: { label: string }) {
    const { openPicker } = useStudio();
    return (
        <Button size="lg" color="tertiary" iconLeading={Plus} onPress={openPicker} className="pointer-coarse:min-h-12">
            {label}
        </Button>
    );
}
