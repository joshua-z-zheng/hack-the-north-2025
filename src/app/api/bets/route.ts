import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import jwt from 'jsonwebtoken';
import clientPromise from '@/lib/mongodb';

interface RawBet {
  betId: number | string;
  courseCode: string;
  gradeThreshold: number;
  betAmount: number; // stored in USD (original user input)
  betAmountETH?: number;
  contractAddress?: string;
  transactionHash?: string;
  timestamp?: Date | string;
}

interface UserDoc {
  sub: string;
  courses?: Array<{ code: string; grade?: number | null; desc?: string; past?: boolean; [k: string]: any }>;
  bets?: RawBet[];
  [k: string]: any;
}

async function getSub() {
  const hdrs = await headers();
  const devHeader = hdrs.get('x-dev-sub');
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd && devHeader) return devHeader;
  const cookieStore = await cookies();
  const idToken = cookieStore.get('id_token');
  if (!idToken?.value) return undefined;
  try {
    const decoded: any = jwt.decode(idToken.value);
    return decoded?.sub;
  } catch {
    return undefined;
  }
}

function computeBetOutcome(bet: RawBet, courseGrade: number | null | undefined) {
  if (courseGrade === null || courseGrade === undefined || isNaN(courseGrade)) {
    return {
      status: 'open' as const,
      outcome: null as null,
      realizedProfitUSD: 0,
      unrealizedProfitUSD: 0
    };
  }
  const win = courseGrade >= bet.gradeThreshold;
  // Simple even-odds model: win yields +stake profit, lose yields -stake.
  const profit = win ? bet.betAmount : -bet.betAmount;
  return {
    status: 'settled' as const,
    outcome: win ? 'win' : 'lose',
    realizedProfitUSD: profit,
    unrealizedProfitUSD: 0
  };
}

export async function GET() {
  try {
    const sub = await getSub();
    if (!sub) {
      return NextResponse.json({ bets: [], aggregates: { openValueUSD: 0, realizedProfitUSD: 0, unrealizedProfitUSD: 0 }, reason: 'not_authenticated' }, { status: 200 });
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);
    const users = db.collection<UserDoc>('users');
    const user = await users.findOne({ sub });
    if (!user) {
      return NextResponse.json({ bets: [], aggregates: { openValueUSD: 0, realizedProfitUSD: 0, unrealizedProfitUSD: 0 }, reason: 'user_not_found' }, { status: 200 });
    }

    const coursesByCode = new Map<string, number | null | undefined>();
    (user.courses || []).forEach(c => {
      coursesByCode.set(c.code?.toUpperCase(), (typeof c.grade === 'number' && !isNaN(c.grade)) ? c.grade : (c.grade === 0 ? 0 : null));
    });

    const rawBets: RawBet[] = Array.isArray(user.bets) ? user.bets : [];

    let openValueUSD = 0;
    let realizedProfitUSD = 0;
    let unrealizedProfitUSD = 0; // currently zero (no pricing model yet)

    const enriched = rawBets.map(bet => {
      const courseGrade = coursesByCode.get(bet.courseCode?.toUpperCase()) ?? null;
      const outcome = computeBetOutcome(bet, courseGrade);
      if (outcome.status === 'open') {
        openValueUSD += bet.betAmount; // treat stake as current value at risk
      } else {
        realizedProfitUSD += outcome.realizedProfitUSD;
      }
      unrealizedProfitUSD += outcome.unrealizedProfitUSD;
      return {
        id: bet.betId,
        courseCode: bet.courseCode,
        threshold: bet.gradeThreshold,
        stakeUSD: bet.betAmount,
        stakeETH: bet.betAmountETH ?? null,
        contractAddress: bet.contractAddress || null,
        transactionHash: bet.transactionHash || null,
        createdAt: bet.timestamp ? new Date(bet.timestamp).toISOString() : null,
        courseGrade,
        status: outcome.status,
        outcome: outcome.outcome,
        realizedProfitUSD: outcome.realizedProfitUSD,
        unrealizedProfitUSD: outcome.unrealizedProfitUSD
      };
    });

    return NextResponse.json({
      bets: enriched.sort((a, b) => (a.createdAt && b.createdAt ? (a.createdAt < b.createdAt ? 1 : -1) : 0)),
      aggregates: { openValueUSD, realizedProfitUSD, unrealizedProfitUSD }
    });
  } catch (e) {
    console.error('GET /api/bets error', e);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const sub = await getSub();
    if (!sub) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const { courseCode, threshold, betAmount } = body || {};
    if (!courseCode || threshold === undefined || betAmount === undefined) {
      return NextResponse.json({ error: 'missing_fields', required: ['courseCode','threshold','betAmount'] }, { status: 400 });
    }
    const usdAmount = parseFloat(String(betAmount));
    if (isNaN(usdAmount) || usdAmount <= 0) {
      return NextResponse.json({ error: 'invalid_bet_amount' }, { status: 400 });
    }
    const ethAmount = usdAmount * 0.001; // simple conversion placeholder

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);
    const users = db.collection<UserDoc>('users');
    const user = await users.findOne({ sub });
    if (!user) return NextResponse.json({ error: 'user_not_found' }, { status: 404 });

    // Validate course existence
    const courseIndex = user.courses?.findIndex(c => c.code?.toUpperCase() === String(courseCode).toUpperCase());
    if (courseIndex === undefined || courseIndex === -1) {
      return NextResponse.json({ error: 'course_not_found' }, { status: 404 });
    }
    const course: any = user.courses![courseIndex];

    // Odds array optional; auto-create simple structure if missing
    if (!Array.isArray(course.odds)) course.odds = [];
    let oddsIndex = course.odds.findIndex((o: any) => o.threshold === threshold);
    if (oddsIndex === -1) {
      course.odds.push({ threshold, shares: 0 });
      oddsIndex = course.odds.length - 1;
    }

    let contractAddress = course.contract;
    // Deploy contract if missing (best-effort; ignore failure if backend unset)
    if (!contractAddress && process.env.BACKEND_SERVER_URL) {
      try {
        const deployRes = await fetch(`${process.env.BACKEND_SERVER_URL}/api/deploy-contract`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-key': process.env.ADMIN_KEY || '' },
          body: JSON.stringify({ courseCode, userId: sub })
        });
        if (deployRes.ok) {
          const deployJson = await deployRes.json();
            contractAddress = deployJson.contract?.address || deployJson.address || contractAddress;
        }
      } catch (e) {
        console.warn('Contract deploy skipped (non-fatal):', e);
      }
    }

    const betId = Date.now();
    let transactionHash: string | undefined;
    if (contractAddress && process.env.BACKEND_SERVER_URL) {
      try {
        const betRes = await fetch(`${process.env.BACKEND_SERVER_URL}/api/place-bet`, {
          method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contractAddress, gradeThreshold: threshold, betAmount: ethAmount })
        });
        if (betRes.ok) {
          const betJson = await betRes.json();
          transactionHash = betJson.transactionHash || betJson.txHash;
        }
      } catch (e) {
        console.warn('On-chain bet placement skipped (non-fatal):', e);
      }
    }

    // Persist updates
    const betsPush = {
      betId,
      courseCode: String(courseCode).toUpperCase(),
      gradeThreshold: Number(threshold),
      betAmount: usdAmount,
      betAmountETH: ethAmount,
      contractAddress: contractAddress || null,
      transactionHash: transactionHash || null,
      timestamp: new Date()
    };

    const sharesPath = `courses.${courseIndex}.odds.${oddsIndex}.shares`;
    const courseContractPath = `courses.${courseIndex}.contract`;
    const oddsPath = `courses.${courseIndex}.odds`;

    const update: any = {
      $push: { bets: betsPush },
      $inc: { [sharesPath]: 1 }
    };
    if (contractAddress) update.$set = { [courseContractPath]: contractAddress, [oddsPath]: course.odds };
    else update.$set = { [oddsPath]: course.odds };

    await users.updateOne({ sub }, update, { upsert: true });

    return NextResponse.json({
      success: true,
      data: {
        betId,
        courseCode: betsPush.courseCode,
        threshold: betsPush.gradeThreshold,
        betAmount: usdAmount,
        betAmountETH: ethAmount,
        contractAddress: betsPush.contractAddress,
        transactionHash: betsPush.transactionHash
      }
    });
  } catch (e) {
    console.error('POST /api/bets error', e);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
