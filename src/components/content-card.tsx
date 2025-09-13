"use client"

import { useRouter } from "next/navigation"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

interface ContentCardProps {
  title: string
  details: string
  id: number
  className?: string
}

export function ContentCard({ title, details, id, className }: ContentCardProps) {
  const router = useRouter()

  const handleClick = () => {
    router.push(`/content/${id}`)
  }

  return (
    <Card
      className={`cursor-pointer hover:shadow-md transition-shadow ${className || ""}`}
      onClick={handleClick}
    >
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">{details}</p>
      </CardContent>
    </Card>
  )
}