import './styles.css';

export default defineContentScript({
    matches: ['<all_urls>'],

    main() {
        // Variables de control
        let isExtensionEnabled = false;
        let lastHighlightedElement: HTMLElement | null = null;
        let includeClasses = true;
        let includeIds = true;
        let includeAttributes = false;
        let selectorDepth = 10;
        let selectorStrategy = 'full'; // 'full', 'nth-child', 'optimized'
        let modifierKey = 'alt'; // 'alt', 'ctrl', 'shift', 'none'

        // Cargar configuración inicial
        browser.storage.sync.get(["isEnabled", "includeClasses", "includeIds", "includeAttributes", "selectorDepth", "selectorStrategy", "modifierKey"], (data) => {
            isExtensionEnabled = (data.isEnabled as boolean) || false;
            includeClasses = data.includeClasses !== undefined ? (data.includeClasses as boolean) : true;
            includeIds = data.includeIds !== undefined ? (data.includeIds as boolean) : true;
            includeAttributes = data.includeAttributes !== undefined ? (data.includeAttributes as boolean) : false;
            selectorDepth = data.selectorDepth !== undefined ? (data.selectorDepth as number) : 10;
            selectorStrategy = data.selectorStrategy !== undefined ? (data.selectorStrategy as string) : 'full';
            modifierKey = data.modifierKey !== undefined ? (data.modifierKey as string) : 'alt';
        });

        // Escuchar cambios en la configuración
        browser.storage.onChanged.addListener((changes, _namespace) => {
            if (changes.isEnabled) {
                isExtensionEnabled = changes.isEnabled.newValue as boolean;
                if (!isExtensionEnabled) {
                    removeHighlight();
                }
            }
            if (changes.includeClasses) {
                includeClasses = changes.includeClasses.newValue as boolean;
            }
            if (changes.includeIds) {
                includeIds = changes.includeIds.newValue as boolean;
            }
            if (changes.includeAttributes) {
                includeAttributes = changes.includeAttributes.newValue as boolean;
            }
            if (changes.selectorDepth) {
                selectorDepth = changes.selectorDepth.newValue as number;
            }
            if (changes.selectorStrategy) {
                selectorStrategy = changes.selectorStrategy.newValue as string;
            }
            if (changes.modifierKey) {
                modifierKey = changes.modifierKey.newValue as string;
            }
        });

        // Escuchar mensajes desde el popup
        browser.runtime.onMessage.addListener((request, _sender, _sendResponse) => {
            if (request.action === "toggleState") {
                isExtensionEnabled = request.isEnabled;
                if (!isExtensionEnabled) {
                    removeHighlight();
                }
            }
            if (request.action === "updateOptions") {
                includeClasses = request.includeClasses;
                includeIds = request.includeIds;
                includeAttributes = request.includeAttributes;
            }
            if (request.action === "updateDepth") {
                selectorDepth = request.selectorDepth;
            }
            if (request.action === "updateStrategy") {
                selectorStrategy = request.selectorStrategy;
            }
            if (request.action === "updateModifierKey") {
                modifierKey = request.modifierKey;
            }
        });

        // Verifica si la tecla modificadora configurada está activa
        function isModifierActive(event: MouseEvent) {
            switch (modifierKey) {
                case 'alt': return event.altKey;
                case 'ctrl': return event.ctrlKey;
                case 'shift': return event.shiftKey;
                case 'none': return true;
                default: return event.altKey;
            }
        }

        // Evento mouseover: Resalta el elemento
        document.addEventListener('mouseover', (event) => {
            if (!isExtensionEnabled) return;
            if ((event.target as HTMLElement | null)?.id === 'selector-copy-toast') return;

            if (isModifierActive(event)) {
                let target = event.target as HTMLElement;

                if (lastHighlightedElement && lastHighlightedElement !== target) {
                    removeHighlight();
                }

                target.classList.add('selector-copy-highlight');
                lastHighlightedElement = target;

                // Mostrar preview del selector
                const selector = generateFullSelector(target);
                showPreview(selector, event.clientX, event.clientY);
            }
        });

        // Evento mouseout: Quita el resaltado
        document.addEventListener('mouseout', (event) => {
            if (!isExtensionEnabled) return;
            if (event.target === lastHighlightedElement) {
                removeHighlight();
                hidePreview();
            }
        });

        // Evento click: Copia el selector
        document.addEventListener('click', (event) => {
            if (!isExtensionEnabled) return;

            if (isModifierActive(event)) {
                event.preventDefault();
                event.stopPropagation();

                const target = event.target as HTMLElement;
                const selector = generateFullSelector(target);

                if (selector) {
                    navigator.clipboard.writeText(selector).then(() => {
                        showToast("¡Selector copiado!", "success");

                        target.classList.add('selector-copy-copied');
                        setTimeout(() => {
                            target.classList.remove('selector-copy-copied');
                        }, 400);
                    }).catch(err => {
                        console.error('Error al copiar: ', err);
                        showToast("No se pudo copiar el selector", "error");
                    });
                }
            }
        }, true);

        // Genera el selector CSS completo - delega a la estrategia seleccionada
        function generateFullSelector(element: HTMLElement) {
            switch (selectorStrategy) {
                case 'nth-child':
                    return generateNthChildSelector(element);
                case 'optimized':
                    return generateOptimizedSelector(element);
                case 'full':
                default:
                    return generateFullPathSelector(element);
            }
        }

        // Genera el selector CSS completo desde main hasta el elemento con profundidad limitada
        function generateFullPathSelector(element: HTMLElement | null) {
            const path = [];
            let current: HTMLElement | null = element;
            let foundMain = false;
            let depth = 0;

            // Recorrer hacia arriba hasta encontrar main, llegar al body, o alcanzar la profundidad máxima
            while (current && current !== document.body && current !== document.documentElement && depth < selectorDepth) {
                const selector = generateElementSelector(current);
                path.unshift(selector);
                depth++;

                // Si encontramos el elemento main, detenerse
                if (current.tagName.toLowerCase() === 'main') {
                    foundMain = true;
                    break;
                }

                current = current.parentElement;
            }

            // Si no se encontró main y no hemos alcanzado el límite, y estamos en body
            if (!foundMain && path.length > 0 && depth < selectorDepth) {
                // Solo agregar 'body' si el elemento actual no es body
                if (element !== document.body) {
                    // Verificar si el último elemento en el path no es body
                    if (current === document.body) {
                        path.unshift('body');
                    }
                }
            }

            return path.join(' > ');
        }

        // Genera el selector para un elemento individual
        function generateElementSelector(element: HTMLElement) {
            let selector = element.tagName.toLowerCase();

            // Siempre incluir el ID si existe y está habilitado
            if (includeIds && element.id) {
                selector += `[id="${element.id}"]`;
            }

            // Incluir clases si está habilitado
            if (includeClasses && element.classList.length > 0) {
                const classes = Array.from(element.classList)
                    .filter(cls => !cls.startsWith('selector-copy-')) // Se excluyen las clases de la extensión
                    .join(' ');

                if (classes) {
                    selector += `[class="${classes}"]`;
                }
            }

            // Incluir atributos si está habilitado
            if (includeAttributes) {
                const attributes = [];
                for (let attr of element.attributes) {
                    // Excluir atributos comunes que no son útiles para selectores
                    if (!['id', 'class', 'style'].includes(attr.name)) {
                        // No escapar el valor del atributo para evitar caracteres extraños
                        attributes.push(`[${attr.name}="${attr.value}"]`);
                    }
                }
                if (attributes.length > 0) {
                    selector += attributes.slice(0, 3).join(''); // Limitar a 3 atributos
                }
            }

            return selector;
        }

        // Genera selector usando nth-child/nth-of-type para posicionamiento
        function generateNthChildSelector(element: HTMLElement) {
            const path = [];
            let current: HTMLElement | null = element;
            let foundMain = false;
            let depth = 0;

            while (current && current !== document.body && current !== document.documentElement && depth < selectorDepth) {
                let selector = current.tagName.toLowerCase();

                // Agregar ID si existe y está habilitado
                if (includeIds && current.id) {
                    selector += `[id="${CSS.escape(current.id)}"]`;
                    path.unshift(selector);
                    break; // Si tiene ID, no necesitamos más especificidad
                } else {
                    // Calcular posición entre hermanos
                    const parent = current.parentElement;
                    if (parent) {
                        const siblings = Array.from(parent.children);
                        const sameTypeSiblings = siblings.filter(el => el.tagName === current?.tagName);

                        // Usar nth-of-type si hay múltiples del mismo tipo
                        if (sameTypeSiblings.length > 1) {
                            const index = sameTypeSiblings.indexOf(current) + 1;
                            selector += `:nth-of-type(${index})`;
                        } else if (siblings.length > 1) {
                            // Usar nth-child si es el único de su tipo pero hay otros hermanos
                            const index = siblings.indexOf(current) + 1;
                            selector += `:nth-child(${index})`;
                        }

                        // Agregar clases si está habilitado y no usamos nth-child/nth-of-type
                        if (includeClasses && current.classList.length > 0 && !selector.includes(':nth-')) {
                            const classes = Array.from(current.classList)
                                .filter(cls => !cls.startsWith('selector-copy-'))
                                .map(cls => `${CSS.escape(cls)}`)
                                .join(' ');
                            if (classes) {
                                selector += `[class="${classes}"]`;
                            }
                        }
                    }

                    path.unshift(selector);
                }

                depth++;

                if (current.tagName.toLowerCase() === 'main') {
                    foundMain = true;
                    break;
                }

                current = current.parentElement;
            }

            if (!foundMain && path.length > 0 && depth < selectorDepth) {
                if (element !== document.body && current === document.body) {
                    path.unshift('body');
                }
            }

            return path.join(' > ');
        }

        // Genera el selector único más corto posible
        function generateOptimizedSelector(element: HTMLElement) {
            // Estrategia 1: Intentar con ID
            if (element.id) {
                const idSelector = `[id="${CSS.escape(element.id)}"]`;
                if (isUniqueSelector(idSelector)) {
                    return idSelector;
                }
            }

            // Estrategia 2: Intentar con combinación de tag + clases
            if (element.classList.length > 0) {
                const classes = Array.from(element.classList)
                    .filter(cls => !cls.startsWith('selector-copy-'));

                // Probar cada clase individualmente
                for (const cls of classes) {
                    const classSelector = `${element.tagName.toLowerCase()}[class="${CSS.escape(cls)}"]`;
                    if (isUniqueSelector(classSelector)) {
                        return classSelector;
                    }
                }

                // Probar combinación de todas las clases
                if (classes.length > 1) {
                    const allClassesSelector = `${element.tagName.toLowerCase()}[class="${classes.map(c => CSS.escape(c)).join(' ')}"]`;
                    if (isUniqueSelector(allClassesSelector)) {
                        return allClassesSelector;
                    }
                }
            }

            // Estrategia 3: Intentar con atributos data-*
            const dataAttrs = Array.from(element.attributes).filter(attr => attr.name.startsWith('data-'));
            for (const attr of dataAttrs) {
                const attrSelector = `${element.tagName.toLowerCase()}[${attr.name}="${attr.value}"]`;
                if (isUniqueSelector(attrSelector)) {
                    return attrSelector;
                }
            }

            // Estrategia 4: Construir selector con contexto mínimo necesario
            let current = element;
            let selector = generateSimpleElementSelector(current);

            // Subir en el árbol hasta que el selector sea único
            while (!isUniqueSelector(selector) && current.parentElement && current !== document.body) {
                current = current.parentElement;
                const parentSelector = generateSimpleElementSelector(current);
                selector = `${parentSelector} > ${selector}`;

                // Limitar profundidad para evitar selectores muy largos
                if (selector.split('>').length >= selectorDepth) {
                    break;
                }
            }

            return selector;
        }

        // Genera un selector simple para un elemento (usado por la estrategia 'optimized').
        // Cuando hay múltiples hermanos del mismo tipo, usa solo :nth-of-type (sin clases),
        // ya que :nth-of-type opera únicamente sobre la etiqueta del elemento.
        function generateSimpleElementSelector(element: HTMLElement) {
            const tag = element.tagName.toLowerCase();

            // Prioridad 1: ID único
            if (element.id) {
                return `${tag}[id="${CSS.escape(element.id)}"]`;
            }

            // Prioridad 2: comprobar si necesitamos nth-of-type para diferenciar entre hermanos
            const parent = element.parentElement;
            const needsNth = parent
                ? Array.from(parent.children).filter(el => el.tagName === element.tagName).length > 1
                : false;

            if (parent && needsNth) {
                // Cuando hay varios hermanos del mismo tag, nth-of-type es suficiente y correcto.
                // No combinar con clases porque :nth-of-type actúa sólo sobre el tag.
                const siblings = Array.from(parent.children).filter(el => el.tagName === element.tagName);
                const index = (siblings as Element[]).indexOf(element) + 1;
                return `${tag}:nth-of-type(${index})`;
            }

            // Prioridad 3: usar clases cuando el elemento es único entre hermanos del mismo tipo
            if (element.classList.length > 0) {
                const classes = Array.from(element.classList)
                    .filter((cls: string) => !cls.startsWith('selector-copy-'))
                    .slice(0, 2)
                    .map((cls: string) => CSS.escape(cls))
                    .join(' ');
                if (classes) {
                    return `${tag}[class="${classes}"]`;
                }
            }

            // Fallback: sólo el tag
            return tag;
        }

        // Verifica si un selector es único en el documento
        function isUniqueSelector(selector: string) {
            try {
                const elements = document.querySelectorAll(selector);
                return elements.length === 1;
            } catch (e) {
                return false;
            }
        }


        // Función para mostrar preview del selector
        function showPreview(selector: string, x: number, y: number) {
            let preview = document.getElementById('selector-copy-preview');

            if (!preview) {
                preview = document.createElement('div');
                preview.id = 'selector-copy-preview';
                document.body.appendChild(preview);
            }

            preview.textContent = selector;
            preview.style.display = 'block';

            // Posicionar cerca del cursor
            preview.style.left = `${x + 15}px`;
            preview.style.top = `${y + 15}px`;
        }

        // Función para ocultar preview
        function hidePreview() {
            const preview = document.getElementById('selector-copy-preview');
            if (preview) {
                preview.style.display = 'none';
            }
        }

        // Función auxiliar para eliminar el resaltado
        function removeHighlight() {
            if (lastHighlightedElement) {
                lastHighlightedElement.classList.remove('selector-copy-highlight');
                lastHighlightedElement = null;
            }
        }

        // Identificador del temporizador activo para ocultar la notificación toast
        let toastTimeoutId: ReturnType<typeof setTimeout> | null = null;

        // Función para mostrar notificación toast
        function showToast(message: string, type = "normal") {
            let toast = document.getElementById('selector-copy-toast');

            if (!toast) {
                toast = document.createElement('div');
                toast.id = 'selector-copy-toast';
                document.body.appendChild(toast);
            }

            toast.textContent = message;

            // Reiniciar clases
            toast.className = '';
            if (type === 'success') toast.classList.add('success');
            if (type === 'error') toast.classList.add('error');

            // Forzar reflow para reiniciar animación
            void toast.offsetWidth;

            toast.classList.add('show');

            // Ocultar después de 2.5 segundos
            if (toastTimeoutId) clearTimeout(toastTimeoutId);

            toastTimeoutId = setTimeout(() => {
                toast.classList.remove('show');
                toastTimeoutId = null;
            }, 2500);
        }
    },
});
