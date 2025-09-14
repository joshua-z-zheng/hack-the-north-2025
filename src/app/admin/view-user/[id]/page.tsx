import clientPromise from "@/lib/mongodb";

interface Props {
  params: Promise<{ id: string }>
}

export default async function AdminPage({ params }: Props) {
  const resolvedParams = await params;
  let id = resolvedParams.id;

  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB);
  const user = await db.collection("users").findOne({"email": decodeURIComponent(id.trim())});
  console.log(user);

  if (!user) {
    return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8 md:px-6 lg:px-8">
        <div className="mb-8">
          <p className="text-lg text-muted-foreground leading-relaxed">Profile does not exist.</p>
        </div>
      </main>
    </div>
    )
  }
  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8 md:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2 leading-tight">{user.email}</h1>
          <p className="text-lg text-muted-foreground leading-relaxed">Student profile.</p>
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2 leading-snug">Courses</h1>
          {
            user.courses.map((x: any, i: number) => (
            <div
              key={i}
              className="block max-w-md p-6 bg-white rounded-2xl shadow-lg border border-gray-200 hover:shadow-xl transition-shadow"
            >
              <h2 className="text-xl font-semibold text-gray-800 mb-2">{x.code}</h2>

              <dl className="space-y-2 text-gray-700">
                <div className="flex justify-between">
                  <dt className="font-medium">Current Grade:</dt>
                  <dd className="font-semibold text-blue-600">{x.grade}%</dd>
                </div>
              </dl>
            </div>
            ))
          }
        </div>
      </main>
    </div>
  )
}