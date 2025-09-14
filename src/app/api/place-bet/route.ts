// DEPRECATED: Use /api/bets (GET/POST). This route retained temporarily for backward compatibility.
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    error: 'deprecated',
    message: 'Use POST /api/bets instead of /api/place-bet.'
  }, { status: 410 });
}
