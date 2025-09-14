"use client"
import { Navbar } from "./navbar";
import { useAuth } from "@/contexts/auth-context";

export default function NavbarClient() {
  const { isLoggedIn, userEmail, logout } = useAuth();
  return <Navbar isLoggedIn={isLoggedIn} userEmail={userEmail} onLogout={logout} />;
}
