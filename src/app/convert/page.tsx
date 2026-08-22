import type { Metadata } from "next"
import { auth } from "@/auth"
import { CitationConverter } from "@/components/citation-converter"
import { AppShell } from "@/components/layout/app-shell"
import type { SidebarProject } from "@/components/layout/app-sidebar"
import { prisma } from "@/lib/db"

export const metadata: Metadata = {
  title: "快速轉換",
}

export default async function ConvertPage() {
  const session = await auth()

  if (!session?.user?.id) {
    return <CitationConverter />
  }

  let projects: SidebarProject[] = []
  try {
    const rawProjects = await prisma.project.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { references: true } } },
    })
    projects = rawProjects.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      defaultStyle: p.defaultStyle,
      updatedAt: p.updatedAt.toISOString(),
      _count: p._count,
    }))
  } catch {
    // fallback to empty if db fails
  }

  return (
    <AppShell projects={projects}>
      <CitationConverter showHeader={false} />
    </AppShell>
  )
}
