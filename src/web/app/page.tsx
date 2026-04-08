"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("alook_token");
    if (token) {
      router.replace("/agents");
    } else {
      router.replace("/login");
    }
  }, [router]);

  return null;
}
