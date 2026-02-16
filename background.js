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
});

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
});
