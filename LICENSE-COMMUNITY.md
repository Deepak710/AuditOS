> **DRAFT — REQUIRES LEGAL REVIEW.** This document describes an intended community licensing model in business terms. It is not a final, legally binding license, has not been reviewed by an attorney, and must not be relied upon as one. No license currently governs use of this repository — see [License](README.md#license) in the README.

# AuditOS Community License (Draft)

## Purpose

The Community License is intended to let individuals and organizations **use, study, and modify** AuditOS at no cost for non-commercial purposes, while reserving commercial use for a separate [Commercial License](LICENSE-COMMERCIAL.md). It is modeled on the general shape of "source-available" licenses (e.g. the Business Source License and Elastic License 2.0 families) — visible source, permissive for evaluation and internal use, restrictive for competing commercial offerings — without adopting any specific license's text verbatim.

## Intended Scope — What Would Be Permitted

- **Personal use** — running, modifying, and experimenting with AuditOS for individual, non-commercial purposes.
- **Educational use** — use in coursework, research, training materials, and academic study, with attribution.
- **Internal evaluation** — an organization installing and testing AuditOS internally to assess fit before a commercial decision, for a bounded evaluation period.
- **Contribution back** — submitting patches, bug fixes, and improvements under the terms of [CONTRIBUTING.md](CONTRIBUTING.md).
- **Forking for non-commercial derivative work** — provided the fork remains under the same license and is not offered as a paid product or hosted service to third parties.

## Intended Scope — What Would Require the Commercial License Instead

- Deploying AuditOS (or a derivative) to perform paid assurance engagements for clients.
- Offering AuditOS, or a modified version of it, as a hosted service (SaaS) to any third party.
- Embedding AuditOS or its source in a commercial product sold or licensed to others.
- Removing or obscuring attribution to the original project.

## Attribution

Any permitted use should retain a visible reference to the AuditOS project and a link back to this repository.

## Duration and Change

A community license, once granted, is intended to be perpetual for the version it was granted under. A future version of AuditOS may be released under different terms; this does not retroactively change the terms already granted for a version a user already holds.

## Why This Model Is Being Considered

AuditOS's Release 1 is a fully offline, zero-dependency static prototype with genuine standalone value for the audience it targets — students, individual auditors, and organizations evaluating the architecture before adopting it commercially. A source-available community tier lets that audience use, study, and improve the platform, while the org that built it still has a path to monetize production/commercial use, sponsorships, and support contracts under the [Commercial License](LICENSE-COMMERCIAL.md). See [MONETIZATION.md](MONETIZATION.md) for the full comparison this recommendation is drawn from.

## What This Document Deliberately Does Not Do

- It does not grant any rights today — no rights are granted until a real license file replaces this draft.
- It does not include disclaimer-of-warranty, limitation-of-liability, patent-grant, or termination clauses in enforceable legal language — those require counsel to draft correctly and are placeholders here.
- It does not select a specific existing open-source or source-available license to adopt verbatim — that decision, along with the exact enforceable text, is the open item for legal review.

---

**Next step:** legal counsel should review this draft, decide whether to adopt an existing source-available license (with modification) or draft bespoke terms, and confirm this model doesn't conflict with any dependency's own license (Bootstrap and Bootstrap Icons — both MIT-licensed — are the only two third-party dependencies in this repository today).
