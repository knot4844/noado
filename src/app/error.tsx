'use client';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-red-50 text-red-900 break-all text-sm whitespace-pre-wrap">
            <div>
                <h2 className="font-bold text-lg mb-2">Something went wrong!</h2>
                <p className="font-bold">{error.name}: {error.message}</p>
                <p className="mt-4 opacity-80">{error.stack}</p>
                <button
                    onClick={() => reset()}
                    className="mt-6 px-4 py-2 bg-red-600 text-white rounded"
                >
                    Try again
                </button>
            </div>
        </div>
    );
}
