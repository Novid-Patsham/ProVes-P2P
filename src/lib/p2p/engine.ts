import { items, locations, vendors, vessels } from "./seed";
import type { Item, Location, QtyCalc, Requisition, StockRow, VendorScore, Vessel } from "./types";

export const MILESTONES = ["SUPPLIER", "FORWARDER", "PORT_AGENT", "LAUNCH", "VESSEL"] as const;
export const PRICE_TOLERANCE = 2;

export function vesselById(id: string): Vessel {
  return vessels.find((v) => v.id === id) ?? vessels[0];
}
export function itemById(id: string): Item {
  return items.find((i) => i.id === id) ?? items[0];
}
export function locById(id: string): Location {
  return locations.find((l) => l.id === id) ?? locations[0];
}

export function stockAt(stock: StockRow[], itemId: string, locationId: string) {
  return stock.find((s) => s.itemId === itemId && s.locationId === locationId);
}

export function openDemand(reqs: Requisition[], vesselId: string, itemId: string, ignore?: string) {
  return reqs.filter(
    (r) =>
      r.id !== ignore &&
      r.vesselId === vesselId &&
      r.itemId === itemId &&
      r.status !== "CLOSED" &&
      r.status !== "CANCELLED",
  );
}

export function recommendQty(stock: StockRow[], req: Requisition): QtyCalc {
  const item = itemById(req.itemId);
  const local = stockAt(stock, req.itemId, req.locationId);
  const onHand = local?.qty ?? 0;
  const inbound = local?.inbound ?? 0;
  const target = local?.max ?? onHand;
  const safety = Math.max(0, (local?.min ?? 0) * 0.25);
  const horizon = req.requiredInDays;
  const consumption = Math.round(item.daily * horizon * 100) / 100;
  let fleetDemand = 0;
  for (const row of stock) {
    const loc = locById(row.locationId);
    if (row.itemId !== req.itemId) continue;
    if (loc.vesselId && loc.vesselId !== req.vesselId && row.qty < row.min) {
      fleetDemand += Math.max(0, row.min - row.qty);
    }
  }
  const raw = Math.max(0, target - onHand - inbound + consumption + safety + fleetDemand);
  const pack = item.pack || 1;
  let recommended = Math.ceil(raw / pack) * pack;
  if (recommended === 0 && local && onHand < local.min) recommended = pack;
  return { onHand, inbound, consumption, fleetDemand, horizon, safety, target, pack, recommended };
}

export function scoreVendors(req: Requisition): VendorScore[] {
  const item = itemById(req.itemId);
  return vendors.map((v) => {
    const exceptions: string[] = [];
    if (!v.ismApproved) exceptions.push("Not on the ISM approved list");
    const portOk = v.ports.includes(req.deliveryPort);
    if (!portOk) exceptions.push(`Does not serve ${req.deliveryPort}`);
    const leadOk = v.leadDays <= req.requiredInDays;
    if (!leadOk) exceptions.push(`Lead ${v.leadDays}d misses need-by ${req.requiredInDays}d`);
    let score = 0;
    if (v.ismApproved) score += 10;
    if (portOk) score += 25;
    if (leadOk) score += 25;
    score += v.otd * 0.2 + v.fill * 0.1 + v.quality * 0.1;
    if (item.critical && !v.equivalentOk && !v.code.startsWith("OEM")) score -= 15;
    return { ...v, eligible: v.ismApproved && portOk, score: Math.round(score * 10) / 10, exceptions };
  });
}

export function shortlist(req: Requisition) {
  return scoreVendors(req)
    .filter((v) => v.eligible)
    .sort((a, b) => b.score - a.score || a.unitPrice - b.unitPrice)
    .slice(0, 5);
}

export function validateFacts(stock: StockRow[], reqs: Requisition[], req: Requisition) {
  const item = itemById(req.itemId);
  const vessel = vesselById(req.vesselId);
  const local = stockAt(stock, req.itemId, req.locationId);
  const dups = openDemand(reqs, req.vesselId, req.itemId, req.id).map((r) => r.number);
  const exceptions: string[] = [];
  if (dups.length) exceptions.push(`Duplicate open demand: ${dups.join(", ")}`);
  if (local && local.qty >= local.min && req.source === "MANUAL") {
    exceptions.push("Vessel stock is not below minimum \u2014 confirm this is not a duplicate top-up");
  }
  const wh = stock.find((s) => s.itemId === req.itemId && locById(s.locationId).kind === "SHORE_WH" && s.qty > 0);
  if (wh) exceptions.push(`Transfer option: shore warehouse holds ${wh.qty} ${item.uom}`);
  const reasoning = [
    `${vessel.name} (IMO ${vessel.imo}) needs delivery at ${req.deliveryPort} in ${req.requiredInDays} days.`,
    `Item IMPA ${item.impa} ${item.name} for ${item.equipment}.`,
    `ROB ${local?.qty ?? 0} against minimum ${local?.min ?? 0}.`,
    item.equipment ? "Equipment fit is linked on the BOM." : "Equipment fit is not linked \u2014 technical review.",
  ];
  return {
    blocked: dups.length > 0,
    recommendation: dups.length ? "Blocked on duplicate demand" : "Request is valid to continue",
    reasoning,
    exceptions,
  };
}

export function matchReceipt(ordered: number, received: number, condition: string) {
  const flags: string[] = [];
  if (received < ordered) flags.push(`Short-land: PO ${ordered} vs GRN ${received}`);
  if (received > ordered) flags.push(`Over-receipt: PO ${ordered} vs GRN ${received}`);
  if (condition !== "OK") flags.push(`Condition ${condition}`);
  return { ok: flags.length === 0, flags };
}

export function matchInvoice(poQty: number, poPrice: number, received: number, invQty: number, invPrice: number, freight: number) {
  const flags: string[] = [];
  if (invQty > received) flags.push("Invoiced quantity exceeds received quantity");
  if (received < poQty && invQty >= poQty) flags.push("Invoice is for the full PO but the receipt is short");
  const delta = poPrice ? (Math.abs(invPrice - poPrice) / poPrice) * 100 : 0;
  if (delta > PRICE_TOLERANCE) flags.push(`Price variance ${delta.toFixed(1)}% exceeds ${PRICE_TOLERANCE}%`);
  if (freight) flags.push(`Freight line ${freight} needs approval`);
  return { ok: flags.length === 0, flags, delta };
}
