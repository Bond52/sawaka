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
      className="rounded-lg border border-red-200 bg-red-50 px-4 py-4 text-sawaka-700"
      data-testid={testId}
      role="alert"
    >
      <p className="text-sm sm:text-base">{message}</p>
      {onRetry && retryLabel ? (
        <button
          type="button"
          onClick={onRetry}
          data-testid={`${testId}-retry`}
          className="mt-3 inline-flex items-center justify-center rounded-lg border border-sawaka-300 bg-white px-4 py-2 text-sm font-medium text-sawaka-800 hover:border-sawaka-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-sawaka-500 focus-visible:ring-offset-2"
        >
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}
