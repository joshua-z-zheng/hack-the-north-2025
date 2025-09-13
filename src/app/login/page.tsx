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
            <form>
              <label>
                Email
                <input type="email" />
              </label>
              <label>
                Password
                <input type="password" />
              </label>
              <button type="submit">Login</button>
            </form>
          </div>
        </div>
      </main>
    </div>
  )
}