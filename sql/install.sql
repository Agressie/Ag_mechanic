-- ag_mechanic schema
--
-- The resource creates these tables itself on first start, so running this file
-- is optional. It is here for anyone who would rather apply migrations by hand,
-- or who runs a database user without CREATE rights at runtime.

CREATE TABLE IF NOT EXISTS ag_mechanic_vehicles (
    vehicle_key   VARCHAR(64)  NOT NULL,           -- vin:<vin> or plate:<plate>
    plate         VARCHAR(16)  NOT NULL DEFAULT '',
    model         VARCHAR(64)  NOT NULL DEFAULT '',
    blueprint     VARCHAR(16)  NOT NULL DEFAULT 'car',
    health        LONGTEXT     NULL,                -- JSON: { component: 0-100 }
    tiers         LONGTEXT     NULL,                -- JSON: { category: tierIndex }
    symptoms      LONGTEXT     NULL,                -- JSON: recent wear sources
    odometer      DOUBLE       NOT NULL DEFAULT 0,  -- metres
    updated_at    BIGINT       NOT NULL DEFAULT 0,
    PRIMARY KEY (vehicle_key),
    KEY idx_plate (plate),
    KEY idx_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ag_mechanic_orders (
    id            INT          NOT NULL AUTO_INCREMENT,
    shop          VARCHAR(32)  NOT NULL,
    citizenid     VARCHAR(64)  NOT NULL DEFAULT '',
    ordered_by    VARCHAR(64)  NOT NULL DEFAULT '',
    lines_json    LONGTEXT     NULL,                -- JSON: [{ item, qty, unit }]
    cost          INT          NOT NULL DEFAULT 0,
    status        VARCHAR(16)  NOT NULL DEFAULT 'pending',
    placed_at     BIGINT       NOT NULL DEFAULT 0,
    ready_at      BIGINT       NOT NULL DEFAULT 0,
    delivered_at  BIGINT       NOT NULL DEFAULT 0,
    signed_by     VARCHAR(64)  NOT NULL DEFAULT '',
    PRIMARY KEY (id),
    KEY idx_shop_status (shop, status),
    KEY idx_ready (ready_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ag_mechanic_employees (
    citizenid     VARCHAR(64)  NOT NULL,
    shop          VARCHAR(32)  NOT NULL DEFAULT '',
    name          VARCHAR(96)  NOT NULL DEFAULT '',
    grade         INT          NOT NULL DEFAULT 0,
    hired_at      BIGINT       NOT NULL DEFAULT 0,
    hired_by      VARCHAR(96)  NOT NULL DEFAULT '',
    note          VARCHAR(255) NOT NULL DEFAULT '',
    PRIMARY KEY (citizenid),
    KEY idx_shop (shop)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Only used when no inventory resource provides stashes of its own.
CREATE TABLE IF NOT EXISTS ag_mechanic_stash (
    shop          VARCHAR(32)  NOT NULL,
    item          VARCHAR(64)  NOT NULL,
    count         INT          NOT NULL DEFAULT 0,
    PRIMARY KEY (shop, item)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ag_mechanic_log (
    id            INT          NOT NULL AUTO_INCREMENT,
    shop          VARCHAR(32)  NOT NULL DEFAULT '',
    actor         VARCHAR(96)  NOT NULL DEFAULT '',
    action        VARCHAR(48)  NOT NULL DEFAULT '',
    detail        LONGTEXT     NULL,
    at            BIGINT       NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    KEY idx_shop_at (shop, at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
