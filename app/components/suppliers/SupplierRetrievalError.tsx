"use client";

type SupplierRetrievalErrorProps = {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  testId?: string;
};

/**
 * User-safe retrieval error for View Supplier flows.
 * Never renders technical details passed from the API.
 */
export default function SupplierRetrievalError({
  message,
  onRetry,
  retryLabel,
  testId = "supplier-retrieval-error",
}: SupplierRetrievalErrorProps) {
  return (
    <div
      className="alert alert-error"
      data-testid={testId}
      role="alert"
    >
      <p className="text-sm sm:text-base">{message}</p>
      {onRetry && retryLabel ? (
        <button
          type="button"
          onClick={onRetry}
          data-testid={`${testId}-retry`}
          className="btn btn-outline mt-3"
        >
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}
