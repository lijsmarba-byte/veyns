import TasteMapViz from "@/components/taste/TasteMapViz";
import { mockUsers } from "@/data/mockUsers";

export default function TasteMapPage() {
  const user = mockUsers.find((entry) => entry.userId === 1);

  if (!user) {
    return <main className="min-h-screen bg-[#FEFEFD]" />;
  }

  return (
    <TasteMapViz
      clusters={user.tasteAttributes.clusters}
      styleDescription={user.tasteDescription.tasteThesis}
    />
  );
}
