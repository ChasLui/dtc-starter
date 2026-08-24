#!/usr/bin/env node
/**
 * patch-sqlite.cjs — SQLite all-in-one patches for Medusa 2.19.0.
 *
 * Runs automatically on every `bun install` (root package.json "postinstall").
 * Medusa's database layer is hardwired to PostgreSQL in three places:
 *
 *  1. @medusajs/deps/mikro-orm/postgresql injects PostgreSqlDriver into every
 *     module connection.  The root "overrides" entry maps @medusajs/deps to
 *     vendor/@medusajs/deps, whose mikro-orm/postgresql subpath re-exports
 *     @mikro-orm/sqlite instead — nothing to do here.
 *
 *  2. @medusajs/utils createPgConnection builds the shared knex connection
 *     with client: "pg" unconditionally.  This script makes it branch to the
 *     sqlite3 client for sqlite: URLs (used by the boot probe, the migration
 *     table bookkeeping and the migration scripts).
 *
 *  3. The core module migrations and the framework Migrator emit
 *     PostgreSQL-only SQL (default now(), ALTER COLUMN, DROP CONSTRAINT,
 *     ::type casts, SERIAL, gen_random_uuid).  This script rewrites every
 *     shipped migration file and the migrator bookkeeping SQL into the SQLite
 *     dialect.
 *
 * All replacements are idempotent: a second run finds nothing left to change.
 */
"use strict"

const fs = require("fs")
const path = require("path")

const ROOT = path.resolve(__dirname, "..")
const BUN_DIR = path.join(ROOT, "node_modules", ".bun")

const log = (msg) => console.log(`[patch-sqlite] ${msg}`)

/** Walk a directory tree collecting files matching a regex. */
function glob(dir, re, out = []) {
  if (!fs.existsSync(dir)) {
    return out
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      glob(full, re, out)
    } else if (re.test(full)) {
      out.push(full)
    }
  }
  return out
}

/** Every installed @medusajs package directory (all .bun store copies). */
function medusaPackageDirs() {
  const dirs = new Set()
  if (!fs.existsSync(BUN_DIR)) {
    return dirs
  }
  for (const store of fs.readdirSync(BUN_DIR)) {
    const m = store.match(/^@medusajs\+([^@]+)@/)
    if (!m) {
      continue
    }
    const pkgDir = path.join(BUN_DIR, store, "node_modules", "@medusajs", m[1])
    if (fs.existsSync(pkgDir)) {
      dirs.add(pkgDir)
    }
  }
  return dirs
}

/**
 * SQLite dialect translation for a whole migration file.  Operates on the raw
 * JS source; every construct below only ever appears inside SQL strings.
 */
const CAST_TYPES =
  "text|numeric|integer|int|real|boolean|jsonb|timestamptz|timestamp|date|time|float|double precision|bigint|smallint|uuid"

function translateMigrationFile(src) {
  // `\"` appears inside double-quoted JS strings; `"` inside template
  // literals — accept both forms for quoted SQL identifiers.  Statement
  // bodies are matched with [^;`']+ so they never cross the enclosing JS
  // string (backtick, single quote, or a semicolon of a neighboring call).
  const Q = String.raw`\\?"([^"]+)"`
  const BODY = "[^;`']+"
  let s = src
  // SQLite has no ALTER COLUMN — the statement is a schema tweak on top of
  // the initial setup, safe to skip on a fresh database.
  s = s.replace(
    new RegExp(
      `alter table\\s+(if exists\\s+)?${Q}\\s+alter column\\s+[^;\\\`]+;?`,
      "gi",
    ),
    "",
  )
  // SQLite has no DROP CONSTRAINT — but the equivalent `drop index` covers
  // the unique-constraint conversions (a no-op for every other constraint).
  s = s.replace(
    new RegExp(
      `alter table\\s+(if exists\\s+)?${Q}\\s+drop constraint\\s+(if exists\\s+)?${Q}\\s*(?:cascade\\s*)?;?`,
      "gi",
    ),
    (match, ifExists1, table, ifExists2, name) =>
      `drop index if exists "${name}";`,
  )
  // ADD CONSTRAINT UNIQUE becomes a plain unique index in SQLite.
  s = s.replace(
    new RegExp(
      `alter table\\s+(if exists\\s+)?${Q}\\s+add constraint\\s+${Q}\\s+unique\\s*\\(([^;]+?)\\)\\s*;?`,
      "gi",
    ),
    (match, ifExists, table, name, cols) =>
      `create unique index if not exists "${name}" on "${table}" (${cols.trim()});`,
  )
  // ADD CONSTRAINT ... CHECK carries quoted literals in its body, so match it
  // with paren balancing instead of the quote-free body class.
  s = s.replace(
    new RegExp(
      `alter table\\s+(if exists\\s+)?${Q}\\s+add constraint\\s+${Q}\\s+check\\s*\\(((?:[^()]|\\([^()]*\\))*)\\)\\s*;?`,
      "gi",
    ),
    "",
  )
  // All other ADD CONSTRAINT forms (primary key, foreign key) cannot be
  // expressed in SQLite outside CREATE TABLE — drop them.
  s = s.replace(
    new RegExp(
      `alter table\\s+(if exists\\s+)?${Q}\\s+add constraint\\s+${Q}\\s+${BODY}\\s*(?:cascade\\s*)?;?`,
      "gi",
    ),
    "",
  )
  // ... and the ", add constraint ..." continuations that follow a dropped
  // DROP CONSTRAINT statement.
  s = s.replace(
    new RegExp(`,\\s*add constraint\\s+${Q}\\s+${BODY};?`, "gi"),
    "",
  )
  // ADD PRIMARY KEY is also CREATE TABLE-only in SQLite.
  s = s.replace(
    new RegExp(
      `alter table\\s+(if exists\\s+)?${Q}\\s+add primary key\\s*\\([^;]+\\)\\s*;?`,
      "gi",
    ),
    "",
  )
  // now() does not exist in SQLite; CURRENT_TIMESTAMP is equivalent for the
  // DEFAULT and comparison contexts Medusa uses.
  s = s.replace(/default\s+now\(\)/gi, "default CURRENT_TIMESTAMP")
  s = s.replace(/now\(\)/gi, "CURRENT_TIMESTAMP")
  // SERIAL becomes INTEGER PRIMARY KEY AUTOINCREMENT in SQLite.
  s = s.replace(
    /id\s+serial\s+primary\s+key/gi,
    "id integer PRIMARY KEY AUTOINCREMENT",
  )
  // gen_random_uuid() has a SQLite equivalent: lower(hex(randomblob(16))).
  s = s.replace(
    /default\s+gen_random_uuid\(\)/gi,
    "default (lower(hex(randomblob(16))))",
  )
  s = s.replace(/gen_random_uuid\(\)/gi, "lower(hex(randomblob(16)))")
  // PostgreSQL JSON operators (->, ->> and the ? key-exists operator) become
  // json_extract() calls in SQLite.  Run before the ::cast translation.
  s = s.replace(
    /([A-Za-z_][A-Za-z0-9_]*)((?:->>?'[^']+')+)/g,
    (match, base, chain) => {
      const keys = [...chain.matchAll(/->>?'([^']+)'/g)].map((x) => x[1])
      return `json_extract(${base}, '$.${keys.join(".")}')`
    },
  )
  s = s.replace(
    /json_extract\(([^,]+), '([^']+)'\) \? '[^']+'/g,
    (match, base, path) => `json_extract(${base}, '${path}') IS NOT NULL`,
  )
  // array_to_json(ARRAY(SELECT ...)) becomes json_group_array(...) in SQLite.
  // Consume the surrounding "(SELECT ... )" wrapper and the ::text cast in one
  // go — "(SELECT (SELECT ...))" does not parse in SQLite.
  s = s.replace(
    new RegExp(
      `\\(SELECT\\s+array_to_json\\(\\s*ARRAY\\s*\\(\\s*SELECT\\s+([a-z_0-9.]+)\\s+FROM\\s+([a-z_0-9]+)([^)]*)\\)\\s*\\)::(${CAST_TYPES})\\)`,
      "gi",
    ),
    (match, col, table, where, castType) =>
      `(SELECT json_group_array(${col}) FROM ${table}${where})::${castType}`,
  )
  // PostgreSQL ::type casts become CAST(... AS ...); JSON/temporal casts fall
  // back to text because SQLite has no jsonb/timestamptz storage classes.
  // Passes: quoted literals, (SELECT ...) / (json_extract(...)) expressions,
  // then plain identifier-ish expressions.  The parenthesized passes have
  // distinctive opening tokens so they never swallow JS wrapper code.
  const castTarget = (type) => {
    const t = type.toLowerCase()
    return ["jsonb", "timestamptz", "timestamp", "uuid", "date"].includes(t)
      ? "text"
      : type
  }
  s = s.replace(
    new RegExp(`(\\\\?)'((?:[^'\\\\]|\\\\.)*)'::(${CAST_TYPES})\\b`, "gi"),
    (match, esc, literal, type) => {
      return `cast(${esc}'${literal}' as ${castTarget(type)})`
    },
  )
  s = s.replace(
    new RegExp(`(\\(SELECT[^;\\\`]*?\\))::(${CAST_TYPES})\\b`, "gi"),
    (match, lhs, type) => `cast(${lhs} as ${castTarget(type)})`,
  )
  s = s.replace(
    new RegExp(`(\\(json_extract[^;\\\`]*?\\))::(${CAST_TYPES})\\b`, "gi"),
    (match, lhs, type) => `cast(${lhs} as ${castTarget(type)})`,
  )
  s = s.replace(
    new RegExp(`([A-Za-z0-9_."()\\s]+?)::(${CAST_TYPES})\\b`, "gi"),
    (match, lhs, type) => `cast(${lhs.trim()} as ${castTarget(type)})`,
  )
  // plpgsql DO $$ ... $$ blocks do not exist in SQLite.
  s = s.replace(/DO \$\$[\s\S]*?\$\$;?/gi, "")
  // PostgreSQL enum types and CASCADE clauses do not exist in SQLite.
  s = s.replace(
    /create type\s+"?[a-zA-Z0-9_]+"?\s+as\s+enum\s*\([\s\S]*?\)\s*;?/gi,
    "",
  )
  s = s.replace(
    /drop type (if exists\s+)?"?[a-zA-Z0-9_]+"?\s*(?:cascade\s*)?;?/gi,
    "",
  )
  s = s.replace(
    /drop table if exists\s+("[^"]+")\s+cascade/gi,
    "drop table if exists $1",
  )
  // SQLite UPDATE ... FROM does not allow an alias on the target table:
  // "update \"image\" i set ... from \"product_images\" pi where pi.image_id = i.id"
  // becomes "update \"image\" set ... from ... where pi.image_id = \"image\".id".
  s = s.replace(
    /update\s+"([^"]+)"\s+([a-z_][a-z0-9_]*)\s+set([\s\S]*?);/gi,
    (match, table, alias, body) =>
      `update "${table}" set${body.replace(new RegExp(`\\b${alias}\\.`, "g"), `"${table}".`)};`,
  )
  // PostgreSQL index clauses that SQLite does not know.
  s = s.replace(/using (?:btree|gin|gist|hash)\s*/gi, "")
  s = s.replace(/\s+(?:asc|desc)\s+nulls\s+(?:last|first)/gi, "")
  // SQLite has no IF EXISTS on ALTER TABLE itself.
  s = s.replace(/alter table if exists\s+/gi, "alter table ")
  // "exists" is a reserved word in SQLite — quote the alias.
  s = s.replace(/ as exists\b/gi, ' as "exists"')
  // SQLite has no IF [NOT] EXISTS on ALTER TABLE ... ADD/DROP COLUMN.
  s = s.replace(
    /\b(add|drop) column (if not exists|if exists)\s+/gi,
    "$1 column ",
  )
  // information_schema.tables existence probes become sqlite_master lookups.
  s = s.replace(
    /select \* from information_schema\.tables where table_name = '([^']+)' and table_schema = 'public'/gi,
    "select name from sqlite_master where type = 'table' and name = '$1'",
  )
  // Statements fully dropped above leave empty addSql() calls and bare
  // CASCADE; remnants behind.
  s = s.replace(/^\s*CASCADE;\s*$/gim, "")
  s = s.replace(/this\.addSql\(\s*(['"`])\s*\1\s*\)\s*;?/g, "")
  return s
}

/** Apply the translation to a file if it changed, reverting on syntax breakage. */
const TRANSLATION_NEEDED =
  /alter column|drop constraint|add constraint|add primary key|add column|drop column|information_schema|now\(\)|gen_random_uuid|id\s+serial\s+primary\s+key|create type|drop type| cascade|->>'|as exists|using (?:btree|gin|gist|hash)|nulls last|nulls first|::(?:text|numeric|integer|int|real|boolean|jsonb|timestamptz|timestamp|date|time|float|bigint|smallint|uuid)\b/i

function translateFile(file) {
  if (!fs.existsSync(file)) {
    return false
  }
  const src = fs.readFileSync(file, "utf8")
  if (!TRANSLATION_NEEDED.test(src)) {
    return false
  }
  const out = translateMigrationFile(src)
  if (out === src) {
    return false
  }
  fs.writeFileSync(file, out)
  const { execFileSync } = require("child_process")
  try {
    // `node --check` validates the JS; process.execPath would be bun here.
    execFileSync("node", ["--check", file], { stdio: "pipe" })
  } catch {
    fs.writeFileSync(file, src) // revert
    log(`reverted (invalid JS after translation) ${path.relative(ROOT, file)}`)
    return false
  }
  log(`translated ${path.relative(ROOT, file)}`)
  return true
}

/** Patch a file with exact-string replacements; skips already-applied ones. */
function patchFile(file, replacements) {
  if (!fs.existsSync(file)) {
    log(`skip (missing) ${path.relative(ROOT, file)}`)
    return
  }
  let src = fs.readFileSync(file, "utf8")
  const orig = src
  for (const [from, to] of replacements) {
    if (to && src.includes(to)) {
      continue // already patched
    }
    if (!src.includes(from)) {
      log(
        `skip (needle absent, may already be patched) ${path.relative(ROOT, file)}: ${from.slice(0, 60)}`,
      )
      continue
    }
    src = src.split(from).join(to)
  }
  if (src !== orig) {
    fs.writeFileSync(file, src)
    log(`patched ${path.relative(ROOT, file)}`)
  }
}

const KNEX_PG_CLIENT = `    return (0, postgresql_1.knex)({
        client: "pg",`

const KNEX_SQLITE_BRANCH = `    const isSqliteClient = typeof clientUrl === "string" && clientUrl.startsWith("sqlite");
    if (isSqliteClient) {
        return (0, postgresql_1.knex)({
            client: "sqlite3",
            useNullAsDefault: true,
            connection: {
                filename: clientUrl.replace(/^sqlite:(\\/\\/)?/, ""),
            },
            pool: {
                propagateCreateError: false,
                min: pool?.min ?? 1,
                max: pool?.max ?? Math.max(pool?.min ?? 1, 5),
                afterCreate: (conn, done) => {
                    conn.run("PRAGMA journal_mode = WAL");
                    conn.run("PRAGMA busy_timeout = 30000");
                    done(null, conn);
                },
            },
        });
    }
    return (0, postgresql_1.knex)({
        client: "pg",`

const KNEX_SQLITE_OLD_POOL = `            pool: {
                propagateCreateError: false,
                min: pool?.min ?? 1,
                ...(pool ?? {}),
            },`

const KNEX_SQLITE_NEW_POOL = `            pool: {
                propagateCreateError: false,
                min: pool?.min ?? 1,
                max: pool?.max ?? Math.max(pool?.min ?? 1, 5),
            },`

/**
 * node-sqlite3 ships prebuilt N-API binaries on GitHub releases, but
 * prebuild-install refuses to pick them under Bun (it wants a napi-v10 asset
 * that does not exist), and the node-gyp fallback fails on Python 3.12+
 * (no distutils).  Download the N-API v6 prebuilt and place it where the
 * `bindings` package looks for it: build/Release/node_sqlite3.node.
 */
const SQLITE3_PREBUILTS = {
  "darwin-arm64": "sqlite3-v5.1.7-napi-v6-darwin-arm64.tar.gz",
  "darwin-x64": "sqlite3-v5.1.7-napi-v6-darwin-x64.tar.gz",
  "linux-x64": "sqlite3-v5.1.7-napi-v6-linux-x64.tar.gz",
  "linux-arm64": "sqlite3-v5.1.7-napi-v6-linux-arm64.tar.gz",
  "win32-x64": "sqlite3-v5.1.7-napi-v6-win32-x64.tar.gz",
}

function ensureSqlite3Binding() {
  const { execFileSync } = require("child_process")
  const os = require("os")
  const platformKey = `${os.platform()}-${os.arch()}`
  const asset = SQLITE3_PREBUILTS[platformKey]
  if (!asset) {
    log(
      `skip sqlite3 prebuilt: no asset for ${platformKey} (needs a local node-gyp build)`,
    )
    return
  }
  const sqlite3Dirs = glob(
    BUN_DIR,
    /\/sqlite3@5\.1\.7\+[^/]+\/node_modules\/sqlite3\/package\.json$/,
  ).map((p) => path.dirname(p))
  if (!sqlite3Dirs.length) {
    return
  }
  for (const dir of sqlite3Dirs) {
    const bindingPath = path.join(dir, "build", "Release", "node_sqlite3.node")
    if (fs.existsSync(bindingPath)) {
      continue
    }
    const url = `https://github.com/TryGhost/node-sqlite3/releases/download/v5.1.7/${asset}`
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sqlite3-prebuild-"))
    const tarPath = path.join(tmpDir, "prebuilt.tar.gz")
    log(`downloading ${asset}`)
    execFileSync("curl", ["-sL", "--max-time", "120", "-o", tarPath, url], {
      stdio: "inherit",
    })
    execFileSync("tar", ["-xzf", tarPath, "-C", tmpDir])
    const nodeFile = path.join(tmpDir, "build", "Release", "node_sqlite3.node")
    if (!fs.existsSync(nodeFile)) {
      throw new Error(`[patch-sqlite] unexpected prebuilt layout for ${asset}`)
    }
    fs.mkdirSync(path.dirname(bindingPath), { recursive: true })
    fs.copyFileSync(nodeFile, bindingPath)
    fs.rmSync(tmpDir, { recursive: true, force: true })
    log(`installed sqlite3 prebuilt binding into ${path.relative(ROOT, dir)}`)
  }
}

function main() {
  const { execFileSync } = require("child_process")
  log("patching Medusa node_modules for SQLite all-in-one...")

  const pkgDirs = [...medusaPackageDirs()]
  log(`found ${pkgDirs.length} @medusajs package dirs`)

  const TRANSLATION_GREP = String.raw`alter column|drop constraint|add constraint|add primary key|add column|drop column|information_schema|now\(\)|gen_random_uuid|create type|drop type| cascade|->>'|as exists|using (?:btree|gin|gist|hash)|nulls last|nulls first|::(text|numeric|integer|int|real|boolean|jsonb|timestamptz|timestamp|date|time|float|bigint|smallint|uuid)`

  let migrated = 0
  for (const pkgDir of pkgDirs) {
    const isFramework = pkgDir.endsWith("/framework")
    const isMedusa = pkgDir.endsWith("/medusa")
    const isUtils = pkgDir.endsWith("/utils")
    const distDir = path.join(pkgDir, "dist")
    if (!fs.existsSync(distDir)) {
      continue
    }

    // 1. Translate every shipped migration file to SQLite dialect.  Only
    //    files directly inside `migrations/` dirs (never `migration/` or
    //    `migration-scripts/`, which contain plain code).  grep finds the
    //    candidates at C speed instead of walking every dist file.
    let hits = ""
    try {
      hits = execFileSync("grep", ["-rlEi", TRANSLATION_GREP, distDir], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      })
    } catch {
      hits = "" // grep exits 1 when nothing matches
    }
    for (const file of hits.split("\n").filter(Boolean)) {
      if (!/\/migrations\/[^/]+\.js$/.test(file)) {
        continue
      }
      if (translateFile(file)) {
        migrated++
      }
    }

    // 1b. A few core files import @mikro-orm/postgresql directly (only for
    //     `raw`/`knex`, which @mikro-orm/sqlite re-exports identically).
    let pgHits = ""
    try {
      pgHits = execFileSync(
        "grep",
        ["-rl", '"@mikro-orm/postgresql"', distDir],
        { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
      )
    } catch {
      pgHits = ""
    }
    for (const file of pgHits.split("\n").filter(Boolean)) {
      const src = fs.readFileSync(file, "utf8")
      const out = src
        .split('require("@mikro-orm/postgresql")')
        .join('require("@mikro-orm/sqlite")')
        .split('from "@mikro-orm/postgresql"')
        .join('from "@mikro-orm/sqlite"')
      if (out !== src) {
        fs.writeFileSync(file, out)
        log(`swapped pg import ${path.relative(ROOT, file)}`)
      }
    }

    // 2. Framework migrator bookkeeping: information_schema check and the
    //    knex result shape ({ rows } vs array) differ on SQLite.
    if (isFramework) {
      const migrator = path.join(pkgDir, "dist", "migrations", "migrator.js")
      patchFile(migrator, [
        [
          `const tableExists = await this.pgConnection.raw(\`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public'
          AND table_name = '\${this.migration_table_name}'
        );
      \`);
            if (!tableExists.rows[0].exists) {`,
          `const tableExists = await this.pgConnection.raw(
        \`SELECT name FROM sqlite_master WHERE type = 'table' AND name = '\${this.migration_table_name}'\`
      );
            const tableExistsResult = Array.isArray(tableExists)
                ? tableExists.length > 0
                : !!tableExists.rows?.[0]?.exists;
            if (!tableExistsResult) {`,
        ],
        [
          `const result = await this.pgConnection.raw(\`SELECT * FROM \${this.migration_table_name}\`);
            return result.rows;`,
          `const result = await this.pgConnection.raw(\`SELECT * FROM \${this.migration_table_name}\`);
            return Array.isArray(result) ? result : result.rows;`,
        ],
      ])
    }

    // 3. Medusa data-migration scripts: PostgreSQL-only (jsonb_set, ::int,
    //    information_schema).  They are upgrade helpers — no-ops on a fresh
    //    SQLite database — so short-circuit them.
    if (isMedusa) {
      const scriptsDir = path.join(pkgDir, "dist", "migration-scripts")
      for (const name of [
        "migrate-normalize-currency-codes-normalization",
        "reconcile-inventory-reserved-quantity",
        "migrate-product-option-link-ids",
      ]) {
        const file = path.join(scriptsDir, `${name}.js`)
        if (!fs.existsSync(file)) {
          continue
        }
        let src = fs.readFileSync(file, "utf8")
        const orig = src
        const guardMarker = 'knex.client?.config?.client === "sqlite3"'
        if (!src.includes(guardMarker)) {
          src = src.replace(
            /(async function \w+\(\{ container,? \}\) \{\n)/,
            `$1    const knex = container.resolve(utils_1.ContainerRegistrationKeys.PG_CONNECTION);
    if (knex.client?.config?.client === "sqlite3") {
        return;
    }
`,
          )
          src = src.replace(
            /(async function updateIdsInBatches\(\{ tableName, idPrefix, pgConnection, logger, \}\) \{\n)/,
            `$1    if (pgConnection.client?.config?.client === "sqlite3") {
        return;
    }
`,
          )
        }
        if (src !== orig) {
          fs.writeFileSync(file, src)
          log(`guarded ${path.relative(ROOT, file)}`)
        }
      }
      // db:create has nothing to do with SQLite — the file is created on
      // first connect.
      const createCmd = path.join(pkgDir, "dist", "commands", "db", "create.js")
      patchFile(createCmd, [
        [
          `    if (!dbConnectionString) {
        logger.error(\`Missing "DATABASE_URL" inside the .env file. The value is required to connect to the PostgreSQL server\`);
        return false;
    }`,
          `    if (!dbConnectionString) {
        logger.error(\`Missing "DATABASE_URL" inside the .env file. The value is required to connect to the PostgreSQL server\`);
        return false;
    }
    if (dbConnectionString.startsWith("sqlite")) {
        logger.info("SQLite mode: the database file is created automatically on first connect");
        return true;
    }`,
        ],
      ])
    }

    // 4. Shared knex connection: branch to the sqlite3 client for sqlite URLs.
    if (isUtils) {
      // SQLite errors carry no postgres-style `table`/`detail` fields; the
      // error mapper must not crash while formatting them.
      const dbErrorMapper = path.join(
        pkgDir,
        "dist",
        "dal",
        "mikro-orm",
        "db-error-mapper.js",
      )
      patchFile(dbErrorMapper, [
        [
          '        table: err.table.split("_").join(" "),',
          '        table: err.table ? err.table.split("_").join(" ") : "record",',
        ],
        [
          'Cannot set field \'${err.column}\' of ${(0, common_1.upperCaseFirst)(err.table.split("_").join(" "))} to null',
          'Cannot set field \'${err.column}\' of ${(0, common_1.upperCaseFirst)(err.table ? err.table.split("_").join(" ") : "record")} to null',
        ],
      ])
      const createPg = path.join(
        pkgDir,
        "dist",
        "modules-sdk",
        "create-pg-connection.js",
      )
      const KNEX_SQLITE_POOL_WITH_PRAGMAS = `            pool: {
                propagateCreateError: false,
                min: pool?.min ?? 1,
                max: pool?.max ?? Math.max(pool?.min ?? 1, 5),
                afterCreate: (conn, done) => {
                    conn.run("PRAGMA journal_mode = WAL");
                    conn.run("PRAGMA busy_timeout = 30000");
                    done(null, conn);
                },
            },`
      patchFile(createPg, [
        [
          'conn.run("PRAGMA busy_timeout = 5000")',
          'conn.run("PRAGMA busy_timeout = 30000")',
        ],
        [KNEX_SQLITE_OLD_POOL, KNEX_SQLITE_NEW_POOL],
        [KNEX_SQLITE_NEW_POOL, KNEX_SQLITE_POOL_WITH_PRAGMAS],
        [KNEX_PG_CLIENT, KNEX_SQLITE_BRANCH],
      ])
      // MikroORM's sqlite connection reads the database file from `dbName`,
      // not `clientUrl` — translate the URL for sqlite clientUrls.
      const createConnection = path.join(
        pkgDir,
        "dist",
        "dal",
        "mikro-orm",
        "mikro-orm-create-connection.js",
      )
      patchFile(createConnection, [
        [
          "        clientUrl,\n        schema,",
          '        clientUrl,\n        dbName: clientUrl?.startsWith("sqlite")\n            ? clientUrl.replace(/^sqlite:(\\/\\/)?/, "")\n            : undefined,\n        schema,',
        ],
        [
          "        clientUrl =\n            database.connection.context?.client?.config?.connection?.connectionString;",
          "        clientUrl =\n            database.connection.context?.client?.config?.connection?.connectionString ??\n            database.clientUrl;",
        ],
        [
          '    let schema = database.schema || "public";',
          '    let schema = database.clientUrl?.startsWith("sqlite")\n        ? undefined\n        : database.schema || "public";',
        ],
        [
          "        pool: {\n            min: 2,\n            ...database.pool,\n        },",
          "        pool: {\n            min: 2,\n            max: database.pool?.max ?? 10,\n            ...database.pool,\n        },",
        ],
      ])
    }

    // 5. SQLite connections: WAL journal + busy timeout so the many module
    //    connections can share one database file.
    const knexSqliteFiles = glob(
      BUN_DIR,
      /\/@mikro-orm\+knex@[^/]+\/node_modules\/@mikro-orm\/knex\/dialects\/sqlite\/BaseSqliteConnection\.js$/,
    )
    for (const file of knexSqliteFiles) {
      patchFile(file, [
        [
          "await this.client.raw('pragma foreign_keys = on');",
          "await this.client.raw('pragma foreign_keys = on');\n        await this.client.raw('pragma journal_mode = WAL');\n        await this.client.raw('pragma busy_timeout = 30000');",
        ],
        [
          "            pool: this.config.get('pool'),",
          "            pool: {\n                ...this.config.get('pool'),\n                afterCreate: (conn, done) => {\n                    conn.run('PRAGMA journal_mode = WAL');\n                    conn.run('PRAGMA busy_timeout = 30000');\n                    done(null, conn);\n                },\n            },",
        ],
      ])
    }

    // 5a. node-sqlite3 errors can lack a stack; MikroORM's DriverException
    //     constructor then crashes while copying it.
    const coreExceptionFiles = glob(
      BUN_DIR,
      /\/@mikro-orm\+core@[^/]+\/node_modules\/@mikro-orm\/core\/exceptions\.js$/,
    )
    for (const file of coreExceptionFiles) {
      patchFile(file, [
        [
          "        this.stack += '\\n\\n' + previous.stack.split('\\n').filter(l => l.trim().startsWith('at ')).join('\\n');",
          "        if (previous && previous.stack) {\n            this.stack += '\\n\\n' + previous.stack.split('\\n').filter(l => l.trim().startsWith('at ')).join('\\n');\n        }",
        ],
      ])
    }

    // 5b. node-sqlite3 executes only the FIRST statement of a multi-statement
    //     string (knex raw -> prepare + all), silently dropping the rest —
    //     fatal for the big multi-statement migration templates.  Rewrite the
    //     sqlite connection to split statements, and give ADD/DROP COLUMN
    //     IF [NOT] EXISTS their no-op semantics via ignorable errors.
    const sqlitePackageDirs = []
    if (fs.existsSync(BUN_DIR)) {
      for (const store of fs.readdirSync(BUN_DIR)) {
        const m = store.match(/^@mikro-orm\+sqlite@/)
        if (!m) {
          continue
        }
        const pkgDir = path.join(
          BUN_DIR,
          store,
          "node_modules",
          "@mikro-orm",
          "sqlite",
        )
        if (fs.existsSync(pkgDir)) {
          sqlitePackageDirs.push(pkgDir)
        }
      }
    }
    const SQLITE_CONNECTION_FULL = `"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SqliteConnection = void 0;
const knex_1 = require("@mikro-orm/knex");
function isIgnorableAlterError(e, query) {
    const msg = String(e?.message ?? e ?? "");
    // ADD/DROP COLUMN IF [NOT] EXISTS semantics on a fresh database: the
    // column is already part of the initial setup (duplicate), was never
    // part of it (no such column), or the statement runs before its table
    // is created by a later statement in the same migration (no such table).
    // Only DDL statements are safe to skip.
    if (!/duplicate column name|no such column|no such table/.test(msg)) {
        return false;
    }
    return /^\\s*(alter|drop|create|truncate)\\b/i.test(query ?? "");
}
function splitSqlStatements(sql) {
    const statements = [];
    let current = "";
    let quote = null;
    for (let i = 0; i < sql.length; i++) {
        const ch = sql[i];
        current += ch;
        if (quote) {
            if (ch === quote) {
                if (quote === "'" && sql[i + 1] === "'") {
                    current += sql[++i];
                } else {
                    quote = null;
                }
            }
        } else if (ch === "'" || ch === '"') {
            quote = ch;
        } else if (ch === ";" && current.trim()) {
            statements.push(current.trim());
            current = "";
        }
    }
    if (current.trim()) {
        statements.push(current.trim());
    }
    // SQLite allows only ONE ADD/DROP COLUMN per ALTER TABLE — split
    // comma-separated chains into separate statements.
    const splitChains = (statement) => {
        const m = statement.match(/^(alter table\\s+(?:if exists\\s+)?"(?:[^"]+)")\\s+(add|drop) column\\b/i);
        if (!m) {
            return [statement];
        }
        const head = m[1] + " " + m[2] + " column";
        const parts = statement.slice(m[0].length).split(/,(?=\\s*(?:add|drop) column\\b)/i);
        return parts.map((part, i) => {
            const cleaned = i === 0 ? part : part.replace(/^\\s*(?:add|drop) column\\b/i, "");
            return head + cleaned;
        });
    };
    const out = [];
    for (const statement of statements) {
        for (const part of splitChains(statement)) {
            out.push(part);
        }
    }
    return out.filter((statement) => {
        // Drop comment-only chunks (e.g. "\\n-- Adjust x table\\n").
        return !/^(?:\\s*--[^\\n]*\\n?)*\\s*$/.test(statement);
    });
}
class SqliteConnection extends knex_1.BaseSqliteConnection {
    createKnex() {
        this.client = this.createKnexClient(knex_1.SqliteKnexDialect);
        this.connected = true;
    }
    async execute(queryOrKnex, params = [], method = "all", ctx, loggerContext) {
        const query = typeof queryOrKnex === "string" ? queryOrKnex : null;
        if (query && query.includes(";")) {
            const statements = splitSqlStatements(query);
            if (statements.length > 1) {
                let result;
                for (let i = 0; i < statements.length; i++) {
                    const statement = statements[i];
                    try {
                        // Placeholders belong to the first statement.
                        result = await super.execute(statement, i === 0 ? params : [], method, ctx, loggerContext);
                    } catch (e) {
                        // SQLite refuses to DROP a column referenced by an
                        // index (PostgreSQL drops the index automatically) —
                        // drop the index and retry before classifying the
                        // error as ignorable.
                        const indexMatch = String(e?.message ?? "").match(/error in index ([^\\s]+) after drop column/i);
                        if (indexMatch) {
                            await super.execute(\`drop index if exists \${indexMatch[1]}\`, [], method, ctx, loggerContext);
                            result = await super.execute(statement, i === 0 ? params : [], method, ctx, loggerContext);
                            continue;
                        }
                        if (isIgnorableAlterError(e, statement)) {
                            continue;
                        }
                        throw e;
                    }
                }
                return result;
            }
        }
        try {
            return await super.execute(queryOrKnex, params, method, ctx, loggerContext);
        } catch (e) {
            const indexMatch = String(e?.message ?? "").match(/error in index ([^\\s]+) after drop column/i);
            if (indexMatch) {
                await super.execute(\`drop index if exists \${indexMatch[1]}\`, [], method, ctx, loggerContext);
                return await super.execute(queryOrKnex, params, method, ctx, loggerContext);
            }
            if (isIgnorableAlterError(e, query)) {
                return undefined;
            }
            throw e;
        }
    }
    transformRawResult(res, method) {
        if (method === 'get') {
            return res[0];
        }
        if (method === 'all') {
            return res;
        }
        if (Array.isArray(res)) {
            return {
                insertId: res[res.length - 1]?.id ?? 0,
                affectedRows: res.length,
                row: res[0],
                rows: res,
            };
        }
        return {
            insertId: res.lastID,
            affectedRows: res.changes,
        };
    }
}
exports.SqliteConnection = SqliteConnection;
`
    for (const pkgDir of sqlitePackageDirs) {
      const file = path.join(pkgDir, "SqliteConnection.js")
      let src = ""
      try {
        src = fs.readFileSync(file, "utf8")
      } catch {
        src = ""
      }
      if (!src.includes("no such table")) {
        fs.writeFileSync(file, SQLITE_CONNECTION_FULL)
        log(`rewrote ${path.relative(ROOT, file)}`)
      }
    }

    // 5c. generatePostgresAlterColummnIfExistStatement emits a plpgsql DO
    //     block that queries information_schema — a no-op on SQLite.
    if (isUtils) {
      const alterHelper = path.join(
        pkgDir,
        "dist",
        "common",
        "alter-columns-helper.js",
      )
      patchFile(alterHelper, [
        [
          "function generatePostgresAlterColummnIfExistStatement(tableName, columns, alterExpression) {",
          'function generatePostgresAlterColummnIfExistStatement(tableName, columns, alterExpression) {\n    if (process.env.DATABASE_URL?.startsWith("sqlite")) {\n        return "";\n    }',
        ],
      ])
    }

    // 6. medusa build emits the admin bundle into `.medusa/server/public/admin`
    //    (the tsconfig outDir) but the production serve looks in
    //    `public/admin` — align the two.
    if (pkgDir.endsWith("/medusa")) {
      const adminLoader = path.join(pkgDir, "dist", "loaders", "admin.js")
      patchFile(adminLoader, [
        [
          "        outDir: path_1.default.join(rootDirectory, utils_1.ADMIN_RELATIVE_OUTPUT_DIR),",
          '        outDir: path_1.default.join(rootDirectory, ".medusa/server", utils_1.ADMIN_RELATIVE_OUTPUT_DIR),',
        ],
      ])
    }

    // 6b. knex `raw()` returns the rows array directly on SQLite (not
    //    `{ rows }` like pg) — normalize the destructured shape.
    if (pkgDir.endsWith("/product")) {
      const productRepo = path.join(
        pkgDir,
        "dist",
        "repositories",
        "product.js",
      )
      patchFile(productRepo, [
        [
          "        const { rows: alreadyLinkedRows } = await knex.raw(",
          "        const alreadyLinkedRaw = await knex.raw(",
        ],
        [
          "        const { rows: exclusiveConflictRows } = await knex.raw(",
          "        const exclusiveConflictRaw = await knex.raw(",
        ],
        [
          "        const alreadyLinkedOptionIds = alreadyLinkedRows.map((row) => row.option_id);",
          "        const alreadyLinkedOptionIds = (Array.isArray(alreadyLinkedRaw) ? alreadyLinkedRaw : alreadyLinkedRaw.rows).map((row) => row.option_id);",
        ],
        [
          "        const exclusiveOptionIds = exclusiveConflictRows.map((row) => row.option_id);",
          "        const exclusiveOptionIds = (Array.isArray(exclusiveConflictRaw) ? exclusiveConflictRaw : exclusiveConflictRaw.rows).map((row) => row.option_id);",
        ],
      ])
    }

    // 6b. Link-modules migration planner: schema-qualified SQL, information_schema
    //    probes, SERIAL, ::jsonb defaults and SET LOCAL search_path — all
    //    PostgreSQL-only.  The schema prefix is dropped, which makes the
    //    remaining SQL plain SQLite.
    if (pkgDir.endsWith("/link-modules")) {
      const linkMigration = path.join(pkgDir, "dist", "migration", "index.js")
      patchFile(linkMigration, [
        [
          "await lockConn.execute(`SELECT pg_advisory_xact_lock(hashtext('${lockKey}'))`);",
          "await lockConn.execute(`SELECT 1`);",
        ],
        [
          'const sql = `SET LOCAL search_path TO "${__classPrivateFieldGet(this, _MigrationsExecutionPlanner_schema, "f")}"; \n\n${action.s',
          "const sql = `${action.s",
        ],
        [
          '"${__classPrivateFieldGet(this, _MigrationsExecutionPlanner_schema, "f")}".',
          "",
        ],
        [
          "        SELECT table_name\n        FROM information_schema.tables\n        WHERE table_schema = '${__classPrivateFieldGet(this, _MigrationsExecutionPlanner_schema, \"f\")}';",
          "        SELECT name as table_name\n        FROM sqlite_master\n        WHERE type = 'table'",
        ],
        [
          "        id SERIAL PRIMARY KEY,\n        table_name VARCHAR(255) NOT NULL UNIQUE,\n        link_descriptor JSONB NOT NULL DEFAULT '{}'::jsonb,\n        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
          "        id integer PRIMARY KEY AUTOINCREMENT,\n        table_name VARCHAR(255) NOT NULL UNIQUE,\n        link_descriptor JSONB NOT NULL DEFAULT '{}',\n        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
        ],
        [
          'SET LOCAL search_path TO "${__classPrivateFieldGet(this, _MigrationsExecutionPlanner_schema, "f")}"; \n      \n      ',
          "",
        ],
      ])
    }

    // 6b. PostgreSQL advisory locks (pg_advisory_xact_lock/hashtext) are used
    //    by the migration planner and the locking module — SQLite serializes
    //    writers natively, so make them no-ops.
    if (pkgDir.endsWith("/modules-sdk")) {
      // SQLite has a single writer: boot the modules sequentially instead of
      // in parallel so their seed loaders do not pile up on the write lock.
      const medusaModule = path.join(pkgDir, "dist", "medusa-module.js")
      patchFile(medusaModule, [
        [
          "        await (0, utils_1.promiseAll)(modulesOptions.map(async (moduleOptions) => {",
          "        for (const moduleOptions of modulesOptions) {",
        ],
        [
          "            });\n        }));\n        if (loaderOnly) {",
          "            });\n        }\n        if (loaderOnly) {",
        ],
        [
          "        const resolvedServices = await (0, utils_1.promiseAll)(loadedModules.map(async ({ hashKey, modDeclaration, moduleResolutions, container, finishLoading, }) => {",
          "        const resolvedServices = [];\n        for (const { hashKey, modDeclaration, moduleResolutions, container, finishLoading, } of loadedModules) {",
        ],
        [
          "            return service;\n        }));",
          "            resolvedServices.push(service);\n        }",
        ],
      ])
      const medusaApp = path.join(pkgDir, "dist", "medusa-app.js")
      patchFile(medusaApp, [
        [
          "await trx.raw(`SELECT pg_advisory_xact_lock(hashtext(?))`, [lockKey]);",
          "await trx.raw(`SELECT 1`);",
        ],
      ])
    }
    if (pkgDir.endsWith("/locking-postgres")) {
      const advisoryLock = path.join(
        pkgDir,
        "dist",
        "services",
        "advisory-lock.js",
      )
      patchFile(advisoryLock, [
        [
          "const lockPromises = numKeys.map((numKey) => manager.execute(`SELECT ${fnName}(?)`, [numKey]));",
          "const lockPromises = numKeys.map((numKey) => manager.execute(`SELECT 1`));",
        ],
      ])
    }
  }

  log(`done (${migrated} migration files translated)`)

  ensureSqlite3Binding()
}

main()
