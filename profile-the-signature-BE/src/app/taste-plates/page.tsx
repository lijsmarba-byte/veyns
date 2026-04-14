import TastePlates from "@/components/taste/TastePlates";
import { mockUsers } from "@/data/mockUsers";

export default function TastePlatesPage() {
  const juna = mockUsers.find((entry) => entry.userId === 1);

  if (!juna) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-ink">Taste Plates</h1>
        <p className="mt-3 text-sm text-meta">Mock user with id=1 not found.</p>
      </main>
    );
  }

  return <TastePlates user={juna} />;
}
