"use client";
import React, { useEffect, useState, useCallback } from 'react';

export interface RawBet {
  betId?: number | string;
  id?: number | string;
  courseCode: string;
  gradeThreshold?: number;
  threshold?: number;
  betAmount?: number;
  stakeUSD?: number;
  betAmountETH?: number;
  stakeETH?: number;
  transactionHash?: string | null;
  timestamp?: string | Date;
  createdAt?: string | Date | null;
  status?: string;
  outcome?: string;
  realizedProfitUSD?: number;
  unrealizedProfitUSD?: number;
}

interface BetsResponse { bets: RawBet[]; }

interface BetsLiveTableProps { bets?: RawBet[]; passive?: boolean; }

export default function BetsLiveTable({ bets: externalBets, passive }: BetsLiveTableProps) {
  const [bets, setBets] = useState<RawBet[]>(externalBets || []);
  const [loading, setLoading] = useState(!passive);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (passive) return;
    try {
      const res = await fetch('/api/bets', { cache: 'no-store' });
      const json: BetsResponse = await res.json();
      setBets(json.bets || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load');
    } finally { setLoading(false); }
  }, [passive]);

  useEffect(() => {
    if (passive) { setBets(externalBets || []); return; }
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load, passive, externalBets]);

  useEffect(()=>{ if(passive && externalBets) setBets(externalBets); }, [externalBets, passive]);

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Bets</h2>
        {loading && <span className="text-xs text-muted-foreground">Loading…</span>}
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr className="text-xs uppercase tracking-wide">
              <th className="px-4 py-3 font-semibold">Bet ID</th>
              <th className="px-4 py-3 font-semibold">Course</th>
              <th className="px-4 py-3 font-semibold">Grade Threshold</th>
              <th className="px-4 py-3 font-semibold">Bet Amount (USD)</th>
              <th className="px-4 py-3 font-semibold">Bet Amount (ETH)</th>
              <th className="px-4 py-3 font-semibold">Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {bets.map(b => {
              const betId = b.betId ?? b.id ?? '—';
              const gradeThreshold = b.gradeThreshold ?? b.threshold ?? '—';
              const betAmount = b.betAmount ?? b.stakeUSD ?? '—';
              const betAmountETH = b.betAmountETH ?? b.stakeETH ?? '—';
              const timestamp = b.timestamp || b.createdAt || null;
              return (
                <tr key={String(betId)} className="border-t border-border hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-2 font-medium">{String(betId)}</td>
                  <td className="px-4 py-2">{b.courseCode}</td>
                  <td className="px-4 py-2">{gradeThreshold}</td>
                  <td className="px-4 py-2">{betAmount}</td>
                  <td className="px-4 py-2">{betAmountETH}</td>
                  <td className="px-4 py-2 text-muted-foreground">{timestamp? new Date(timestamp as any).toLocaleString(): '—'}</td>
                </tr>
              );
            })}
            {!bets.length && !loading && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">No bets yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}