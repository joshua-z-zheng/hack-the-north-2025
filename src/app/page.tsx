import { getUserCourses, getAuthState } from "@/lib/user-data"
import { ContentCard } from "@/components/content-card"

export default async function HomePage() {
  const isLoggedIn = await getAuthState()
  const courses = isLoggedIn ? await getUserCourses() : []

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-background">
        <main className="container mx-auto px-4 py-8 md:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2 leading-tight">Dashboard</h1>
            <p className="text-lg text-muted-foreground leading-relaxed">Please log in to view your courses</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8 md:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2 leading-tight">Dashboard</h1>
          <p className="text-lg text-muted-foreground leading-relaxed">Your courses will appear here once added to your profile.</p>
        </div>

        {courses.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-lg text-muted-foreground">No courses found. Your courses will appear here once added to your profile.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
            {courses.filter(course => course.odds && !course.past).map((course) => (
              <ContentCard
                key={course.code}
                id={course.code}
                title={course.code}
                odds={course.odds}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
