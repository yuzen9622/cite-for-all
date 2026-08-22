import { auth } from "@/auth"
import {
  ProjectDashboard,
  type ProjectSummary,
} from "@/components/projects/project-dashboard"
import { CitationConverter } from "@/components/citation-converter"
import { prisma } from "@/lib/db"

export default async function Home() {
  const session = await auth()
  if (!session?.user?.id) {
    return <CitationConverter />
  }

  let initialProjects: ProjectSummary[] = []
  let loadError: string | undefined

  try {
    const projects = await prisma.project.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { references: true } } },
    })
    initialProjects = projects.map((project) => ({
      id: project.id,
      name: project.name,
      description: project.description,
      defaultStyle: project.defaultStyle,
      updatedAt: project.updatedAt.toISOString(),
      _count: project._count,
    }))
  } catch {
    loadError = "資料庫暫時無法使用，請稍後再試。"
  }

  return (
    <ProjectDashboard initialProjects={initialProjects} loadError={loadError} />
  )
}
