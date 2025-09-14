"use client";
import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import BetsLiveTable, { RawBet } from './table-client';

interface BetsResponse { bets: RawBet[]; }
function formatUSD(n: number) { return `$${n.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`; }

export default function BetsDashboardClient() {
  const [bets, setBets] = useState<RawBet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/bets', { cache: 'no-store' });
      const json: BetsResponse = await res.json();
      setBets(json.bets || []);
      setLastRefresh(new Date());
    } catch (e: any) {
      setError(e.message || 'Failed to load');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); const id=setInterval(load,15000); return ()=>clearInterval(id); }, [load]);

  // Derive metrics using the correct bet structure
  let openValue = 0, realized = 0, open = 0, settled = 0, wins = 0;
  bets.forEach(b => {
    const stake = b.betAmount || 0;
    const isResolved = b.resolved;
    const profit = b.profit || 0;
    const won = b.won;

    if (isResolved) {
      settled++;
      realized += profit;
      if (won) wins++;
    } else {
      open++;
      openValue += stake;
    }
  });
  const total=bets.length;
  const winRate = settled ? `${Math.round((wins/settled)*100)}%` : '—';

  return (
    <div className="space-y-8">
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between"><span>User Summary</span><Link href="/profile" className="text-sm text-primary hover:underline">Profile</Link></CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Open Value (Stake)</span><span className="font-semibold" data-testid="open-value">{formatUSD(openValue)}</span></div>
            <div className="flex justify-between"><span>Total Bets</span><span className="font-semibold" data-testid="total-bets">{total}</span></div>
            <div className="flex justify-between"><span>Open Bets</span><span className="font-semibold" data-testid="open-bets">{open}</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Realized P&amp;L</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Realized Profit</span><span className={(realized>=0?'text-green-500':'text-red-500')+ ' font-semibold'} data-testid="realized-profit">{formatUSD(realized)}</span></div>
            <div className="flex justify-between"><span>Settled Bets</span><span className="font-semibold" data-testid="settled-bets">{settled}</span></div>
            <div className="flex justify-between"><span>Win Rate</span><span className="font-semibold" data-testid="win-rate">{winRate}</span></div>
          </CardContent>
        </Card>
        <div className="flex flex-col justify-between text-sm p-4 border rounded-md bg-muted/20">
          <div className="flex justify-between"><span className="font-medium">Last Refresh</span><span data-testid="last-refresh">{lastRefresh? lastRefresh.toLocaleTimeString(): '—'}</span></div>
          <div className="flex justify-between"><span className="font-medium">Status</span><span data-testid="status">{loading? 'Loading' : error? 'Error' : 'Live'}</span></div>
        </div>
      </div>
      <BetsLiveTable bets={bets} passive />
    </div>
  );
}
