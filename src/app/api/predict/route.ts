import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import jwt from "jsonwebtoken";
import clientPromise from "@/lib/mongodb";

// Expect environment variable pointing to ML service base, e.g. http://127.0.0.1:8000
const ML_BASE = process.env.ML_SERVICE_URL || "http://127.0.0.1:8000";
const REG_ENDPOINT = "/predict_regression"; // currently serving regression

interface UpstreamPrediction {
  predicted_grade: number;
  rounded_grade: number;
  model_scaled: boolean;
  used_difficulty: boolean;
}

function buildTenGrades(raw: number[]): number[] {
  if (raw.length === 0) return [];
  let selected = raw.slice(-10);
  if (selected.length < 10) {
    const padValue = selected[0];
    const padCount = 10 - selected.length;
    selected = [...Array(padCount).fill(padValue), ...selected];
  }
  return selected;
}

export async function GET(request?: Request) {
  try {
    const debug = request ? (new URL(request.url).searchParams.get('debug') === '1') : false;
    const hdrs = await headers();
    const devHeader = hdrs.get('x-dev-sub');
    const isProd = process.env.NODE_ENV === 'production';
    let sub: string | undefined;
    if (!isProd && devHeader) {
      sub = devHeader;
    } else {
      const cookieStore = await cookies();
      const idToken = cookieStore.get("id_token");
      if (!idToken?.value) {
        return NextResponse.json({ error: "not_authenticated" }, { status: 200 });
      }
      const decoded: any = jwt.decode(idToken.value);
      sub = decoded?.sub;
      if (!sub) {
        return NextResponse.json({ error: "no_sub" }, { status: 200 });
      }
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);
    const users = db.collection("users");
    const user = await users.findOne({ sub });
    if (!user) {
      return NextResponse.json({ error: "user_not_found" }, { status: 200 });
    }

    const courses = Array.isArray(user.courses) ? user.courses : [];
    const rawGrades: number[] = courses
      .map((c: any) => c?.grade)
      .filter((g: any) => typeof g === 'number' && !isNaN(g));

    if (rawGrades.length === 0) {
      return NextResponse.json({ error: "no_grades" }, { status: 200 });
    }

    const grades = buildTenGrades(rawGrades);
    const difficulty = 1; // placeholder

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const started = Date.now();
    let upstream: UpstreamPrediction | null = null;
    let statusCode = 0;
    try {
      const resp = await fetch(ML_BASE + REG_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ past_grades: grades, difficulty }),
        signal: controller.signal
      });
      clearTimeout(timeout);
      statusCode = resp.status;
      if (!resp.ok) {
        return NextResponse.json({ error: 'ml_upstream_error', status: resp.status }, { status: 502 });
      }
      upstream = await resp.json();
    } catch (e: any) {
      clearTimeout(timeout);
      const aborted = e?.name === 'AbortError';
      return NextResponse.json({ error: aborted ? 'ml_timeout' : 'ml_fetch_error' }, { status: 504 });
    }

    if (debug) {
      return NextResponse.json({
        grades,
        difficulty,
        prediction: upstream,
        debug: {
          ml_url: ML_BASE + REG_ENDPOINT,
            upstream_status: statusCode,
            latency_ms: Date.now() - started,
            grade_count: rawGrades.length
        }
      });
    }

    return NextResponse.json({
      grades,
      difficulty,
      prediction: upstream
    });
  } catch (error) {
    console.error('Predict endpoint error:', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

// POST allows explicit difficulty override and optional direct grades array.
// Body schema:
// { difficulty?: number, grades?: number[] }
// If grades omitted, fetches from user profile like GET. If provided, still padded/truncated to 10.
export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const debug = url.searchParams.get('debug') === '1';
    const hdrs = await headers();
    const devHeader = hdrs.get('x-dev-sub');
    const isProd = process.env.NODE_ENV === 'production';
    let sub: string | undefined;
    if (!isProd && devHeader) {
      sub = devHeader;
    } else {
      const cookieStore = await cookies();
      const idToken = cookieStore.get("id_token");
      if (!idToken?.value) {
        return NextResponse.json({ error: "not_authenticated" }, { status: 200 });
      }
      const decoded: any = jwt.decode(idToken.value);
      sub = decoded?.sub;
      if (!sub) {
        return NextResponse.json({ error: "no_sub" }, { status: 200 });
      }
    }

    const body = await req.json().catch(() => ({}));
    let providedDifficulty: number | undefined = body?.difficulty;
    let providedGrades: number[] | undefined = Array.isArray(body?.grades) ? body.grades : undefined;

    if (providedDifficulty !== undefined) {
      if (typeof providedDifficulty !== 'number' || isNaN(providedDifficulty)) {
        return NextResponse.json({ error: 'invalid_difficulty' }, { status: 400 });
      }
      providedDifficulty = Math.min(10, Math.max(1, providedDifficulty));
    }

    let gradesSource: number[] = [];
    let fromBody = false;
    if (providedGrades && providedGrades.length > 0) {
      gradesSource = providedGrades.filter(g => typeof g === 'number' && !isNaN(g));
      fromBody = true;
    } else {
      const client = await clientPromise;
      const db = client.db(process.env.MONGODB_DB);
      const users = db.collection("users");
      const user = await users.findOne({ sub });
      if (!user) {
        return NextResponse.json({ error: 'user_not_found' }, { status: 200 });
      }
      const courses = Array.isArray(user.courses) ? user.courses : [];
      gradesSource = courses
        .map((c: any) => c?.grade)
        .filter((g: any) => typeof g === 'number' && !isNaN(g));
    }

    if (gradesSource.length === 0) {
      return NextResponse.json({ error: 'no_grades' }, { status: 200 });
    }

    const grades = buildTenGrades(gradesSource);
    const difficulty = providedDifficulty ?? 1;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const started = Date.now();
    let upstream: UpstreamPrediction | null = null;
    let statusCode = 0;
    try {
      const resp = await fetch(ML_BASE + REG_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ past_grades: grades, difficulty }),
        signal: controller.signal
      });
      clearTimeout(timeout);
      statusCode = resp.status;
      if (!resp.ok) {
        return NextResponse.json({ error: 'ml_upstream_error', status: resp.status }, { status: 502 });
      }
      upstream = await resp.json();
    } catch (e: any) {
      clearTimeout(timeout);
      const aborted = e?.name === 'AbortError';
      return NextResponse.json({ error: aborted ? 'ml_timeout' : 'ml_fetch_error' }, { status: 504 });
    }

    if (debug) {
      return NextResponse.json({
        grades,
        difficulty,
        prediction: upstream,
        debug: {
          ml_url: ML_BASE + REG_ENDPOINT,
          upstream_status: statusCode,
          latency_ms: Date.now() - started,
          provided_grades: fromBody,
          source_count: gradesSource.length
        }
      });
    }

    return NextResponse.json({
      grades,
      difficulty,
      prediction: upstream
    });
  } catch (error) {
    console.error('Predict POST error:', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
