import { Suspense } from "react";
import ActivityHistory from "@/app/components/dashboard/ActivityHistory";

export default function ActivityHistoryRoute() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <p className="text-muted-foreground" data-testid="activity-history-auth-loading">
            …
          </p>
        </div>
      }
    >
      <ActivityHistory />
    </Suspense>
  );
}
