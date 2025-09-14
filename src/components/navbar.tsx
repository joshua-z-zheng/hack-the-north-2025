import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function Navbar({
  isLoggedIn = false,
  userEmail = null,
  onLogout
}: {
  isLoggedIn?: boolean;
  userEmail?: string | null;
  onLogout?: () => void;
}) {
  const getDisplayEmail = (email: string | null) => {
    if (!email) return '';
    const atIndex = email.indexOf('@');
    return atIndex > 0 ? email.substring(0, atIndex) : email;
  };

  return (
    <nav className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-8">
            <Link href="/" className="flex items-center space-x-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary text-primary-foreground">
                <span className="text-lg">📚</span>
              </div>
              <span className="font-bold text-lg text-foreground">ScholarMarket</span>
            </Link>
            <div className="hidden md:flex items-center space-x-6">
              <Link
                href="/"
                className="text-base font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Home
              </Link>
              <Link
                href="/bets"
                className="text-base font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Bets
              </Link>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {!isLoggedIn ? (
              <Button asChild>
                <Link href="/login">
                  Login
                </Link>
              </Button>
            ) : (
              <div className="flex items-center space-x-3">
                <span className="text-base font-medium text-foreground">
                  {getDisplayEmail(userEmail)}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onLogout}
                  className="p-2 hover:bg-muted"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
