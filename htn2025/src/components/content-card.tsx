interface ContentCardProps {
  title: string
  details: string
  className?: string
}

export function ContentCard({ title, details, className }: ContentCardProps) {
  return (
    <div className={`card ${className || ""}`}>
      <div className="card-header">
        <h3 className="card-title">{title}</h3>
      </div>
      <div className="card-content">
        <p className="card-description">{details}</p>
      </div>
    </div>
  )
}