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
  clientContacts,
  clientInteractions,
  clientReminders,
  clients,
  donorGrants,
  donorProjects,
  opportunities,
  opportunityActivities,
  opportunityClients,
  opportunityComments,
  organizationMembers,
  organizations,
  partnershipAgreements,
  projects,
  proposalAssignments,
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
  consola.success('Wiped clients, opportunities, proposals, grants, agreements, projects.')

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
  const tech = userIdByEmail.get('sam@camel-os.com')!
  const fin = userIdByEmail.get('priya@camel-os.com')!
  const comp = userIdByEmail.get('rita@camel-os.com')!
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
        reminderRecipientUserIds: [lead, tech],
        createdByUserId: ownerId(),
      })
      .returning({ id: proposals.id })
    const proposalId = p!.id
    proposalCount++

    // assignments once we're past 'assigned'
    if (beyondAssigned) {
      await db.insert(proposalAssignments).values([
        { proposalId, organizationId: orgId, roleType: 'lead', assignedUserId: lead },
        { proposalId, organizationId: orgId, roleType: 'technical_reviewer', assignedUserId: tech },
        { proposalId, organizationId: orgId, roleType: 'finance_reviewer', assignedUserId: fin },
        {
          proposalId,
          organizationId: orgId,
          roleType: 'compliance_reviewer',
          assignedUserId: comp,
        },
        { proposalId, organizationId: orgId, roleType: 'final_approver', assignedUserId: approver },
      ])
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
          reviewerUserId: tech,
          reviewerRole: 'technical_reviewer',
          isRequired: true,
          status: reviewerStatus(),
          feedback: 'Technical approach reviewed.',
          decidedAt: pstatus === 'awaiting_review' ? null : daysFromNow(-rand(5)),
        },
        {
          proposalId,
          organizationId: orgId,
          reviewerUserId: fin,
          reviewerRole: 'finance_reviewer',
          isRequired: true,
          status: reviewerStatus(),
          feedback: 'Budget reviewed.',
          decidedAt: pstatus === 'awaiting_review' ? null : daysFromNow(-rand(5)),
        },
        {
          proposalId,
          organizationId: orgId,
          reviewerUserId: comp,
          reviewerRole: 'compliance_reviewer',
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
  }
  consola.success(`Proposals: ${proposalCount} (spread across the workflow)`)

  consola.box(
    [
      'Demo data seeded ✔',
      '',
      `Login password for every seeded user: ${PASSWORD}`,
      'Key demo logins:',
      '  linda@camel-os.com  → Proposal Lead',
      '  sam@camel-os.com    → Technical Reviewer',
      '  priya@camel-os.com  → Finance Reviewer',
      '  rita@camel-os.com   → Compliance Reviewer',
      '  doris@camel-os.com  → Final Approver',
      '  david@camel-os.com  → Manager (pipeline + accept)',
    ].join('\n')
  )

  await client.end()
  process.exit(0)
}

run().catch((err) => {
  consola.error(err)
  process.exit(1)
})
