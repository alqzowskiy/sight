import { DockNav } from "@/components/landing/DockNav";
import { Hero } from "@/components/landing/Hero";
import { EssenceSection } from "@/components/landing/EssenceSection";
import { IndustryContextSection } from "@/components/landing/IndustryContextSection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { ModelsSection } from "@/components/landing/ModelsSection";
import { MetricsSection } from "@/components/landing/MetricsSection";
import { VoicesSection } from "@/components/landing/VoicesSection";
import { AiSection } from "@/components/landing/AiSection";
import { OptimizerSection } from "@/components/landing/OptimizerSection";
import { StackSection } from "@/components/landing/StackSection";
import { Footer } from "@/components/landing/Footer";

export default function Home() {
  return (
    <>
      <DockNav />
      <main>
        <Hero />
        <EssenceSection />
        <IndustryContextSection />
        <HowItWorksSection />
        <ModelsSection />
        <MetricsSection />
        <VoicesSection />
        <AiSection />
        <OptimizerSection />
        <StackSection />
      </main>
      <Footer />
    </>
  );
}
