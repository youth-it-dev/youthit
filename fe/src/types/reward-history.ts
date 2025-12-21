export type HistoryType = "earn" | "use" | "expire";

export type HistoryItem = {
  id: string;
  title: string;
  amount: number;
  type: HistoryType;
  label: string;
  description?: string;
};

export type HistorySection = {
  date: string;
  items: HistoryItem[];
};
