import { Navbar } from "@/components/navbar"
import { ContentCard } from "@/components/content-card"

const sampleData = [
  {
    title: "Market Analysis Q4 2024",
    details: "Comprehensive analysis of market trends and predictions for the upcoming quarter with detailed insights.",
  },
  {
    title: "Technology Sector Growth",
    details: "Exploring the rapid expansion in the technology sector and its impact on global markets.",
  },
  {
    title: "Cryptocurrency Trends",
    details: "Latest developments in cryptocurrency markets and blockchain technology adoption rates.",
  },
  {
    title: "Sustainable Energy Investments",
    details: "Investment opportunities in renewable energy sectors and their long-term market potential.",
  },
  {
    title: "Global Economic Outlook",
    details: "Economic forecasts and analysis of international trade patterns affecting various industries.",
  },
  {
    title: "AI and Machine Learning",
    details: "The growing influence of artificial intelligence on business operations and market dynamics.",
  },
  {
    title: "Healthcare Innovation",
    details: "Breakthrough technologies in healthcare and their market implications for investors.",
  },
  {
    title: "Real Estate Market Shifts",
    details: "Analysis of changing real estate trends and their impact on investment strategies.",
  },
]

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