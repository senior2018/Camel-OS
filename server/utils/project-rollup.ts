import { eq } from 'drizzle-orm'

import { projectActivities, projectMilestones, projects } from '../database/schema'
import { useDrizzle } from './drizzle'

type Category = 'not_started' | 'in_progress' | 'done'

/**
 * Roll a set of child categories up to a parent category (P14):
 *  - no children              → not_started
 *  - every child done         → done
 *  - every child not_started  → not_started
 *  - anything in between       → in_progress
 */
function rollup(children: Category[]): Category {
  if (!children.length) return 'not_started'
  if (children.every((c) => c === 'done')) return 'done'
  if (children.every((c) => c === 'not_started')) return 'not_started'
  return 'in_progress'
}

// Keep the legacy enum columns coherent with the derived category so older
// views/queries stay sensible until they're fully migrated.
const milestoneEnum = {
  not_started: 'not_started',
  in_progress: 'in_progress',
  done: 'completed',
} as const
const projectEnum = { not_started: 'planning', in_progress: 'active', done: 'completed' } as const

/**
 * Recompute every milestone's derived status from its activities, then the
 * project's derived lifecycle from its milestones. Milestone and project status
 * are NEVER set by hand — this is the single source of truth (P14). Call after
 * any change to activities (create / delete / status) or milestones.
 */
export async function recomputeProjectRollups(projectId: string): Promise<void> {
  const db = useDrizzle()

  const [activities, milestones, projectRow] = await Promise.all([
    db
      .select({
        milestoneId: projectActivities.milestoneId,
        statusCategory: projectActivities.statusCategory,
      })
      .from(projectActivities)
      .where(eq(projectActivities.projectId, projectId)),
    db
      .select({ id: projectMilestones.id, statusCategory: projectMilestones.statusCategory })
      .from(projectMilestones)
      .where(eq(projectMilestones.projectId, projectId)),
    db
      .select({ closedAt: projects.closedAt })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1),
  ])

  const byMilestone = new Map<string, Category[]>()
  for (const a of activities) {
    if (!a.milestoneId) continue
    const cat = (a.statusCategory as Category) ?? 'not_started'
    const arr = byMilestone.get(a.milestoneId) ?? []
    arr.push(cat)
    byMilestone.set(a.milestoneId, arr)
  }

  // Milestones → derive from their activities.
  const milestoneCats: Category[] = []
  for (const m of milestones) {
    const cat = rollup(byMilestone.get(m.id) ?? [])
    milestoneCats.push(cat)
    if (cat !== m.statusCategory) {
      await db
        .update(projectMilestones)
        .set({
          statusCategory: cat,
          status: milestoneEnum[cat],
          completedAt: cat === 'done' ? new Date() : null,
        })
        .where(eq(projectMilestones.id, m.id))
    }
  }

  // Project → derive from milestones, or from activities directly if there are
  // no milestones yet.
  const projectCat = milestones.length
    ? rollup(milestoneCats)
    : rollup(activities.map((a) => (a.statusCategory as Category) ?? 'not_started'))

  const set: Record<string, unknown> = { lifecycleCategory: projectCat }
  // Only steer the legacy status enum while the project is open; a closed
  // project keeps its archived status.
  if (!projectRow[0]?.closedAt) set.status = projectEnum[projectCat]
  await db.update(projects).set(set).where(eq(projects.id, projectId))
}
