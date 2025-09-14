import { cookies } from "next/headers"
import jwt from "jsonwebtoken"
import clientPromise from "@/lib/mongodb"
import { NextResponse } from "next/server"

export interface Course {
  code: string
  odds: {
    probability: number
    threshold: number
    shares?: number
  }[]
  contract?: string
}

export async function GET() {
  try {
    const cookieStore = await cookies()
    const idToken = cookieStore.get("id_token")

    if (!idToken?.value) {
      return NextResponse.json([])
    }

    const decoded: any = jwt.decode(idToken.value)
    const sub = decoded?.sub

    if (!sub) {
      return NextResponse.json([])
    }

    const client = await clientPromise
    const db = client.db(process.env.MONGODB_DB)
    const users = db.collection("users")

    const user = await users.findOne({ sub })
    return NextResponse.json(user?.courses || [])
  } catch (error) {
    console.error("Error fetching user courses:", error)
    return NextResponse.json([])
  }
}
