"use client"

import { useRouter } from "next/navigation"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

interface ContentCardProps {
  title: string
  odds: {
    probability: number
    threshold: number
  }[]
  id: string
  className?: string
}

export function ContentCard({ title, odds, id, className }: ContentCardProps) {
  const router = useRouter()

  const handleClick = () => {
    router.push(`/content/${id}`)
  }

  const formatProbability = (prob: number) => `${(prob * 100).toFixed(1)}%`

  const emojiMap: Record<string, string> = {
    MATH: "📐",
    ENGL: "📝",
    SCI: "🧪"
  }

  const formatReward = (prob: number) => {
    const cost = (prob * 100).toFixed(1)
    return `${cost}¢ → 100¢`
  }

  const getEmoji = (title: string) => {
    for (const [key, emoji] of Object.entries(emojiMap)) {
      if (title.includes(key)) {
        return emoji
      }
    }
    return ""
  }

  return (
    <Card
      className={`cursor-pointer hover:shadow-md transition-shadow ${className || ""}`}
      onClick={handleClick}
    >
      <CardHeader>
        <CardTitle className="text-xl">{getEmoji(title)} {title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {odds.map((odd, index) => (
            <div key={index} className="flex justify-between items-center">
              <span className="text-base font-semibold">{odd.threshold}%+</span>
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold">{formatReward(odd.probability)}</span>
                <div className="flex gap-1">
                  <div
                    className="px-2 py-1 bg-green-500 bg-opacity-30 rounded-sm hover:bg-opacity-50 hover:scale-105 transition-all"
                  >
                    <span className="text-xs font-semibold text-white">BACK IT</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
