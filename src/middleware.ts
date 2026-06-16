import { auth } from "@/lib/auth";

// Protect /plans and /overview — must be logged in. Public: /, /login, /signup.
export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;
  const isProtected =
    pathname.startsWith("/plans") || pathname.startsWith("/overview");

  if (isProtected && !isLoggedIn) {
    const url = new URL("/login", req.nextUrl);
    url.searchParams.set("callbackUrl", pathname);
    return Response.redirect(url);
  }

  // Logged-in users hitting auth pages → bounce to the cross-plan overview (landing).
  if (isLoggedIn && (pathname === "/login" || pathname === "/signup")) {
    return Response.redirect(new URL("/overview", req.nextUrl));
  }
});

export const config = {
  matcher: ["/plans/:path*", "/overview/:path*", "/login", "/signup"],
};
