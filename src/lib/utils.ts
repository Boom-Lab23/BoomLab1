import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const PILLARS = [
  { id: "gestao-comercial", label: "Gestao Comercial", color: "#9333ea", icon: "BarChart3" },
  { id: "consultoria-comercial", label: "Consultoria Comercial", color: "#16a34a", icon: "Users" },
  { id: "parcerias", label: "Parcerias", color: "#ea580c", icon: "Handshake" },
  { id: "ads-funnel", label: "Ads Funnel", color: "#2563eb", icon: "Megaphone" },
  { id: "cold-calls", label: "Cold Calls", color: "#ca8a04", icon: "Phone" },
  { id: "linkedin-outreach", label: "LinkedIn Outreach", color: "#ec4899", icon: "Linkedin" },
  { id: "acompanhamento", label: "Acompanhamento Semanal", color: "#6b7280", icon: "CalendarCheck" },
  { id: "boom-club", label: "BoomClub", color: "#0891b2", icon: "Rocket" },
] as const;

export type PillarId = (typeof PILLARS)[number]["id"];

export function getPillarFromModule(module: string): (typeof PILLARS)[number] | undefined {
  const normalized = module.toLowerCase();
  if (normalized.includes("gestão comercial") || normalized.includes("gestao comercial")) {
    return PILLARS.find((p) => p.id === "gestao-comercial");
  }
  if (normalized.includes("dep. comercial") || normalized.includes("consultoria comercial")) {
    return PILLARS.find((p) => p.id === "consultoria-comercial");
  }
  if (normalized.includes("parcerias")) return PILLARS.find((p) => p.id === "parcerias");
  if (normalized.includes("ads funnel")) return PILLARS.find((p) => p.id === "ads-funnel");
  if (normalized.includes("cold call")) return PILLARS.find((p) => p.id === "cold-calls");
  if (normalized.includes("linkedin")) return PILLARS.find((p) => p.id === "linkedin-outreach");
  if (normalized.includes("acompanhamento")) return PILLARS.find((p) => p.id === "acompanhamento");
  if (normalized.includes("boom")) return PILLARS.find((p) => p.id === "boom-club");
  return undefined;
}

export function formatStatus(status: string): string {
  return status
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getStatusColor(status: string): string {
  const s = status.toUpperCase();
  if (s === "ATIVO" || s === "CONCLUIDA") return "bg-green-100 text-green-800";
  if (s === "PRE_ARRANQUE" || s === "LEVANTAMENTO" || s === "MARCADA") return "bg-blue-100 text-blue-800";
  if (s === "INATIVO" || s === "FALTOU" || s === "CANCELADA") return "bg-red-100 text-red-800";
  if (s === "REAGENDADA" || s === "AGUARDAR_CONFIRMACAO") return "bg-orange-100 text-orange-800";
  if (s === "PROJETO_FINALIZADO" || s === "COBRADO") return "bg-gray-100 text-gray-800";
  return "bg-gray-100 text-gray-600";
}
