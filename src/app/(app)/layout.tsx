import { Nav } from "@/components/nav/Nav";
import { createClient } from "@/lib/supabase/server";
import type { BadgeModule } from "@/lib/types";

async function getBadgeCounts(): Promise<Partial<Record<BadgeModule, number>>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_badge_counts");
  if (error || !data) return {};

  const counts: Partial<Record<BadgeModule, number>> = {};
  for (const row of data as { module: BadgeModule; count: number }[]) {
    counts[row.module] = row.count;
  }
  return counts;
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const badgeCounts = await getBadgeCounts();

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Nav badgeCounts={badgeCounts} />
      <main className="flex-1 overflow-y-auto pb-16 md:pb-0">{children}</main>
    </div>
  );
}
