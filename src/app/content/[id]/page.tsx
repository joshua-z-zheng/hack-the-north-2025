import { getUserCourses, getAuthState } from "@/lib/user-data"
import { redirect } from "next/navigation"
import Link from "next/link"

interface Props {
  params: Promise<{ id: string }>
}

export default async function ContentDetailPage({ params }: Props) {
  const { id } = await params
  const courseId = Number.parseInt(id)

  const isLoggedIn = await getAuthState()

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-background">
        <main className="max-w-5xl mx-auto px-4 py-8 md:px-6 lg:px-8">
          <h1>Please log in to view course details</h1>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 mb-8 bg-secondary text-secondary-foreground border border-border rounded-lg text-sm font-medium cursor-pointer transition-all hover:bg-muted"
          >
            Back to Home
          </Link>
        </main>
      </div>
    )
  }

  const courses = await getUserCourses()
  const content = courses[courseId]

  if (!content) {
    return (
      <div className="min-h-screen bg-background">
        <main className="max-w-5xl mx-auto px-4 py-8 md:px-6 lg:px-8">
          <h1>Course not found</h1>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 mb-8 bg-secondary text-secondary-foreground border border-border rounded-lg text-sm font-medium cursor-pointer transition-all hover:bg-muted"
          >
            Back to Home
          </Link>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-5xl mx-auto px-4 py-8 md:px-6 lg:px-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 mb-8 bg-secondary text-secondary-foreground border border-border rounded-lg text-sm font-medium cursor-pointer transition-all hover:bg-muted"
        >
          ← Back to Home
        </Link>

        <article className="max-w-3xl mx-auto">
          <header className="mb-8 pb-6 border-b border-border">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4 leading-tight">{content.code}</h1>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed italic">{content.desc}</p>
          </header>

          <div className="text-base md:text-lg leading-relaxed text-foreground">
            <button
              className="bet-button px-4 py-2 mr-2 mb-2 bg-primary text-primary-foreground rounded hover:opacity-90 transition-opacity"
            >
              Bet 95%-100%
            </button>
            <button
              className="bet-button px-4 py-2 mr-2 mb-2 bg-primary text-primary-foreground rounded hover:opacity-90 transition-opacity"
            >
              Bet 90%-95%
            </button>
            <button
              className="bet-button px-4 py-2 mr-2 mb-2 bg-primary text-primary-foreground rounded hover:opacity-90 transition-opacity"
            >
              Bet 85%-90%
            </button>
          </div>
        </article>
      </main>
    </div>
  )
}
