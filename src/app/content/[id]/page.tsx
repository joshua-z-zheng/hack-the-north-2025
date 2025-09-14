'use client'

import Link from "next/link"
import { useState, useEffect } from "react"
import { NumberInput } from "@/components/number-input"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"

interface Props {
  params: Promise<{ id: string }>
}

interface Market {
  threshold: number
  probability: number
  shares?: number
}

interface Course {
  code: string
  odds: Market[]
}

// Client-side helper functions
async function getUserCourses(): Promise<Course[]> {
  try {
    const response = await fetch('/api/user-courses')
    if (!response.ok) return []
    return await response.json()
  } catch (error) {
    console.error('Error fetching user courses:', error)
    return []
  }
}

async function getAuthState(): Promise<boolean> {
  try {
    const response = await fetch('/api/auth-state')
    if (!response.ok) return false
    const data = await response.json()
    return data.isLoggedIn
  } catch (error) {
    console.error('Error checking auth state:', error)
    return false
  }
}

export default function ContentDetailPage({ params }: Props) {
  const [id, setId] = useState<string>("")
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false)
  const [courses, setCourses] = useState<Course[]>([])
  const [course, setCourse] = useState<Course | null>(null)
  const [selectedMarket, setSelectedMarket] = useState<number | null>(null)
  const [shareCount, setShareCount] = useState<number>(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      const resolvedParams = await params
      const courseId = Number.parseInt(resolvedParams.id)

      setId(resolvedParams.id)

      const authState = await getAuthState()
      setIsLoggedIn(authState)

      if (authState) {
        const userCourses = await getUserCourses()
        setCourses(userCourses)
        setCourse(userCourses[courseId] || null)
      }

      setLoading(false)
    }

    loadData()
  }, [params])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

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

  if (!course) {
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

  const formatProbability = (prob: number) => `${(prob * 100).toFixed(1)}%`
  const formatReward = (prob: number) => {
    const cost = (prob * 100).toFixed(1)
    return `${cost}¢ → 100¢`
  }

  const calculateCost = (prob: number, shares: number) => {
    return ((prob) * shares).toFixed(2)
  }

  const calculateReward = (shares: number) => {
    return shares.toFixed(2)
  }

  const emojiMap: Record<string, string> = {
    MATH: "📐",
    ENGL: "📝",
    SCI: "🧪"
  }

  const getEmoji = (title: string) => {
    for (const [key, emoji] of Object.entries(emojiMap)) {
      if (title.includes(key)) {
        return emoji
      }
    }
    return "📚"
  }

  const handleMarketClick = (index: number) => {
    setSelectedMarket(index)
    setShareCount(1)
  }

  const handleCloseBetting = () => {
    setSelectedMarket(null)
    setShareCount(1)
  }

  const selectedMarketData = selectedMarket !== null ? course.odds[selectedMarket] : null

  return (
    <div className="min-h-screen bg-background">
      <main className={`transition-all duration-500 ease-in-out ${selectedMarket !== null ? 'max-w-7xl' : 'max-w-5xl'} mx-auto px-4 py-8 md:px-6 lg:px-8`}>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 mb-8 bg-secondary text-secondary-foreground border border-border rounded-lg text-sm font-medium cursor-pointer transition-all hover:bg-muted"
        >
          ← Back to Home
        </Link>

        <div className="flex gap-8">
          {/* Main Content */}
          <div className={`transition-all duration-500 ease-in-out ${selectedMarket !== null ? 'w-2/3' : 'max-w-3xl mx-auto w-full'}`}>
            <header className="mb-8 pb-6 border-b border-border">
              <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4 leading-tight">
                {getEmoji(course.code)} {course.code}
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
                Place your bets!
              </p>
            </header>

            <div className="space-y-6">
              {/* Betting Interface */}
              <div className="bg-card border border-border rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-6">🎯 Bet On Yourself</h2>
                <div className="grid grid-cols-1 gap-4">
                  {course.odds.map((odd, index) => {
                    const hasShares = (odd.shares || 0) > 0
                    const isSelected = selectedMarket === index
                    return (
                      <button
                        key={index}
                        onClick={() => handleMarketClick(index)}
                        className={`group relative flex items-center justify-between p-6 rounded-lg transition-all duration-200 hover:shadow-lg hover:scale-[1.02] ${
                          isSelected
                            ? 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border border-blue-200 dark:border-blue-800 ring-2 ring-blue-500/20'
                            : hasShares
                            ? 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 border border-green-200 dark:border-green-800'
                            : 'bg-card border border-border hover:from-blue-50 hover:to-indigo-50 dark:hover:from-blue-950 dark:hover:to-indigo-950 hover:border-blue-200 dark:hover:border-blue-800 hover:bg-gradient-to-r'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`flex items-center justify-center w-12 h-12 rounded-full font-bold text-lg transition-colors ${
                            isSelected
                              ? 'bg-blue-500 text-white'
                              : hasShares
                              ? 'bg-green-500 text-white group-hover:bg-green-600'
                              : 'bg-muted text-muted-foreground group-hover:bg-blue-500 group-hover:text-white'
                          }`}>
                            {hasShares ? '✓' : '◉'}
                          </div>
                          <div className="text-left">
                            <div className={`text-lg font-semibold mb-1 ${
                              isSelected
                                ? 'text-blue-700 dark:text-blue-300'
                                : hasShares
                                ? 'text-green-700 dark:text-green-300'
                                : 'text-foreground group-hover:text-blue-700 dark:group-hover:text-blue-300'
                            }`}>
                              I'll score {odd.threshold}%+
                            </div>
                            <div className={`text-sm ${
                              isSelected
                                ? 'text-blue-600 dark:text-blue-400'
                                : hasShares
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-muted-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400'
                            }`}>
                              Shares: {odd.shares || 0}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <div className={`text-2xl font-bold ${
                              isSelected
                                ? 'text-blue-600 dark:text-blue-400'
                                : hasShares
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400'
                            }`}>
                              {formatReward(odd.probability)}
                            </div>
                            <div className={`text-xs ${
                              isSelected
                                ? 'text-blue-500 dark:text-blue-500'
                                : hasShares
                                ? 'text-green-500 dark:text-green-500'
                                : 'text-muted-foreground group-hover:text-blue-500 dark:group-hover:text-blue-500'
                            }`}>
                              BACK IT
                            </div>
                          </div>
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                            isSelected
                              ? 'bg-blue-500 bg-opacity-20'
                              : hasShares
                              ? 'bg-green-500 bg-opacity-20 group-hover:bg-opacity-30'
                              : 'bg-muted group-hover:bg-blue-500 group-hover:bg-opacity-20'
                          }`}>
                            <span className={`font-bold ${
                              isSelected
                                ? 'text-blue-600'
                                : hasShares
                                ? 'text-green-600'
                                : 'text-muted-foreground group-hover:text-blue-600'
                            }`}>→</span>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Betting Panel */}
          {selectedMarket !== null && selectedMarketData && (
            <div className="w-1/3 transition-all duration-500 ease-in-out transform translate-x-0">
              <div className="bg-card border border-border rounded-lg p-6 sticky top-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold">Place Your Bet</h3>
                  <button
                    onClick={handleCloseBetting}
                    className="p-2 hover:bg-muted rounded-lg transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <div className="text-sm text-muted-foreground mb-1">Market</div>
                    <div className="text-lg font-semibold">
                      I'll score {selectedMarketData.threshold}%+
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Number of Shares
                    </label>
                    <NumberInput
                      value={shareCount}
                      onValueChange={(value) => setShareCount(value || 1)}
                      min={1}
                      max={1000}
                      stepper={1}
                      placeholder="1"
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Cost</span>
                      <span className="font-medium">
                        ${calculateCost(selectedMarketData.probability, shareCount)}
                      </span>
                    </div>

                    <div className="flex items-center justify-center">
                      <span className="text-2xl">↓</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Potential Reward</span>
                      <span className="text-2xl font-bold text-green-600">
                        ${calculateReward(shareCount)}
                      </span>
                    </div>
                  </div>

                  <Button className="w-full" size="lg">
                    Buy Shares
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
