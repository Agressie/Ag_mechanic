fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name 'ag_mechanic'
author 'Agressie'
description 'Mechanic job with per-component vehicle health, named part tiers, diagnostics minigame, field/mobile/garage repairs and a tablet (personnel, stash inventory, parts ordering with NPC delivery).'
version '1.0.0'
repository 'https://github.com/Agressie/Ag_mechanic'

-- ox_lib is required for callbacks, notifications, progress bars and points.
-- ox_target is required for all world interactions.
-- oxmysql is required for persistence.
dependencies {
    'ox_lib',
    'ox_target',
    'oxmysql',
}

ui_page 'html/index.html'

shared_scripts {
    '@ox_lib/init.lua',
    'shared/namespace.js',
    'config/config.js',
    'config/classes.js',
    'config/components.js',
    'config/tiers.js',
    'config/dtc.js',
    'config/damage.js',
    'config/handling.js',
    'config/shop.js',
    'config/locations.js',
    'shared/util.js',
    'shared/health.js',
}

client_scripts {
    'client/lib_bridge.lua',
    'client/rpc.js',
    'client/state.js',
    'client/nui.js',
    'client/performance.js',
    'client/monitor.js',
    'client/diagnose.js',
    'client/scanner.js',
    'client/repair.js',
    'client/upgrades.js',
    'client/delivery.js',
    'client/payment.js',
    'client/targets.js',
    'client/tablet.js',
    'client/main.js',
}

server_scripts {
    '@oxmysql/lib/MySQL.lua',
    'server/db.js',
    'server/rpc.js',
    'server/bridge/core.js',
    'server/bridge/inventory.js',
    'server/bridge/society.js',
    'server/vehicles.js',
    'server/damage.js',
    'server/scanner.js',
    'server/diagnose.js',
    'server/repair.js',
    'server/upgrades.js',
    'server/personnel.js',
    'server/shop.js',
    'server/delivery.js',
    'server/payment.js',
    'server/main.js',
}

files {
    'html/index.html',
    'html/**/*',
}

provide 'ag_mechanic'
