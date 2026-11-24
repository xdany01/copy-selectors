import { defineConfig } from 'wxt'

export default defineConfig({
  // Suprime el warning de Firefox sobre data_collection_permissions.
  // Esta extensión no recolecta datos de usuario.
  suppressWarnings: {
    firefoxDataCollection: true,
  },
  manifest: ({ browser }) => ({
    name: 'Copy Selector',
    version: '1.0',
    description:
      'Copia selectores CSS completos desde el main hasta el elemento objetivo con opciones personalizables.',
    // 'scripting' es sólo MV3 (Chrome/Edge). Firefox usa MV2 por defecto en WXT,
    // donde los content scripts se declaran en el manifest y no necesitan 'scripting'.
    // 'clipboardWrite' es necesario en Firefox para navigator.clipboard.writeText()
    // dentro de content scripts.
    permissions: browser === 'firefox'
      ? ['storage', 'activeTab', 'clipboardWrite']
      : ['storage', 'activeTab', 'scripting', 'clipboardWrite'],
    icons: {
      16: '/icon.png',
      48: '/icon.png',
      128: '/icon.png',
    },
    // Firefox requiere un gecko ID para identificar la extensión.
    // Sin esto, storage.sync no funciona correctamente en Firefox.
    // data_collection_permissions: requerido por Mozilla desde noviembre 2025.
    // Declaramos que no recolectamos datos de usuarios.
    ...(browser === 'firefox' && {
      browser_specific_settings: {
        gecko: {
          id: 'copy-selector@extension',
          strict_min_version: '109.0',
        },
      },
      data_collection_permissions: {
        required: [],
        optional: [],
      },
    }),
  }),
})
