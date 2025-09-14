import clientPromise from "@/lib/mongodb";

export default async function AdminPage() {
  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB);
  const users = await db.collection("users").find({}).toArray();
  console.log(users);

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8 md:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2 leading-tight">Admin</h1>
          <p className="text-lg text-muted-foreground leading-relaxed">Admin console.</p>
        </div>
        <div>
          {(function() {
            let displ = [];
            for (let i = 0; i < users.length; i++) {
              let user = users[i];
              displ.push(
                <div key={i} className="m-4">
                  <a href="/admin"
                  className="block max-w-md mx-auto p-6 bg-white rounded-2xl shadow-md border border-gray-200 hover:shadow-lg hover:bg-gray-50 transition cursor-pointer">
                    <h2 className="text-xl font-semibold text-gray-800 mb-2">{user.email}</h2>
                    {/* <p className="text-gray-600">
                      Click anywhere in this box to see more details.
                    </p> */}
                    {
                      user.courses.map((x: any, i: number) => (
                        <label key={i} className="text-gray-600">
                          {x.code}&ensp;
                        </label>
                      ))
                    }
                  </a>
                </div>
              )
            }
            return displ;
          })()}
        </div>
      </main>
    </div>
  )
}
