import { BackgroundRemovalSection } from "@/components/landing/BackgroundRemovalSection";
import { EditorSection } from "@/components/landing/EditorSection";
import { EssentialsBento } from "@/components/landing/EssentialsBento";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { Hero } from "@/components/landing/Hero";
import { ScrollStatement } from "@/components/landing/ScrollStatement";
import { UpscalerSection } from "@/components/landing/UpscalerSection";

export function HomePage() {
    return (
        <>
            <Hero />
            <ScrollStatement />
            <BackgroundRemovalSection />
            <UpscalerSection />
            <EditorSection />
            <EssentialsBento />
            <FinalCTA />
        </>
    );
}
