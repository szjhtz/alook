"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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

  return <>{children}</>;
}
