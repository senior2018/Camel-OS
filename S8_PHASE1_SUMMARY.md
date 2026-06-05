# S8 Phase 1 — Proposal Review Workflow

## Overview

Complete workflow from **Opportunity Discovery → Proposal Review → Submission → Won/Lost**, with a focus on **team alignment** through structured review cycles.

**Key principle:** All required reviewers must align before proposal can advance to Final Approval.

---

## The Complete Workflow

### Stage 1: Opportunity Found
- Opportunity enters system with Pending status
- Team members review and comment
- Example: "This fits our ICT expertise"

### Stage 2: Go-No-Go Decision (Approval Gate)
**Component:** `OpportunityDecisionCard`

Manager/Director decides: **Approved** or **Not Pursuing**

```
┌─────────────────────────┐
│ GO / NO-GO DECISION     │
├─────────────────────────┤
│ ✓ Approve               │
│   → Creates Proposal    │
│                         │
│ ✗ Not Pursuing          │
│   → Closes opportunity  │
└─────────────────────────┘
```

**Business logic:**
- Only if Approved, proposal is auto-created
- Proposal starts in `assigned` status
- Ready for team assignment

---

### Stage 3: Team Assignment
**Component:** `ProposalTeamAssignmentCard`

Assign roles:
- **Proposal Lead** — Writes and manages the proposal
- **Technical Reviewer** — Reviews technical content
- **Finance Reviewer** — Reviews budget and pricing
- **Compliance Reviewer** — Reviews legal/compliance
- **Final Approver** — Executive sign-off before submission

```
┌────────────────────────────────┐
│ TEAM ASSIGNMENT                │
├────────────────────────────────┤
│ Proposal Lead: Sarah ✓         │
│ Technical: John ✓              │
│ Finance: Mary ✓                │
│ Compliance: [Unassigned]       │
│ Final Approver: Director ✓     │
└────────────────────────────────┘
```

Proposal transitions: `assigned` → `drafting`

---

### Stage 4: Drafting Phase
**Duration:** Flexible (days to weeks)

What happens:
- **Proposal Lead writes** the proposal (rich text or document upload)
- **Reviewers comment anytime** — like Google Docs
- **Writer revises in real-time** — no waiting required
- Comments visible to all (collaborative)

Example comments:
```
John (Technical): "Please strengthen implementation methodology."
↳ Sarah (Lead): "Updated section 3 with detailed approach."

Mary (Finance): "Budget exceeds allowed ceiling by $5k."
↳ Sarah: "Reduced travel costs, now within limit."
```

**Key point:** No formal review yet — just feedback and iteration.

Proposal status: `drafting`

---

### Stage 5: Ready for Review
**Component:** `OpportunityActivityTimeline` (shows this action)

When Proposal Lead is satisfied, they click: **[Mark Ready for Review]**

```
Sarah clicks: READY FOR REVIEW
│
├─ All comments made so far stay visible
├─ All reviewers status reset to "pending"
├─ Notification sent to all reviewers
└─ Proposal status: awaiting_review
```

This signals: **"I've incorporated your feedback. Please now give your formal decision."**

---

### Stage 6: Formal Review (Parallel)
**Component:** `ProposalReviewerStatusCard` + `ProposalReviewForm`

Each reviewer independently submits:
- ✅ **Approved** — "This is ready to proceed"
- 🔄 **Changes Required** — "Please revise X, Y, Z"
- ❌ **Rejected** — "This should not go forward"

All reviewers can work in parallel (no serial approval chain).

```
John (Technical):  ✅ APPROVED "Strong methodology"
Mary (Finance):    🔄 CHANGES REQUIRED "Need budget detail"
Compliance:        ⏳ PENDING "Waiting..."
```

**Real-time dashboard shows alignment:**
- Who has decided
- Who is still pending
- What issues were raised

---

### Stage 7: Alignment Phase

System auto-checks decisions:

**Scenario A: All approved**
```
John:      ✅ Approved
Mary:      ✅ Approved
Compliance: ✅ Approved

→ Proposal automatically moves to: ready_for_final_approval
```

**Scenario B: One or more "Changes Required"**
```
John:      ✅ Approved
Mary:      🔄 CHANGES REQUIRED
Compliance: ✅ Approved

→ Proposal automatically moves to: revision_required
→ Lead notified: Must address Mary's feedback
→ Lead revises and re-submits for review
→ Reviewers make new decisions
```

**Scenario C: Any rejected**
```
John:      ✅ Approved
Mary:      ✅ Approved
Compliance: ❌ REJECTED

→ Proposal automatically moves to: rejected
→ Blocked until decision appealed or overridden
```

---

### Stage 8: Final Approval
**Component:** Built-in proposal detail (via existing flow)

Director sees:
```
┌────────────────────────────┐
│ FINAL APPROVAL             │
├────────────────────────────┤
│ Technical:  ✅ Approved    │
│ Finance:    ✅ Approved    │
│ Compliance: ✅ Approved    │
│                            │
│ Team consensus: ALIGNED    │
│                            │
│ [✅ APPROVE]              │
│ [❌ REJECT]               │
└────────────────────────────┘
```

Director validates team's decision OR can override (rare, requires comment).

**If approved:**
- Proposal status: `final_approved`
- Ready to submit to client/funder

**If rejected:**
- Proposal status: `final_rejected`
- Proposal sent back to lead (proposal stops here)

---

### Stage 9: Submission
Existing flow (no changes):
- Proposal status: `submitted`
- Submission date/method recorded
- Awaiting client evaluation

---

### Stage 10: Outcome
Existing flow:
- Proposal status: `won` / `lost` / `shortlisted`
- Debrief notes captured

---

## Database Changes

### New Tables

**`proposal_reviewers`**
- Tracks each reviewer's decision
- Status: pending → approved / changes_required / rejected
- Feedback captured
- Required vs optional flag

**`proposal_assignments`**
- Maps roles to users
- One user per role (can be re-assigned)

**`opportunity_decisions`**
- Go-No-Go decision
- Approver + timestamp + reason

**`opportunity_activities`**
- Audit trail of all actions
- Every decision logged automatically

### Modified Tables

**`proposals`**
- New status enum with 13 states (previously 4)
- Default status changed from 'writing' to 'assigned'

---

## Proposal Status States

```
assigned
  ↓ (team assigned, ready to write)
drafting
  ↓ (comments happening, can revise)
awaiting_review (lead marks ready)
  ├─ (reviewers making decisions...)
  │
  ├─ revision_required (if any said "Changes Required")
  │    ↓ (lead revises)
  │    ↓ (back to awaiting_review)
  │
  ├─ rejected (if any said "Rejected")
  │    ↓ (blocked, can appeal)
  │
  └─ ready_for_final_approval (if all approved)
      ↓
awaiting_final_approval
  ├─ final_approved → ready_to_submit
  └─ final_rejected → blocked
      ↓
submitted
  ↓
won / lost / shortlisted
```

---

## UI Components

### OpportunityDecisionCard
- Shows Go-No-Go decision interface
- Captures reason for approval/rejection
- Displays final decision status

### ProposalTeamAssignmentCard
- Shows all 5 roles
- Assign button for each unassigned role
- Confirmation that role is assigned

### ProposalReviewerStatusCard
- Real-time alignment dashboard
- Shows all reviewers + their status
- Displays feedback snippets
- Summary line: "All approved" / "Changes required" / "Rejected"

### ProposalReviewForm
- Only visible to assigned reviewers
- Radio buttons for decision (Approve / Changes / Reject)
- Feedback textarea (required)
- Shows existing review if already submitted

### OpportunityActivityTimeline
- Chronological log of all actions
- Icons + colors for action type
- Who did what + when
- Shows decision details inline

---

## Permissions

**Opportunity Review & Decision:**
- `opportunity:read` — Can see opportunity
- `opportunity:update` — Can make Go-No-Go decision

**Proposal Assignment:**
- `opportunity:update` — Can assign team members

**Proposal Review:**
- `opportunity:read` — Can see proposal + submit feedback
- `opportunity:update` — Can submit formal reviewer decision

**Final Approval:**
- Usually `super_admin` or `org_admin` role

---

## Audit Trail

Every action logged to `opportunityActivities`:

```sql
INSERT INTO opportunity_activities (
  opportunity_id,
  action,          -- "opportunity:decision", "proposal:review", etc.
  details,         -- JSON: decision, reason, role, feedback, etc.
  user_id,
  created_at
)
```

Dashboard shows: "John approved opportunity on Jun 15 at 2:30 PM"

---

## Next Steps (Phase 2+)

- **Notifications:** Email reviewers when ready for review
- **Reminders:** "Proposal waiting for your review for X days"
- **Escalation:** Auto-escalate if reviewer doesn't respond in 3 days
- **Bulk operations:** Bulk invite multiple reviewers
- **Templates:** Pre-built reviewer checklists per proposal type
- **Integrations:** Slack notifications, Teams alerts
- **Analytics:** Track review cycle time, most common feedback

---

## Testing Checklist

- [ ] Go-No-Go decision creates proposal
- [ ] Team assignment works
- [ ] Drafting allows comments
- [ ] Ready for Review resets all reviewers
- [ ] Approval moves to Final Approval
- [ ] Changes Required moves to revision_required
- [ ] Rejection marks proposal as rejected
- [ ] Final Approver sees aligned team
- [ ] Activity timeline shows all actions
- [ ] Audit log captures everything

---

## Example Workflow (Day-by-day)

```
Day 1: Opportunity found
  - Submitted by: Partner
  - Status: Pending Review
  - John reviews: "Great fit for our expertise"
  
Day 2: Go-No-Go Decision
  - Manager decides: APPROVED
  - System creates Proposal: "ACME Digital Transformation RFP"
  - Proposal status: assigned
  
Day 2 afternoon: Team Assignment
  - Proposal Lead: Sarah
  - Technical: John
  - Finance: Mary
  - Compliance: [TBD]
  - Final Approver: Director
  - Proposal status: drafting
  
Day 3-7: Drafting
  - Sarah writes proposal sections
  - John comments: "Need 6-month timeline, not 3"
  - Sarah revises Day 4
  - Mary comments: "Budget is $150k, we quoted $180k"
  - Sarah reduces scope, now $145k
  - All feedback incorporated by Day 6
  
Day 7 afternoon: Ready for Review
  - Sarah clicks: READY FOR REVIEW
  - Proposal status: awaiting_review
  - Notifications sent to John, Mary, Compliance
  
Day 8-9: Formal Reviews
  - John (Day 8, 10:00am): ✅ APPROVED "Excellent technical approach"
  - Mary (Day 8, 2:00pm): ✅ APPROVED "Budget is tight but reasonable"
  - Compliance (Day 8, 4:00pm): 🔄 CHANGES REQUIRED
           "Need updated partner certifications (3 of 5 missing)"
  - Proposal status auto-updates: revision_required
  
Day 9 morning: Remediation
  - Sarah gets alert: Compliance needs certifications
  - Sarah reaches out to partners, gets 2 of 3 certs by noon
  - Sarah notes: "Attached 2 certifications, 3rd partner processing"
  - Sarah revises and resubmits: Day 9, 2:00pm
  
Day 9 afternoon: Re-Review
  - Compliance (Day 9, 3:00pm): ✅ APPROVED "Good, acceptable risk"
  - All required reviewers now approved
  - Proposal status auto-updates: ready_for_final_approval
  
Day 10 morning: Final Approval
  - Director reviews: Team is aligned, decision is sound
  - Director: ✅ FINAL APPROVED
  - Proposal status: final_approved
  
Day 10 afternoon: Submission
  - Sarah uploads final proposal to RFP portal
  - Proposal status: submitted
  - Deadline: 30 days
  
Day 40: Outcome
  - Client responds: WON
  - Proposal status: won
  - Award value: $145,000
  - Next step: Contracting (S9+)
```

Timeline: **9 days from Accepted opportunity to Submitted proposal**
(typical: 5-15 days depending on feedback intensity)

---

## Files Created

**Backend:**
- `server/database/schema.ts` — 4 new tables + enums
- `server/database/migrations/0017_...sql` — Migration
- `server/api/opportunities/[id]/decision.post.ts`
- `server/api/opportunities/[id]/activities.get.ts`
- `server/api/proposals/[id]/assignments.post.ts|get.ts`
- `server/api/proposals/[id]/review.post.ts`
- `server/api/proposals/[id]/reviewers.get.ts`
- `server/api/proposals/[id]/ready-for-review.post.ts`

**Frontend:**
- `app/components/opportunity/OpportunityDecisionCard.vue`
- `app/components/opportunity/OpportunityActivityTimeline.vue`
- `app/components/proposal/ProposalTeamAssignmentCard.vue`
- `app/components/proposal/ProposalReviewerStatusCard.vue`
- `app/components/proposal/ProposalReviewForm.vue`

**Schemas:**
- `shared/schemas/opportunity-decision.ts`
- `shared/schemas/proposal-assignment.ts`
- `shared/schemas/proposal-review.ts`

**Composables:**
- `app/composables/useProposalReview.ts`
- `app/composables/useOpportunityDecision.ts`

**Branch:**
- `feat/proposal-review-workflow` (feature branch)
- Will merge to `main` after testing

---

## Integration Points (Next Work)

To activate Phase 1 in the UI:

1. **Opportunity detail page** (`/opportunities/[id]`)
   - Add `<OpportunityDecisionCard>` after "Opportunity Review" section
   - Add `<OpportunityActivityTimeline>` at bottom

2. **Proposal detail page** (`/proposals/[id]`)
   - Replace current status controls with new components:
     - Add `<ProposalTeamAssignmentCard>` (when status = 'assigned')
     - Add `<ProposalReviewerStatusCard>` (when status = 'drafting' or 'awaiting_review')
     - Add `<ProposalReviewForm>` (when status = 'awaiting_review')
   - Add `<OpportunityActivityTimeline>` at bottom (shows proposal actions too)
   - Keep existing Draft/Decision note editors

3. **Proposal list page** (`/proposals`)
   - Update status badges to reflect new states (assigned/drafting/revision_required/rejected/etc.)
   - Add hover tooltip explaining each status

---

**Status:** Ready for browser testing & verification ✅
