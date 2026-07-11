import type { Certification, ExpertProfile } from '@@/server/database/schema'

interface CvUser {
  firstName: string | null
  lastName: string | null
  email: string
}

const esc = (s: string | null | undefined): string =>
  String(s ?? '').replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!
  )

/**
 * EX-04 — render an expert profile + virtual CV as a self-contained HTML
 * fragment suitable for insertion into a proposal document (Tiptap) or print.
 */
export function buildCvHtml(
  user: CvUser,
  profile: ExpertProfile | null,
  certs: Certification[] = []
): string {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email
  const parts: string[] = [`<h2>${esc(name)}</h2>`]
  if (profile?.headline) parts.push(`<p><strong>${esc(profile.headline)}</strong></p>`)

  const facts: string[] = []
  if (profile?.yearsExperience != null) facts.push(`${profile.yearsExperience} years' experience`)
  if (profile?.languages?.length)
    facts.push(`Languages: ${profile.languages.map((l) => esc(l.language)).join(', ')}`)
  if (profile?.countries?.length) facts.push(`Countries: ${profile.countries.map(esc).join(', ')}`)
  if (facts.length) parts.push(`<p>${facts.join(' · ')}</p>`)

  if (profile?.summary) parts.push(`<h3>Professional summary</h3><p>${esc(profile.summary)}</p>`)

  if (profile?.skills?.length)
    parts.push(`<h3>Key skills</h3><p>${profile.skills.map(esc).join(' · ')}</p>`)

  if (profile?.experience?.length) {
    parts.push('<h3>Experience</h3><ul>')
    for (const x of profile.experience) {
      const span = [x.startYear, x.endYear].filter(Boolean).join('–')
      parts.push(
        `<li><strong>${esc(x.role)}</strong>, ${esc(x.organization)}${span ? ` (${esc(span)})` : ''}${x.description ? `<br/>${esc(x.description)}` : ''}</li>`
      )
    }
    parts.push('</ul>')
  }

  if (profile?.education?.length) {
    parts.push('<h3>Education</h3><ul>')
    for (const e of profile.education) {
      parts.push(
        `<li>${esc(e.qualification)}, ${esc(e.institution)}${e.year ? ` (${esc(e.year)})` : ''}</li>`
      )
    }
    parts.push('</ul>')
  }

  if (certs.length) {
    parts.push('<h3>Certifications</h3><ul>')
    for (const c of certs)
      parts.push(`<li>${esc(c.name)}${c.issuer ? ` — ${esc(c.issuer)}` : ''}</li>`)
    parts.push('</ul>')
  }

  return parts.join('\n')
}
