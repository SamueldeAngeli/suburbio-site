// Applies the additive v0.3 admin contract to the separately owned API workspace.
const fs = require('node:fs');
const path = require('node:path');
const root = 'D:/api suburbio';
const write = (name, text) => fs.writeFileSync(path.join(root, name), text);
const edit = (name, from, to) => { const p = path.join(root, name); const text = fs.readFileSync(p, 'utf8'); if (!text.includes(from)) throw new Error(`Missing anchor: ${name}`); fs.writeFileSync(p, text.replace(from, to)); };
write('src/modules/admin/capabilities.ts', `export const CAPABILITIES = [
  "DASHBOARD_READ", "PLAYERS_READ", "PLAYERS_MANAGE", "ADMINS_READ", "ADMINS_MANAGE",
  "PERMISSIONS_READ", "ADMIN_PERMISSIONS_MANAGE", "ALLOWLIST_READ", "ALLOWLIST_REVOKE",
  "PUNISHMENTS_READ", "PUNISHMENTS_WRITE", "TICKETS_READ", "TICKETS_MANAGE", "TICKETS_TRANSCRIPT_INTERNAL",
  "ORDERS_READ", "ORDERS_MANAGE", "PAYMENTS_READ", "REFUNDS_READ", "REFUNDS_MANAGE", "CHARGEBACKS_READ",
  "PRODUCTS_READ", "PRODUCTS_CREATE", "PRODUCTS_UPDATE", "PRODUCTS_DISABLE",
  "COUPONS_READ", "COUPONS_CREATE", "COUPONS_UPDATE", "COUPONS_DISABLE",
  "AUDIT_READ", "SERVICES_READ", "DISCORD_READ", "SETTINGS_READ", "SETTINGS_WRITE",
] as const;
export const OWNER_ONLY = new Set<string>(["COUPONS_CREATE", "COUPONS_UPDATE", "COUPONS_DISABLE"]);
export function effectiveCapabilities(owner: boolean, overrides: readonly { capability: string; allowed: boolean }[]) {
  if (owner) return [...CAPABILITIES];
  // STANDARD has no implicit grants. Revokes win; unknown and owner-only grants are ignored.
  return CAPABILITIES.filter(cap => !OWNER_ONLY.has(cap) && overrides.some(o => o.capability === cap && o.allowed) && !overrides.some(o => o.capability === cap && !o.allowed));
}
`);
write('src/modules/admin/resolve.ts', `import type { Tx } from "../../database/postgres/types.js";
import { ApiError } from "../../http/errors.js";
import { normalizeIdentifier } from "../identity/service.js";
import { effectiveCapabilities } from "./capabilities.js";
export async function resolveAdmin(tx: Tx, discordId: string, readOnly: boolean) {
  const normalized = normalizeIdentifier("discord", discordId);
  const admin = await tx.selectFrom("admin_accounts as a")
    .innerJoin("admin_identifiers as i", "i.admin_account_id", "a.admin_account_id")
    .select(["a.admin_account_id", "a.status", "a.access_level"])
    .where("i.type", "=", "discord").where("i.normalized_value", "=", normalized).executeTakeFirst();
  if (!admin || admin.status !== "active") throw new ApiError("ADMIN_ACCESS_DENIED", 403, "Acesso administrativo não autorizado.");
  const overrides = await tx.selectFrom("admin_capability_overrides").select(["capability", "allowed"]).where("admin_account_id", "=", admin.admin_account_id).execute();
  const isSystemOwner = admin.access_level === "SYSTEM_OWNER";
  return { adminAccountId: admin.admin_account_id, discordId: normalized, status: admin.status, isSystemOwner,
    capabilities: effectiveCapabilities(isSystemOwner, overrides), readOnly };
}
`);
write('src/contracts/admin.ts', `import { z } from "zod";
export const discordId = z.string().regex(/^\\d{17,20}$/);
export const adminResolution = z.object({ adminAccountId: z.uuid(), discordId, status: z.literal("active"), isSystemOwner: z.boolean(), capabilities: z.array(z.string()), readOnly: z.boolean() });
export const adminSummary = z.object({ adminAccountId: z.uuid(), discordId: discordId.nullable(), status: z.enum(["active", "disabled"]), isSystemOwner: z.boolean(), createdAt: z.iso.datetime(), updatedAt: z.iso.datetime() });
export const adminList = z.object({ items: z.array(adminSummary), page: z.number().int(), pageSize: z.number().int(), total: z.number().int() });
`);
write('src/http/admin.ts', `import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import type { Config } from "../config/env.js";
import type { Db } from "../database/postgres/types.js";
import { discordId } from "../contracts/admin.js";
import { resolveAdmin } from "../modules/admin/resolve.js";
import { requireAdminCapability } from "../modules/admin/access.js";
import { ApiError } from "./errors.js";
export function registerAdmin(instance: FastifyInstance, db: Db, config: Config) {
  const app = instance.withTypeProvider<ZodTypeProvider>();
  app.post("/internal/site/admin/resolve", { schema: { body: z.object({ discordId }).strict() } }, async req =>
    db.transaction().execute(tx => resolveAdmin(tx, req.body.discordId, config.API_READ_ONLY)));
  const actorHeaders = z.object({ "x-actor-discord-id": discordId });
  const query = z.object({ page: z.coerce.number().int().min(1).max(100000).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(25), q: z.string().trim().max(100).default(""), status: z.enum(["active", "disabled"]).optional() }).strict();
  const serialize = (row: { admin_account_id: string; normalized_value: string | null; status: string; access_level: string; created_at: Date; updated_at: Date }) => ({ adminAccountId: row.admin_account_id, discordId: row.normalized_value, status: row.status, isSystemOwner: row.access_level === "SYSTEM_OWNER", createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString() });
  app.get("/internal/site/admins", { schema: { headers: actorHeaders, querystring: query } }, async req => {
    return db.transaction().setIsolationLevel("repeatable read").execute(async tx => {
      await requireAdminCapability(tx, req.headers["x-actor-discord-id"], "ADMINS_READ");
      let base = tx.selectFrom("admin_accounts as a").leftJoin("admin_identifiers as i", join => join.onRef("i.admin_account_id", "=", "a.admin_account_id").on("i.type", "=", "discord"));
      if (req.query.status) base = base.where("a.status", "=", req.query.status);
      if (req.query.q) base = base.where(eb => eb.or([eb("i.normalized_value", "=", req.query.q), ...(z.uuid().safeParse(req.query.q).success ? [eb("a.admin_account_id", "=", req.query.q)] : [])]));
      const count = await base.select(eb => eb.fn.countAll<string>().as("total")).executeTakeFirstOrThrow();
      const rows = await base.select(["a.admin_account_id", "i.normalized_value", "a.status", "a.access_level", "a.created_at", "a.updated_at"]).orderBy("a.created_at", "desc").orderBy("a.admin_account_id").limit(req.query.pageSize).offset((req.query.page - 1) * req.query.pageSize).execute();
      return { items: rows.map(serialize), page: req.query.page, pageSize: req.query.pageSize, total: Number(count.total) };
    });
  });
  app.get("/internal/site/admins/:id", { schema: { headers: actorHeaders, params: z.object({ id: z.uuid() }) } }, async req => db.transaction().execute(async tx => {
    await requireAdminCapability(tx, req.headers["x-actor-discord-id"], "ADMINS_READ");
    const row = await tx.selectFrom("admin_accounts as a").leftJoin("admin_identifiers as i", join => join.onRef("i.admin_account_id", "=", "a.admin_account_id").on("i.type", "=", "discord")).select(["a.admin_account_id", "i.normalized_value", "a.status", "a.access_level", "a.created_at", "a.updated_at"]).where("a.admin_account_id", "=", req.params.id).executeTakeFirst();
    if (!row) throw new ApiError("ADMIN_NOT_FOUND", 404, "AdminAccount não encontrado.");
    return serialize(row);
  }));
}
`);
// Actor must be bound to HMAC. Query is part of the canonical signature; unsigned headers are not.
edit('src/http/admin.ts', 'const actorHeaders = z.object({ "x-actor-discord-id": discordId });', 'const actorQuery = z.object({ actorDiscordId: discordId });');
edit('src/http/admin.ts', 'const query = z.object({ page:', 'const query = actorQuery.extend({ page:');
edit('src/http/admin.ts', 'headers: actorHeaders, querystring: query', 'querystring: query');
edit('src/http/admin.ts', 'headers: actorHeaders, params:', 'querystring: actorQuery.strict(), params:');
const adminPath = path.join(root, 'src/http/admin.ts');
fs.writeFileSync(adminPath, fs.readFileSync(adminPath,'utf8').replaceAll('req.headers["x-actor-discord-id"]', 'req.query.actorDiscordId'));
edit('src/bootstrap.ts', 'import { registerRoutes }', 'import { registerAdmin } from "./http/admin.js";\nimport { registerRoutes }');
edit('src/bootstrap.ts', 'registerQbcore(app, deps.db, deps.mysql, config);', 'registerQbcore(app, deps.db, deps.mysql, config);\n  registerAdmin(app, deps.db, config);');
edit('src/bootstrap.ts', 'version: "0.2.0"', 'version: "0.3.0"');
edit('src/security/hmac.ts', '(role && service.role !== role) ||', '(role && service.role !== role) ||\n      (path.startsWith("/internal/site/") && service.role !== "site") ||');
edit('src/contracts/responses.ts', 'import { z } from "zod";', 'import { z } from "zod";\nimport { adminResolution, adminSummary, adminList } from "./admin.js";');
edit('src/contracts/responses.ts', 'const responses: Record<string, z.ZodType> = {', 'const responses: Record<string, z.ZodType> = {\n  "/internal/site/admin/resolve": adminResolution,\n  "/internal/site/admins": adminList,\n  "/internal/site/admins/:id": adminSummary,');
edit('src/modules/admin/access.ts', 'import type { Tx }', 'import { OWNER_ONLY } from "./capabilities.js";\nimport type { Tx }');
edit('src/modules/admin/access.ts', 'if (!override?.allowed)', 'if (OWNER_ONLY.has(capability) || !override?.allowed)');
edit('src/modules/admin/permissions.ts', 'import { z } from "zod";', 'import { z } from "zod";\nimport { OWNER_ONLY } from "./capabilities.js";');
edit('src/modules/admin/permissions.ts', 'capability === "SYSTEM_OWNER"', 'capability === "SYSTEM_OWNER" || OWNER_ONLY.has(capability)');
// Resolution is read-only even though its identity is carried in a POST body.
edit('src/app.ts', '!["GET", "HEAD", "OPTIONS"].includes(req.method)', '!["GET", "HEAD", "OPTIONS"].includes(req.method) &&\n      !(req.method === "POST" && req.url === "/internal/site/admin/resolve")');
console.log('Admin v0.3 source installed; no database or environment changes.');
