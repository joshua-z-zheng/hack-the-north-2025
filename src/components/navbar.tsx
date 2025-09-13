import Link from "next/link";

export function Navbar({ isLoggedIn = false }: { isLoggedIn?: boolean }) {
  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="navbar-content">
          <div className="navbar-nav">
            <Link href="/" className="navbar-brand">
              <div className="navbar-logo">
                <span className="navbar-logo-text">📚</span>
              </div>
              <span className="navbar-title">ScholarMarket</span>
            </Link>
            <Link href="/" className="navbar-link">
              Home
            </Link>
            <Link href="/" className="navbar-link">
              Courses
            </Link>
          </div>

          <div className="navbar-actions">
            {!isLoggedIn && (
              <Link href="/login" className="btn btn-primary">
                Login
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
