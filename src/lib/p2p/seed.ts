import type { Item, Location, StockRow, Vendor, Vessel } from "./types";

export const vessels: Vessel[] = [
  { id: "star", name: "MV Adele Star", imo: "9876543", nextPort: "SGSIN", etaDays: 11 },
  { id: "moon", name: "MV Adele Moon", imo: "9876544", nextPort: "AEJEA", etaDays: 18 },
];

export const items: Item[] = [
  {
    id: "filt",
    impa: "612411",
    name: "Main engine lube oil filter",
    uom: "PCS",
    maker: "MAN",
    makerPart: "ME-LOF-50",
    critical: true,
    equipment: "MAN B&W 6S50ME-C",
    pack: 1,
    daily: 0.15,
  },
  {
    id: "filt-eq",
    impa: "612419",
    name: "Lube oil filter, approved equivalent",
    uom: "PCS",
    maker: "FleetFit",
    makerPart: "FF-LOF-50",
    critical: true,
    equipment: "MAN B&W 6S50ME-C",
    pack: 1,
    daily: 0.15,
  },
  {
    id: "seal",
    impa: "591220",
    name: "Purifier gearbox seal",
    uom: "PCS",
    maker: "Alfa Laval",
    makerPart: "AL-PGS-12",
    critical: false,
    equipment: "Fuel oil purifier",
    pack: 2,
    daily: 0.02,
  },
];

export const locations: Location[] = [
  { id: "star-er", name: "Adele Star ER stores", kind: "VESSEL_ER", vesselId: "star" },
  { id: "moon-er", name: "Adele Moon ER stores", kind: "VESSEL_ER", vesselId: "moon" },
  { id: "sg-wh", name: "Singapore shore warehouse", kind: "SHORE_WH", vesselId: null },
];

export const initialStock: StockRow[] = [
  { itemId: "filt", locationId: "star-er", qty: 3, min: 4, max: 12, inbound: 0 },
  { itemId: "filt", locationId: "moon-er", qty: 10, min: 4, max: 12, inbound: 0 },
  { itemId: "filt", locationId: "sg-wh", qty: 8, min: 0, max: 40, inbound: 0 },
  { itemId: "seal", locationId: "star-er", qty: 1, min: 2, max: 6, inbound: 0 },
  { itemId: "seal", locationId: "sg-wh", qty: 4, min: 0, max: 20, inbound: 0 },
];

export const vendors: Vendor[] = [
  {
    id: "oem",
    code: "OEM-MAN",
    name: "MAN PrimeServ Singapore",
    ismApproved: true,
    ports: ["SGSIN"],
    leadDays: 9,
    unitPrice: 148,
    otd: 96,
    fill: 98,
    quality: 99,
    equivalentOk: false,
  },
  {
    id: "chb",
    code: "CH-B",
    name: "Pacific Marine Chandlers",
    ismApproved: true,
    ports: ["SGSIN", "AEJEA"],
    leadDays: 7,
    unitPrice: 129,
    otd: 94,
    fill: 93,
    quality: 95,
    equivalentOk: true,
  },
  {
    id: "chc",
    code: "CH-C",
    name: "BudgetShip Stores",
    ismApproved: true,
    ports: ["CNSHA", "SGSIN"],
    leadDays: 21,
    unitPrice: 99,
    otd: 81,
    fill: 88,
    quality: 86,
    equivalentOk: true,
  },
  {
    id: "grey",
    code: "UNAPP",
    name: "Grey Dock Trader",
    ismApproved: false,
    ports: ["SGSIN"],
    leadDays: 5,
    unitPrice: 90,
    otd: 70,
    fill: 70,
    quality: 70,
    equivalentOk: true,
  },
];
