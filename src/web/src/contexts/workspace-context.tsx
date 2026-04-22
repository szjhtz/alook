"use client"

import { createContext, useContext, useEffect, type ReactNode } from "react"

interface WorkspaceContextValue {
  workspaceId: string
  slug: string
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider")
  return ctx
}

export function WorkspaceProvider({
  workspaceId,
  slug,
  children,
}: WorkspaceContextValue & { children: ReactNode }) {
  useEffect(() => {
    try { localStorage.setItem("lastWorkspace", slug) } catch {}
  }, [slug])

  return (
    <WorkspaceContext.Provider value={{ workspaceId, slug }}>
      {children}
    </WorkspaceContext.Provider>
  )
}
