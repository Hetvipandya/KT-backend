# HRMS + Finance MongoDB Sharding Runbook

## Current safe scope

The backend already connects through the MongoDB URI, so when that URI points to
Atlas `mongos`, the driver routes reads and writes through the sharded cluster.
No application-side shard router is required.

The Finance collections listed by `scripts/mongoShardingReadiness.js` are the
first candidates for a range shard key of `{ companyId: 1 }`. The existing
Finance schemas generally require `companyId` and use tenant-prefixed unique
indexes. The range key preserves those unique constraints and targets company
queries to the owning shard.

Do not shard all HRMS collections yet. The current schema has HRMS/shared
collections without consistently required `companyId` values, including
`users`, `employees`, attendance/leave data, and salary-related data. `users`
has globally unique email and phone indexes; finance-user and deduction/payroll
collections also have unique indexes that do not start with `companyId`.
Changing the shard key or weakening these constraints without tenant backfill
could break global login uniqueness, payroll idempotency, or data isolation.
Keep those collections unsharded until a separate reviewed migration backfills
tenant ownership and redesigns their unique indexes.

## Readiness checks

1. In Atlas, confirm the target is a **sharded cluster** on a tier that supports
   sharding, and take/verify a restorable backup.
2. Deploy the application schema/index changes first. Keep
   `RUN_STARTUP_MAINTENANCE=true` on exactly one backend instance and `false` on
   the other instances while indexes are being created.
3. Run a schema-only check from `KT-backend/`:

   ```sh
   npm run sharding:check
   ```

4. Run the live read-only check only during a low-traffic window:

   ```sh
   npm run sharding:check:data
   ```

   This connects through the configured URI, requires `mongos`, and scans the
   candidate collections to group `companyId` BSON types. It does not update
   documents, create indexes, enable sharding, or shard collections. Set
   `SHARDING_AUDIT_MAX_TIME_MS` to adjust the per-collection scan timeout.
   A timeout or any missing/null/non-ObjectId tenant key blocks that collection.

5. Review every emitted command and blocker. Confirm the collection is not
   already sharded in Atlas before running any command. The check is not a
   replacement for a tested backup/restore or a reviewed capacity plan.

## Applying the shard key

Only after the live check passes for a collection, run its exact
`db.adminCommand({ shardCollection: ... })` command from the output using Atlas
mongosh or the Atlas UI. Apply collections gradually and verify chunk
distribution, query targeting, replication lag, and application errors before
continuing. The readiness script intentionally never applies commands.

The shard key is a **range** key, not hashed: the Finance schema has unique
indexes prefixed by ascending `companyId`, while MongoDB does not support unique
constraints on hashed indexes. This layout distributes tenants across shards
but a single very large tenant remains on a single shard. If that becomes a
measured hotspot, design a compound key and migrate all affected unique indexes
before changing the shard key.

## HRMS follow-up migration

Before sharding HRMS collections, create a tenant-ownership inventory and
backfill `companyId` from authoritative employee/company relationships. Resolve
users who belong to multiple companies, legacy records with no company, and
shared/global records explicitly. Then update all create/update/query paths to
write and filter by the authorized `companyId`, and redesign global unique
indexes (for example login email/phone) without weakening their intended
uniqueness. Validate the migrated data and query plans on a staging sharded
cluster before production rollout.

Do not use the HTTP `companyId` query parameter as an authorization source;
continue deriving tenant access from the authenticated user's authorized
company membership.
