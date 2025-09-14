import { NextResponse } from 'next/server';
import { headers, cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import clientPromise from '@/lib/mongodb';

interface UserCourseOddsEntry { threshold: number; probability?: number; shares?: number }
interface BucketProbability { threshold: number; probability: number }

async function getSub() {
  const hdrs = await headers();
  const dev = hdrs.get('x-dev-sub');
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd && dev) return dev;
  const store = await cookies();
  const idToken = store.get('id_token');
  if (!idToken?.value) return undefined;
  try { const decoded: any = jwt.decode(idToken.value); return decoded?.sub; } catch { return undefined; }
}

// POST body: { courseCode: string, buckets: Array<{ threshold:number, probability:number }>, all?: boolean }
// If all=true, will upsert/update all provided buckets.
// Otherwise only buckets with probability < 0.5 are processed.
export async function POST(req: Request) {
  try {
    const sub = await getSub();
    if (!sub) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
    const body = await req.json().catch(()=>({}));
  const courseCodeRaw = body.courseCode;
    const rawBuckets = Array.isArray(body.buckets) ? body.buckets : [];
  const includeAll: boolean = !!body.all;
    // Validate & coerce incoming buckets to typed structure
    const buckets: BucketProbability[] = rawBuckets.filter((b: any): b is BucketProbability =>
      typeof b?.threshold === 'number' && typeof b?.probability === 'number'
    );
    if (!courseCodeRaw || !buckets.length) {
      return NextResponse.json({ error: 'missing_fields', required: ['courseCode','buckets'] }, { status: 400 });
    }
  const courseCode = String(courseCodeRaw).toUpperCase();
  // Filter only probability < 0.5 unless includeAll
  const filtered: BucketProbability[] = includeAll ? buckets : buckets.filter(b => b.probability < 0.5);
    if (!filtered.length) {
      console.log('[odds.update] no buckets after filter', { sub, courseCode, includeAll, inputCount: buckets.length });
      return NextResponse.json({ skipped: true, reason: 'no_low_probability_buckets' });
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);
    const users = db.collection<any>('users');
  const user = await users.findOne({ sub });
    if (!user) return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
    const courseIndex = user.courses?.findIndex((c: any)=> c.code?.toUpperCase() === courseCode);
    if (courseIndex === undefined || courseIndex === -1) return NextResponse.json({ error: 'course_not_found' }, { status: 404 });
    const course = user.courses[courseIndex];
    if (!Array.isArray(course.odds)) course.odds = [];
    const odds: UserCourseOddsEntry[] = course.odds;

    filtered.forEach((f: BucketProbability) => {
      const existing = odds.find(o => o.threshold === f.threshold);
      if (existing) {
        existing.probability = f.probability;
      } else {
        odds.push({ threshold: f.threshold, probability: f.probability, shares: 0 });
      }
    });

    const oddsPath = `courses.${courseIndex}.odds`;
    const updateResult = await users.updateOne({ sub }, { $set: { [oddsPath]: odds } });
    console.log('[odds.update] write', { sub, courseCode, courseIndex, filtered: filtered.length, matched: updateResult.matchedCount, modified: updateResult.modifiedCount });
    return NextResponse.json({ success: true, updated: filtered.map(f => f.threshold), mode: includeAll ? 'all' : 'lt_50', modified: updateResult.modifiedCount });
  } catch (e) {
    console.error('POST /api/odds/update error', e);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}