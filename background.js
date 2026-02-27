// Función para inicializar el estado de la extensión (badge)
function initializeExtension() {
    chrome.storage.sync.get(["isEnabled"], (data) => {
        updateBadge(data.isEnabled || false);
    });
}

// Función para actualizar el badge
function updateBadge(isEnabled) {
    chrome.action.setBadgeText({ text: isEnabled ? "✓" : "✕" });
    chrome.action.setBadgeBackgroundColor({
        color: isEnabled ? "#00E676" : "#FF5252"
    });
}

// Evento que se ejecuta cuando la extensión se instala o actualiza por primera vez
chrome.runtime.onInstalled.addListener(() => {
    // Inicializa el estado de la extensión y las opciones por defecto
    chrome.storage.sync.set({
        isEnabled: false,
        includeClasses: true,
        includeIds: true,
        includeAttributes: false,
        selectorDepth: 10
    });

    // Inicializar badge como OFF
    updateBadge(false);
});

// Asegura que el badge se actualice al iniciar el navegador
chrome.runtime.onStartup.addListener(initializeExtension);

// Escucha mensajes de otras partes de la extensión
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getStatus") {
        chrome.storage.sync.get(["isEnabled", "includeClasses", "includeIds", "includeAttributes", "selectorDepth"], (data) => {
            sendResponse({
                isEnabled: data.isEnabled,
                includeClasses: data.includeClasses,
                includeIds: data.includeIds,
                includeAttributes: data.includeAttributes,
                selectorDepth: data.selectorDepth
            });
        });
        return true;
    }

    // Verifica si el mensaje está solicitando la actualización del badge
    if (request.action === "badgeUpdate") {
        updateBadge(request.isEnabled);
    }
});

// Inicialización inmediata al cargar el service worker para cubrir otros casos de activación
initializeExtension();