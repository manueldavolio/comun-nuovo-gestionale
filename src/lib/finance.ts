export const FINANCE_CATEGORY_VALUES = [
  "iscrizioni",
  "sponsor",
  "staff",
  "tornei",
  "materiale",
  "bar",
  "altro",
] as const;

export type FinanceCategory = (typeof FINANCE_CATEGORY_VALUES)[number];

export const FINANCE_CATEGORY_LABEL: Record<FinanceCategory, string> = {
  iscrizioni: "Iscrizioni",
  sponsor: "Sponsor",
  staff: "Staff",
  tornei: "Tornei",
  materiale: "Materiale",
  bar: "Bar",
  altro: "Altro",
};

export const euroFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
