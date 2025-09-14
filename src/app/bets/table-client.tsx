"use client";
import React, { useEffect, useState, useCallback } from 'react';

export interface RawBet {
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
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Profit (USD)</th>
              <th className="px-4 py-3 font-semibold">Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {bets.map(b => {
              let timestamp: Date | null = null;
              if (b.timestamp) {
                if (typeof b.timestamp === 'object' && '$date' in b.timestamp) {
                  timestamp = new Date(b.timestamp.$date);
                } else {
                  timestamp = new Date(b.timestamp as string | Date);
                }
              }

              const statusText = b.resolved ? (b.won ? 'Won' : 'Lost') : 'Open';
              const statusColor = b.resolved ? (b.won ? 'text-green-600' : 'text-red-600') : 'text-blue-600';
              const profitColor = b.profit >= 0 ? 'text-green-600' : 'text-red-600';

              return (
                <tr key={b.betId} className="border-t border-border hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-2 font-medium">{b.betId}</td>
                  <td className="px-4 py-2">{b.courseCode}</td>
                  <td className="px-4 py-2">{b.gradeThreshold}%</td>
                  <td className="px-4 py-2">${b.betAmount.toFixed(2)}</td>
                  <td className="px-4 py-2">{b.betAmountETH.toFixed(6)} ETH</td>
                  <td className={`px-4 py-2 font-medium ${statusColor}`}>{statusText}</td>
                  <td className={`px-4 py-2 font-medium ${profitColor}`}>
                    {b.resolved ? `$${b.profit.toFixed(2)}` : '—'}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {timestamp ? timestamp.toLocaleString() : '—'}
                  </td>
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
