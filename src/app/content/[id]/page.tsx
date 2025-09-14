'use client'

import Link from "next/link"
import { useState, useEffect, useRef } from "react"
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
  contract?: string
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
  const [placingBet, setPlacingBet] = useState(false)
  // Prediction states
  const [predictionLoading, setPredictionLoading] = useState(false)
  const [predictionError, setPredictionError] = useState<string | null>(null)
  const [predictedGrade, setPredictedGrade] = useState<number | null>(null)
  const [roundedGrade, setRoundedGrade] = useState<number | null>(null)
  const [gradesUsed, setGradesUsed] = useState<number[]>([])
  const animationRef = useRef<number | null>(null)
  const [animatedGrade, setAnimatedGrade] = useState<number | null>(null)
  const [bucketProbs, setBucketProbs] = useState<{ threshold: number; p: number }[]>([])

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

  // Fetch prediction once user data is available
  useEffect(() => {
    if (!isLoggedIn) return
    setPredictionLoading(true)
    setPredictionError(null)
    fetch('/api/predict?debug=1')
      .then(r => r.json())
      .then(data => {
        if (data?.error) {
          setPredictionError(data.error)
          return
        }
        const pg = typeof data?.prediction?.predicted_grade === 'number' ? data.prediction.predicted_grade : null
        const rg = typeof data?.prediction?.rounded_grade === 'number' ? data.prediction.rounded_grade : null
        if (pg !== null) {
          setPredictedGrade(pg)
          setAnimatedGrade(0)
          // animate to target
          const start = performance.now()
          const duration = 1200
          const target = Math.max(0, Math.min(100, pg))
          const step = (ts: number) => {
            const t = Math.min(1, (ts - start) / duration)
            const eased = 1 - Math.pow(1 - t, 3)
            setAnimatedGrade(parseFloat((target * eased).toFixed(2)))
            if (t < 1) {
              animationRef.current = requestAnimationFrame(step)
            }
          }
          animationRef.current = requestAnimationFrame(step)
        }
        if (rg !== null) setRoundedGrade(rg)
        if (Array.isArray(data?.grades)) setGradesUsed(data.grades)
        // Compute bucket probabilities using normal approximation
        if (pg !== null) {
          const thresholds = [70,75,80,85,90,95]
          // sample std from gradesUsed if available else fallback
          let sigma: number | null = null
          if (Array.isArray(data?.grades) && data.grades.length > 1) {
            const m = data.grades.reduce((a:number,b:number)=>a+b,0)/data.grades.length
            const variance = data.grades.reduce((a:number,b:number)=>a+Math.pow(b-m,2),0)/(data.grades.length-1)
            sigma = Math.sqrt(variance)
          }
            if (!sigma || !isFinite(sigma) || sigma < 3) sigma = 6; // fallback / floor
          const erf = (x:number)=>{ // Abramowitz-Stegun approximation
            const sign = x < 0 ? -1 : 1; x = Math.abs(x)
            const a1=0.254829592,a2=-0.284496736,a3=1.421413741,a4=-1.453152027,a5=1.061405429,p=0.3275911;
            const t=1/(1+p*x);
            const y=1-((((a5*t+a4)*t+a3)*t+a2)*t+a1)*t*Math.exp(-x*x);
            return sign*y;
          }
          const cdf = (x:number)=>0.5*(1+erf(x/Math.SQRT2));
          const probs = thresholds.map(th=>({threshold: th, p: 1 - cdf((th - pg)/sigma!)}));
          setBucketProbs(probs)
        }
      })
      .catch(e => setPredictionError(e.message || 'prediction_failed'))
      .finally(() => setPredictionLoading(false))
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current) }
  }, [isLoggedIn])

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

    const handlePlaceBet = async () => {
    if (!selectedMarketData || !course || placingBet) return

    setPlacingBet(true)

    try {
      const response = await fetch('/api/place-bet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          courseCode: course.code,
          threshold: selectedMarketData.threshold,
          betAmount: calculateCost(selectedMarketData.probability, shareCount)
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to place bet')
      }

      const result = await response.json()
      console.log('Bet placed successfully:', result)

      // Refresh the page to show updated data
      window.location.reload()
    } catch (error) {
      console.error('Error placing bet:', error)
      alert(`Failed to place bet: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setPlacingBet(false)
    }
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
              {/* Prediction Panel */}
              <div className="mt-6 relative">
                <div className="group overflow-hidden rounded-xl border border-border bg-gradient-to-br from-indigo-50 via-white to-blue-50 dark:from-indigo-950 dark:via-background dark:to-blue-950 p-6 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium tracking-wide text-indigo-600 dark:text-indigo-300">GRADE BUCKET PROBABILITIES</span>
                      {predictionLoading && <span className="animate-pulse text-xs text-muted-foreground">Loading…</span>}
                      {predictionError && <span className="text-xs text-red-500">{predictionError}</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">Based on model mean prediction and normal approximation (σ adaptive, min 6). Assumes ~70% accuracy within ±1σ.</div>
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                      {bucketProbs.length ? bucketProbs.map(b=>{
                        return (
                          <div key={b.threshold} className="relative rounded-md border border-indigo-200/50 dark:border-indigo-800/40 bg-white/40 dark:bg-indigo-950/30 p-3 flex flex-col items-center text-center shadow-sm hover:shadow transition-shadow">
                            <div className="text-[10px] tracking-wide font-medium text-indigo-600 dark:text-indigo-300 mb-1">{b.threshold}%+</div>
                            <div className="text-sm font-semibold text-indigo-900 dark:text-indigo-100">{(b.p*100).toFixed(1)}%</div>
                            <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity bg-[radial-gradient(circle_at_50%_40%,rgba(99,102,241,0.15),transparent_70%)]" />
                          </div>
                        )
                      }) : (
                        <div className="col-span-6 text-center text-muted-foreground text-sm">No prediction yet.</div>
                      )}
                    </div>
                    {animatedGrade !== null && (
                      <div className="flex flex-wrap items-center gap-2 text-xs mt-2">
                        <span className="px-2 py-1 rounded bg-indigo-600/10 text-indigo-700 dark:text-indigo-300 border border-indigo-600/20">Mean {animatedGrade.toFixed(2)}%</span>
                        {roundedGrade !== null && <span className="px-2 py-1 rounded bg-muted border border-border">Rounded {Math.round(roundedGrade)}%</span>}
                      </div>
                    )}
                  </div>
                  <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity bg-[radial-gradient(circle_at_20%_25%,rgba(99,102,241,0.12),transparent_65%)]" />
                </div>
              </div>
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

                  <Button
                    className="w-full"
                    size="lg"
                    onClick={handlePlaceBet}
                    disabled={placingBet}
                  >
                    {placingBet ? 'Placing Bet...' : 'Buy Shares'}
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
