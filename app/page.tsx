import { DockNav } from "@/components/landing/DockNav";
import { Hero } from "@/components/landing/Hero";
import { EssenceSection } from "@/components/landing/EssenceSection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { ModelsSection } from "@/components/landing/ModelsSection";
import { MetricsSection } from "@/components/landing/MetricsSection";
import { AiSection } from "@/components/landing/AiSection";
import { StackSection } from "@/components/landing/StackSection";
import { Footer } from "@/components/landing/Footer";

export default function Home() {
  return (
    <>
      <DockNav />
      <main>
        <Hero />
        <EssenceSection />
        <HowItWorksSection />
        <ModelsSection />
        <MetricsSection />
        <AiSection />
        <StackSection />
      </main>
      <Footer />
    </>
  );
}
