import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import jwt from 'jsonwebtoken';
import clientPromise from '@/lib/mongodb';

interface CourseInput { code: string; desc?: string; grade?: number | null }

// Utility: authenticate and return user document + collection
async function getUserAndCollection() {
  const hdrs = await headers();
  const devHeader = hdrs.get('x-dev-sub');
  const isProd = process.env.NODE_ENV === 'production';
  let sub: string | undefined;
  if (!isProd && devHeader) {
    sub = devHeader;
  } else {
    const cookieStore = await cookies();
    const idToken = cookieStore.get('id_token');
    if (!idToken?.value) return { error: 'not_authenticated' };
    try {
      const decoded: any = jwt.decode(idToken.value);
      sub = decoded?.sub;
    } catch {
      return { error: 'token_decode_failed' };
    }
    if (!sub) return { error: 'no_sub' };
  }
  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB);
  const users = db.collection('users');
  const user = await users.findOne({ sub });
  return { users, user, sub };
}

// GET: list user's courses
export async function GET() {
  try {
    const { error, user } = await getUserAndCollection();
    if (error) return NextResponse.json({ error });
    return NextResponse.json({ courses: user?.courses || [] });
  } catch (e) {
    console.error('GET /api/courses error', e);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

// POST: add one or many courses
// Body: { code, desc?, grade? } OR { courses: [ {code, desc?, grade?}, ... ] }
export async function POST(req: Request) {
  try {
    const payload = await req.json().catch(() => ({}));
    const { error, users, user, sub } = await getUserAndCollection();
    if (error) return NextResponse.json({ error });

    let toAdd: CourseInput[] = [];
    if (Array.isArray(payload)) {
      // Support raw array of course objects: [ {code, grade?}, ... ]
      toAdd = payload as CourseInput[];
    } else if (Array.isArray(payload?.courses)) {
      toAdd = payload.courses;
    } else if (payload?.code) {
      toAdd = [payload as CourseInput];
    } else {
      return NextResponse.json({ error: 'invalid_body', hint: 'Send {code,...}, {courses:[...]}, or an array of course objects' }, { status: 400 });
    }

    // Normalize & validate
    const cleaned: CourseInput[] = [];
    for (const c of toAdd) {
      if (!c?.code || typeof c.code !== 'string') continue;
      const code = c.code.trim().toUpperCase();
      if (!code) continue;
      let grade: number | null | undefined = c.grade;
      if (grade !== undefined && grade !== null) {
        if (typeof grade !== 'number' || isNaN(grade)) grade = null;
        else grade = Math.min(100, Math.max(0, grade));
      }
      cleaned.push({ code, desc: c.desc?.trim(), grade: grade ?? null });
    }
    if (cleaned.length === 0) return NextResponse.json({ error: 'no_valid_courses' }, { status: 400 });

    const existing = Array.isArray(user?.courses) ? user!.courses : [];
    const existingCodes = new Set(existing.map((c: any) => c.code?.toUpperCase()));

    const merged = [...existing];
    for (const c of cleaned) {
      if (existingCodes.has(c.code)) {
        // Skip duplicates silently; could choose to update desc/grade if provided
        continue;
      }
      merged.push({ code: c.code, desc: c.desc || '', grade: c.grade ?? null, past: false });
    }

    await users!.updateOne({ sub }, { $set: { courses: merged } }, { upsert: true });
    return NextResponse.json({ courses: merged, added: cleaned.map(c => c.code) });
  } catch (e) {
    console.error('POST /api/courses error', e);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

// PATCH: update grade or desc for a course
// Body: { code: string, grade?: number|null, desc?: string }
export async function PATCH(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    if (!body?.code) return NextResponse.json({ error: 'missing_code' }, { status: 400 });
    const code = String(body.code).trim().toUpperCase();

    let grade: number | null | undefined = body.grade;
    if (grade !== undefined && grade !== null) {
      if (typeof grade !== 'number' || isNaN(grade)) return NextResponse.json({ error: 'invalid_grade' }, { status: 400 });
      grade = Math.min(100, Math.max(0, grade));
    }

    const { error, users, user, sub } = await getUserAndCollection();
    if (error) return NextResponse.json({ error });

    const existing = Array.isArray(user?.courses) ? user!.courses : [];
    let found = false;
    const updated = existing.map((c: any) => {
      if (c.code?.toUpperCase() === code) {
        found = true;
        return {
          ...c,
          desc: body.desc !== undefined ? String(body.desc) : c.desc,
          grade: grade !== undefined ? grade : c.grade
        };
      }
      return c;
    });
    if (!found) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    await users!.updateOne({ sub }, { $set: { courses: updated } });
    return NextResponse.json({ courses: updated, updated: code });
  } catch (e) {
    console.error('PATCH /api/courses error', e);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

// DELETE: remove course by code (query ?code=XXX or body {code})
export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const codeParam = url.searchParams.get('code');
    let code = codeParam;
    if (!code) {
      const body = await req.json().catch(() => ({}));
      if (body?.code) code = String(body.code);
    }
    if (!code) return NextResponse.json({ error: 'missing_code' }, { status: 400 });
    code = code.trim().toUpperCase();

    const { error, users, user, sub } = await getUserAndCollection();
    if (error) return NextResponse.json({ error });

    const existing = Array.isArray(user?.courses) ? user!.courses : [];
    const filtered = existing.filter((c: any) => c.code?.toUpperCase() !== code);
    if (filtered.length === existing.length) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    await users!.updateOne({ sub }, { $set: { courses: filtered } });
    return NextResponse.json({ courses: filtered, removed: code });
  } catch (e) {
    console.error('DELETE /api/courses error', e);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
