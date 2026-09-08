'use client';

import { useState } from 'react';

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/v1';

type Store = {
  id: string;
  businessName: string;
  suspendedAt: string | null;
  createdAt: string;
  store?: { name: string } | null;
};
type Overview = { stores: number; devices: number; pendingSync: number };

export default function HomePage() {
  const [adminToken, setAdminToken] = useState('');
  const [mfaToken, setMfaToken] = useState('');
  const [stores, setStores] = useState<Store[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${apiBase}/admin${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        'x-admin-token': adminToken,
        'x-admin-mfa': mfaToken,
        ...init?.headers,
      },
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const message =
        typeof payload === 'object' &&
        payload !== null &&
        'message' in payload &&
        typeof payload.message === 'string'
          ? payload.message
          : `HTTP ${response.status}`;
      throw new Error(message);
    }
    return payload as T;
  }

  async function load() {
    setLoading(true);
    setMessage('');
    try {
      const [summary, list] = await Promise.all([
        request<Overview>('/overview'),
        request<Store[]>('/stores'),
      ]);
      setOverview(summary);
      setStores(list);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'ບໍ່ສາມາດໂຫຼດ Admin');
    } finally {
      setLoading(false);
    }
  }

  async function suspend(tenantId: string) {
    const reason = window.prompt('ເຫດຜົນການ suspend');
    if (!reason?.trim()) return;
    try {
      await request(`/stores/${tenantId}/suspend`, {
        method: 'PATCH',
        body: JSON.stringify({ reason }),
      });
      setMessage('Suspend store ສຳເລັດ ແລະບັນທຶກ audit ແລ້ວ');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Suspend ບໍ່ສຳເລັດ');
    }
  }

  return (
    <main className="min-h-screen p-6 md:p-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-[var(--primary)]">
            Sunha POS
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Internal Admin</h1>
          <p className="mt-2 text-[var(--muted)]">ระบบดูแลภายใน · ไม่สามารถแก้ไขใบเสร็จได้</p>
        </header>
        <section className="mb-8 rounded-2xl border border-slate-200 bg-[var(--surface)] p-5 shadow-sm">
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <input
              type="password"
              placeholder="Admin token"
              value={adminToken}
              onChange={(event) => setAdminToken(event.target.value)}
              className="rounded-xl border border-slate-200 p-3"
            />
            <input
              type="password"
              placeholder="MFA token"
              value={mfaToken}
              onChange={(event) => setMfaToken(event.target.value)}
              className="rounded-xl border border-slate-200 p-3"
            />
            <button
              onClick={() => void load()}
              disabled={loading || !adminToken || !mfaToken}
              className="rounded-xl bg-[var(--primary)] px-5 py-3 font-semibold text-white disabled:opacity-50"
            >
              {loading ? 'ກຳລັງໂຫຼດ…' : 'ເຂົ້າລະບົບ'}
            </button>
          </div>
          {message ? <p className="mt-3 text-sm text-rose-700">{message}</p> : null}
        </section>
        <section className="mb-8 grid gap-5 md:grid-cols-3">
          {[
            ['Stores', overview?.stores ?? '—'],
            ['Devices', overview?.devices ?? '—'],
            ['Sync queue', overview?.pendingSync ?? '—'],
          ].map(([label, value]) => (
            <article
              key={label}
              className="rounded-2xl border border-slate-200 bg-[var(--surface)] p-6 shadow-sm"
            >
              <p className="text-sm text-[var(--muted)]">{label}</p>
              <p className="my-4 text-4xl font-semibold">{value}</p>
              <p className="text-sm text-[var(--muted)]">Operational overview</p>
            </article>
          ))}
        </section>
        <section className="rounded-2xl border border-slate-200 bg-[var(--surface)] p-5 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold">Stores</h2>
          {stores.length ? (
            <div className="space-y-3">
              {stores.map((store) => (
                <div
                  key={store.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-4"
                >
                  <div>
                    <p className="font-semibold">{store.store?.name ?? store.businessName}</p>
                    <p className="text-sm text-[var(--muted)]">
                      {store.id} · {store.suspendedAt ? 'SUSPENDED' : 'ACTIVE'}
                    </p>
                  </div>
                  {!store.suspendedAt ? (
                    <button
                      onClick={() => void suspend(store.id)}
                      className="rounded-lg border border-rose-200 px-3 py-2 text-sm text-rose-700"
                    >
                      Suspend
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[var(--muted)]">ເຂົ້າລະບົບເພື່ອເບິ່ງຮ້ານ</p>
          )}
        </section>
      </div>
    </main>
  );
}
