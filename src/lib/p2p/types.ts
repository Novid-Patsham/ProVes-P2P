export type Priority = "A" | "B" | "C";
export type Source = "MINMAX" | "MANUAL";
export type Provider = "rules" | "qwen" | "glm";
export type Milestone = "SUPPLIER" | "FORWARDER" | "PORT_AGENT" | "LAUNCH" | "VESSEL";

export type Vessel = {
  id: string;
  name: string;
  imo: string;
  nextPort: string;
  etaDays: number;
};

export type Item = {
  id: string;
  impa: string;
  name: string;
  uom: string;
  maker: string;
  makerPart: string;
  critical: boolean;
  equipment: string;
  pack: number;
  daily: number;
};

export type Location = {
  id: string;
  name: string;
  kind: "VESSEL_ER" | "SHORE_WH";
  vesselId: string | null;
};

export type StockRow = {
  itemId: string;
  locationId: string;
  qty: number;
  min: number;
  max: number;
  inbound: number;
};

export type Vendor = {
  id: string;
  code: string;
  name: string;
  ismApproved: boolean;
  ports: string[];
  leadDays: number;
  unitPrice: number;
  otd: number;
  fill: number;
  quality: number;
  equivalentOk: boolean;
};

export type Quote = {
  vendorId: string;
  unitPrice: number;
  leadDays: number;
  compliant: boolean;
  notes: string;
};

export type PurchaseOrder = {
  number: string;
  vendorId: string;
  qty: number;
  unitPrice: number;
  incoterm: string;
  deliveryPort: string;
  buyerApproved: boolean;
  techApproved: boolean;
  status: "DRAFT" | "ISSUED" | "CLOSED";
};

export type Shipment = { milestone: Milestone; status: string };

export type GoodsReceipt = {
  number: string;
  qty: number;
  condition: "OK" | "DAMAGED";
  discrepancy: string;
};

export type Invoice = {
  number: string;
  qty: number;
  unitPrice: number;
  freight: number;
  matched: boolean;
  financeApproved: boolean;
  status: "OPEN" | "MATCHED" | "VARIANCE" | "CLOSED";
  notes: string;
};

export type AgentEvent = {
  step: string;
  provider: Provider;
  recommendation: string;
  reasoning: string[];
  exceptions: string[];
  grok?: string;
};

export type Requisition = {
  id: string;
  number: string;
  vesselId: string;
  itemId: string;
  locationId: string;
  source: Source;
  priority: Priority;
  requestedQty: number;
  recommendedQty: number | null;
  approvedQty: number | null;
  deliveryPort: string;
  requiredInDays: number;
  status: string;
  quotes: Quote[];
  po: PurchaseOrder | null;
  shipment: Shipment | null;
  grn: GoodsReceipt | null;
  invoice: Invoice | null;
  events: AgentEvent[];
};

export type Audit = { actor: string; action: string; detail: string };

export type QtyCalc = {
  onHand: number;
  inbound: number;
  consumption: number;
  fleetDemand: number;
  horizon: number;
  safety: number;
  target: number;
  pack: number;
  recommended: number;
};

export type VendorScore = Vendor & {
  eligible: boolean;
  score: number;
  exceptions: string[];
};
