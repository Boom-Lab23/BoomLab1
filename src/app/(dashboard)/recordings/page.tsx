import { redirect } from "next/navigation";

// The old "Gravacoes & IA" page was removed.
// - Knowledge base moved to /knowledge
// - Call uploads + AI analysis moved to /workspace/[clientId] > Analise de Vendas
export default function RecordingsIndexPage() {
  redirect("/knowledge");
}
