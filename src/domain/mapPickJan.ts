export type JanMaster = Record<string, string | undefined>;

export function mapPickJan(eachJan: string, master: JanMaster): string {
  const mapped = master[eachJan];
  return mapped ?? eachJan;
}
