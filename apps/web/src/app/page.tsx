export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-20">
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-hrih-gold">
        HRIH Investments
      </p>
      <h1 className="mt-5 text-4xl font-semibold tracking-tight text-white sm:text-6xl">
        Platform services
      </h1>
      <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
        Secure CRM, product-ingestion and operational APIs. Internal endpoints require
        server-side authentication and distributed rate limiting.
      </p>
      <div className="mt-10 inline-flex w-fit rounded-lg border border-hrih-border bg-hrih-surface px-4 py-3 text-sm text-slate-300">
        Service status: operational
      </div>
    </main>
  )
}
