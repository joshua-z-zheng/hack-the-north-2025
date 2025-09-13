
import { ContentCard } from "@/components/content-card"
import { sampleData } from "@/sample-data"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8 md:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2 leading-tight">Market Insights Dashboard</h1>
          <p className="text-lg text-muted-foreground leading-relaxed">Stay informed with the latest market trends and analysis</p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sampleData.map((item, index) => (
            <ContentCard
              key={index}
              id={index}
              title={item.title}
              details={item.details}
            />
          ))}
        </div>
      </main>
    </div>
  )
}
