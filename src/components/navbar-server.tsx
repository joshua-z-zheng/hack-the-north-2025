import { cookies } from "next/headers";
import { Navbar } from "./navbar";

export default async function NavbarServer() {
  const cookieStore = await cookies();
  const idToken = cookieStore.get("id_token");
  const isLoggedIn = !!idToken;
  return <Navbar isLoggedIn={isLoggedIn} />;
}
