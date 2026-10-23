import type { ReactNode } from "react";

/**
 * Shared white header band used by public content pages.
 * Matches the Supplier Directory: bg-card, wrap, py-8 lg:py-12, bottom border.
 */
export default function PublicPageHeader({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div
      className="border-b border-border bg-card"
      data-testid="public-page-header"
    >
      <div className="wrap py-8 lg:py-12">{children}</div>
    </div>
  );
}
