import { useState, type ReactNode } from "react";
import { Anchor, Package, RefreshCw, Ship, Sparkles } from "lucide-react";
import { items, vendors, vessels } from "@/lib/p2p/seed";
import { itemById, locById, scoreVendors, shortlist, vesselById } from "@/lib/p2p/engine";
import { narrateStep } from "@/lib/p2p/narrate";
import { useP2p } from "@/lib/p2p/store";
import type { Priority, Provider } from "@/lib/p2p/types";

const providers: { id: Provider; label: string }[] = [
  { id: "rules", label: "Rules" },
  { id: "qwen", label: "Qwen" },
  { id: "glm", label: "GLM" },
];

export function Console() {
  const s = useP2p();
  const req = s.reqs.find((r) => r.id === s.selectedId) ?? null;
  const last = req?.events.at(-1);
  const [manual, setManual] = useState({ vesselId: "star", itemId: "seal", qty: 20, priority: "A" as Priority });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  async function narrate() {
    if (!req || !last) return;
    setBusy(true);
    setNote("");
    const facts = [
      last.recommendation,
      ...last.reasoning,
      ...last.exceptions.map((e) => `Exception: ${e}`),
      `Vessel ${vesselById(req.vesselId).name}, IMPA ${itemById(req.itemId).impa}, port ${req.deliveryPort}.`,
    ].join("\n");
    const out = await narrateStep({ data: { step: last.step, facts } });
    setBusy(false);
    if (!out.ok) {
      setNote(out.error);
      return;
    }
    s.attachGrok(req.id, last.step, out.text);
  }

  return (
    <div className="min-h-screen bg-bg text-fg">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-brass text-brass-ink">
              <Anchor className="size-5" aria-hidden />
            </span>
            <div>
              <p className="font-display text-2xl leading-none tracking-tight">ProVes P2P</p>
              <p className="text-sm text-muted">Vessel procure-to-pay · ProShip and ProShore</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {providers.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => s.setProvider(p.id)}
                className={
                  "min-h-11 rounded-full border px-4 text-sm font-semibold " +
                  (s.provider === p.id
                    ? "border-brass bg-brass text-brass-ink"
                    : "border-line bg-raised text-fg")
                }
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => s.reset()}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-raised px-4 text-sm"
            >
              <RefreshCw className="size-4" aria-hidden />
              Reset demo
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-4 px-4 py-4 lg:grid-cols-[18rem_minmax(0,1fr)_20rem]">
        <nav className="flex gap-2 lg:hidden">
          {(
            [
              ["stock", "Stock"],
              ["flow", "Flow"],
              ["agent", "Agent"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => s.setPanel(id)}
              className={
                "min-h-11 flex-1 rounded-full border text-sm font-semibold " +
                (s.panel === id ? "border-brass bg-brass text-brass-ink" : "border-line bg-surface")
              }
            >
              {label}
            </button>
          ))}
        </nav>

        <section className={s.panel === "stock" ? "space-y-4" : "hidden space-y-4 lg:block"}>
          <Panel title="Remaining on board">
            {s.stock.map((row) => {
              const item = itemById(row.itemId);
              const loc = locById(row.locationId);
              const low = row.min > 0 && row.qty < row.min;
              return (
                <div key={row.itemId + row.locationId} className="flex items-start justify-between gap-3 border-b border-line py-3 last:border-0">
                  <div>
                    <p className="font-semibold">{item.name}</p>
                    <p className="text-sm text-muted">{loc.name}</p>
                  </div>
                  <p className={"text-right text-sm " + (low ? "font-semibold text-brass" : "text-muted")}>
                    {row.qty}
                    <span className="block">min {row.min}</span>
                  </p>
                </div>
              );
            })}
            <button type="button" onClick={() => s.scan()} className="mt-3 min-h-11 w-full rounded-xl bg-brass font-semibold text-brass-ink">
              Scan minimums
            </button>
          </Panel>

          <Panel title="Manual requisition">
            <Label>Vessel</Label>
            <Select value={manual.vesselId} onChange={(v) => setManual({ ...manual, vesselId: v })}>
              {vessels.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </Select>
            <Label>Item</Label>
            <Select value={manual.itemId} onChange={(v) => setManual({ ...manual, itemId: v })}>
              {items.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.impa} · {it.name}
                </option>
              ))}
            </Select>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Quantity</Label>
                <input
                  className="field"
                  type="number"
                  min={1}
                  value={manual.qty}
                  onChange={(e) => setManual({ ...manual, qty: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Priority</Label>
                <Select value={manual.priority} onChange={(v) => setManual({ ...manual, priority: v as Priority })}>
                  <option value="A">A · Breakdown</option>
                  <option value="B">B · Urgent</option>
                  <option value="C">C · Routine</option>
                </Select>
              </div>
            </div>
            <button
              type="button"
              onClick={() => s.raiseManual(manual)}
              className="min-h-11 w-full rounded-xl border border-line bg-raised font-semibold"
            >
              Raise from the vessel
            </button>
          </Panel>
        </section>

        <section className={s.panel === "flow" ? "space-y-4" : "hidden space-y-4 lg:block"}>
          <Panel title="Requisitions">
            {!s.reqs.length && <p className="text-sm text-muted">Scan minimums or raise a crew request. Adele Star’s filter is already below minimum.</p>}
            <ul className="space-y-2">
              {s.reqs.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => s.select(r.id)}
                    className={
                      "w-full rounded-xl border px-3 py-3 text-left " +
                      (r.id === req?.id ? "border-brass bg-raised" : "border-line bg-bg")
                    }
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{r.number}</span>
                      <span className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">
                        {r.priority} · {r.source}
                      </span>
                    </span>
                    <span className="mt-1 block text-sm text-muted">
                      {vesselById(r.vesselId).name} · {itemById(r.itemId).name}
                    </span>
                    <span className="block text-sm text-brass">{r.status}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>

          {req && (
            <Panel title={`${req.number} · ${req.deliveryPort}`}>
              <p className="mb-3 flex items-center gap-2 text-sm text-muted">
                <Ship className="size-4 text-brass" aria-hidden />
                {vesselById(req.vesselId).name} · IMPA {itemById(req.itemId).impa}
                {itemById(req.itemId).critical ? " · critical spare" : ""}
              </p>
              <div className="flex flex-wrap gap-2">
                <Step onClick={() => s.validate(req.id)}>Validate</Step>
                <Step onClick={() => s.setQty(req.id)}>Quantity</Step>
                <Step onClick={() => s.source(req.id)}>Shortlist</Step>
                <Step onClick={() => s.rfq(req.id)}>Simulate RFQ</Step>
              </div>

              {req.quotes.length > 0 && (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-muted">
                      <tr>
                        <th className="py-2 font-medium">Vendor</th>
                        <th className="py-2 font-medium">Price</th>
                        <th className="py-2 font-medium">Lead</th>
                        <th className="py-2 font-medium" />
                      </tr>
                    </thead>
                    <tbody>
                      {req.quotes.map((q) => {
                        const v = vendors.find((x) => x.id === q.vendorId)!;
                        return (
                          <tr key={q.vendorId} className="border-t border-line">
                            <td className="py-2">
                              {v.code}
                              <span className="block text-xs text-muted">{q.notes}</span>
                            </td>
                            <td>{q.unitPrice}</td>
                            <td>{q.leadDays}d</td>
                            <td className="py-2 text-right">
                              {q.compliant && (
                                <button type="button" className="min-h-11 rounded-lg border border-line px-3" onClick={() => s.award(req.id, q.vendorId)}>
                                  Draft PO
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {req.po && (
                <div className="mt-4 space-y-3 rounded-xl border border-line bg-bg p-3">
                  <p className="text-sm">
                    <span className="font-semibold">{req.po.number}</span>
                    <span className="text-muted">
                      {" "}
                      · {vendors.find((v) => v.id === req.po!.vendorId)?.name} · {req.po.qty} @ {req.po.unitPrice} {req.po.incoterm}{" "}
                      {req.po.deliveryPort}
                    </span>
                  </p>
                  <p className="text-sm text-muted">
                    Buyer {req.po.buyerApproved ? "signed" : "pending"}
                    {itemById(req.itemId).critical ? ` · Superintendent ${req.po.techApproved ? "signed" : "pending"}` : ""}
                    {" · "}
                    {req.po.status}
                    {req.shipment ? ` · ${req.shipment.milestone} (${req.shipment.status})` : ""}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Step onClick={() => s.approveBuyer(req.id)}>Buyer approves</Step>
                    {itemById(req.itemId).critical && <Step onClick={() => s.approveTech(req.id)}>Superintendent signs</Step>}
                    <Step onClick={() => s.advance(req.id)}>Advance inbound</Step>
                    <Step onClick={() => s.receive(req.id, "full")}>Full receipt</Step>
                    <Step onClick={() => s.receive(req.id, "short")}>Short / damaged</Step>
                    <Step onClick={() => s.invoice(req.id)}>Match invoice</Step>
                    <button
                      type="button"
                      disabled={!req.invoice?.matched}
                      onClick={() => s.closeFinance(req.id)}
                      className="min-h-11 rounded-lg bg-brass px-3 font-semibold text-brass-ink"
                    >
                      Finance closes
                    </button>
                  </div>
                  {req.grn && <p className="text-sm text-muted">{req.grn.number}: {req.grn.discrepancy || "clean receipt"}</p>}
                  {req.invoice && (
                    <p className="text-sm text-muted">
                      {req.invoice.number} · {req.invoice.status}
                      {req.invoice.notes ? ` · ${req.invoice.notes}` : ""}
                    </p>
                  )}
                </div>
              )}

              {!req.quotes.length && req.status !== "DRAFT" && (
                <p className="mt-3 text-sm text-muted">
                  Eligible now: {shortlist(req).map((v) => v.code).join(", ") || "none"}. Unapproved vendors stay off the panel (
                  {scoreVendors(req)
                    .filter((v) => !v.ismApproved)
                    .map((v) => v.code)
                    .join(", ")}
                  ).
                </p>
              )}
            </Panel>
          )}
        </section>

        <aside className={s.panel === "agent" ? "space-y-4" : "hidden space-y-4 lg:block"}>
          <Panel title="Agent reasoning">
            <p className="text-sm text-muted">
              Decisions come from the procurement rules: ISM list, port ETA, equipment fit, and stock math. Qwen and GLM are the intended
              production narrators. This preview does not call them. Optional commentary below is Grok, labeled as Grok.
            </p>
            {s.provider !== "rules" && (
              <p className="mt-2 rounded-lg border border-line bg-bg px-3 py-2 text-sm">
                {s.provider === "qwen" ? "Qwen (Alibaba, qwen-plus)" : "GLM (Z.ai, glm-4.6)"} is selected as the label on new events. No
                key is configured here, so the recommendation stays with the rules engine.
              </p>
            )}
            {last ? (
              <div className="mt-3 space-y-2">
                <p className="text-sm text-muted">
                  {last.step} · {last.provider}
                </p>
                <p className="font-semibold">{last.recommendation}</p>
                <ul className="space-y-1 text-sm text-muted">
                  {last.reasoning.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                {last.exceptions.length > 0 && (
                  <ul className="space-y-1 text-sm text-brass">
                    {last.exceptions.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                )}
                {last.grok && <p className="rounded-lg border border-line bg-bg p-3 text-sm">{last.grok}</p>}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void narrate()}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line px-3 text-sm font-semibold"
                >
                  <Sparkles className="size-4 text-brass" aria-hidden />
                  {busy ? "Writing…" : "Ask Grok to narrate"}
                </button>
                {note && <p className="text-sm text-brass">{note}</p>}
              </div>
            ) : (
              <p className="mt-3 flex items-center gap-2 text-sm text-muted">
                <Package className="size-4" aria-hidden />
                Validate a requisition to see the reasoning.
              </p>
            )}
          </Panel>
          <Panel title="Audit">
            {!s.audit.length && <p className="text-sm text-muted">Approvals and receipts land here.</p>}
            <ul className="space-y-2">
              {s.audit.slice(0, 8).map((a, i) => (
                <li key={a.action + a.detail + i} className="text-sm">
                  <span className="font-semibold">{a.actor}</span>
                  <span className="text-muted"> · {a.action}</span>
                  <span className="block text-muted">{a.detail}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </aside>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="mb-2 text-xs font-semibold tracking-widest text-muted uppercase">{title}</h2>
      {children}
    </section>
  );
}

function Step({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="min-h-11 rounded-lg border border-line bg-raised px-3 text-sm font-semibold">
      {children}
    </button>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <span className="mb-1 block text-xs text-muted">{children}</span>;
}

function Select({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
}) {
  return (
    <select className="field mb-2" value={value} onChange={(e) => onChange(e.target.value)}>
      {children}
    </select>
  );
}
