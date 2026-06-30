import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import { Hash } from '@adonisjs/hash'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'
import postgres from 'postgres'
import dotenv from 'dotenv'
import consola from 'consola'

import * as schema from '../server/database/schema'
import {
  authAccounts,
  campaignBudgetLines,
  campaigns,
  clientContacts,
  clientInteractions,
  clientReminders,
  clients,
  contentComments,
  contentItems,
  contentMetrics,
  contentReviews,
  donorGrants,
  donorProjects,
  mediaMentions,
  stakeholderActivities,
  stakeholders,
  opportunities,
  opportunityActivities,
  opportunityClients,
  opportunityComments,
  organizationMembers,
  organizations,
  partnershipAgreements,
  projectActivities,
  projectBudgetLines,
  projectExpenses,
  projectMembers,
  projectMilestones,
  projectReports,
  projectVendors,
  projects,
  timesheetEntries,
  proposalAssignments,
  proposalDocumentVersions,
  proposalMessages,
  proposalReviewers,
  proposals,
  roles,
  userRoles,
  users,
} from '../server/database/schema'

dotenv.config()

const ORG_SLUG = 'camel-os'
const PASSWORD = 'CamelOS@2025!'

// ─── tiny helpers (no faker dependency) ──────────────────────────────────────
const rand = (n: number) => Math.floor(Math.random() * n)
const pick = <T>(arr: readonly T[]): T => arr[rand(arr.length)]!
const chance = (p: number) => Math.random() < p
function pickN<T>(arr: readonly T[], n: number): T[] {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, n)
}
function daysFromNow(d: number): Date {
  return new Date(Date.now() + d * 86_400_000)
}
const isoDate = (dt: Date) => dt.toISOString().slice(0, 10)
const money = (min: number, max: number) => (min + rand(max - min)).toFixed(2)

// ─── data pools ───────────────────────────────────────────────────────────────
const FIRST = [
  'Amina',
  'John',
  'Grace',
  'Hassan',
  'Mary',
  'Peter',
  'Fatima',
  'David',
  'Joyce',
  'Samuel',
  'Neema',
  'Daniel',
  'Esther',
  'Ibrahim',
  'Rehema',
  'Joseph',
  'Zainab',
  'Emmanuel',
  'Lucy',
  'Ali',
]
const LAST = [
  'Mwangi',
  'Otieno',
  'Hassan',
  'Kimaro',
  'Achieng',
  'Mushi',
  'Bakari',
  'Njoroge',
  'Sanga',
  'Mollel',
  'Kiprop',
  'Lema',
  'Massawe',
  'Juma',
  'Ngwale',
  'Shirima',
  'Maeda',
  'Komba',
]
const COMPANIES = [
  'Acacia Holdings',
  'Serengeti Logistics',
  'Zanzibar Spice Co',
  'Kilimanjaro Foods',
  'Tanga Cement',
  'Mwanza Fisheries',
  'Dodoma AgriTech',
  'Arusha Tourism Group',
  'Coastal Energy',
  'Highland Coffee',
  'Rift Valley Mining',
  'Savannah Retail',
  'Bahari Shipping',
  'Uhuru Telecom',
  'Maendeleo Bank',
]
const FOUNDATIONS = [
  'Gates Foundation',
  'Ford Foundation',
  'Mastercard Foundation',
  'Rockefeller Foundation',
  'Aga Khan Foundation',
  'Wellcome Trust',
  'Hewlett Foundation',
  'Open Society Foundations',
]
const NGOS = [
  'Oxfam',
  'Save the Children',
  'CARE International',
  'Plan International',
  'World Vision',
  'Mercy Corps',
  'Amref Health',
  'SNV Netherlands',
]
const INDUSTRIES = [
  'Agriculture',
  'Health',
  'Education',
  'Energy',
  'Financial Services',
  'Logistics',
  'Tourism',
  'Manufacturing',
  'ICT',
  'Mining',
]
const COUNTRIES = [
  'Tanzania',
  'Kenya',
  'Uganda',
  'Rwanda',
  'Zambia',
  'Ethiopia',
  'Ghana',
  'Nigeria',
]
const FOCUS = [
  'Maternal Health',
  'Climate Resilience',
  'Youth Employment',
  'Digital Inclusion',
  'Food Security',
  'Girls Education',
  'Clean Water',
  'Financial Inclusion',
]
const OPP_TITLES = [
  'Digital Transformation Advisory',
  'M&E Framework Design',
  'Public Financial Mgmt Review',
  'Renewable Energy Feasibility',
  'Health Systems Strengthening',
  'Agri Value-Chain Study',
  'Skills Development Programme',
  'Governance Capacity Building',
  'Climate Adaptation Strategy',
  'Tax Policy Reform',
  'SME Finance Diagnostic',
  'Education Sector Analysis',
  'WASH Baseline Survey',
  'Gender Inclusion Audit',
  'Trade Logistics Assessment',
]
const SOURCES = ['tender', 'grant', 'partnership', 'referral', 'inbound', 'other']
const TYPES = ['consulting', 'training', 'research', 'advisory', 'other']
const TAGS = [
  'health',
  'education',
  'climate',
  'governance',
  'finance',
  'agriculture',
  'energy',
  'gender',
  'digital',
  'urgent',
  'strategic',
  'repeat-client',
]
const INTERACTION_TYPES = ['meeting', 'call', 'email', 'note'] as const
const DONOR_INTERACTION_TYPES = ['donor_reporting', 'grant_negotiation'] as const
const SUMMARIES = [
  'Intro call to understand needs',
  'Shared capability statement',
  'Discussed upcoming tender',
  'Quarterly check-in',
  'Negotiated scope and budget',
  'Reviewed draft proposal together',
  'Site visit and stakeholder mapping',
  'Follow-up on outstanding documents',
]

// Account-role roster (excludes the System Administrator / super admin).
const ROSTER = [
  { email: 'david@camel-os.com', firstName: 'David', lastName: 'Director', roleName: 'Manager' },
  { email: 'maria@camel-os.com', firstName: 'Maria', lastName: 'Mushi', roleName: 'Manager' },
  {
    email: 'linda@camel-os.com',
    firstName: 'Linda',
    lastName: 'Lead',
    roleName: 'Business Development Officer',
  },
  {
    email: 'ben@camel-os.com',
    firstName: 'Ben',
    lastName: 'Otieno',
    roleName: 'Business Development Officer',
  },
  { email: 'sam@camel-os.com', firstName: 'Sam', lastName: 'Writer', roleName: 'Consultant' },
  { email: 'priya@camel-os.com', firstName: 'Priya', lastName: 'Writer', roleName: 'Consultant' },
  { email: 'rita@camel-os.com', firstName: 'Rita', lastName: 'Reviewer', roleName: 'Reviewer' },
  { email: 'nadia@camel-os.com', firstName: 'Nadia', lastName: 'Reviewer', roleName: 'Reviewer' },
  { email: 'omar@camel-os.com', firstName: 'Omar', lastName: 'Reviewer', roleName: 'Reviewer' },
  {
    email: 'doris@camel-os.com',
    firstName: 'Doris',
    lastName: 'Approver',
    roleName: 'Staff Member',
  },
  {
    email: 'cathy@camel-os.com',
    firstName: 'Cathy',
    lastName: 'Comms',
    roleName: 'Communications Officer',
  },
  {
    email: 'carl@camel-os.com',
    firstName: 'Carl',
    lastName: 'Media',
    roleName: 'Communications Lead',
  },
  {
    email: 'paul@camel-os.com',
    firstName: 'Paul',
    lastName: 'Project',
    roleName: 'Project Manager',
  },
  {
    email: 'hannah@camel-os.com',
    firstName: 'Hannah',
    lastName: 'Resource',
    roleName: 'HR Manager',
  },
  {
    email: 'frank@camel-os.com',
    firstName: 'Frank',
    lastName: 'Finance',
    roleName: 'Finance Officer',
  },
  {
    email: 'karen@camel-os.com',
    firstName: 'Karen',
    lastName: 'Knowledge',
    roleName: 'Knowledge Manager',
  },
] as const

async function run() {
  const client = postgres(process.env.DATABASE_URL!)
  const db = drizzle(client, { schema })
  const hasher = new Hash(new Scrypt({}))

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, ORG_SLUG))
    .limit(1)
  if (!org) {
    consola.error(`Organization "${ORG_SLUG}" not found — run pnpm db:seed first.`)
    await client.end()
    process.exit(1)
  }
  const orgId = org.id

  // ── 1) wipe business data (cascades clear children); keep users/roles/lookups ──
  await db.delete(opportunities).where(eq(opportunities.organizationId, orgId))
  await db.delete(clients).where(eq(clients.organizationId, orgId))
  await db.delete(projects).where(eq(projects.organizationId, orgId))
  // Communications (S7–S10) — children cascade from these.
  await db.delete(contentItems).where(eq(contentItems.organizationId, orgId))
  await db.delete(campaigns).where(eq(campaigns.organizationId, orgId))
  await db.delete(stakeholders).where(eq(stakeholders.organizationId, orgId))
  await db.delete(mediaMentions).where(eq(mediaMentions.organizationId, orgId))
  consola.success('Wiped clients, opportunities, proposals, communications, grants, agreements.')

  // ── 2) user roster across roles (idempotent) ──
  const orgRoles = await db.select().from(roles).where(eq(roles.organizationId, orgId))
  const roleId = (name: string) => orgRoles.find((r) => r.name === name)?.id
  const passwordHash = await hasher.make(PASSWORD)
  const userIdByEmail = new Map<string, string>()

  for (const u of ROSTER) {
    const [existing] = await db.select().from(users).where(eq(users.email, u.email)).limit(1)
    if (existing) {
      userIdByEmail.set(u.email, existing.id)
      continue
    }
    const rid = roleId(u.roleName)
    await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          organizationId: orgId,
          email: u.email,
          firstName: u.firstName,
          lastName: u.lastName,
          status: 'active',
          role: 'member',
          mfaRequired: false,
          emailVerifiedAt: new Date(),
        })
        .returning()
      await tx
        .insert(organizationMembers)
        .values({ organizationId: orgId, userId: user!.id, role: 'member' })
      await tx.insert(authAccounts).values({ userId: user!.id, provider: 'local', passwordHash })
      if (rid) await tx.insert(userRoles).values({ userId: user!.id, roleId: rid })
      userIdByEmail.set(u.email, user!.id)
    })
  }
  const owners = [
    'david@camel-os.com',
    'maria@camel-os.com',
    'linda@camel-os.com',
    'ben@camel-os.com',
  ]
    .map((e) => userIdByEmail.get(e)!)
    .filter(Boolean)
  const ownerId = () => pick(owners)
  consola.success(`User roster ready (${ROSTER.length} non-admin users across roles).`)

  // ── 3) projects (CR-10) ──
  const projectIds: string[] = []
  for (let i = 0; i < 12; i++) {
    const [p] = await db
      .insert(projects)
      .values({
        organizationId: orgId,
        name: `${pick(FOCUS)} Programme ${2024 + rand(3)}`,
        code: `PRJ-${2025}-${String(i + 1).padStart(3, '0')}`,
        status: pick(['planning', 'active', 'active', 'completed']),
        startDate: isoDate(daysFromNow(-rand(400))),
        endDate: isoDate(daysFromNow(rand(500))),
        totalBudget: money(200_000, 2_000_000),
        createdByUserId: ownerId(),
      })
      .returning({ id: projects.id })
    projectIds.push(p!.id)
  }

  // ── 4) clients (50) + contacts + interactions + reminders + grants/agreements ──
  const TYPE_PLAN: Array<'client' | 'prospect' | 'donor' | 'partner'> = [
    ...Array(18).fill('client'),
    ...Array(12).fill('prospect'),
    ...Array(12).fill('donor'),
    ...Array(8).fill('partner'),
  ]
  let contactCount = 0
  let interactionCount = 0
  let reminderCount = 0
  let grantCount = 0
  let agreementCount = 0
  const clientIds: string[] = []

  for (const type of TYPE_PLAN) {
    const isOrg = type === 'client' || type === 'prospect' || type === 'partner' || chance(0.5)
    const first = pick(FIRST)
    const last = pick(LAST)
    const orgName =
      type === 'donor' ? pick(FOUNDATIONS) : type === 'partner' ? pick(NGOS) : pick(COMPANIES)
    const name = isOrg ? orgName : `${first} ${last}`

    const metadata =
      type === 'donor'
        ? {
            focusAreas: pickN(FOCUS, 2 + rand(2)),
            reportingLanguage: 'English',
            fiscalYearStart: '01-01',
          }
        : type === 'partner'
          ? { partnershipType: pick(['MOU', 'Consortium', 'Sub-grantee']), scope: pick(FOCUS) }
          : null

    const [c] = await db
      .insert(clients)
      .values({
        organizationId: orgId,
        name,
        firstName: isOrg ? null : first,
        lastName: isOrg ? null : last,
        organization: isOrg ? orgName : null,
        type,
        industry: pick(INDUSTRIES),
        country: pick(COUNTRIES),
        website: `https://www.${orgName.toLowerCase().replace(/[^a-z]+/g, '')}.org`,
        phone: `+255 7${rand(90) + 10} ${rand(900) + 100} ${rand(900) + 100}`,
        email: `info@${orgName.toLowerCase().replace(/[^a-z]+/g, '')}.org`,
        notes: chance(0.4) ? `Key account in ${pick(COUNTRIES)}.` : null,
        metadata,
        ownerUserId: ownerId(),
        // Donors & partners get 1–2 extra reminder recipients so the new
        // grant/renewal reminder fan-out is visible in the demo.
        reminderRecipientUserIds:
          type === 'donor' || type === 'partner' ? pickN(owners, 1 + rand(2)) : [],
        createdByUserId: ownerId(),
      })
      .returning({ id: clients.id })
    const clientId = c!.id
    clientIds.push(clientId)

    // contacts (1–3, first is primary)
    const nContacts = 1 + rand(3)
    const contactIds: string[] = []
    for (let i = 0; i < nContacts; i++) {
      const cf = pick(FIRST)
      const cl = pick(LAST)
      const [ct] = await db
        .insert(clientContacts)
        .values({
          clientId,
          organizationId: orgId,
          firstName: cf,
          lastName: cl,
          title: pick([
            'Director',
            'Programme Manager',
            'Procurement Lead',
            'Finance Manager',
            'CEO',
            'Grants Officer',
          ]),
          email: `${cf.toLowerCase()}.${cl.toLowerCase()}@example.org`,
          phone: `+255 6${rand(90) + 10} ${rand(900) + 100} ${rand(900) + 100}`,
          isPrimary: i === 0,
        })
        .returning({ id: clientContacts.id })
      contactIds.push(ct!.id)
      contactCount++
    }

    // interactions (2–5)
    const nInter = 2 + rand(4)
    for (let i = 0; i < nInter; i++) {
      const isDonorType = type === 'donor' || type === 'partner'
      const itype =
        isDonorType && chance(0.4) ? pick(DONOR_INTERACTION_TYPES) : pick(INTERACTION_TYPES)
      const hasFollowUp = chance(0.3)
      await db.insert(clientInteractions).values({
        clientId,
        organizationId: orgId,
        contactId: chance(0.7) ? pick(contactIds) : null,
        type: itype,
        occurredAt: daysFromNow(-rand(120)),
        summary: pick(SUMMARIES),
        followUpAt: hasFollowUp ? isoDate(daysFromNow(rand(30))) : null,
        followUpAction: hasFollowUp ? 'Send updated proposal and schedule meeting' : null,
        createdByUserId: ownerId(),
      })
      interactionCount++
    }

    // a follow-up reminder for some
    if (chance(0.4)) {
      await db.insert(clientReminders).values({
        clientId,
        organizationId: orgId,
        contactId: chance(0.5) ? pick(contactIds) : null,
        assignedUserId: ownerId(),
        dueAt: daysFromNow(rand(21) - 3),
        message: `Follow up with ${name} on next steps`,
        createdByUserId: ownerId(),
      })
      reminderCount++
    }

    // donor grants + project links
    if (type === 'donor') {
      const nGrants = 1 + rand(2)
      for (let i = 0; i < nGrants; i++) {
        await db.insert(donorGrants).values({
          donorId: clientId,
          organizationId: orgId,
          title: `${pick(FOCUS)} Grant ${2024 + rand(3)}`,
          startDate: isoDate(daysFromNow(-rand(300))),
          endDate: isoDate(daysFromNow(rand(400) + 20)),
          totalValue: money(100_000, 3_000_000),
          reportingSchedule: pick(['Quarterly', 'Bi-annual', 'Annual']),
          nextReportingDate: isoDate(daysFromNow(rand(90) + 5)),
          status: pick(['pending', 'active', 'active', 'completed']),
          createdByUserId: ownerId(),
        })
        grantCount++
      }
      if (chance(0.6)) {
        await db
          .insert(donorProjects)
          .values({
            donorId: clientId,
            projectId: pick(projectIds),
            organizationId: orgId,
            fundingAmount: money(50_000, 1_000_000),
            notes: 'Co-funding arrangement',
            createdByUserId: ownerId(),
          })
          .onConflictDoNothing()
      }
    }

    // partnership agreements
    if (type === 'partner') {
      const nAgr = 1 + rand(2)
      for (let i = 0; i < nAgr; i++) {
        await db.insert(partnershipAgreements).values({
          partnerId: clientId,
          organizationId: orgId,
          title: `${pick(['MOU', 'Consortium Agreement', 'Sub-grant'])} — ${pick(FOCUS)}`,
          startDate: isoDate(daysFromNow(-rand(300))),
          endDate: isoDate(daysFromNow(rand(300) + 20)),
          value: money(50_000, 800_000),
          status: pick(['draft', 'active', 'active', 'expired']),
          notes: 'Strategic partnership',
          createdByUserId: ownerId(),
        })
        agreementCount++
      }
    }
  }
  consola.success(
    `Clients: ${clientIds.length} | contacts: ${contactCount} | interactions: ${interactionCount} | reminders: ${reminderCount} | grants: ${grantCount} | agreements: ${agreementCount}`
  )

  // ── 5) opportunities (50) ──
  // status spread: 25 pending, 15 accepted, 10 rejected
  const STATUS_PLAN: Array<'pending' | 'accepted' | 'rejected'> = [
    ...Array(25).fill('pending'),
    ...Array(15).fill('accepted'),
    ...Array(10).fill('rejected'),
  ]
  const acceptedOppIds: Array<{ id: string; title: string }> = []
  let oppCount = 0
  let commentCount = 0

  for (const status of STATUS_PLAN) {
    const title = `${pick(OPP_TITLES)} — ${pick(COUNTRIES)}`
    const owner = ownerId()
    const [o] = await db
      .insert(opportunities)
      .values({
        organizationId: orgId,
        title,
        description: `Opportunity to deliver ${pick(OPP_TITLES).toLowerCase()} for a ${pick(['government', 'donor', 'private sector', 'multilateral'])} client.`,
        source: pick(SOURCES),
        type: pick(TYPES),
        status,
        winProbability: chance(0.7) ? 10 + rand(90) : null,
        tags: pickN(TAGS, 1 + rand(3)),
        deadline: isoDate(daysFromNow(rand(120) - 20)),
        estimatedValue: money(20_000, 1_500_000),
        currency: 'USD',
        ownerUserId: owner,
        approvedToPursueAt: status === 'accepted' ? daysFromNow(-rand(20)) : null,
        approvedByUserId: status === 'accepted' ? ownerId() : null,
        createdByUserId: owner,
      })
      .returning({ id: opportunities.id, title: opportunities.title })
    const oppId = o!.id
    oppCount++

    // link a primary client
    if (clientIds.length) {
      await db
        .insert(opportunityClients)
        .values({
          opportunityId: oppId,
          clientId: pick(clientIds),
          organizationId: orgId,
          isPrimary: true,
        })
        .onConflictDoNothing()
    }

    // a comment on some (rejection rationale / reviewer note)
    if (status === 'rejected' || chance(0.3)) {
      await db.insert(opportunityComments).values({
        opportunityId: oppId,
        organizationId: orgId,
        kind: 'comment',
        body:
          status === 'rejected'
            ? pick([
                'Deadline too tight to mobilise a quality team.',
                'Budget ceiling below our cost base.',
                'Outside our core sectors.',
              ])
            : 'Looks promising — aligns with our expertise.',
        createdByUserId: ownerId(),
      })
      commentCount++
      await db.insert(opportunityActivities).values({
        opportunityId: oppId,
        organizationId: orgId,
        userId: owner,
        action: status === 'rejected' ? 'opportunity:rejected' : 'opportunity:status',
        details: { to: status },
      })
    }

    if (status === 'accepted') acceptedOppIds.push({ id: oppId, title })
  }
  consola.success(`Opportunities: ${oppCount} | comments: ${commentCount}`)

  // ── 6) proposals from accepted opps, spread across workflow stages ──
  const lead = userIdByEmail.get('linda@camel-os.com')!
  // Writers (contributors) — the people who author the sections.
  const writer1 = userIdByEmail.get('sam@camel-os.com')!
  const writer2 = userIdByEmail.get('priya@camel-os.com')!
  // Reviewers (≥3) — distinct from the writers (separation of duties).
  const rev1 = userIdByEmail.get('rita@camel-os.com')!
  const rev2 = userIdByEmail.get('nadia@camel-os.com')!
  const rev3 = userIdByEmail.get('omar@camel-os.com')!
  const approver = userIdByEmail.get('doris@camel-os.com')!

  type PStatus = (typeof schema.proposalStatusEnum.enumValues)[number]
  // distribute the ~15 accepted across representative stages
  const STAGE_PLAN: PStatus[] = [
    'assigned',
    'assigned',
    'drafting',
    'drafting',
    'awaiting_review',
    'awaiting_review',
    'revision_required',
    'ready_for_final_approval',
    'final_approved',
    'submitted',
    'submitted',
    'won',
    'won',
    'lost',
    'shortlisted',
  ]
  let proposalCount = 0

  for (let i = 0; i < acceptedOppIds.length; i++) {
    const opp = acceptedOppIds[i]!
    const pstatus = STAGE_PLAN[i % STAGE_PLAN.length]!
    const beyondAssigned = pstatus !== 'assigned'
    const inReviewOrLater = !['assigned', 'drafting'].includes(pstatus)

    const [p] = await db
      .insert(proposals)
      .values({
        opportunityId: opp.id,
        organizationId: orgId,
        title: opp.title,
        status: pstatus,
        deadline: isoDate(daysFromNow(rand(60) + 5)),
        contentDraft: beyondAssigned
          ? 'Executive summary, technical approach, methodology, work-plan, team, and budget narrative…'
          : null,
        decisionNote:
          pstatus === 'won'
            ? 'Strong technical score and competitive price.'
            : pstatus === 'lost'
              ? 'Outscored on local presence.'
              : null,
        submittedAt: ['submitted', 'won', 'lost', 'shortlisted'].includes(pstatus)
          ? daysFromNow(-rand(30))
          : null,
        decidedAt: ['won', 'lost', 'shortlisted', 'final_approved'].includes(pstatus)
          ? daysFromNow(-rand(10))
          : null,
        reminderRecipientUserIds: [lead, writer1],
        createdByUserId: ownerId(),
      })
      .returning({ id: proposals.id })
    const proposalId = p!.id
    proposalCount++

    // Team assignments. Every proposal has a Lead (the creator becomes lead on
    // accept — the lead-default refinement). roleLabel mirrors the configurable
    // role catalogue; distinct people per role enforce separation of duties.
    const assignments: (typeof proposalAssignments.$inferInsert)[] = [
      {
        proposalId,
        organizationId: orgId,
        roleType: 'lead',
        roleLabel: 'Proposal Lead',
        assignedUserId: lead,
      },
    ]
    if (beyondAssigned) {
      assignments.push(
        // Writing team (collaborators / contributors — can edit)
        {
          proposalId,
          organizationId: orgId,
          roleType: 'contributor',
          roleLabel: 'Author',
          assignedUserId: writer1,
        },
        {
          proposalId,
          organizationId: orgId,
          roleType: 'contributor',
          roleLabel: 'Author',
          assignedUserId: writer2,
        },
        // Review team — 3 distinct reviewers, each a different discipline
        {
          proposalId,
          organizationId: orgId,
          roleType: 'reviewer',
          roleLabel: 'Technical Reviewer',
          assignedUserId: rev1,
        },
        {
          proposalId,
          organizationId: orgId,
          roleType: 'reviewer',
          roleLabel: 'Finance Reviewer',
          assignedUserId: rev2,
        },
        {
          proposalId,
          organizationId: orgId,
          roleType: 'reviewer',
          roleLabel: 'Compliance Reviewer',
          assignedUserId: rev3,
        },
        {
          proposalId,
          organizationId: orgId,
          roleType: 'final_approver',
          roleLabel: 'Final Approver',
          assignedUserId: approver,
        }
      )
    }
    await db.insert(proposalAssignments).values(assignments)
    if (beyondAssigned) {
      await db.insert(opportunityActivities).values({
        opportunityId: opp.id,
        organizationId: orgId,
        userId: lead,
        action: 'proposal:assignment',
        details: { role: 'lead', assignedName: 'Linda Lead' },
      })
    }

    // reviewer rows + their statuses for review stages
    if (inReviewOrLater) {
      const reviewerStatus = (): (typeof schema.proposalReviewerStatusEnum.enumValues)[number] => {
        if (pstatus === 'revision_required') return chance(0.5) ? 'changes_required' : 'approved'
        if (pstatus === 'awaiting_review') return 'pending'
        return 'approved' // ready_for_final_approval and beyond
      }
      await db.insert(proposalReviewers).values([
        {
          proposalId,
          organizationId: orgId,
          reviewerUserId: rev1,
          reviewerRole: 'reviewer',
          isRequired: true,
          status: reviewerStatus(),
          feedback: 'Technical approach reviewed.',
          decidedAt: pstatus === 'awaiting_review' ? null : daysFromNow(-rand(5)),
        },
        {
          proposalId,
          organizationId: orgId,
          reviewerUserId: rev2,
          reviewerRole: 'reviewer',
          isRequired: true,
          status: reviewerStatus(),
          feedback: 'Budget reviewed.',
          decidedAt: pstatus === 'awaiting_review' ? null : daysFromNow(-rand(5)),
        },
        {
          proposalId,
          organizationId: orgId,
          reviewerUserId: rev3,
          reviewerRole: 'reviewer',
          isRequired: true,
          status: reviewerStatus(),
          feedback: 'Compliance checked.',
          decidedAt: pstatus === 'awaiting_review' ? null : daysFromNow(-rand(5)),
        },
      ])
      await db.insert(opportunityActivities).values({
        opportunityId: opp.id,
        organizationId: orgId,
        userId: lead,
        action: 'proposal:ready_for_review',
        details: { reviewerCount: 3 },
      })
    }

    // Conversation thread — varied, realistic BD chatter + system events that
    // the redesigned workspace surfaces in the right rail. Lines rotate so no
    // two proposals read the same, and the flow mirrors the real review gate.
    const msgs: Pick<
      typeof proposalMessages.$inferInsert,
      'kind' | 'body' | 'eventType' | 'authorUserId'
    >[] = [
      {
        kind: 'system',
        body: `Proposal created from the accepted opportunity "${opp.title}".`,
        eventType: 'created',
        authorUserId: null,
      },
    ]
    if (beyondAssigned) {
      const kickoff = pick([
        `Kicking off "${opp.title}". Sam — technical approach; Priya — budget & staffing. Win themes first.`,
        `Workspace is live. Let's aim to submit two days early on this one — no last-minute scrambles.`,
        `Priority bid for us. Rita, Nadia, Omar — I'll bring you in the moment the first full draft lands.`,
      ])
      const reply = pick([
        'On it — methodology and work-plan first, then past performance.',
        "I'll own the budget and the staffing matrix. Already flagging a tight travel line.",
        'Outline is up with inline notes where I need reviewer input.',
      ])
      msgs.push(
        { kind: 'message', body: kickoff, eventType: null, authorUserId: lead },
        {
          kind: 'message',
          body: reply,
          eventType: null,
          authorUserId: chance(0.5) ? writer1 : writer2,
        }
      )
    }
    if (inReviewOrLater) {
      msgs.push({
        kind: 'system',
        body: 'Sent for review — 3 reviewers required (all must align).',
        eventType: 'status_change',
        authorUserId: lead,
      })
      if (pstatus === 'awaiting_review') {
        msgs.push({
          kind: 'message',
          body: pick([
            'Starting my pass now — focusing on the technical scoring criteria.',
            "Reviewing the budget tables today; I'll flag anything over the ceiling.",
            'Running the compliance checklist against the ToR this afternoon.',
          ]),
          eventType: null,
          authorUserId: pick([rev1, rev2, rev3]),
        })
      } else if (pstatus === 'revision_required') {
        msgs.push(
          {
            kind: 'system',
            body: 'Rita (Technical) requested changes.',
            eventType: 'review_decision',
            authorUserId: rev1,
          },
          {
            kind: 'message',
            body: pick([
              'Section 2 needs a tighter logframe and measurable indicators.',
              'Budget narrative and the cost tables disagree in a few places — please reconcile.',
              'Add the risk-mitigation annex; reviewers will look for it.',
            ]),
            eventType: null,
            authorUserId: rev1,
          }
        )
      } else {
        msgs.push(
          {
            kind: 'system',
            body: 'Rita (Technical) approved.',
            eventType: 'review_decision',
            authorUserId: rev1,
          },
          {
            kind: 'system',
            body: 'Nadia (Finance) approved.',
            eventType: 'review_decision',
            authorUserId: rev2,
          },
          {
            kind: 'message',
            body: pick([
              'Compliance annex attached and verified — good to proceed.',
              'All clear from my side; nicely structured response.',
            ]),
            eventType: null,
            authorUserId: rev3,
          }
        )
      }
    }
    if (pstatus === 'submitted') {
      msgs.push({
        kind: 'system',
        body: 'Submitted to the client ahead of the deadline.',
        eventType: 'status_change',
        authorUserId: lead,
      })
    }
    if (['won', 'lost', 'shortlisted'].includes(pstatus)) {
      msgs.push({
        kind: 'system',
        body:
          pstatus === 'won'
            ? 'Outcome recorded: WON 🎉 — handover to delivery next.'
            : pstatus === 'lost'
              ? 'Outcome recorded: Lost. Debrief notes captured for next time.'
              : 'Outcome recorded: Shortlisted — preparing for the interview stage.',
        eventType: 'status_change',
        authorUserId: lead,
      })
    }
    const nowMs = Date.now()
    await db.insert(proposalMessages).values(
      msgs.map((m, idx) => ({
        ...m,
        proposalId,
        organizationId: orgId,
        createdAt: new Date(nowMs - (msgs.length - idx) * 3_600_000),
      }))
    )

    // Document version history (PM-03) — a couple of snapshots for drafts.
    if (beyondAssigned) {
      await db.insert(proposalDocumentVersions).values([
        {
          proposalId,
          organizationId: orgId,
          content: `<h1>${opp.title}</h1><h2>Outline</h2><p>Section headings and overall approach — first pass.</p>`,
          savedByUserId: writer1,
          createdAt: daysFromNow(-3),
        },
        {
          proposalId,
          organizationId: orgId,
          content: `<h1>${opp.title}</h1><h2>Executive summary</h2><p>We propose a phased delivery aligned to the client's objectives.</p><h2>Technical approach</h2><p>Methodology, work-plan, and quality assurance.</p><h2>Team &amp; budget</h2><p>Staffing matrix and a value-for-money budget narrative.</p>`,
          savedByUserId: writer2,
          createdAt: daysFromNow(-1),
        },
      ])
    }
  }
  consola.success(`Proposals: ${proposalCount} (spread across the workflow)`)

  // ── Communications (S7–S10) ──────────────────────────────────────────────────
  const commsAuthor = userIdByEmail.get('cathy@camel-os.com')!
  const commsLead = userIdByEmail.get('carl@camel-os.com')!
  const cm = [
    userIdByEmail.get('rita@camel-os.com')!,
    userIdByEmail.get('nadia@camel-os.com')!,
    userIdByEmail.get('omar@camel-os.com')!,
  ]

  const [campA] = await db
    .insert(campaigns)
    .values({
      organizationId: orgId,
      name: 'Q3 Agriculture Thought-Leadership',
      objective: 'Position the firm as a leader in agricultural transformation across East Africa.',
      audience: 'Development partners, government, agribusiness',
      startDate: isoDate(daysFromNow(-30)),
      endDate: isoDate(daysFromNow(60)),
      budgetPlanned: '15000.00',
      currency: 'USD',
      status: 'active',
      ownerUserId: commsLead,
    })
    .returning({ id: campaigns.id })
  const [campB] = await db
    .insert(campaigns)
    .values({
      organizationId: orgId,
      name: 'Annual Report 2026 Launch',
      objective: 'Drive awareness and downloads of the annual report.',
      audience: 'Clients, donors, staff',
      startDate: isoDate(daysFromNow(20)),
      endDate: isoDate(daysFromNow(80)),
      budgetPlanned: '8000.00',
      currency: 'USD',
      status: 'planning',
      ownerUserId: commsLead,
    })
    .returning({ id: campaigns.id })
  await db.insert(campaignBudgetLines).values([
    {
      campaignId: campA!.id,
      organizationId: orgId,
      label: 'Paid social promotion',
      plannedAmount: '6000.00',
      actualAmount: '4200.00',
    },
    {
      campaignId: campA!.id,
      organizationId: orgId,
      label: 'Design & production',
      plannedAmount: '5000.00',
      actualAmount: '5200.00',
    },
    {
      campaignId: campA!.id,
      organizationId: orgId,
      label: 'Webinar platform',
      plannedAmount: '2000.00',
      actualAmount: '1500.00',
    },
  ])

  const CONTENT_PLAN = [
    {
      title: 'Unlocking Climate-Smart Agriculture in Tanzania',
      type: 'insight',
      category: 'Agriculture',
      status: 'published',
      campaign: 'A',
      metrics: true,
    },
    {
      title: 'Five Lessons from Our M&E Practice',
      type: 'article',
      category: 'M&E',
      status: 'published',
      campaign: null,
      metrics: true,
    },
    {
      title: 'Digital Finance: A 2026 Outlook',
      type: 'report',
      category: 'Finance',
      status: 'approved',
      campaign: 'A',
      metrics: false,
    },
    {
      title: 'Strengthening Health Systems — Field Notes',
      type: 'insight',
      category: 'Health',
      status: 'in_review',
      campaign: null,
      metrics: false,
    },
    {
      title: 'Youth Employment: What Works',
      type: 'article',
      category: 'Employment',
      status: 'changes_requested',
      campaign: 'A',
      metrics: false,
    },
    {
      title: 'Governance Reform Brief',
      type: 'insight',
      category: 'Governance',
      status: 'draft',
      campaign: null,
      metrics: false,
    },
    {
      title: 'Water & Sanitation Trends',
      type: 'news',
      category: 'WASH',
      status: 'draft',
      campaign: 'B',
      metrics: false,
    },
    {
      title: 'Legacy Tax Policy Review',
      type: 'report',
      category: 'Finance',
      status: 'archived',
      campaign: null,
      metrics: false,
    },
  ] as const
  // Rich, distinct article bodies so the editor shows real-looking content.
  const GENERIC_BODY =
    '<h2>Executive summary</h2><p>Key findings and what they mean for practitioners.</p><h2>Background</h2><p>Context and our approach.</p><h2>Recommendations</h2><ul><li>Invest in local capacity</li><li>Leverage data and evidence</li><li>Partner deliberately</li></ul>'
  const BODIES: Record<string, string> = {
    'Unlocking Climate-Smart Agriculture in Tanzania':
      '<p><em>How smallholder farmers in the Southern Highlands are turning climate risk into resilience — and what funders should back next.</em></p>' +
      '<h2>The challenge</h2><p>Erratic rainfall and prolonged dry spells have cut maize yields by up to 30% in parts of Mbeya and Iringa over the last five seasons. For households that depend on a single harvest, that volatility is the difference between school fees paid and a year lost.</p>' +
      '<h2>What we found</h2><p>Across 12 farmer cooperatives we supported, three practices consistently outperformed:</p><ul><li><strong>Drought-tolerant seed</strong> paired with extension follow-up raised yields 18–24%.</li><li><strong>Conservation tillage</strong> cut input costs and protected soil moisture.</li><li><strong>Weather-indexed advisories</strong> by SMS shifted planting dates to match the real onset of rains.</li></ul>' +
      '<blockquote>“We stopped guessing the rains. Now we plant when the message says plant.” — Cooperative chair, Mbeya</blockquote>' +
      '<h2>Recommendations for funders</h2><ol><li>Fund the <strong>advisory layer</strong>, not just inputs — behaviour change is where the yield is.</li><li>Tie disbursement to <strong>cooperative-level outcomes</strong>, not activity counts.</li><li>Invest in <strong>local agro-dealers</strong> so improved seed is available within 5km.</li></ol>',
    'Five Lessons from Our M&E Practice':
      '<p><em>A decade of measuring what matters has taught us as much about humility as about methods.</em></p>' +
      '<h2>1. Design the evaluation before the project</h2><p>Baselines collected after activities begin are the single most common — and most expensive — mistake we see.</p>' +
      '<h2>2. Mixed methods beat clever statistics</h2><p>A well-run focus group often explains <em>why</em> an indicator moved better than another regression ever will.</p>' +
      '<h2>3. Data that nobody uses is waste</h2><p>We now ship a one-page decision brief with every dataset. Dashboards are for analysts; decisions need narrative.</p>' +
      '<h2>4. Counterfactuals are a discipline, not a luxury</h2><p>Even a light comparison group changes how confidently you can attribute results.</p>' +
      '<h2>5. Build the client&rsquo;s capacity, not your dependency</h2><p>The best evaluation leaves the partner able to run the next one themselves.</p>',
    'Digital Finance: A 2026 Outlook':
      '<p><em>Mobile money matured a decade ago. The next frontier is credit, insurance, and interoperable rails.</em></p>' +
      '<h2>Market signals</h2><p>Agent networks have saturated urban centres; growth is now rural and driven by merchant payments. Regulators across the region are converging on interoperability mandates.</p>' +
      '<h2>Three shifts to watch</h2><ul><li><strong>Embedded credit</strong> — nano-loans underwritten on transaction history.</li><li><strong>Parametric insurance</strong> — pay-outs triggered by weather data, not claims.</li><li><strong>Open rails</strong> — wallet-to-bank interoperability lowering the cost of moving money.</li></ul>' +
      '<h2>Risks</h2><p>Over-indebtedness and opaque pricing remain the sector&rsquo;s reputational exposure. Consumer-protection design is now a commercial necessity, not a compliance afterthought.</p>' +
      '<h2>Our view</h2><p>Institutions that treat data governance as a product feature — not a back-office cost — will own the next cycle.</p>',
    'Strengthening Health Systems — Field Notes':
      '<p><em>Notes from six district health facilities on what actually moves service quality.</em></p>' +
      '<h2>Supply is necessary, not sufficient</h2><p>Stocked pharmacies with absent staff still fail patients. The binding constraint was almost always <strong>health-worker time and morale</strong>, not commodities.</p>' +
      '<h2>What worked</h2><ul><li>Supportive supervision visits (monthly, structured) lifted protocol adherence.</li><li>Simple performance dashboards posted in the facility created peer accountability.</li><li>Community health workers closed the referral loop that clinics could not.</li></ul>' +
      '<h2>What we&rsquo;re still testing</h2><p>Results-based financing shows promise but risks gaming. We are watching data-quality audits closely before scaling.</p>',
    'Youth Employment: What Works':
      '<p><em>Skills training alone rarely creates jobs. The evidence points to bundles, not silver bullets.</em></p>' +
      '<h2>The honest baseline</h2><p>Tracer studies show many standalone training programmes return graduates to the same labour market that had no demand for them.</p>' +
      '<h2>What shifts outcomes</h2><ol><li><strong>Demand-led design</strong> — train for jobs employers are actively hiring for.</li><li><strong>Wage subsidies + mentorship</strong> to lower the cost of the first hire.</li><li><strong>Self-employment grants</strong> for those in markets without formal jobs.</li></ol>' +
      '<h2>Measurement caution</h2><p>Six-month employment is a weak proxy. We recommend 18-month income tracking to capture what lasts.</p>',
    'Governance Reform Brief':
      '<p><em>Transparency tools deliver only when citizens can act on what they see.</em></p>' +
      '<h2>Context</h2><p>Open-budget portals have multiplied, but use remains thin. Publishing data is the start of accountability, not the end of it.</p>' +
      '<h2>Recommendations</h2><ul><li>Pair disclosure with <strong>civic intermediaries</strong> who translate data into local issues.</li><li>Create <strong>feedback channels</strong> with a duty to respond, not just to receive.</li><li>Protect the reformers inside government who carry political risk.</li></ul>',
    'Water & Sanitation Trends':
      '<p><em>A short briefing on where WASH investment is heading this year.</em></p>' +
      '<h2>Headlines</h2><ul><li>Professionalised rural water management is replacing volunteer committees.</li><li>Faecal-sludge management is finally attracting blended finance.</li><li>Climate resilience is now a procurement requirement, not an add-on.</li></ul>' +
      '<h2>Implication</h2><p>Funders are shifting from building infrastructure to financing the <strong>service</strong> that keeps it running.</p>',
    'Legacy Tax Policy Review':
      '<p><em>Archived for reference — superseded by the 2026 fiscal framework.</em></p>' +
      '<h2>Summary</h2><p>This review assessed the prior administration&rsquo;s tax-incentive regime and its revenue trade-offs.</p>' +
      '<h2>Key finding</h2><p>Discretionary exemptions eroded the base faster than they attracted investment, with limited transparency on cost.</p>',
  }
  for (const c of CONTENT_PLAN) {
    const published = c.status === 'published'
    const [ci] = await db
      .insert(contentItems)
      .values({
        organizationId: orgId,
        title: c.title,
        type: c.type,
        category: c.category,
        excerpt: `${c.title} — a concise, practical perspective from our consultants.`,
        body: `<h1>${c.title}</h1>${BODIES[c.title] ?? GENERIC_BODY}`,
        tags: [c.category.toLowerCase()],
        status: c.status,
        authorUserId: commsAuthor,
        campaignId: c.campaign === 'A' ? campA!.id : c.campaign === 'B' ? campB!.id : null,
        scheduledFor: ['approved', 'in_review'].includes(c.status)
          ? daysFromNow(rand(20) + 3)
          : null,
        publishedAt: published ? daysFromNow(-rand(20) - 1) : null,
      })
      .returning({ id: contentItems.id })
    const id = ci!.id

    if (['in_review', 'changes_requested', 'approved', 'published'].includes(c.status)) {
      const decisions: ('pending' | 'approved' | 'changes_requested')[] =
        c.status === 'in_review'
          ? ['pending', 'pending', 'approved']
          : c.status === 'changes_requested'
            ? ['changes_requested', 'approved', 'pending']
            : ['approved', 'approved', 'approved']
      await db.insert(contentReviews).values(
        cm.map((uid, i) => ({
          contentItemId: id,
          organizationId: orgId,
          reviewerUserId: uid,
          stepOrder: 1,
          decision: decisions[i]!,
          comment:
            decisions[i] === 'changes_requested'
              ? 'Please tighten section 2 and add a recent data point.'
              : null,
          decidedAt: decisions[i] !== 'pending' ? daysFromNow(-rand(5)) : null,
        }))
      )
      await db.insert(contentComments).values([
        {
          contentItemId: id,
          organizationId: orgId,
          authorUserId: null,
          body: 'Sent for review — 3 reviewers assigned.',
        },
        {
          contentItemId: id,
          organizationId: orgId,
          authorUserId: cm[0]!,
          body: 'Reviewing now — strong angle on this one.',
        },
      ])
    }

    if (published && c.metrics) {
      const days = 6
      await db.insert(contentMetrics).values(
        Array.from({ length: days }, (_, i) => ({
          contentItemId: id,
          organizationId: orgId,
          metricDate: isoDate(daysFromNow(-(days - i) * 2)),
          impressions: 200 + rand(800),
          clicks: 10 + rand(120),
          shares: rand(40),
          likes: rand(90),
        }))
      )
    }
  }

  const STAKE = [
    {
      name: 'Ministry of Agriculture',
      type: 'Government',
      sector: 'Public',
      geography: 'Tanzania',
      influence: 'high',
      interest: 'high',
      strategy: 'Manage closely',
    },
    {
      name: 'Gates Foundation',
      type: 'Donor',
      sector: 'Philanthropy',
      geography: 'Global',
      influence: 'high',
      interest: 'medium',
      strategy: 'Keep satisfied',
    },
    {
      name: 'Daily News',
      type: 'Media',
      sector: 'Media',
      geography: 'Tanzania',
      influence: 'medium',
      interest: 'high',
      strategy: 'Keep informed',
    },
    {
      name: 'Agribusiness Council',
      type: 'Partner',
      sector: 'Private',
      geography: 'East Africa',
      influence: 'medium',
      interest: 'medium',
      strategy: 'Keep informed',
    },
    {
      name: 'University of Dar es Salaam',
      type: 'Academia',
      sector: 'Education',
      geography: 'Tanzania',
      influence: 'low',
      interest: 'high',
      strategy: 'Keep informed',
    },
    {
      name: 'Local Farmers Cooperative',
      type: 'Community',
      sector: 'Agriculture',
      geography: 'Mwanza',
      influence: 'low',
      interest: 'low',
      strategy: 'Monitor',
    },
  ] as const
  for (const s of STAKE) {
    const [sk] = await db
      .insert(stakeholders)
      .values({
        organizationId: orgId,
        name: s.name,
        type: s.type,
        sector: s.sector,
        geography: s.geography,
        influence: s.influence,
        interest: s.interest,
        engagementStrategy: s.strategy,
        ownerUserId: commsLead,
      })
      .returning({ id: stakeholders.id })
    await db.insert(stakeholderActivities).values({
      stakeholderId: sk!.id,
      organizationId: orgId,
      activityDate: isoDate(daysFromNow(-rand(30) - 1)),
      type: pick(['Meeting', 'Call', 'Email', 'Event']),
      description: `Engaged ${s.name} on upcoming collaboration.`,
      outcome: 'Positive — agreed to follow up.',
      nextStep: 'Share concept note.',
      loggedByUserId: commsLead,
    })
  }

  const MENTIONS = [
    {
      title: 'Sahara Consult drives agri-innovation forum',
      outlet: 'Daily News',
      sourceType: 'print',
      sentiment: 'positive',
    },
    {
      title: 'Consultancy report shapes policy debate',
      outlet: 'The Citizen',
      sourceType: 'online',
      sentiment: 'positive',
    },
    {
      title: 'Experts weigh in on water access',
      outlet: 'TBC',
      sourceType: 'tv',
      sentiment: 'neutral',
    },
    {
      title: 'Mixed reactions to reform proposals',
      outlet: 'Mwananchi',
      sourceType: 'online',
      sentiment: 'negative',
    },
    {
      title: 'Radio panel features our economist',
      outlet: 'Radio One',
      sourceType: 'radio',
      sentiment: 'positive',
    },
    {
      title: 'Social thread questions methodology',
      outlet: 'X / Twitter',
      sourceType: 'social',
      sentiment: 'negative',
    },
    {
      title: 'Annual report widely shared online',
      outlet: 'LinkedIn',
      sourceType: 'social',
      sentiment: 'positive',
    },
    {
      title: 'Op-ed cites our findings',
      outlet: 'The Guardian',
      sourceType: 'print',
      sentiment: 'neutral',
    },
  ] as const
  await db.insert(mediaMentions).values(
    MENTIONS.map((m, i) => {
      const flag = m.sentiment === 'negative' && i % 2 === 0
      return {
        organizationId: orgId,
        title: m.title,
        outlet: m.outlet,
        sourceType: m.sourceType,
        sentiment: m.sentiment,
        url: 'https://example.com/news',
        mentionDate: isoDate(daysFromNow(-rand(40) - 1)),
        summary: 'Coverage referencing Sahara Consult work.',
        flagged: flag,
        escalationNote: flag ? 'Negative coverage — recommend a coordinated response.' : null,
        flaggedByUserId: flag ? commsLead : null,
        flaggedAt: flag ? daysFromNow(-rand(5)) : null,
        createdByUserId: commsAuthor,
      }
    })
  )

  consola.success(
    `Communications: ${CONTENT_PLAN.length} content items, 2 campaigns, ${STAKE.length} stakeholders, ${MENTIONS.length} media mentions.`
  )

  // ── Project Management (S14–S15) — enrich the first few stub projects ─────────
  const pmCandidates = [
    userIdByEmail.get('paul@camel-os.com')!,
    userIdByEmail.get('david@camel-os.com')!,
    userIdByEmail.get('maria@camel-os.com')!,
  ]
  const teamPool = [
    userIdByEmail.get('sam@camel-os.com')!,
    userIdByEmail.get('priya@camel-os.com')!,
    userIdByEmail.get('rita@camel-os.com')!,
    userIdByEmail.get('nadia@camel-os.com')!,
    userIdByEmail.get('omar@camel-os.com')!,
    userIdByEmail.get('ben@camel-os.com')!,
  ]
  const memberRoles = ['Lead Consultant', 'Analyst', 'M&E Specialist', 'Field Coordinator']
  const enriched = projectIds.slice(0, 5)
  for (const pid of enriched) {
    const pm = pick(pmCandidates)
    await db
      .update(projects)
      .set({
        projectManagerUserId: pm,
        status: 'active',
        scope:
          'Deliver the engagement to scope, schedule, and budget with quarterly client reporting.',
      })
      .where(eq(projects.id, pid))

    const team = pickN(teamPool, 3 + rand(2))
    await db.insert(projectMembers).values(
      team.map((u, i) => ({
        projectId: pid,
        organizationId: orgId,
        userId: u,
        role: memberRoles[i % memberRoles.length]!,
        allocationPct: pick([50, 75, 100]),
      }))
    )

    const msPlan: {
      name: string
      status: 'completed' | 'in_progress' | 'not_started'
      due: number
    }[] = [
      { name: 'Inception & work-plan', status: 'completed', due: -60 },
      { name: 'Fieldwork & data collection', status: 'in_progress', due: 20 },
      { name: 'Analysis & draft report', status: 'not_started', due: 60 },
      { name: 'Final report & close-out', status: 'not_started', due: 100 },
    ]
    const msIds: string[] = []
    for (let i = 0; i < msPlan.length; i++) {
      const m = msPlan[i]!
      const [ms] = await db
        .insert(projectMilestones)
        .values({
          projectId: pid,
          organizationId: orgId,
          name: m.name,
          status: m.status,
          dueDate: isoDate(daysFromNow(m.due)),
          orderIndex: i,
          completedAt: m.status === 'completed' ? daysFromNow(m.due) : null,
        })
        .returning({ id: projectMilestones.id })
      msIds.push(ms!.id)
    }

    const actStatuses: ('todo' | 'in_progress' | 'blocked' | 'done')[] = [
      'done',
      'in_progress',
      'todo',
    ]
    for (let mi = 0; mi < msIds.length; mi++) {
      const base = daysFromNow(-50 + mi * 30)
      for (let a = 0; a < 2; a++) {
        const st = msPlan[mi]!.status === 'completed' ? 'done' : actStatuses[(mi + a) % 3]!
        await db.insert(projectActivities).values({
          projectId: pid,
          organizationId: orgId,
          milestoneId: msIds[mi]!,
          name: `${msPlan[mi]!.name.split(' ')[0]} task ${a + 1}`,
          assignedUserId: pick(team),
          startDate: isoDate(base),
          endDate: isoDate(new Date(base.getTime() + (7 + rand(14)) * 86_400_000)),
          plannedHours: String(20 + rand(40)),
          percentComplete: st === 'done' ? 100 : st === 'in_progress' ? 30 + rand(50) : 0,
          status: st,
        })
      }
    }

    await db.insert(projectBudgetLines).values([
      {
        projectId: pid,
        organizationId: orgId,
        category: 'Personnel',
        phase: 'All phases',
        originalAmount: '120000.00',
        revisedAmount: '128000.00',
      },
      {
        projectId: pid,
        organizationId: orgId,
        category: 'Travel & fieldwork',
        phase: 'Phase 2',
        originalAmount: '40000.00',
        revisedAmount: null,
      },
      {
        projectId: pid,
        organizationId: orgId,
        category: 'Equipment & supplies',
        phase: 'Phase 1',
        originalAmount: '15000.00',
        revisedAmount: null,
      },
    ])
    await db.insert(projectExpenses).values([
      {
        projectId: pid,
        organizationId: orgId,
        amount: '32000.00',
        category: 'Personnel',
        expenseDate: isoDate(daysFromNow(-40)),
        description: 'Consultant fees — month 1',
        createdByUserId: pm,
      },
      {
        projectId: pid,
        organizationId: orgId,
        amount: '11500.00',
        category: 'Travel & fieldwork',
        expenseDate: isoDate(daysFromNow(-15)),
        description: 'Field mission — Mwanza',
        createdByUserId: pm,
      },
    ])
    await db.insert(projectVendors).values({
      projectId: pid,
      organizationId: orgId,
      name: pick(['Savannah Data Co', 'Rift Survey Partners', 'Coastal Translators']),
      contactName: 'Vendor Contact',
      contractAmount: '18000.00',
      currency: 'USD',
      scope: 'Enumerator hire and data entry',
      paymentSchedule: '50% on signing, 50% on delivery',
    })
    await db.insert(projectReports).values([
      {
        projectId: pid,
        organizationId: orgId,
        title: 'Inception Report',
        status: 'approved',
        content: '## Summary\nInception complete.\n',
        authorUserId: pm,
      },
      {
        projectId: pid,
        organizationId: orgId,
        title: 'Monthly Progress — latest',
        status: 'in_review',
        content: '## Summary\nFieldwork underway.\n',
        authorUserId: pick(team),
      },
    ])
    for (const u of team) {
      await db.insert(timesheetEntries).values(
        Array.from({ length: 3 }, (_, w) => ({
          organizationId: orgId,
          projectId: pid,
          userId: u,
          entryDate: isoDate(daysFromNow(-(w + 1) * 7)),
          hours: String(15 + rand(20)),
          note: 'Weekly delivery work',
        }))
      )
    }
  }
  consola.success(
    `Projects: enriched ${enriched.length} with full PM data (team, milestones, budget, reports).`
  )

  consola.box(
    [
      'Demo data seeded ✔',
      '',
      `Login password for every seeded user: ${PASSWORD}`,
      'Key demo logins:',
      '  david@camel-os.com  → Manager (accepts/rejects opportunities)',
      '  linda@camel-os.com  → BD Officer (creates opportunities) + Proposal Lead',
      '  sam@camel-os.com    → Consultant (proposal writer)',
      '  priya@camel-os.com  → Consultant (proposal writer)',
      '  rita / nadia / omar @camel-os.com → Reviewers (the 3-reviewer gate)',
      '  doris@camel-os.com  → Final Approver',
    ].join('\n')
  )

  await client.end()
  process.exit(0)
}

run().catch((err) => {
  consola.error(err)
  process.exit(1)
})
