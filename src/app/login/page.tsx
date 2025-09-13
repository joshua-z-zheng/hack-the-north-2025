import { Navbar } from "@/components/navbar"
import "./login.css"

export default function LoginPage() {
  return (
    <div className="main-content">
      <Navbar />

      <main className="page-container">
        <div className="page-header">
          <h1 className="page-title">Login</h1>
        </div>

        <div className="login-wrapper">
          <div className="login-panel">
            <h2>Welcome Back</h2>
            <div className="auth-buttons">
              <a href="/api/auth/login" className="auth-button login-button">
                Login with Email
              </a>
              <a href="/api/auth/login" className="auth-button signup-button">
                Sign Up with Email
              </a>
            </div>
            <p className="auth-note">
              You'll receive a verification code via email to complete the process.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
