const cards = [
  { label: 'Stores', value: '—', detail: 'Tenant overview' },
  { label: 'Devices', value: '—', detail: 'Enrollment health' },
  { label: 'Sync queue', value: '—', detail: 'Pending operations' },
];

export default function HomePage() {
  return (
    <main className="min-h-screen p-6 md:p-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-[var(--primary)]">
              Sunha POS
            </p>
            <h1 className="mt-2 text-3xl font-semibold">Internal Admin</h1>
            <p className="mt-2 text-[var(--muted)]">
              Foundation shell · no merchant data connected
            </p>
          </div>
          <span className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-medium text-emerald-800">
            API setup pending
          </span>
        </header>
        <section className="grid gap-5 md:grid-cols-3">
          {cards.map((card) => (
            <article
              key={card.label}
              className="rounded-2xl border border-slate-200 bg-[var(--surface)] p-6 shadow-sm"
            >
              <p className="text-sm text-[var(--muted)]">{card.label}</p>
              <p className="my-4 text-4xl font-semibold">{card.value}</p>
              <p className="text-sm text-[var(--muted)]">{card.detail}</p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
