import { loadWorkspace } from "@/lib/data";
import { SearchClient } from "./search-client";

export default async function SearchPage() {
  const { ws } = await loadWorkspace();
  return <SearchClient candidates={ws.candidates} />;
}
