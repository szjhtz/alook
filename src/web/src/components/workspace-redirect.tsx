"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export function WorkspaceRedirect() {
  const router = useRouter()

  useEffect(() => {
    const slug = localStorage.getItem("lastWorkspace")
    router.replace(slug ? `/w/${slug}/home` : "/workspaces?auto")
  }, [router])

  return null
}
