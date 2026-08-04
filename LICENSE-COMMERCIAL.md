> **DRAFT — REQUIRES LEGAL REVIEW.** This document describes an intended commercial licensing model in business terms. It is not a final, legally binding license, has not been reviewed by an attorney, and must not be relied upon as one, quoted in a contract, or used as the basis for an actual commercial transaction until replaced by reviewed legal text. No license currently governs use of this repository — see [License](README.md#license) in the README.

# AuditOS Commercial License (Draft)

## Purpose

The Commercial License is intended to cover every use of AuditOS that falls outside the [Community License](LICENSE-COMMUNITY.md)'s scope: running paid client engagements on it, embedding it in a product, or hosting it as a service. It is the mechanism by which the organization that builds AuditOS would generate revenue from the platform's commercial use.

## Intended License Tracks

Three tracks are proposed for legal and business review, not as a final decision but as the shape the recommendation in [MONETIZATION.md](MONETIZATION.md) is built from:

### 1. Enterprise License (self-hosted)

- Grants a named organization the right to deploy AuditOS internally, at a fixed seat count or unlimited-internal-use tier, to run its own or its clients' assurance engagements.
- Priced as an annual or multi-year license fee, independent of usage volume.
- Would typically include a support/maintenance commitment (patches, security fixes, upgrade assistance) as a bundled or separately priced add-on.
- Best fit for audit firms and enterprises with existing infrastructure, data-residency requirements, or a preference against a vendor-hosted service.

### 2. SaaS / Subscription License

- AuditOS (Release 2 and beyond, once a real backend exists) hosted and operated by the vendor; the customer licenses access rather than the software itself.
- Priced per active engagement, per seat, or as a tiered subscription (e.g. by engagement volume or AI usage volume — see the telemetry/cost-attribution model already built into Release 1's AI Usage workspace).
- Lowest friction for smaller audit practices without their own infrastructure.
- This track depends on Release 2's backend and multi-tenancy architecture existing — it is not available against the current Release 1 static prototype.

### 3. Royalty / Usage-Based License

- A lower or zero up-front fee in exchange for a percentage of the value AuditOS demonstrably creates — most naturally metered through the same AI Usage / cost-attribution schema Release 1 already ships (`estimatedHoursSaved`, `costUsd`, `billable` fields already exist in the telemetry model).
- Most relevant once Release 2's AI agents are live and their time/cost savings can be measured directly, rather than for the current static prototype.

## Intended Common Terms Across Tracks (subject to legal drafting)

- **Grant scope** — a license to use, not a transfer of ownership; source visibility does not imply a right to redistribute, sublicense, or resell.
- **Support and SLA** — commercial tiers are the natural place to attach support response times, uptime commitments (once hosted), and upgrade paths — none of which apply to the Community License.
- **Term and renewal** — annual by default, with the specific renewal, termination-for-cause, and termination-for-convenience language left to counsel.
- **Liability and warranty** — commercial agreements of this kind typically carry negotiated liability caps and warranty disclaimers; none is drafted here, deliberately, since this requires counsel.
- **Data and confidentiality** — once Release 2 introduces real client data (evidence, findings, reports), the commercial agreement is also where data-processing, confidentiality, and (if hosted) data-residency terms belong.

## What This Document Deliberately Does Not Do

- It does not set actual prices — those are business decisions for the org to make, not something to fabricate here.
- It does not draft enforceable legal clauses (indemnification, warranty, liability, governing law, dispute resolution) — that is exactly the work legal review exists to do.
- It does not commit to the SaaS track being available today — it isn't, until Release 2 ships a real backend.

---

**Next step:** legal counsel should turn the three tracks above into an actual commercial agreement template (or three), in coordination with a pricing decision from the business side — see [MONETIZATION.md](MONETIZATION.md) for the comparative analysis and recommendation this draft is grounded in.
