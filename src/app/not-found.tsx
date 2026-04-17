import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card mx-auto flex max-w-lg flex-col items-center gap-6 px-8 py-16 text-center">
      <h1 className="text-2xl font-bold text-foreground">Page not found</h1>
      <p className="text-muted">
        We couldn&apos;t find the page you&apos;re looking for. It may have been moved or removed.
      </p>
      <Link href="/" className="btn-primary">
        Back to home
      </Link>
    </div>
  );
}
