"use client"

import * as React from "react"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import {
  AppSidebar,
  type SidebarProject,
} from "@/components/layout/app-sidebar"

interface AppShellProps {
  children: React.ReactNode
  projects?: SidebarProject[]
  onProjectCreated?: (project: SidebarProject) => void
  headerActions?: React.ReactNode
}

export function AppShell({
  children,
  projects,
  onProjectCreated,
  headerActions,
}: AppShellProps) {
  return (
    <SidebarProvider>
      <AppSidebar projects={projects} onProjectCreated={onProjectCreated} />
      <SidebarInset className="min-h-svh flex flex-col bg-background">
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border px-4 md:hidden">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            <span className="font-heading text-lg font-bold tracking-[-0.04em]">
              <span>CITE</span>
              <span className="font-mono text-accent">/</span>
              <span>ALL</span>
            </span>
          </div>
          {headerActions}
        </header>
        <div className="flex-1">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
