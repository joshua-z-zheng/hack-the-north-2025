import Link from "next/link"

export function Navbar() {
  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="navbar-content">
          <div className="navbar-nav">
            <Link href="/" className="navbar-brand">
              <div className="navbar-logo">
                <span className="navbar-logo-text">M</span>
              </div>
              <span className="navbar-title">Market</span>
            </Link>
            <Link href="/" className="navbar-link">
              Home
            </Link>
          </div>

          <div className="navbar-actions">
            <Link href="/login" className="btn btn-ghost">
              Login
            </Link>
            <Link href="/signup" className="btn btn-primary">
              Sign Up
            </Link>
          </div>
        </div>
      </div>
    </nav>
  )
}