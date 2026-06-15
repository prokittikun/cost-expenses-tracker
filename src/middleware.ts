import { auth } from "@/lib/auth";

// Protect everything under /plans — must be logged in. Public: /, /login, /signup.
export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;
  const isProtected = pathname.startsWith("/plans");

  if (isProtected && !isLoggedIn) {
    const url = new URL("/login", req.nextUrl);
    url.searchParams.set("callbackUrl", pathname);
    return Response.redirect(url);
  }

  // Logged-in users hitting auth pages → bounce to /plans
  if (isLoggedIn && (pathname === "/login" || pathname === "/signup")) {
    return Response.redirect(new URL("/plans", req.nextUrl));
  }
});

export const config = {
  matcher: ["/plans/:path*", "/login", "/signup"],
};
