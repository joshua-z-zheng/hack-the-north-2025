import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, courseCode, grade } = body;

    if (!email || !courseCode || grade === undefined || grade === null) {
      return NextResponse.json({ error: "Missing required fields: email, courseCode, grade" }, { status: 400 });
    }

    if (typeof grade !== 'number' || grade < 0 || grade > 100) {
      return NextResponse.json({ error: "Grade must be a number between 0 and 100" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);
    const users = db.collection("users");

    // Find the user and update the specific course
    const result = await users.updateOne(
      {
        email: email,
        "courses.code": courseCode
      },
      {
        $set: {
          "courses.$.grade": grade,
          "courses.$.past": true
        }
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "User or course not found" }, { status: 404 });
    }

    if (result.modifiedCount === 0) {
      return NextResponse.json({ error: "Course was not updated" }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: "Course resolved successfully" });
  } catch (error) {
    console.error('Resolve course endpoint error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
