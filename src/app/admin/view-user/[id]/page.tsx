import AdminUserView from "./AdminUserView";
import clientPromise from "@/lib/mongodb";
import { User } from "@/types";

interface Props {
  params: Promise<{ id: string }>
}

export default async function AdminPage({ params }: Props) {
  const resolvedParams = await params;
  let id = resolvedParams.id;

  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB);
  const user: User = await db.collection("users").findOne({"email": decodeURIComponent(id.trim())}) as any;
  user._id = undefined;

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

  return <AdminUserView user={user} />
}
