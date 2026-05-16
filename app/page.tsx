import { ArchitectureSection } from "@/components/landing/ArchitectureSection";
import { CtaSection } from "@/components/landing/CtaSection";
import { DockNav } from "@/components/landing/DockNav";
import { EnginesSection } from "@/components/landing/EnginesSection";
import { Footer } from "@/components/landing/Footer";
import { Hero } from "@/components/landing/Hero";
import { LiveGlimpseSection } from "@/components/landing/LiveGlimpseSection";
import { NumbersSection } from "@/components/landing/NumbersSection";
import { ProblemSection } from "@/components/landing/ProblemSection";
import { VoicesSection } from "@/components/landing/VoicesSection";

export default function Home() {
  return (
    <>
      <DockNav />
      <main>
        <Hero />
        <LiveGlimpseSection />
        <ProblemSection />
        <EnginesSection />
        <NumbersSection />
        <VoicesSection />
        <ArchitectureSection />
        <CtaSection />
      </main>
      <Footer />
    </>
  );
}
