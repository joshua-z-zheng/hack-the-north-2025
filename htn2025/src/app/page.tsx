import { Navbar } from "@/components/navbar"
import { ContentCard } from "@/components/content-card"
import { sampleData } from "@/sample-data"

export default function HomePage() {
  return (
    <div className="main-content">
      <Navbar />

      <main className="page-container">
        <div className="page-header">
          <h1 className="page-title">Market Insights Dashboard</h1>
          <p className="page-subtitle">Stay informed with the latest market trends and analysis</p>
        </div>

        <div className="grid grid-responsive">
          {sampleData.map((item, index) => (
            <ContentCard
              key={index}
              title={item.title}
              details={item.details}
            />
          ))}
        </div>
      </main>
    </div>
  )
}