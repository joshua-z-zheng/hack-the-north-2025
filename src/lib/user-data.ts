import { cookies } from "next/headers"
import jwt from "jsonwebtoken"
import clientPromise from "@/lib/mongodb"

export interface Course {
  code: string
  odds: {
    probability: number
    threshold: number
    shares?: number
  }[]
  contract?: string
  past?: boolean
}

export async function getUserCourses(): Promise<Course[]> {
  try {
    const cookieStore = await cookies()
    const idToken = cookieStore.get("id_token")

    if (!idToken?.value) {
      return []
    }

    const decoded: any = jwt.decode(idToken.value)
    const sub = decoded?.sub

    if (!sub) {
      return []
    }

    const client = await clientPromise
    const db = client.db(process.env.MONGODB_DB)
    const users = db.collection("users")

    const user = await users.findOne({ sub })
    return user?.courses || []
  } catch (error) {
    console.error("Error fetching user courses:", error)
    return []
  }
}

export async function getAuthState() {
  const cookieStore = await cookies()
  const idToken = cookieStore.get("id_token")
  return !!idToken
}
