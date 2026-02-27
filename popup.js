// Cargar opciones guardadas cuando se abre el popup
document.addEventListener('DOMContentLoaded', restoreOptions);

// Event listeners para los controles
document.getElementById('toggleExtension').addEventListener('change', saveMainToggle);
document.getElementById('toggleIds').addEventListener('change', saveOptions);
document.getElementById('toggleClasses').addEventListener('change', saveOptions);
document.getElementById('toggleAttributes').addEventListener('change', saveOptions);
document.getElementById('depthDecrease').addEventListener('click', decreaseDepth);
document.getElementById('depthIncrease').addEventListener('click', increaseDepth);
document.getElementById('selectorStrategy').addEventListener('change', saveStrategy);
document.getElementById('modifierKey').addEventListener('change', saveModifierKey);

// Función para guardar el estado principal de activación
function saveMainToggle() {
    const isEnabled = document.getElementById('toggleExtension').checked;

    chrome.storage.sync.set({ isEnabled: isEnabled }, () => {
        updateStatusUI(isEnabled);

        // Enviar mensaje al background para actualizar el badge
        chrome.runtime.sendMessage({ action: "badgeUpdate", isEnabled: isEnabled });

        // Enviar mensaje al script de contenido
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: "toggleState",
                    isEnabled: isEnabled
                });
            }
        });
    });
}

// Función para guardar todas las opciones
function saveOptions() {
    const includeIds = document.getElementById('toggleIds').checked;
    const includeClasses = document.getElementById('toggleClasses').checked;
    const includeAttributes = document.getElementById('toggleAttributes').checked;

    chrome.storage.sync.set({
        includeIds: includeIds,
        includeClasses: includeClasses,
        includeAttributes: includeAttributes
    }, () => {
        // Enviar mensaje al script de contenido con las nuevas opciones
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: "updateOptions",
                    includeIds: includeIds,
                    includeClasses: includeClasses,
                    includeAttributes: includeAttributes
                });
            }
        });
    });
}

// Función para disminuir profundidad
function decreaseDepth() {
    chrome.storage.sync.get({ selectorDepth: 10 }, (items) => {
        const newDepth = Math.max(1, items.selectorDepth - 1);
        updateDepth(newDepth);
    });
}

// Función para aumentar profundidad
function increaseDepth() {
    chrome.storage.sync.get({ selectorDepth: 10 }, (items) => {
        const newDepth = Math.min(10, items.selectorDepth + 1);
        updateDepth(newDepth);
    });
}

// Función para actualizar la profundidad
function updateDepth(depth) {
    document.getElementById('depthValue').textContent = depth;

    chrome.storage.sync.set({ selectorDepth: depth }, () => {
        // Enviar mensaje al script de contenido
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: "updateDepth",
                    selectorDepth: depth
                });
            }
        });
    });
}

// Función para guardar la estrategia de selector
function saveStrategy() {
    const strategy = document.getElementById('selectorStrategy').value;

    chrome.storage.sync.set({ selectorStrategy: strategy }, () => {
        // Enviar mensaje al script de contenido
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: "updateStrategy",
                    selectorStrategy: strategy
                });
            }
        });
    });
}

// Función para guardar la tecla modificadora
function saveModifierKey() {
    const modifier = document.getElementById('modifierKey').value;

    chrome.storage.sync.set({ modifierKey: modifier }, () => {
        updateModifierLabel(modifier);
        // Enviar mensaje al script de contenido
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: "updateModifierKey",
                    modifierKey: modifier
                });
            }
        });
    });
}

// Actualiza la etiqueta de la instrucción según la tecla seleccionada
function updateModifierLabel(modifier) {
    const label = document.getElementById('modifierKeyLabel');
    const instructionText = document.getElementById('instructionText');
    const keyLabels = { alt: 'Alt', ctrl: 'Ctrl', shift: 'Shift', none: null };
    const keyName = keyLabels[modifier];

    if (keyName) {
        label.textContent = keyName;
        label.style.display = '';
        instructionText.innerHTML = `Mantén <span class="key" id="modifierKeyLabel">${keyName}</span> + <span class="mouse">Clic</span> para copiar el selector.`;
    } else {
        instructionText.innerHTML = `Haz <span class="mouse">Clic</span> para copiar el selector.`;
    }
}

// Restaurar el estado guardado al abrir el popup
function restoreOptions() {
    chrome.storage.sync.get({
        isEnabled: false,
        includeIds: true,
        includeClasses: true,
        includeAttributes: false,
        selectorDepth: 10,
        selectorStrategy: 'full',
        modifierKey: 'alt'
    }, (items) => {
        document.getElementById('toggleExtension').checked = items.isEnabled;
        document.getElementById('toggleIds').checked = items.includeIds;
        document.getElementById('toggleClasses').checked = items.includeClasses;
        document.getElementById('toggleAttributes').checked = items.includeAttributes;
        document.getElementById('depthValue').textContent = items.selectorDepth;
        document.getElementById('selectorStrategy').value = items.selectorStrategy;
        document.getElementById('modifierKey').value = items.modifierKey;
        updateModifierLabel(items.modifierKey);

        updateStatusUI(items.isEnabled);
    });
}

// Actualizar la interfaz de usuario
function updateStatusUI(isEnabled) {
    const badge = document.getElementById('statusBadge');

    if (isEnabled) {
        badge.textContent = 'ON';
        badge.classList.add('active');
    } else {
        badge.textContent = 'OFF';
        badge.classList.remove('active');
    }
}
