import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Routes that anyone can hit without signing in:
//   - Landing and marketing pages
//   - Sign-in / sign-up flows
//   - Public demo dashboard (read-only NovaPay view)
//   - Public attestation page (live system snapshot)
//   - Inbound webhook endpoints and health checks
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/demo(.*)",
  "/attestation",
  "/api/webhooks(.*)",
  "/api/health",
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
