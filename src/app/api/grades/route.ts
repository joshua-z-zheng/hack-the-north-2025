import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import jwt from "jsonwebtoken";
import clientPromise from "@/lib/mongodb";

/**
 * Returns a normalized list of the user's past grades for inference.
 * Logic:
 * - Retrieve user by sub from id_token cookie.
 * - Extract all course grade entries (courses[].grade) that are numeric.
 * - Sort by most recent. (If timestamps exist later, we can adjust; for now preserve array order as stored, assuming newest last.)
 * - If > 10 take the last 10.
 * - If < 10 left-pad by repeating the first (oldest) grade until length == 10.
 * - If no grades, return empty array.
 */
export async function GET() {
  try {
    const hdrs = await headers();
    const devHeader = hdrs.get("x-dev-sub");
    const isProd = process.env.NODE_ENV === 'production';

    let sub: string | undefined;
    if (!isProd && devHeader) {
      sub = devHeader; // dev bypass
    } else {
      const cookieStore = await cookies();
      const idToken = cookieStore.get("id_token");
      if (!idToken?.value) {
        return NextResponse.json({ grades: [], reason: "not_authenticated" }, { status: 200 });
      }
      const decoded: any = jwt.decode(idToken.value);
      sub = decoded?.sub;
      if (!sub) {
        return NextResponse.json({ grades: [], reason: "no_sub" }, { status: 200 });
      }
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);
    const users = db.collection("users");

    const user = await users.findOne({ sub });
    if (!user) {
      return NextResponse.json({ grades: [], reason: "user_not_found" }, { status: 200 });
    }

    const courses = Array.isArray(user.courses) ? user.courses : [];

    // Extract numeric grades in the stored order.
    const rawGrades: number[] = courses
      .map((c: any) => c?.grade)
      .filter((g: any) => typeof g === 'number' && !isNaN(g));

    if (rawGrades.length === 0) {
      return NextResponse.json({ grades: [], reason: "no_grades" }, { status: 200 });
    }

    // Assume the raw order is chronological oldest -> newest. Keep only last 10 if more.
    let selected = rawGrades.slice(-10);

    // If fewer than 10, we left-pad by repeating the oldest available grade.
    if (selected.length < 10) {
      const padValue = selected[0];
      const padCount = 10 - selected.length;
      const padding = Array(padCount).fill(padValue);
      selected = [...padding, ...selected];
    }

    return NextResponse.json({ grades: selected, count: selected.length });
  } catch (error) {
    console.error("Error building grades sequence:", error);
    return NextResponse.json({ grades: [], error: "internal_error" }, { status: 500 });
  }
}
