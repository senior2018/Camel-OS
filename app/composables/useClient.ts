import type {
  ClientInteractionType,
  ClientMetadata,
  ClientType,
  CreateContactPayload,
  CreateGrantPayload,
  CreateInteractionPayload,
  CreateReminderPayload,
  DonorGrantStatus,
  UpdateClientPayload,
  UpdateContactPayload,
  UpdateGrantPayload,
  UpdateInteractionPayload,
  UpdateReminderPayload,
} from '@@/shared/schemas/client'
import type { OpportunityStage } from '@@/shared/schemas/opportunity'
import type {
  CreateAgreementPayload,
  PartnershipAgreementStatus,
  UpdateAgreementPayload,
} from '@@/shared/schemas/partnership'
import type {
  LinkDonorProjectPayload,
  ProjectStatus,
  UpdateDonorProjectPayload,
} from '@@/shared/schemas/project'

export interface ClientDetail {
  id: string
  name: string
  type: ClientType
  industry: string | null
  country: string | null
  website: string | null
  phone: string | null
  email: string | null
  notes: string | null
  metadata: ClientMetadata | null
  ownerUserId: string | null
  ownerEmail: string | null
  ownerFirstName: string | null
  ownerLastName: string | null
  createdByUserId: string | null
  createdAt: string
  updatedAt: string
}

export interface ClientContact {
  id: string
  clientId: string
  firstName: string
  lastName: string | null
  title: string | null
  email: string | null
  phone: string | null
  isPrimary: boolean
  createdAt: string
  updatedAt: string
}

export interface ClientInteraction {
  id: string
  type: ClientInteractionType
  occurredAt: string
  summary: string
  followUpAt: string | null
  followUpAction: string | null
  contactId: string | null
  createdByUserId: string | null
  createdAt: string
  createdByFirstName: string | null
  createdByLastName: string | null
  createdByEmail: string | null
}

export interface ClientLinkedOpportunity {
  opportunityId: string
  title: string
  stage: OpportunityStage
  estimatedValue: string | null
  currency: string
  deadline: string | null
  isPrimary: boolean
}

export interface ClientReminder {
  id: string
  dueAt: string
  message: string
  completedAt: string | null
  assignedUserId: string
  contactId: string | null
  createdAt: string
  assignedFirstName: string | null
  assignedLastName: string | null
  assignedEmail: string | null
}

export interface DonorGrant {
  id: string
  donorId: string
  title: string
  startDate: string | null
  endDate: string | null
  totalValue: string | null
  currency: string
  reportingSchedule: string | null
  nextReportingDate: string | null
  status: DonorGrantStatus
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface DonorFundedProject {
  projectId: string
  name: string
  code: string | null
  status: ProjectStatus
  startDate: string | null
  endDate: string | null
  fundingAmount: string | null
  currency: string
  notes: string | null
  createdAt: string
}

export interface PartnershipAgreement {
  id: string
  partnerId: string
  title: string
  startDate: string | null
  endDate: string | null
  value: string | null
  currency: string
  status: PartnershipAgreementStatus
  documentUrl: string | null
  notes: string | null
  renewalNotifiedAt90: string | null
  renewalNotifiedAt30: string | null
  createdAt: string
  updatedAt: string
}

export interface ClientDetailResponse {
  client: ClientDetail
  contacts: ClientContact[]
  interactions: ClientInteraction[]
  linkedOpportunities: ClientLinkedOpportunity[]
  reminders: ClientReminder[]
  grants: DonorGrant[]
  fundedProjects: DonorFundedProject[]
  agreements: PartnershipAgreement[]
}

/**
 * Detail-page composable: one bundle fetch + a mutation API for every related
 * resource (contacts, interactions, opportunity links, reminders). Each mutation
 * refreshes the bundle so the UI always reflects DB truth.
 */
export function useClient(id: Ref<string>) {
  const toast = useToast()
  const data = ref<ClientDetailResponse | null>(null)
  const status = ref<'idle' | 'pending' | 'success' | 'error'>('idle')

  async function refresh() {
    if (!id.value) return
    status.value = 'pending'
    try {
      data.value = await $fetch<ClientDetailResponse>(`/api/clients/${id.value}`)
      status.value = 'success'
    } catch {
      data.value = null
      status.value = 'error'
    }
  }

  watch(id, refresh, { immediate: true })

  function extractMessage(err: unknown, fallback: string) {
    return (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? fallback
  }

  async function withToast<T>(
    fn: () => Promise<T>,
    successTitle: string,
    failureTitle: string
  ): Promise<T | null> {
    try {
      const res = await fn()
      toast.add({ title: successTitle, color: 'success' })
      await refresh()
      return res
    } catch (err) {
      toast.add({
        title: failureTitle,
        description: extractMessage(err, 'Please try again.'),
        color: 'error',
      })
      return null
    }
  }

  // Client profile -------------------------------------------------------------
  function updateClient(payload: UpdateClientPayload) {
    return withToast(
      () => $fetch(`/api/clients/${id.value}`, { method: 'PATCH', body: payload }),
      'Client updated',
      'Update failed'
    )
  }

  // Contacts -------------------------------------------------------------------
  function addContact(payload: CreateContactPayload) {
    return withToast(
      () => $fetch(`/api/clients/${id.value}/contacts`, { method: 'POST', body: payload }),
      'Contact added',
      'Could not add contact'
    )
  }
  function updateContact(contactId: string, payload: UpdateContactPayload) {
    return withToast(
      () =>
        $fetch(`/api/clients/${id.value}/contacts/${contactId}`, {
          method: 'PATCH',
          body: payload,
        }),
      'Contact updated',
      'Update failed'
    )
  }
  function removeContact(contactId: string) {
    return withToast(
      () => $fetch(`/api/clients/${id.value}/contacts/${contactId}`, { method: 'DELETE' }),
      'Contact removed',
      'Delete failed'
    )
  }

  // Interactions ---------------------------------------------------------------
  function logInteraction(payload: CreateInteractionPayload) {
    return withToast(
      () => $fetch(`/api/clients/${id.value}/interactions`, { method: 'POST', body: payload }),
      'Interaction logged',
      'Could not log interaction'
    )
  }
  function updateInteraction(interactionId: string, payload: UpdateInteractionPayload) {
    return withToast(
      () =>
        $fetch(`/api/clients/${id.value}/interactions/${interactionId}`, {
          method: 'PATCH',
          body: payload,
        }),
      'Interaction updated',
      'Update failed'
    )
  }
  function removeInteraction(interactionId: string) {
    return withToast(
      () => $fetch(`/api/clients/${id.value}/interactions/${interactionId}`, { method: 'DELETE' }),
      'Interaction removed',
      'Delete failed'
    )
  }

  // Opportunity links ----------------------------------------------------------
  // After link/unlink we invalidate the opportunities-list cache too so that if
  // the user navigates back to /opportunities, the card immediately reflects the
  // new (or removed) primary-client name.
  async function refreshOpportunitiesList() {
    await refreshNuxtData('opportunities-list')
  }
  async function linkOpportunity(opportunityId: string, isPrimary = false) {
    const res = await withToast(
      () =>
        $fetch(`/api/clients/${id.value}/opportunities`, {
          method: 'POST',
          body: { opportunityId, isPrimary },
        }),
      'Opportunity linked',
      'Could not link'
    )
    if (res) await refreshOpportunitiesList()
    return res
  }
  async function unlinkOpportunity(opportunityId: string) {
    const res = await withToast(
      () => $fetch(`/api/clients/${id.value}/opportunities/${opportunityId}`, { method: 'DELETE' }),
      'Opportunity unlinked',
      'Could not unlink'
    )
    if (res) await refreshOpportunitiesList()
    return res
  }

  // Donor grants ---------------------------------------------------------------
  function createGrant(payload: CreateGrantPayload) {
    return withToast(
      () => $fetch(`/api/clients/${id.value}/grants`, { method: 'POST', body: payload }),
      'Grant added',
      'Could not add grant'
    )
  }
  function updateGrant(grantId: string, payload: UpdateGrantPayload) {
    return withToast(
      () =>
        $fetch(`/api/clients/${id.value}/grants/${grantId}`, { method: 'PATCH', body: payload }),
      'Grant updated',
      'Update failed'
    )
  }
  function removeGrant(grantId: string) {
    return withToast(
      () => $fetch(`/api/clients/${id.value}/grants/${grantId}`, { method: 'DELETE' }),
      'Grant removed',
      'Delete failed'
    )
  }

  // Funded projects (CR-10) ----------------------------------------------------
  function linkProject(payload: LinkDonorProjectPayload) {
    return withToast(
      () => $fetch(`/api/clients/${id.value}/projects`, { method: 'POST', body: payload }),
      'Project linked',
      'Could not link project'
    )
  }
  function updateProjectLink(projectId: string, payload: UpdateDonorProjectPayload) {
    return withToast(
      () =>
        $fetch(`/api/clients/${id.value}/projects/${projectId}`, {
          method: 'PATCH',
          body: payload,
        }),
      'Funding updated',
      'Update failed'
    )
  }
  function unlinkProject(projectId: string) {
    return withToast(
      () => $fetch(`/api/clients/${id.value}/projects/${projectId}`, { method: 'DELETE' }),
      'Project unlinked',
      'Could not unlink project'
    )
  }

  // Partnership agreements (CR-11) ---------------------------------------------
  function createAgreement(payload: CreateAgreementPayload) {
    return withToast(
      () => $fetch(`/api/clients/${id.value}/agreements`, { method: 'POST', body: payload }),
      'Agreement added',
      'Could not add agreement'
    )
  }
  function updateAgreement(agreementId: string, payload: UpdateAgreementPayload) {
    return withToast(
      () =>
        $fetch(`/api/clients/${id.value}/agreements/${agreementId}`, {
          method: 'PATCH',
          body: payload,
        }),
      'Agreement updated',
      'Update failed'
    )
  }
  function removeAgreement(agreementId: string) {
    return withToast(
      () => $fetch(`/api/clients/${id.value}/agreements/${agreementId}`, { method: 'DELETE' }),
      'Agreement removed',
      'Delete failed'
    )
  }

  // Reminders ------------------------------------------------------------------
  function createReminder(payload: CreateReminderPayload) {
    return withToast(
      () => $fetch(`/api/clients/${id.value}/reminders`, { method: 'POST', body: payload }),
      'Reminder created',
      'Could not create reminder'
    )
  }
  function updateReminder(reminderId: string, payload: UpdateReminderPayload) {
    return withToast(
      () =>
        $fetch(`/api/clients/${id.value}/reminders/${reminderId}`, {
          method: 'PATCH',
          body: payload,
        }),
      'Reminder updated',
      'Update failed'
    )
  }
  function removeReminder(reminderId: string) {
    return withToast(
      () => $fetch(`/api/clients/${id.value}/reminders/${reminderId}`, { method: 'DELETE' }),
      'Reminder removed',
      'Delete failed'
    )
  }

  return {
    data,
    status,
    refresh,
    updateClient,
    addContact,
    updateContact,
    removeContact,
    logInteraction,
    updateInteraction,
    removeInteraction,
    linkOpportunity,
    unlinkOpportunity,
    createReminder,
    updateReminder,
    removeReminder,
    createGrant,
    updateGrant,
    removeGrant,
    linkProject,
    updateProjectLink,
    unlinkProject,
    createAgreement,
    updateAgreement,
    removeAgreement,
  }
}
