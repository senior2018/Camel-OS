# Camel OS — Proposal & Opportunity Workspace: Strategic Redesign (v2)

> Source: founder review (voice note → "Opportunity and proposal review.pdf", 11 pp).
> This document is the canonical blueprint for the redesign. Build against it.

## Design philosophy

Camel OS is **not** a tool for casual users. It serves **experienced consulting
professionals and serious, audited business environments** (grants, tenders,
donor compliance). Every screen, interaction, and default must feel **premium,
mature, and ahead of existing PSA tools**. We optimise for:

- **Clarity over density** — never cram; reveal progressively (tabs, drawers, popovers).
- **Trust & governance** — every decision leaves a clean, visible audit trail.
- **Configurability without complexity** — power users tune the workflow; defaults stay elegant.
- **Need-to-know security** — you see only what concerns you.
- **AI-ready** — every surface has a hook for a future AI layer (drafting, scoring, summarising).

---

## 1. Core reframe: Fixed teams → Permission-driven collaboration

Kill the "writing team vs review team" split. A proposal is a **workspace with
members**, each holding one or more **capabilities** (Google-Docs model):

| Capability (per-proposal) | Can |
|---|---|
| **Lead** (one) | Own it; invite/remove members; reassign lead; drive the workflow |
| **Editor** | Write & edit the document (real-time) |
| **Reviewer** | Approve / Request changes / Reject (cannot edit content) |
| **Approver** | Final sign-off |
| **Commenter** | View + chat/comment only |
| **Viewer** | View only |

Rules:
- **Lead defaults to the opportunity creator** (until AI-generated proposals, where a manager assigns one).
- **"Proposal Manager" is a capability**, not a role: the right to change membership/lead.
- **Separation of duties:** an Editor cannot also be a Reviewer on the same proposal (no self-review). Enforced server-side.
- Org RBAC (`proposal:read/create/update/approve/admin`) governs **module access**; per-proposal **membership** governs everything within a proposal.

---

## 2. The Proposal Workspace — tabbed, clean UI

One calm surface, tabbed:

```
[ Document ] [ Team ] [ Conversation ] [ Reviews ] [ Documents ] [ Timeline ]
```

- **Document** — modern editor (**Tiptap**): no fixed sections, no per-section Save. Author builds their own structure; autosave; **max-height + internal scroll**; **inline comments**; **real-time co-editing** with presence ("Sam is editing here").
- **Team** — membership + capabilities (a "Manage access" surface).
- **Conversation** — WhatsApp-style chat (see §5).
- **Reviews** — reviewer's Approve/Changes/Reject (popup), visible to reviewers only.
- **Documents** — attach/download files, placed under the editor (not pinned at top).
- **Timeline** — activity/audit.

Editor decision: **Tiptap** (ProseMirror, Vue-native, open-source, Yjs collaboration, comment marks) over CKEditor/TinyMCE for Nuxt/Vue fit.

---

## 3. Roles & permissions reimagined (proposal-scoped)

- Membership table carries `(proposalId, userId, capability)`.
- A dedicated **"Manage access"** surface inside the proposal shows only
  **proposal-relevant** capabilities (lead/editor/reviewer/approver/commenter/viewer) —
  never system-admin/manager (irrelevant here).
- Membership drives visibility, editing, and reviewing.

---

## 4. Configurable workflow engine

Per-proposal **settings** (inheriting an org template):
- `minReviewers` (e.g. 3 — but 1 or 5 allowed)
- `approvalRule`: `all` | `count:N` | `percent:P`
- `requireFinalApprover`: bool
- `separationOfDuties`: bool (editor ≠ reviewer)
- `outcomeStages`: **dynamic** (e.g. Submitted → Under Evaluation → Shortlisted → Interview → Won/Lost) — editable on a dedicated page, per-proposal or org-wide.
- `overrideRoles`: who may override a status (won↔loss, reopen).

Final approver = the **Approver** capability (could be CEO/COO/MD). Same page for everyone; capabilities decide what's shown.

---

## 5. The conversation layer (single feedback surface)

- Per-proposal **threaded chat** (WhatsApp-style): all members, colour/name per person, timestamps.
- **System events auto-post**: "Rita approved ✓", "Status → Shortlisted", "Linda invited Sam as Editor".
- **Reviewer flow:** one **"Submit review"** button → popup {Approve / Changes Required / Reject} + optional message → posts to chat. **Reject/Loss requires a reason.**
- The old "Your review" and "Reviewer alignment" cards are **removed** — everything lives in chat, with a **filter** ("show reviewer decisions only / how many approved").

---

## 6. Visibility & security (need-to-know)

- Proposal lists show **only proposals you are a member of** — unless you hold `proposal:admin` or an explicit **"view all"** capability.
- An outsider invited to one proposal cannot see others. Enforced **server-side**, not just UI.

---

## 7. Opportunity UI + reversibility

- **Permanent search** under the header (not behind a button). Advanced filters = expandable/dropdown.
- **Tabs** (Pending / Accepted / Rejected) or hide empty lanes — never show all 0-0-0 lanes.
- **Expansion → its own page**, not a long scroll; board is overview only.
- **Reversible decisions:** an override capability + audit. Reject "re-evaluation by a second reviewer" → later phase.
- Rename the confusing **"Closed"** lane → **"Withdrawn / Not pursued"**.

---

## 8. Scale & polish
- Server-side pagination + virtualization (hundreds per lane must not break the page).
- A proposals **Analytics/Reports** page (pull-your-own), atop the existing Win/Loss report.
- Premium empty states.

---

## 9. Creative differentiators
1. **AI-ready hooks** — draft sections, summarise the conversation, suggest reviewers.
2. **Presence + live cursors** — Google-Docs feel, rare in African PSA tools.
3. **One conversation, full audit** — donor/grant-grade governance.
4. **Org workflow templates** — "Tender" (5 reviewers) vs "Grant" (3); proposals inherit.

---

## 10. Phased roadmap

| Phase | Scope | Size |
|---|---|---|
| **P1 — Foundation reframe** | membership + capabilities; visibility scoping; lead-default; separation of duties; retire the writer/reviewer/contributor split | Med |
| **P2 — Workspace UI** | tabs; Tiptap editor (autosave, max-height); documents tab; permanent search + tabs (opportunity); "Closed" rename | Med-Large |
| **P3 — Conversation + reviews** | chat + system events; reviewer popup; configurable review policy; dynamic outcome stages; override | Large |
| **P4 — Real-time + AI** | Tiptap + Yjs live co-editing + presence; inline comments; AI assists | Large (infra) |

P4 (real-time) is the heaviest (websocket infra). P1–P3 deliver ~80% of the value; interim authoring uses autosave + presence + version history.

---

## Decisions locked
- Editor: **Tiptap** · Real-time: **Yjs (P4)** · Chat: proposal-scoped threaded messages + system events · Config: per-proposal settings inheriting org templates · "Closed" → **"Withdrawn"**.
