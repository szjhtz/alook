"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AgentProvider } from "@/contexts/agent-context";
import { AppSidebar } from "@/components/app-sidebar";
import { GradientBackground } from "@/components/gradient-background";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const token = localStorage.getItem("alook_token");
      if (!token) {
        router.replace("/login");
      } else {
        setReady(true);
      }
    } catch {
      router.replace("/login");
    }
  }, [router]);

  if (!ready) return null;

  return (
    <AgentProvider>
      <div className="flex h-screen overflow-hidden relative">
        <GradientBackground />

        {/* Sidebar rail — stable across route changes */}
        <AppSidebar />

        {/* Floating content panel */}
        <div className="flex-1 min-w-0 p-2 pl-0">
          <main className="h-full rounded-xl bg-card/80 backdrop-blur-xl shadow-lg ring-1 ring-border/40 overflow-hidden flex flex-col">
            {children}
          </main>
        </div>
      </div>
    </AgentProvider>
  );
}
