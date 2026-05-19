import type { ReactNode } from "react";
import { Toaster } from "sonner";
import { Sidebar } from "@/components/sidebar/sidebar";
import { SplashScreen } from "@/components/dashboard/splash-screen";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen w-screen bg-[#FAFAFA] text-zinc-900 lg:h-screen lg:overflow-hidden">
      <Sidebar />
      <main className="flex-1 lg:overflow-hidden">{children}</main>
      <SplashScreen />
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
            border: "1px solid #E4E4E7",
            borderRadius: "8px",
          },
        }}
      />
    </div>
  );
}
