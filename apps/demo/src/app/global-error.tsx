"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#030712", fontFamily: "Inter, system-ui, sans-serif" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            color: "#fff",
            textAlign: "center",
            padding: "0 1rem",
          }}
        >
          <p style={{ fontSize: 14, color: "#f87171", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Critical error
          </p>
          <h1 style={{ fontSize: 36, fontWeight: 700, marginTop: 12 }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: 18, color: "#9ca3af", marginTop: 16 }}>
            An unexpected error occurred.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 32,
              padding: "10px 20px",
              background: "#173cff",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
