export const brazilTimeZone = "America/Sao_Paulo";

export const phaseLabels = {
  group: "Fase de grupos",
  round_of_32: "16 avos de final",
  round_of_16: "Oitavas",
  quarter_final: "Quartas",
  semi_final: "Semifinais",
  third_place: "Disputa de 3º lugar",
  final: "Final",
} as const;

export const statusLabels = {
  scheduled: "Agendado",
  live: "Ao vivo",
  paused: "Intervalo",
  finished: "Encerrado",
  postponed: "Adiado",
  cancelled: "Cancelado",
} as const;

export function formatBrazilDate(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "full",
    timeZone: brazilTimeZone,
  }).format(value);
}

export function formatBrazilTime(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: brazilTimeZone,
  }).format(value);
}

export function getBrazilDateKey(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: brazilTimeZone,
    year: "numeric",
  }).format(value);
}
