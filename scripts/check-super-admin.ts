import postgres from 'postgres'
import dotenv from 'dotenv'

dotenv.config()
const sql = postgres(process.env.DATABASE_URL!)
const r = await sql<Array<{ email: string; is_super_admin: boolean }>>`
  SELECT email, is_super_admin FROM users ORDER BY created_at
`
for (const u of r) console.log(u.email, '→ super:', u.is_super_admin)
await sql.end()
