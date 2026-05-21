import { requirePermission } from '@@/server/utils/permission-guard'

/**
 * Returns the contact-import CSV template (CR-07). Served as a download so
 * staff can save it, fill it in, and re-upload. Gated on `crm:read` because
 * even seeing the field list is operational info.
 */
const TEMPLATE = [
  'first_name,last_name,title,email,phone',
  'Aisha,Karim,Programme Director,aisha@example.com,+255 700 000 000',
  'David,Mwangi,Finance Lead,david@example.com,+254 700 000 000',
].join('\n')

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'crm', 'read')
  setResponseHeader(event, 'Content-Type', 'text/csv; charset=utf-8')
  setResponseHeader(event, 'Content-Disposition', 'attachment; filename="contacts-template.csv"')
  return TEMPLATE
})
