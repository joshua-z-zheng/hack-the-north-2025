import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { Course } from "@/types";

export async function POST(req: Request) {
  const body: {id: string, courseCode: string} = await req.json();
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.id || !body.courseCode) {
    return NextResponse.json({ error: "No id or course code provided" }, { status: 400 });
  }

  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB);
  const coll = db.collection("users");

  const curr = await coll.findOne({email: body.id});
  if (!curr) {
    return NextResponse.json({ error: "No id or course code provided" }, { status: 400 });
  }
  curr.courses.push(new Course(body.courseCode));
  const result = await coll.updateOne(
    {email: body.id},
    curr
  );

  return NextResponse.json({ message: "Success" }, { status: 200 });
}