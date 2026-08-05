import { ListDetailClient } from "@/components/lists/ListDetailClient";

export default async function ListDetailPage({
  params,
}: {
  params: Promise<{ listId: string }>;
}) {
  const { listId } = await params;
  return <ListDetailClient listId={listId} />;
}
