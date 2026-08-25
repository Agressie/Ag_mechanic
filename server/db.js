/*
 * ag_mechanic - persistence
 * ============================================================================
 * Thin promise wrapper over oxmysql. The callback form is used deliberately: it
 * is the one export shape every oxmysql version has, so this works whether the
 * server is running a current build or something from two years ago.
 * ============================================================================
 */

AGM.db = {};

/* NOTE: server scripts are CommonJS modules, so the bare `exports` identifier
   is module.exports. FiveM's export proxy is only reachable via `global`. */
const call = (fn, sql, params) => new Promise((resolve, reject) => {
    try {
        global.exports.oxmysql[fn](sql, params || [], (result) => resolve(result));
    } catch (err) {
        reject(err);
    }
});

AGM.db.query = (sql, params) => call('query', sql, params);
AGM.db.single = (sql, params) => call('single', sql, params);
AGM.db.scalar = (sql, params) => call('scalar', sql, params);
AGM.db.execute = (sql, params) => call('execute', sql, params);
AGM.db.insert = (sql, params) => call('insert', sql, params);
AGM.db.update = (sql, params) => call('update', sql, params);

AGM.db.ready = false;

/* Schema. Also shipped as sql/install.sql for anyone who would rather run it
   by hand; running both is harmless. */
const SCHEMA = [
    `CREATE TABLE IF NOT EXISTS ag_mechanic_vehicles (
        vehicle_key   VARCHAR(64)  NOT NULL,
        plate         VARCHAR(16)  NOT NULL DEFAULT '',
        model         VARCHAR(64)  NOT NULL DEFAULT '',
        blueprint     VARCHAR(16)  NOT NULL DEFAULT 'car',
        health        LONGTEXT     NULL,
        tiers         LONGTEXT     NULL,
        symptoms      LONGTEXT     NULL,
        scanner       LONGTEXT     NULL,
        odometer      DOUBLE       NOT NULL DEFAULT 0,
        updated_at    BIGINT       NOT NULL DEFAULT 0,
        PRIMARY KEY (vehicle_key),
        KEY idx_plate (plate),
        KEY idx_updated (updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    `CREATE TABLE IF NOT EXISTS ag_mechanic_orders (
        id            INT          NOT NULL AUTO_INCREMENT,
        shop          VARCHAR(32)  NOT NULL,
        citizenid     VARCHAR(64)  NOT NULL DEFAULT '',
        ordered_by    VARCHAR(64)  NOT NULL DEFAULT '',
        lines_json    LONGTEXT     NULL,
        cost          INT          NOT NULL DEFAULT 0,
        status        VARCHAR(16)  NOT NULL DEFAULT 'pending',
        placed_at     BIGINT       NOT NULL DEFAULT 0,
        ready_at      BIGINT       NOT NULL DEFAULT 0,
        delivered_at  BIGINT       NOT NULL DEFAULT 0,
        signed_by     VARCHAR(64)  NOT NULL DEFAULT '',
        PRIMARY KEY (id),
        KEY idx_shop_status (shop, status),
        KEY idx_ready (ready_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    `CREATE TABLE IF NOT EXISTS ag_mechanic_employees (
        citizenid     VARCHAR(64)  NOT NULL,
        shop          VARCHAR(32)  NOT NULL DEFAULT '',
        name          VARCHAR(96)  NOT NULL DEFAULT '',
        grade         INT          NOT NULL DEFAULT 0,
        hired_at      BIGINT       NOT NULL DEFAULT 0,
        hired_by      VARCHAR(96)  NOT NULL DEFAULT '',
        note          VARCHAR(255) NOT NULL DEFAULT '',
        PRIMARY KEY (citizenid),
        KEY idx_shop (shop)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    /* Only used when no inventory resource provides stashes of its own. */
    `CREATE TABLE IF NOT EXISTS ag_mechanic_stash (
        shop          VARCHAR(32)  NOT NULL,
        item          VARCHAR(64)  NOT NULL,
        count         INT          NOT NULL DEFAULT 0,
        PRIMARY KEY (shop, item)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    `CREATE TABLE IF NOT EXISTS ag_mechanic_log (
        id            INT          NOT NULL AUTO_INCREMENT,
        shop          VARCHAR(32)  NOT NULL DEFAULT '',
        actor         VARCHAR(96)  NOT NULL DEFAULT '',
        action        VARCHAR(48)  NOT NULL DEFAULT '',
        detail        LONGTEXT     NULL,
        at            BIGINT       NOT NULL DEFAULT 0,
        PRIMARY KEY (id),
        KEY idx_shop_at (shop, at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

/*
 * Columns added after the first release. CREATE TABLE IF NOT EXISTS will not
 * touch a table that already exists, so anything added later has to be applied
 * separately - checked first so re-running is free.
 */
const ADDED_COLUMNS = [
    { table: 'ag_mechanic_vehicles', column: 'scanner', definition: 'LONGTEXT NULL AFTER symptoms' },
];

async function ensureColumn(table, column, definition) {
    const exists = await AGM.db.scalar(
        `SELECT COUNT(*) FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [table, column],
    ).catch(() => null);

    if (exists === null) return;          // could not check; leave well alone
    if (Number(exists) > 0) return;

    await AGM.db.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`)
        .then(() => AGM.log.info(`added column ${table}.${column}`))
        .catch((err) => AGM.log.error(`could not add ${table}.${column}:`, err && err.message));
}

AGM.db.migrate = async function () {
    for (const stmt of SCHEMA) {
        try {
            await AGM.db.query(stmt);
        } catch (err) {
            AGM.log.error('schema migration failed:', err && err.message ? err.message : err);
            return false;
        }
    }

    for (const { table, column, definition } of ADDED_COLUMNS) {
        await ensureColumn(table, column, definition);
    }

    AGM.db.ready = true;
    AGM.log.info('database schema ready');
    return true;
};

/** JSON column read that never throws on bad data. */
AGM.db.json = function (raw, fallback) {
    if (raw === null || raw === undefined) return fallback;
    if (typeof raw === 'object') return raw;
    try {
        const parsed = JSON.parse(raw);
        return parsed === null ? fallback : parsed;
    } catch (_) {
        return fallback;
    }
};

/** Fire-and-forget audit trail. Never blocks a player action. */
AGM.db.log = function (shop, actor, action, detail) {
    if (!AGM.db.ready) return;
    AGM.db.insert(
        'INSERT INTO ag_mechanic_log (shop, actor, action, detail, at) VALUES (?, ?, ?, ?, ?)',
        [shop || '', actor || '', action || '', JSON.stringify(detail || {}), Date.now()],
    ).catch(() => {});
};
