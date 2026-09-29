import { create } from "zustand";
import { persist } from "zustand/middleware";
import { initialStock, items, locations, vendors } from "./seed";
import {
  MILESTONES,
  itemById,
  locById,
  matchInvoice,
  matchReceipt,
  recommendQty,
  shortlist,
  stockAt,
  validateFacts,
  vesselById,
} from "./engine";
import type { Audit, Milestone, Priority, Provider, Requisition, StockRow } from "./types";

type State = {
  stock: StockRow[];
  reqs: Requisition[];
  audit: Audit[];
  seq: number;
  selectedId: string | null;
  provider: Provider;
  panel: "stock" | "flow" | "agent";
  reset: () => void;
  setProvider: (p: Provider) => void;
  setPanel: (p: State["panel"]) => void;
  select: (id: string | null) => void;
  scan: () => void;
  raiseManual: (input: { vesselId: string; itemId: string; qty: number; priority: Priority }) => void;
  validate: (id: string) => void;
  setQty: (id: string) => void;
  source: (id: string) => void;
  rfq: (id: string) => void;
  award: (id: string, vendorId: string) => void;
  approveBuyer: (id: string) => void;
  approveTech: (id: string) => void;
  advance: (id: string) => void;
  receive: (id: string, mode: "full" | "short") => void;
  invoice: (id: string) => void;
  closeFinance: (id: string) => void;
  attachGrok: (id: string, step: string, text: string) => void;
};

function nextNo(prefix: string, seq: number) {
  return `${prefix}-${String(seq).padStart(4, "0")}`;
}

function log(audit: Audit[], actor: string, action: string, detail: string): Audit[] {
  return [{ actor, action, detail }, ...audit].slice(0, 40);
}

function patch(reqs: Requisition[], id: string, fn: (r: Requisition) => Requisition) {
  return reqs.map((r) => (r.id === id ? fn(r) : r));
}

const blank = {
  stock: initialStock,
  reqs: [] as Requisition[],
  audit: [] as Audit[],
  seq: 1,
  selectedId: null as string | null,
  provider: "rules" as Provider,
  panel: "stock" as const,
};

export const useP2p = create<State>()(
  persist(
    (set, get) => ({
      ...blank,
      reset: () => set({ ...blank, stock: initialStock.map((s) => ({ ...s })) }),
      setProvider: (provider) => set({ provider }),
      setPanel: (panel) => set({ panel }),
      select: (selectedId) => set({ selectedId, panel: selectedId ? "flow" : get().panel }),
      scan: () => {
        const { stock, reqs, seq } = get();
        let n = seq;
        const created: Requisition[] = [];
        for (const row of stock) {
          const loc = locById(row.locationId);
          if (loc.kind !== "VESSEL_ER" || !loc.vesselId) continue;
          if (row.qty >= row.min) continue;
          if (reqs.some((r) => r.vesselId === loc.vesselId && r.itemId === row.itemId && r.status !== "CLOSED")) continue;
          const vessel = vesselById(loc.vesselId);
          const item = itemById(row.itemId);
          const id = `pr-${n}`;
          created.push({
            id,
            number: nextNo("PR", n),
            vesselId: loc.vesselId,
            itemId: row.itemId,
            locationId: row.locationId,
            source: "MINMAX",
            priority: item.critical && row.qty <= 0 ? "B" : "C",
            requestedQty: Math.max(row.max - row.qty, 1),
            recommendedQty: null,
            approvedQty: null,
            deliveryPort: vessel.nextPort,
            requiredInDays: vessel.etaDays,
            status: "DRAFT",
            quotes: [],
            po: null,
            shipment: null,
            grn: null,
            invoice: null,
            events: [],
          });
          n += 1;
        }
        set({
          reqs: [...created, ...reqs],
          seq: n,
          selectedId: created[0]?.id ?? get().selectedId,
          panel: created.length ? "flow" : get().panel,
          audit: created.length
            ? log(get().audit, "Inventory agent", "Auto requisition", created.map((c) => c.number).join(", "))
            : get().audit,
        });
      },
      raiseManual: ({ vesselId, itemId, qty, priority }) => {
        const vessel = vesselById(vesselId);
        const loc = locations.find((l) => l.vesselId === vesselId && l.kind === "VESSEL_ER");
        if (!loc) return;
        const n = get().seq;
        const req: Requisition = {
          id: `pr-${n}`,
          number: nextNo("PR", n),
          vesselId,
          itemId,
          locationId: loc.id,
          source: "MANUAL",
          priority,
          requestedQty: qty,
          recommendedQty: null,
          approvedQty: null,
          deliveryPort: vessel.nextPort,
          requiredInDays: vessel.etaDays,
          status: "DRAFT",
          quotes: [],
          po: null,
          shipment: null,
          grn: null,
          invoice: null,
          events: [],
        };
        set({
          reqs: [req, ...get().reqs],
          seq: n + 1,
          selectedId: req.id,
          panel: "flow",
          audit: log(get().audit, "Chief Engineer", "Manual requisition", `${req.number} priority ${priority}`),
        });
      },
      validate: (id) => {
        const facts = validateFacts(get().stock, get().reqs, get().reqs.find((r) => r.id === id)!);
        set({
          reqs: patch(get().reqs, id, (r) => ({
            ...r,
            status: facts.blocked ? "BLOCKED" : "VALIDATED",
            events: [
              ...r.events,
              {
                step: "Validate",
                provider: get().provider,
                recommendation: facts.recommendation,
                reasoning: facts.reasoning,
                exceptions: facts.exceptions,
              },
            ],
          })),
          panel: "agent",
        });
      },
      setQty: (id) => {
        const req = get().reqs.find((r) => r.id === id);
        if (!req) return;
        const calc = recommendQty(get().stock, req);
        const item = itemById(req.itemId);
        const reasoning = [
          `On hand ${calc.onHand}, inbound ${calc.inbound}, target max ${calc.target}.`,
          `Expected consumption until delivery ${calc.consumption}.`,
          `Fleet demand from other vessels below minimum: ${calc.fleetDemand}.`,
          `Horizon ${calc.horizon} days, safety stock ${calc.safety}, pack size ${calc.pack}.`,
          `Model quantity ${calc.recommended} versus requested ${req.requestedQty}.`,
        ];
        const note =
          req.source === "MANUAL" && calc.recommended !== req.requestedQty
            ? `Crew asked for ${req.requestedQty}. Model suggests ${calc.recommended}. Accepted model quantity.`
            : `Recommend ${calc.recommended} ${item.uom}.`;
        set({
          reqs: patch(get().reqs, id, (r) => ({
            ...r,
            recommendedQty: calc.recommended,
            approvedQty: calc.recommended,
            status: "QTY_SET",
            events: [
              ...r.events,
              {
                step: "Quantity",
                provider: get().provider,
                recommendation: note,
                reasoning,
                exceptions:
                  r.source === "MANUAL" && calc.recommended !== r.requestedQty
                    ? ["Requested quantity differs from the model — buyer can still override later"]
                    : [],
              },
            ],
          })),
          panel: "agent",
        });
      },
      source: (id) => {
        const req = get().reqs.find((r) => r.id === id);
        if (!req) return;
        const list = shortlist(req);
        const exceptions = list.length < 3 ? ["Fewer than three vendors can serve this port in time"] : [];
        set({
          reqs: patch(get().reqs, id, (r) => ({
            ...r,
            status: "SOURCED",
            events: [
              ...r.events,
              {
                step: "Shortlist",
                provider: get().provider,
                recommendation: `Shortlisted ${list.length} ISM-approved vendors`,
                reasoning: [
                  "Unapproved vendors are excluded.",
                  "Score uses port fit, lead time versus ETA, on-time delivery, fill rate and quality.",
                  list.map((v) => `${v.code} score ${v.score}, ${v.leadDays}d, ${v.unitPrice}`).join("; ") || "None",
                ],
                exceptions,
              },
            ],
          })),
          panel: "agent",
        });
      },
      rfq: (id) => {
        const req = get().reqs.find((r) => r.id === id);
        if (!req) return;
        const quotes = shortlist(req).map((v) => ({
          vendorId: v.id,
          unitPrice: v.unitPrice,
          leadDays: v.leadDays,
          compliant: v.leadDays <= req.requiredInDays,
          notes: v.leadDays <= req.requiredInDays ? "Meets vessel ETA" : "Lead time misses vessel ETA",
        }));
        set({
          reqs: patch(get().reqs, id, (r) => ({
            ...r,
            quotes,
            events: [
              ...r.events,
              {
                step: "RFQ",
                provider: get().provider,
                recommendation: "Simulated quotes captured from the approved panel",
                reasoning: quotes.map((q) => {
                  const v = vendors.find((x) => x.id === q.vendorId)!;
                  return `${v.code}: ${q.unitPrice} in ${q.leadDays}d — ${q.notes}`;
                }),
                exceptions: quotes.filter((q) => !q.compliant).map((q) => `${vendors.find((v) => v.id === q.vendorId)?.code} non-compliant`),
              },
            ],
          })),
          audit: log(get().audit, "Procurement agent", "RFQ simulated", req.number),
          panel: "flow",
        });
      },
      award: (id, vendorId) => {
        const req = get().reqs.find((r) => r.id === id);
        const quote = req?.quotes.find((q) => q.vendorId === vendorId);
        if (!req || !quote || !quote.compliant) return;
        const vendor = vendors.find((v) => v.id === vendorId)!;
        const qty = req.approvedQty ?? req.recommendedQty ?? req.requestedQty;
        const n = get().seq;
        set({
          seq: req.po ? n : n + 1,
          reqs: patch(get().reqs, id, (r) => ({
            ...r,
            status: "PO_PENDING",
            po: {
              number: r.po?.number ?? nextNo("PO", n),
              vendorId,
              qty,
              unitPrice: quote.unitPrice,
              incoterm: "DPU",
              deliveryPort: r.deliveryPort,
              buyerApproved: false,
              techApproved: false,
              status: "DRAFT",
            },
            events: [
              ...r.events,
              {
                step: "Award",
                provider: get().provider,
                recommendation: `Draft PO to ${vendor.code} at ${quote.unitPrice}`,
                reasoning: [
                  "Late quotes stay out of the award.",
                  `${vendor.name} can reach ${r.deliveryPort} in ${quote.leadDays} days.`,
                  itemById(r.itemId).critical
                    ? "Critical spare — buyer and superintendent must both sign."
                    : "Buyer approval is required before issue.",
                ],
                exceptions: [],
              },
            ],
          })),
          panel: "flow",
        });
      },
      approveBuyer: (id) => {
        set({
          reqs: patch(get().reqs, id, (r) => issueIfReady({ ...r, po: r.po ? { ...r.po, buyerApproved: true } : r.po }, get().stock)),
          stock: applyInbound(get().stock, get().reqs.find((r) => r.id === id), true),
          audit: log(get().audit, "Buyer", "PO approval", id),
        });
        // inbound applied inside issue only once — fix double. I'll recompute carefully below.
      },
      approveTech: (id) => {
        const req = get().reqs.find((r) => r.id === id);
        const willIssue =
          !!req?.po &&
          req.po.buyerApproved &&
          !req.po.techApproved &&
          req.po.status === "DRAFT" &&
          itemById(req.itemId).critical;
        set({
          reqs: patch(get().reqs, id, (r) => issueIfReady({ ...r, po: r.po ? { ...r.po, techApproved: true } : r.po }, get().stock)),
          stock: willIssue
            ? get().stock.map((s) =>
                s.itemId === req!.itemId && s.locationId === req!.locationId
                  ? { ...s, inbound: s.inbound + req!.po!.qty }
                  : s,
              )
            : get().stock,
          audit: log(get().audit, "Superintendent", "Critical sign-off", id),
        });
      },
      advance: (id) => {
        set({
          reqs: patch(get().reqs, id, (r) => {
            if (!r.shipment || r.po?.status !== "ISSUED") return r;
            const idx = MILESTONES.indexOf(r.shipment.milestone as Milestone);
            const next = (idx < MILESTONES.length - 1 ? MILESTONES[idx + 1] : r.shipment.milestone) as Milestone;
            const status = next === "VESSEL" ? "DELIVERED" : next === "LAUNCH" ? "AT_PORT" : "IN_TRANSIT";
            return { ...r, shipment: { milestone: next, status } };
          }),
        });
      },
      receive: (id, mode) => {
        const req = get().reqs.find((r) => r.id === id);
        if (!req?.po || req.po.status === "DRAFT") return;
        const qty = mode === "full" ? req.po.qty : Math.max(1, req.po.qty - 1);
        const condition = mode === "full" ? "OK" : "DAMAGED";
        const match = matchReceipt(req.po.qty, qty, condition);
        const already = !!req.grn;
        set({
          seq: already ? get().seq : get().seq + 1,
          stock: already
            ? get().stock
            : get().stock.map((s) =>
                s.itemId === req.itemId && s.locationId === req.locationId
                  ? { ...s, qty: s.qty + qty, inbound: Math.max(0, s.inbound - req.po!.qty) }
                  : s,
              ),
          reqs: patch(get().reqs, id, (r) => ({
            ...r,
            status: match.ok ? "RECEIVED" : "PART_RECEIVED",
            grn: {
              number: r.grn?.number ?? nextNo("GRN", get().seq),
              qty,
              condition,
              discrepancy: match.flags.join("; "),
            },
            events: [
              ...r.events,
              {
                step: "Receipt",
                provider: get().provider,
                recommendation: match.ok ? "Receipt matches the purchase order" : "Discrepancy — do not close",
                reasoning: [`Received ${qty} of ${r.po?.qty} in condition ${condition}.`, "ROB updated for the received quantity only."],
                exceptions: match.flags,
              },
            ],
          })),
          audit: log(get().audit, "Crew", "Goods receipt", match.flags.join("; ") || "clean"),
          panel: "agent",
        });
      },
      invoice: (id) => {
        const req = get().reqs.find((r) => r.id === id);
        if (!req?.po) return;
        const received = req.grn?.qty ?? 0;
        const match = matchInvoice(req.po.qty, req.po.unitPrice, received, req.po.qty, req.po.unitPrice, 0);
        const n = get().seq;
        set({
          seq: req.invoice ? n : n + 1,
          reqs: patch(get().reqs, id, (r) => ({
            ...r,
            invoice: {
              number: r.invoice?.number ?? nextNo("INV", n),
              qty: r.po!.qty,
              unitPrice: r.po!.unitPrice,
              freight: 0,
              matched: match.ok,
              financeApproved: false,
              status: match.ok ? "MATCHED" : "VARIANCE",
              notes: match.flags.join("; "),
            },
            events: [
              ...r.events,
              {
                step: "Invoice",
                provider: get().provider,
                recommendation: match.ok ? "Three-way match is clean" : "Match failed — payment blocked",
                reasoning: ["Compared invoice quantity and price to the purchase order and the goods receipt."],
                exceptions: match.flags,
              },
            ],
          })),
          panel: "agent",
        });
      },
      closeFinance: (id) => {
        const req = get().reqs.find((r) => r.id === id);
        if (!req?.invoice?.matched) return;
        set({
          reqs: patch(get().reqs, id, (r) => ({
            ...r,
            status: "CLOSED",
            po: r.po ? { ...r.po, status: "CLOSED" } : r.po,
            invoice: r.invoice ? { ...r.invoice, financeApproved: true, status: "CLOSED" } : r.invoice,
          })),
          audit: log(get().audit, "Finance", "Payment approved", req.number),
        });
      },
      attachGrok: (id, step, text) => {
        set({
          reqs: patch(get().reqs, id, (r) => {
            const events = [...r.events];
            for (let i = events.length - 1; i >= 0; i -= 1) {
              if (events[i].step === step) {
                events[i] = { ...events[i], grok: text };
                break;
              }
            }
            return { ...r, events };
          }),
        });
      },
    }),
    { name: "proves-p2p-v1" },
  ),
);

function issueIfReady(r: Requisition, _stock: StockRow[]): Requisition {
  if (!r.po) return r;
  const critical = itemById(r.itemId).critical;
  const ready = r.po.buyerApproved && (!critical || r.po.techApproved);
  if (!ready) return { ...r, po: { ...r.po, status: "DRAFT" } };
  if (r.po.status === "ISSUED" || r.po.status === "CLOSED") return r;
  return {
    ...r,
    status: "PO_ISSUED",
    po: { ...r.po, status: "ISSUED" },
    shipment: r.shipment ?? { milestone: "SUPPLIER", status: "BOOKED" },
  };
}

function applyInbound(stock: StockRow[], req: Requisition | undefined, buyerJustApproved: boolean) {
  if (!req?.po || !buyerJustApproved) return stock;
  const critical = itemById(req.itemId).critical;
  const willIssue = req.po.buyerApproved === false && (!critical || req.po.techApproved);
  // called BEFORE patch in approveBuyer — buyerApproved is still false
  if (!willIssue) return stock;
  if (req.po.status === "ISSUED") return stock;
  return stock.map((s) =>
    s.itemId === req.itemId && s.locationId === req.locationId ? { ...s, inbound: s.inbound + req.po!.qty } : s,
  );
}
