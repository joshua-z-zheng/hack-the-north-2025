import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import jwt from 'jsonwebtoken';
import clientPromise from '@/lib/mongodb';

interface RawBet {
  betId: number;
  courseCode: string;
  gradeThreshold: number;
  betAmount: number;
  betAmountETH: number;
  contractAddress: string;
  transactionHash: string;
  resolved: boolean;
  timestamp: { $date: string } | string | Date;
  profit: number;
  won: boolean;
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

export async function GET() {
  try {
    const sub = await getSub();
    if (!sub) {
      return NextResponse.json({ bets: [] }, { status: 200 });
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);
    const users = db.collection<UserDoc>('users');
    const user = await users.findOne({ sub });

    if (!user) {
      return NextResponse.json({ bets: [] }, { status: 200 });
    }

    const coursesByCode = new Map<string, number | null | undefined>();
    (user.courses || []).forEach(c => {
      coursesByCode.set(c.code?.toUpperCase(), (typeof c.grade === 'number' && !isNaN(c.grade)) ? c.grade : (c.grade === 0 ? 0 : null));
    });

    const rawBets: RawBet[] = Array.isArray(user.bets) ? user.bets : [];

    // Update bets with resolved status and profit based on course grades
    const updatedBets = rawBets.map(bet => {
      const courseGrade = coursesByCode.get(bet.courseCode?.toUpperCase()) ?? null;

      if (courseGrade === null || courseGrade === undefined || isNaN(courseGrade)) {
        // Bet is still open
        return {
          ...bet,
          resolved: false,
          profit: 0,
          won: false
        };
      } else {
        // Bet is resolved
        const won = courseGrade >= bet.gradeThreshold;
        const profit = won ? bet.betAmount : -bet.betAmount; // Simple even-odds model

        return {
          ...bet,
          resolved: true,
          profit,
          won
        };
      }
    });

    return NextResponse.json({
      bets: updatedBets.sort((a, b) => {
        const aTime = a.timestamp && typeof a.timestamp === 'object' && '$date' in a.timestamp
          ? new Date(a.timestamp.$date).getTime()
          : new Date(a.timestamp as string | Date).getTime();
        const bTime = b.timestamp && typeof b.timestamp === 'object' && '$date' in b.timestamp
          ? new Date(b.timestamp.$date).getTime()
          : new Date(b.timestamp as string | Date).getTime();
        return bTime - aTime; // Most recent first
      })
    });
  } catch (e) {
    console.error('GET /api/bets error', e);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
