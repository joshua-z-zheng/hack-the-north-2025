"use client"

import { useRouter } from "next/navigation"

interface ContentCardProps {
  title: string
  details: string
  id: number // Added id prop for navigation
  className?: string
}

export function ContentCard({ title, details, id, className }: ContentCardProps) {
  const router = useRouter()

  const handleClick = () => {
    router.push(`/content/${id}`)
  }

  return (
    <div
      className={`card ${className || ""}`}
      onClick={handleClick} // Made card clickable
      style={{ cursor: "pointer" }} // Added pointer cursor
    >
      <div className="card-header">
        <h3 className="card-title">{title}</h3>
      </div>
      <div className="card-content">
        <p className="card-description">{details}</p>
      </div>
    </div>
  )
}