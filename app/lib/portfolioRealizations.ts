export type RealizationStatus = "draft" | "published";

export type PortfolioRealization = {
  id: string;
  title: string;
  status: RealizationStatus;
  categoryLabel: string;
  domainId: string | null;
  completedAt: string | null;
  imageCount: number;
  coverUrl: string | null;
};

export type OwnerPortfolio =
  | { available: false }
  | { available: true; items: PortfolioRealization[] };

export type PortfolioQuery = {
  query: string;
  status: "" | RealizationStatus;
  domainId: string;
};

/**
 * Owner portfolio list.
 * Sawaka has no Realization model yet. This does not read Product inventory.
 * A later Task can replace the body once a Realization service exists.
 */
export async function loadOwnerPortfolio(): Promise<OwnerPortfolio> {
  return { available: false };
}

export function filterPortfolioRealizations(
  items: PortfolioRealization[],
  criteria: PortfolioQuery
): PortfolioRealization[] {
  const query = criteria.query.trim().toLocaleLowerCase();
  return items.filter((item) => {
    if (criteria.status && item.status !== criteria.status) return false;
    if (criteria.domainId && item.domainId !== criteria.domainId) return false;
    if (!query) return true;
    return `${item.title} ${item.categoryLabel}`.toLocaleLowerCase().includes(query);
  });
}
