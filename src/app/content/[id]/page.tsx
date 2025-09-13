"use client"

import { useParams, useRouter } from "next/navigation"
import { Navbar } from "@/components/navbar"
import { sampleData } from "@/sample-data"
import "../content.css"

export default function ContentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = Number.parseInt(params.id as string)
  const content = sampleData[id]

  if (!content) {
    return (
      <div className="main-content">
        <Navbar />
        <main className="page-container">
          <h1>Content not found</h1>
          <button onClick={() => router.push("/")} className="back-button">
            Back to Home
          </button>
        </main>
      </div>
    )
  }

  return (
    <div className="main-content">
      <Navbar />
      <main className="page-container">
        <button onClick={() => router.push("/")} className="back-button">
          ← Back to Home
        </button>

        <article className="content-detail">
          <header className="content-header">
            <h1 className="content-title">{content.title}</h1>
            <p className="content-summary">{content.details}</p>
          </header>

          <div className="content-body">
            <button onClick={() => {}} className="bet-button">
              Bet 95%-100%
            </button>
            <button onClick={() => {}} className="bet-button">
              Bet 90%-95%
            </button>
            <button onClick={() => {}} className="bet-button">
              Bet 85%-90%
            </button>
          </div>
        </article>
      </main>
    </div>
  )
}