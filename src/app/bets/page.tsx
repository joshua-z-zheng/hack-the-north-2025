import { getAuthState } from "@/lib/user-data";
import BetsDashboardClient from './dashboard-client';

function formatUSD(v: number) { return `$${v.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`; }

export default async function BetsDashboardPage() {
  const loggedIn = await getAuthState();
  if (!loggedIn) {
    return (
      <div className="min-h-screen bg-background">
        <main className="container mx-auto px-4 py-8 md:px-6 lg:px-8">
          <h1 className="text-3xl font-bold mb-4">Bets</h1>
          <p className="text-muted-foreground">Please log in to view your bets.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8 md:px-6 lg:px-8 space-y-8">
        <BetsDashboardClient />
      </main>
    </div>
  );
}

// Client dashboard handles dynamic data.

