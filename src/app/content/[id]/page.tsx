"use client"

import { useParams, useRouter } from "next/navigation"
import { Navbar } from "@/components/navbar"
import { sampleData } from "@/sample-data"

export default function ContentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = Number.parseInt(params.id as string)
  const content = sampleData[id]

  if (!content) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="max-w-5xl mx-auto px-4 py-8 md:px-6 lg:px-8">
          <h1>Content not found</h1>
          <button
            onClick={() => router.push("/")}
            className="inline-flex items-center gap-2 px-4 py-2 mb-8 bg-secondary text-secondary-foreground border border-border rounded-lg text-sm font-medium cursor-pointer transition-all hover:bg-muted"
          >
            Back to Home
          </button>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 py-8 md:px-6 lg:px-8">
        <button
          onClick={() => router.push("/")}
          className="inline-flex items-center gap-2 px-4 py-2 mb-8 bg-secondary text-secondary-foreground border border-border rounded-lg text-sm font-medium cursor-pointer transition-all hover:bg-muted"
        >
          ← Back to Home
        </button>

        <article className="max-w-3xl mx-auto">
          <header className="mb-8 pb-6 border-b border-border">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4 leading-tight">{content.title}</h1>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed italic">{content.details}</p>
          </header>

          <div className="text-base md:text-lg leading-relaxed text-foreground">
            <button
              onClick={() => {}}
              className="bet-button px-4 py-2 mr-2 mb-2 bg-primary text-primary-foreground rounded hover:opacity-90 transition-opacity"
            >
              Bet 95%-100%
            </button>
            <button
              onClick={() => {}}
              className="bet-button px-4 py-2 mr-2 mb-2 bg-primary text-primary-foreground rounded hover:opacity-90 transition-opacity"
            >
              Bet 90%-95%
            </button>
            <button
              onClick={() => {}}
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