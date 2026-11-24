// Inicializa el popup restaurando las opciones guardadas y registrando los listeners
// una vez que el DOM está completamente cargado
document.addEventListener('DOMContentLoaded', () => {
    restoreOptions();

    document.getElementById('toggleExtension')?.addEventListener('change', saveMainToggle);
    document.getElementById('toggleIds')?.addEventListener('change', saveOptions);
    document.getElementById('toggleClasses')?.addEventListener('change', saveOptions);
    document.getElementById('toggleAttributes')?.addEventListener('change', saveOptions);
    document.getElementById('depthDecrease')?.addEventListener('click', decreaseDepth);
    document.getElementById('depthIncrease')?.addEventListener('click', increaseDepth);
    document.getElementById('selectorStrategy')?.addEventListener('change', saveStrategy);
    document.getElementById('modifierKey')?.addEventListener('change', saveModifierKey);
});

// Función para guardar el estado principal de activación
function saveMainToggle() {
    const isEnabled = (document.getElementById('toggleExtension') as HTMLInputElement).checked;

    browser.storage.sync.set({ isEnabled: isEnabled }, () => {
        updateStatusUI(isEnabled);

        // Enviar mensaje al background para actualizar el badge
        browser.runtime.sendMessage({ action: "badgeUpdate", isEnabled: isEnabled });

        // Notifica el cambio de estado al content script de la pestaña activa
        // (se ignoran pestañas internas del navegador donde no corre el content script)
        browser.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            if (tabs[0]?.id) {
                browser.tabs.sendMessage(tabs[0].id, {
                    action: "toggleState",
                    isEnabled: isEnabled
                }).catch(() => {
                    // La tab activa no tiene content script (p.ej. chrome://newtab). Ignorar.
                });
            }
        });
    });
}

// Función para guardar todas las opciones
function saveOptions() {
    const includeIds = (document.getElementById('toggleIds') as HTMLInputElement).checked;
    const includeClasses = (document.getElementById('toggleClasses') as HTMLInputElement).checked;
    const includeAttributes = (document.getElementById('toggleAttributes') as HTMLInputElement).checked;

    browser.storage.sync.set({
        includeIds: includeIds,
        includeClasses: includeClasses,
        includeAttributes: includeAttributes
    }, () => {
        // Envía las nuevas opciones al content script de la pestaña activa
        browser.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            if (tabs[0]?.id) {
                browser.tabs.sendMessage(tabs[0].id, {
                    action: "updateOptions",
                    includeIds: includeIds,
                    includeClasses: includeClasses,
                    includeAttributes: includeAttributes
                }).catch(() => {});
            }
        });
    });
}

// Función para disminuir profundidad
function decreaseDepth() {
    browser.storage.sync.get({ selectorDepth: 10 }, (items) => {
        const newDepth = Math.max(1, (items.selectorDepth as number) - 1);
        updateDepth(newDepth);
    });
}

// Función para aumentar profundidad
function increaseDepth() {
    browser.storage.sync.get({ selectorDepth: 10 }, (items) => {
        const newDepth = Math.min(10, (items.selectorDepth as number) + 1);
        updateDepth(newDepth);
    });
}

// Función para actualizar la profundidad
function updateDepth(depth: number) {
    const depthValue = document.getElementById('depthValue');
    if (depthValue) {
        depthValue.textContent = depth.toString();
    }

    browser.storage.sync.set({ selectorDepth: depth }, () => {
        // Envía el cambio de configuración al content script de la pestaña activa
        browser.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            if (tabs[0]?.id) {
                browser.tabs.sendMessage(tabs[0].id, {
                    action: "updateDepth",
                    selectorDepth: depth
                }).catch(() => {});
            }
        });
    });
}

// Función para guardar la estrategia de selector
function saveStrategy() {
    const strategy = (document.getElementById('selectorStrategy') as HTMLSelectElement).value;

    browser.storage.sync.set({ selectorStrategy: strategy }, () => {
        // Envía el cambio de configuración al content script de la pestaña activa
        browser.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            if (tabs[0]?.id) {
                browser.tabs.sendMessage(tabs[0].id, {
                    action: "updateStrategy",
                    selectorStrategy: strategy
                }).catch(() => {});
            }
        });
    });
}

// Función para guardar la tecla modificadora
function saveModifierKey() {
    const modifier = (document.getElementById('modifierKey') as HTMLSelectElement).value;

    browser.storage.sync.set({ modifierKey: modifier }, () => {
        updateModifierLabel(modifier);
        // Envía el cambio de configuración al content script de la pestaña activa
        browser.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            if (tabs[0]?.id) {
                browser.tabs.sendMessage(tabs[0].id, {
                    action: "updateModifierKey",
                    modifierKey: modifier
                }).catch(() => {});
            }
        });
    });
}

// Actualiza el texto de instrucción según la tecla modificadora seleccionada,
// reconstruyendo el contenido mediante nodos DOM y texto de forma segura
function updateModifierLabel(modifier: string) {
    const instructionText = document.getElementById('instructionText');
    if (!instructionText) return;
    const keyLabels: Record<string, string | null> = { alt: 'Alt', ctrl: 'Ctrl', shift: 'Shift', none: null };
    const keyName = keyLabels[modifier];

    // Limpiar el contenido anterior de forma segura (sin innerHTML)
    while (instructionText.firstChild) {
        instructionText.removeChild(instructionText.firstChild);
    }

    if (keyName) {
        // "Mantén [Alt] + [Clic] para copiar el selector."
        const keySpan = document.createElement('span');
        keySpan.className = 'key';
        keySpan.id = 'modifierKeyLabel';
        keySpan.textContent = keyName;

        const mouseSpan = document.createElement('span');
        mouseSpan.className = 'mouse';
        mouseSpan.textContent = 'Clic';

        instructionText.append('Mantén ', keySpan, ' + ', mouseSpan, ' para copiar el selector.');
    } else {
        // "Haz [Clic] para copiar el selector."
        const mouseSpan = document.createElement('span');
        mouseSpan.className = 'mouse';
        mouseSpan.textContent = 'Clic';

        instructionText.append('Haz ', mouseSpan, ' para copiar el selector.');
    }
}

// Restaurar el estado guardado al abrir el popup
function restoreOptions() {
    browser.storage.sync.get({
        isEnabled: false,
        includeIds: true,
        includeClasses: true,
        includeAttributes: false,
        selectorDepth: 10,
        selectorStrategy: 'full',
        modifierKey: 'alt'
    }, (items) => {
        (document.getElementById('toggleExtension') as HTMLInputElement).checked = items.isEnabled as boolean;
        (document.getElementById('toggleIds') as HTMLInputElement).checked = items.includeIds as boolean;
        (document.getElementById('toggleClasses') as HTMLInputElement).checked = items.includeClasses as boolean;
        (document.getElementById('toggleAttributes') as HTMLInputElement).checked = items.includeAttributes as boolean;
        const depthValue = document.getElementById('depthValue');
        if (depthValue) {
            depthValue.textContent = String(items.selectorDepth);
        }
        (document.getElementById('selectorStrategy') as HTMLSelectElement).value = items.selectorStrategy as string;
        (document.getElementById('modifierKey') as HTMLSelectElement).value = items.modifierKey as string;
        updateModifierLabel(items.modifierKey as string);

        updateStatusUI(items.isEnabled as boolean);
    });
}

// Actualizar la interfaz de usuario
function updateStatusUI(isEnabled: boolean) {
    const badge = document.getElementById('statusBadge');
    if (!badge) return;

    if (isEnabled) {
        badge.textContent = 'ON';
        badge.classList.add('active');
    } else {
        badge.textContent = 'OFF';
        badge.classList.remove('active');
    }
}
