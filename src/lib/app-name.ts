// Lets one codebase serve multiple family deployments (e.g. the Antebys and
// the Dwecks) with different branding, driven purely by each Vercel
// project's env vars — no code fork needed per family.
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "Family Hub";
