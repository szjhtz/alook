"use client";

import { Logo } from "@/components/logo";
import { useSidebarTrigger } from "@/components/workspace-shell";

export function MobileSidebarLogo() {
  const openSidebar = useSidebarTrigger();
  if (!openSidebar) return null;

  return (
    <div
      onClickCapture={(e) => { e.stopPropagation(); e.preventDefault(); openSidebar(); }}
      className="cursor-pointer shrink-0"
    >
      <Logo size="sm" iconOnly />
    </div>
  );
}
