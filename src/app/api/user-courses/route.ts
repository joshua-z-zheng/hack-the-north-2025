import { cookies, headers } from "next/headers"
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
    const hdrs = await headers();
    const devHeader = hdrs.get('x-dev-sub');
    const isProd = process.env.NODE_ENV === 'production';
    let sub: string | undefined;
    if (!isProd && devHeader) {
      sub = devHeader;
    } else {
      const cookieStore = await cookies()
      const idToken = cookieStore.get("id_token")
      if (!idToken?.value) {
        return new NextResponse(JSON.stringify([]), { headers: { 'Cache-Control': 'no-store' } })
      }
      const decoded: any = jwt.decode(idToken.value)
      sub = decoded?.sub
      if (!sub) {
        return new NextResponse(JSON.stringify([]), { headers: { 'Cache-Control': 'no-store' } })
      }
    }

    const client = await clientPromise
    const db = client.db(process.env.MONGODB_DB)
    const users = db.collection("users")

    const user = await users.findOne({ sub })
    const courses = Array.isArray(user?.courses) ? user!.courses : []
    interface NormOdd { threshold: number; shares: number; probability: number | null }
    const normalized = courses.map((c: any) => {
      const oddsArr: any[] = Array.isArray(c.odds) ? c.odds : []
      const normOdds: NormOdd[] = oddsArr.map((o: any): NormOdd => ({
        threshold: o?.threshold,
        shares: typeof o?.shares === 'number' ? o.shares : 0,
        probability: typeof o?.probability === 'number' ? o.probability : null
      }))
        .filter((o: NormOdd) => typeof o.threshold === 'number')
        .sort((a: NormOdd, b: NormOdd)=> a.threshold - b.threshold)
      return {
        code: c.code,
        contract: c.contract,
        odds: normOdds
      }
    })
    return new NextResponse(JSON.stringify(normalized), { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error("Error fetching user courses:", error)
    return new NextResponse(JSON.stringify([]), { headers: { 'Cache-Control': 'no-store' } })
  }
}
