--[[
    ag_mechanic - ox_lib bridge

    ox_lib's client API is Lua and most of it yields (progress bars wait for the
    bar to finish). A JavaScript export cannot wait on a Lua coroutine, so the
    bridge is event based instead: JS sends a token, this file does the yielding
    work in its own thread, and the result comes back on a second event.

    Everything here is a thin pass-through. No game logic lives in this file.
]]

local function reply(event, token, ...)
    TriggerEvent(event, token, ...)
end

--- Notification.
AddEventHandler('ag_mechanic:lua:notify', function(payload)
    local data = json.decode(payload)
    lib.notify({
        id = data.id,
        title = data.title,
        description = data.description,
        type = data.type or 'inform',
        position = data.position or 'top-right',
        duration = data.duration or 5000,
        icon = data.icon,
    })
end)

--- Progress bar. Replies with true when it ran to completion.
AddEventHandler('ag_mechanic:lua:progress', function(token, payload)
    CreateThread(function()
        local data = json.decode(payload)
        local ok = lib.progressBar({
            duration = data.duration or 5000,
            label = data.label or 'Working',
            useWhileDead = false,
            canCancel = data.canCancel ~= false,
            disable = data.disable or { car = true, move = true, combat = true },
            anim = data.anim,
            prop = data.prop,
        })
        reply('ag_mechanic:lua:progressResult', token, ok == true)
    end)
end)

--- Circular progress, used for the shorter fiddly steps.
AddEventHandler('ag_mechanic:lua:progressCircle', function(token, payload)
    CreateThread(function()
        local data = json.decode(payload)
        local ok = lib.progressCircle({
            duration = data.duration or 3000,
            label = data.label or 'Working',
            position = data.position or 'bottom',
            useWhileDead = false,
            canCancel = data.canCancel ~= false,
            disable = data.disable or { car = true, move = true, combat = true },
            anim = data.anim,
            prop = data.prop,
        })
        reply('ag_mechanic:lua:progressResult', token, ok == true)
    end)
end)

--- Yes/no dialog.
AddEventHandler('ag_mechanic:lua:confirm', function(token, payload)
    CreateThread(function()
        local data = json.decode(payload)
        local answer = lib.alertDialog({
            header = data.header or 'Confirm',
            content = data.content or '',
            centered = true,
            cancel = true,
            labels = { confirm = data.confirmLabel or 'Confirm', cancel = data.cancelLabel or 'Cancel' },
        })
        reply('ag_mechanic:lua:confirmResult', token, answer == 'confirm')
    end)
end)

--- Free-text / number input. Replies with a JSON string, or nil when cancelled.
AddEventHandler('ag_mechanic:lua:input', function(token, payload)
    CreateThread(function()
        local data = json.decode(payload)
        local result = lib.inputDialog(data.heading or 'Input', data.rows or {})
        reply('ag_mechanic:lua:inputResult', token, result and json.encode(result) or nil)
    end)
end)

--- Persistent hint in the corner.
AddEventHandler('ag_mechanic:lua:textUI', function(payload)
    local data = json.decode(payload)
    if data.show then
        lib.showTextUI(data.text, { position = data.position or 'left-center', icon = data.icon })
    else
        lib.hideTextUI()
    end
end)

--- Cancels whatever progress bar is running, e.g. when a vehicle drives off.
AddEventHandler('ag_mechanic:lua:cancelProgress', function()
    if lib.progressActive() then
        lib.cancelProgress()
    end
end)

--[[
    ox_target zone registration.

    Zones have to be created from Lua: ox_lib's zone maths runs on real vector3
    values, and the JavaScript runtime has no vector type to hand it. Options
    tables carry no coordinates, so global-vehicle options are still registered
    straight from JS.
]]

local zones = {}

AddEventHandler('ag_mechanic:lua:addSphereZone', function(payload)
    local data = json.decode(payload)
    local ok, id = pcall(function()
        return exports.ox_target:addSphereZone({
            coords = vec3(data.coords[1], data.coords[2], data.coords[3]),
            radius = data.radius + 0.0,
            debug = data.debug == true,
            options = data.options,
        })
    end)

    if ok and id then
        zones[#zones + 1] = id
    else
        print(('^1[ag_mechanic]^7 could not create sphere zone: %s'):format(tostring(id)))
    end
end)

AddEventHandler('ag_mechanic:lua:addBoxZone', function(payload)
    local data = json.decode(payload)
    local ok, id = pcall(function()
        return exports.ox_target:addBoxZone({
            coords = vec3(data.coords[1], data.coords[2], data.coords[3]),
            size = vec3(data.size[1], data.size[2], data.size[3]),
            rotation = (data.rotation or 0) + 0.0,
            debug = data.debug == true,
            options = data.options,
        })
    end)

    if ok and id then
        zones[#zones + 1] = id
    else
        print(('^1[ag_mechanic]^7 could not create box zone: %s'):format(tostring(id)))
    end
end)

AddEventHandler('ag_mechanic:lua:removeZones', function()
    for _, id in ipairs(zones) do
        pcall(function() exports.ox_target:removeZone(id) end)
    end
    zones = {}
end)

AddEventHandler('onResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end
    for _, id in ipairs(zones) do
        pcall(function() exports.ox_target:removeZone(id) end)
    end
    zones = {}
end)
