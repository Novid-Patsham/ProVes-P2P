# ProVes P2P

Vessel procure-to-pay prototype for ProVes 360. A ship falls below minimum stock, or the crew raises a request. The console checks duplicates and shore stock, recommends a quantity, shortlists approved vendors, drafts a purchase order, and closes only after receipt and invoice match.

## Walkthrough

1. **Scan minimums.** Adele Star’s lube-oil filter is already under minimum.
2. Open the requisition and run **Validate**, **Quantity**, **Shortlist**, **Simulate RFQ**.
3. A late quote cannot be awarded. **Draft PO** on a compliant vendor.
4. A critical spare needs **Buyer approves** and **Superintendent signs**.
5. **Advance inbound**, post **Full receipt** or **Short / damaged**, then **Match invoice**.
6. **Finance closes** only when the three-way match is clean.

**Rules** is the decision engine. **Qwen** and **GLM** are the intended production narrators and are not called from this preview. **Ask Grok to narrate** is optional commentary.

## Run

```bash
npm install
npm run dev
```

The dev server listens on port 8080.
