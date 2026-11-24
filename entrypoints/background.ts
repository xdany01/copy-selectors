export default defineBackground(() => {
    // Función para inicializar el estado de la extensión (badge)
    function initializeExtension() {
        browser.storage.sync.get(['isEnabled'], (data) => {
            updateBadge((data.isEnabled as boolean) || false);
        });
    }

    // Función para actualizar el badge
    function updateBadge(isEnabled: boolean) {
        browser.action.setBadgeText({ text: isEnabled ? '✓' : '✕' });
        browser.action.setBadgeBackgroundColor({
            color: isEnabled ? '#00E676' : '#FF5252'
        });
    }

    // Inicialización inmediata al cargar el service worker para cubrir otros casos de activación
    initializeExtension();

    // Asegura que el badge se actualice al iniciar el navegador
    browser.runtime.onStartup.addListener(initializeExtension);

    // Evento que se ejecuta cuando la extensión se instala o actualiza
    browser.runtime.onInstalled.addListener(({ reason }) => {
        if (reason === 'install') {
            // Solo en la PRIMERA instalación se inicializan los valores por defecto.
            // Si se ejecutara en 'update' también, resetearía la configuración del
            // usuario cada vez que WXT reconstruye la extensión en modo dev.
            browser.storage.sync.set({
                isEnabled: false,
                includeClasses: true,
                includeIds: true,
                includeAttributes: false,
                selectorDepth: 10,
                selectorStrategy: 'full',
                modifierKey: 'alt'
            });
            updateBadge(false);
        } else {
            // En actualizaciones, solo refrescamos el badge con el estado actual
            // para no perder la configuración guardada del usuario.
            initializeExtension();
        }
    });

    // Escucha mensajes de otras partes de la extensión
    browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'getStatus') {
            browser.storage.sync.get(
                ['isEnabled', 'includeClasses', 'includeIds', 'includeAttributes', 'selectorDepth'],
                (data) => {
                    sendResponse({
                        isEnabled: data.isEnabled,
                        includeClasses: data.includeClasses,
                        includeIds: data.includeIds,
                        includeAttributes: data.includeAttributes,
                        selectorDepth: data.selectorDepth
                    });
                }
            );
            return true;
        }

        // Verifica si el mensaje está solicitando la actualización del badge
        if (request.action === 'badgeUpdate') {
            updateBadge(request.isEnabled);
        }
    });
});
