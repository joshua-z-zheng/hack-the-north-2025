import Link from "next/link";
import { Button } from "@/components/ui/button";

export function Navbar({ isLoggedIn = false }: { isLoggedIn?: boolean }) {
  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
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
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Home
              </Link>
              <Link
                href="/"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Courses
              </Link>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {!isLoggedIn && (
              <Button asChild>
                <Link href="/login">
                  Login
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
