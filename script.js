// Pizarra Digital - Aplicación Principal

class ActionHistory {
    constructor(app) {
        this.app = app;
        this.undoStack = [];
        this.redoStack = [];
        this.limit = 50;
    }

    execute(action) {
        this.undoStack.push(action);
        if (this.undoStack.length > this.limit) {
            this.undoStack.shift();
        }
        this.redoStack = [];
        this.app.updateUndoRedoButtons();
    }

    undo() {
        if (this.undoStack.length === 0) return;
        const action = this.undoStack.pop();
        action.undo();
        this.redoStack.push(action);
        this.app.updateUndoRedoButtons();
    }

    redo() {
        if (this.redoStack.length === 0) return;
        const action = this.redoStack.pop();
        action.execute();
        this.undoStack.push(action);
        this.app.updateUndoRedoButtons();
    }

    clear() {
    const drawingLayer = document.getElementById('drawing-layer');
    if (drawingLayer) {
        // Limpiar todo el contenido del SVG
        drawingLayer.innerHTML = '<defs id="drawing-defs"></defs>';
        
        // Recrear las superficies de dibujo para todas las capas
        this.app.board.layers.forEach((layer, index) => {
            this.app.createLayerDrawingSurface(index);
        });
    }
    
    // Limpiar todos los elementos de dibujo (incluyendo los del borrador) de todas las capas
    this.app.board.layers.forEach(layer => {
        layer.elements = layer.elements.filter(el => 
            el.type !== 'drawing' && el.type !== 'eraser_path'
        );
    });
    
    this.app.showNotification('Dibujos limpiados');
}
}

class PizarraApp {
    initializeLayersForProject() {
    console.log('Inicializando capas para proyecto:', this.currentProject?.id);
    
    // Reiniciar capas para el proyecto actual
    this.board.layers = [{
        id: `project-${this.currentProject?.id || 'default'}-layer-0`,
        name: 'Capa 1',
        elements: [],
        visible: true,
        locked: false
    }];
    
    this.activeLayerId = this.board.layers[0].id;
    this.currentLayer = 0;
    
    // Si el proyecto tiene elementos, distribuirlos en capas
    if (this.currentProject && this.currentProject.elements) {
        this.distributeElementsToLayers();
    }
    
    console.log('Capas inicializadas:', this.board.layers);
}

distributeElementsToLayers() {
    // Encontrar el número máximo de capas necesario
    const maxLayer = this.currentProject.elements.reduce((max, element) => {
        return Math.max(max, element.layer || 0);
    }, 0);
    
    // Crear capas adicionales si son necesarias
    for (let i = this.board.layers.length; i <= maxLayer; i++) {
        this.board.layers.push({
            id: `project-${this.currentProject.id}-layer-${i}`,
            name: `Capa ${i + 1}`,
            elements: [],
            visible: true,
            locked: false
        });
    }
    
    // Distribuir elementos a sus capas correspondientes
    this.currentProject.elements.forEach(element => {
        const layerIndex = element.layer || 0;
        if (this.board.layers[layerIndex]) {
            this.board.layers[layerIndex].elements.push(element);
        }
    });
    
    console.log('Elementos distribuidos en capas:', this.board.layers);
}
    constructor() {
        // Optimización: inicializar solo propiedades esenciales
        this.currentProject = null;
        this.projects = [];
        this.selectedTool = null;
        this.selectedElement = null;
        this.currentLayer = 0;
        this.currentSlide = 0;
        this.isSaving = false;
        this.lastNotification = null;
        this.notificationTimeout = null;
        this.isDrawing = false;
        this.isDragging = false;
        this.dragStart = { x: 0, y: 0 };
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;
        this.resizeHandle = null;
        this.imageMode = null;
        this.textMode = null;
        this.isCreatingTextBox = false;
        this.textBoxSize = {};
        this.currentDocument = null;
        
        // Inicializar nueva herramienta de dibujo
        this.drawingTool = new DrawingTool(this);
        
        // Sistema de elementos del canvas
        this.elements = [];
        
        this.history = new ActionHistory(this);
        
        this.board = {
            layers: [
                { id: 'layer-0', name: 'Capa 1', elements: [], visible: true, locked: false }
            ]
        };
        this.activeLayerId = 'layer-0';
        this.currentLayer = 0;
        this.createLayerDrawingSurface(0); // Asegurar que la capa inicial tiene superficie

        // Manejadores del panel de capas
        document.getElementById('layers-btn')?.addEventListener('click', () => this.toggleLayersPanel());
        document.getElementById('close-layers-panel')?.addEventListener('click', () => this.toggleLayersPanel(false));
        document.getElementById('add-layer-btn')?.addEventListener('click', () => this.addLayer());

        this.board.zoom = 1;
        this.board.pan = { x: 0, y: 0 };
        this.isPanning = false;
        this.lastPanPoint = { x: 0, y: 0 };

        const canvas = document.getElementById('canvas');
        canvas.addEventListener('wheel', (e) => this.handleWheel(e));
        canvas.addEventListener('mousedown', (e) => {
            if (e.button === 1) {
                this.isPanning = true;
                this.lastPanPoint = { x: e.clientX, y: e.clientY };
                canvas.style.cursor = 'grabbing';
            }
        });
        canvas.addEventListener('mousemove', (e) => {
            if (this.isPanning) {
                const dx = e.clientX - this.lastPanPoint.x;
                const dy = e.clientY - this.lastPanPoint.y;
                this.board.pan.x += dx;
                this.board.pan.y += dy;
                this.lastPanPoint = { x: e.clientX, y: e.clientY };
                this.updateCanvasTransform();
            }
        });
        canvas.addEventListener('mouseup', (e) => {
            if (e.button === 1) {
                this.isPanning = false;
                canvas.style.cursor = 'default';
            }
        });
        // Configurar soporte táctil para dispositivos móviles
        // Esto conecta los eventos touch a los manejadores de mouse para
        // mejorar la experiencia en pantallas táctiles.
        this.setupTouchEvents();
        
        // Usar requestAnimationFrame para inicialización no crítica
        requestAnimationFrame(() => this.init());
        
        // Limpiar recursos al cerrar la página
        window.addEventListener('beforeunload', () => this.cleanup());
    }
    
    async init() {
        this.setupEventListeners();
        this.setupProjectNameInput(); // Añadido para mejorar la experiencia del input del nombre de proyecto
        this.updateUndoRedoButtons();
        
        const drawingLayer = document.getElementById('drawing-layer');
        if (drawingLayer) {
            drawingLayer.innerHTML = '<defs id="drawing-defs"></defs>';
        }
        this.createLayerDrawingSurface(0); 

        // Cargar proyecto actual de forma asíncrona
        await this.loadProjects();
        this.updateProjectsList();
        if (this.projects.length > 0) {
            this.loadProject(this.projects[0].id);
        } else {
            this.createNewProject();
        }
        this.initializeToolPanel();
    }

    // ===== Eventos táctiles (para dispositivos móviles) =====
    setupTouchEvents() {
        const canvas = document.getElementById('canvas');
        if (!canvas) return;
        // Eventos táctiles para el canvas
        canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e));
        
        // Prevenir el zoom con doble toque y multitouch
        canvas.addEventListener('touchstart', (e) => {
            if (e.touches && e.touches.length > 1) {
                e.preventDefault();
            }
        }, { passive: false });
    }

    handleTouchStart(e) {
        if (!e) return;
        if (e.touches && e.touches.length === 1) {
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousedown', {
                clientX: touch.clientX,
                clientY: touch.clientY,
                bubbles: true,
                cancelable: true
            });
            // Disparar como si fuera un mousedown
            this.handleMouseDown(mouseEvent);
        }
        e.preventDefault();
    }

    handleTouchMove(e) {
        if (!e) return;
        if (e.touches && e.touches.length === 1) {
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousemove', {
                clientX: touch.clientX,
                clientY: touch.clientY,
                bubbles: true,
                cancelable: true
            });
            this.handleMouseMove(mouseEvent);
        }
        e.preventDefault();
    }

    handleTouchEnd(e) {
        const mouseEvent = new MouseEvent('mouseup', { bubbles: true, cancelable: true });
        this.handleMouseUp(mouseEvent);
    }

    // Añade este método para mejorar la experiencia del input
    setupProjectNameInput() {
        const projectNameInput = document.getElementById('project-name');
        if (projectNameInput) {
            // Limpiar el placeholder al hacer focus
            projectNameInput.addEventListener('focus', () => {
                if (projectNameInput.value === 'Proyecto sin nombre') {
                    projectNameInput.value = '';
                }
            });
            
            // Restaurar si está vacío al perder focus
            projectNameInput.addEventListener('blur', () => {
                if (projectNameInput.value.trim() === '') {
                    projectNameInput.value = 'Proyecto sin nombre';
                }
            });
            
            // Guardar cuando se presione Enter
            projectNameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    projectNameInput.blur();
                    if (this.currentProject) {
                        this.saveCurrentProject();
                    }
                }
            });
        }
    }

    createLayerDrawingSurface(layerIndex) {
        const drawingLayer = document.getElementById('drawing-layer');
        if (!drawingLayer) {
            console.error('Error crítico: El SVG principal "drawing-layer" no se encontró en el DOM.');
            return;
        }

        // Asegurar que exista el contenedor de definiciones <defs>
        let defs = drawingLayer.querySelector('defs');
        if (!defs) {
            defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
            defs.id = 'drawing-defs';
            // Insertar <defs> al principio del SVG
            drawingLayer.insertBefore(defs, drawingLayer.firstChild);
        }

        // Crear la máscara para el borrador si no existe
        let mask = document.getElementById(`mask-layer-${layerIndex}`);
        if (!mask) {
            mask = document.createElementNS('http://www.w3.org/2000/svg', 'mask');
            mask.id = `mask-layer-${layerIndex}`;
            mask.innerHTML = `<rect width="100%" height="100%" fill="white" /><g id="eraser-paths-${layerIndex}"></g>`;
            defs.appendChild(mask);
        }

        // Crear el grupo <g> para los dibujos de la capa si no existe
        let group = document.getElementById(`g-layer-${layerIndex}`);
        if (!group) {
            group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            group.id = `g-layer-${layerIndex}`;
            group.setAttribute('mask', `url(#mask-layer-${layerIndex})`);
            drawingLayer.appendChild(group);
        }
    }

    initializeToolPanel() {
        const toolbar = document.getElementById('toolbar');
        if (toolbar) {
            toolbar.classList.remove('open');
        }
    }

    // ===== GESTIÓN DE PROYECTOS CON BASE DE DATOS =====
    async loadProjects() {
        try {
            const response = await fetch('api/get_projects.php');
            const responseText = await response.text();

            if (!response.ok) {
                throw new Error(`Error del servidor: ${response.status} ${response.statusText}. Respuesta: ${responseText}`);
            }

            try {
                const projects = JSON.parse(responseText);
                this.projects = projects;
                return projects;
            } catch (jsonError) {
                throw new Error(`La respuesta del servidor no es un JSON válido.\nRespuesta: ${responseText}`);
            }
        } catch (error) {
            console.error('Error loading projects:', error);
            this.projects = [];
            return [];
        }
    }

    saveProjects() {
        // Ya no se usa localStorage
        console.log('Projects are now saved in database');
    }

    async createNewProject() {
        // Resetear el nombre del proyecto a vacío y permitir al usuario escribir
        const projectNameInput = document.getElementById('project-name');
        if (projectNameInput) {
            projectNameInput.value = '';
            projectNameInput.placeholder = 'Nombre del proyecto';
        }
        // Crear un proyecto temporal en cliente (no persistido) para evitar crear "proyectos fantasma"
        const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
        const projectName = projectNameInput?.value || 'Proyecto sin nombre';

        const newProject = {
            id: tempId,
            name: projectName,
            elements: [],
            created: new Date().toISOString(),
            modified: new Date().toISOString(),
            persisted: false // marca local
        };

        // Añadir proyecto en estado local y abrirlo sin hacer POST al servidor
        this.projects.unshift(newProject);
        this.currentProject = newProject;
        this.updateProjectsList();
        this.clearCanvas();
        this.history.clear();
        this.updateProjectName();
        this.showNotification('Proyecto creado en local (recuerda guardar para persistir)');
        // enfocar el input para que el usuario pueda escribir el nombre
        if (projectNameInput) projectNameInput.focus();
    }

    async loadProject(projectId) {
    try {
        // Guardar proyecto actual antes de cambiar solo si está persistido en servidor
        if (this.currentProject && !(String(this.currentProject.id).startsWith('temp-'))) {
            await this.saveCurrentProject();
        }
        // Limpiar completamente el canvas/DOM antes de cargar el nuevo proyecto
        this.clearCanvas();
        
        const response = await fetch(`api/get_project.php?id=${projectId}`);
        const data = await response.json();
        
        if (data.success) {
            const project = {
                id: data.project.id.toString(),
                name: data.project.nombre,
                elements: data.elements || [],
                created: data.project.fecha_creacion,
                modified: data.project.ultima_modificacion
            };
            
            this.currentProject = project;
            
            // Reiniciar sistema de capas para el nuevo proyecto
            this.initializeLayersForProject();
            
            this.loadCanvasElements(project.elements);
            this.updateProjectName();
            this.closeSidebar();
            this.showNotification('Proyecto cargado');
        } else {
            this.showNotification('Error al cargar proyecto: ' + data.message);
        }
    } catch (error) {
        console.error('Error loading project:', error);
        this.showNotification('Error al cargar proyecto');
    }
}

    async deleteProject(projectId) {
        if (confirm('¿Estás seguro de que quieres eliminar este proyecto?')) {
            try {
                const response = await fetch('api/delete_project.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        projectId: projectId
                    })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    this.projects = this.projects.filter(p => p.id !== projectId);
                    this.updateProjectsList();
                    
                    if (this.currentProject && this.currentProject.id === projectId) {
                        if (this.projects.length > 0) {
                            this.loadProject(this.projects[0].id);
                        } else {
                            this.createNewProject();
                        }
                    }
                    
                    this.showNotification('Proyecto eliminado');
                } else {
                    this.showNotification('Error al eliminar proyecto: ' + data.message);
                }
            } catch (error) {
                console.error('Error deleting project:', error);
                this.showNotification('Error al eliminar proyecto');
            }
        }
    }

    async duplicateProject(projectId) {
        const project = this.projects.find(p => p.id === projectId);
        if (project) {
            try {
                const response = await fetch('api/duplicate_project.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        projectId: projectId,
                        newName: project.name + ' (Copia)'
                    })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    // Refrescar lista de proyectos desde servidor y abrir la copia
                    await this.loadProjects();
                    this.updateProjectsList();
                    // Abrir proyecto duplicado automáticamente (si existe)
                    if (data.newProjectId) {
                        await this.loadProject(String(data.newProjectId));
                        this.showNotification('Proyecto duplicado y abierto');
                    } else {
                        this.showNotification('Proyecto duplicado');
                    }
                } else {
                    this.showNotification('Error al duplicar proyecto: ' + data.message);
                }
            } catch (error) {
                console.error('Error duplicating project:', error);
                this.showNotification('Error al duplicar proyecto');
            }
        }
    }

    async saveCurrentProject() {
    if (!this.currentProject || this.isSaving) {
        console.log('No hay proyecto actual o ya se está guardando');
        return;
    }
    
    this.isSaving = true;
    this.showNotification('Guardando proyecto...');
    
    try {
        // Si el proyecto es temporal (no persistido), crearlo primero en el servidor
        if (String(this.currentProject.id).startsWith('temp-')) {
            const projectNameInput = document.getElementById('project-name');
            const nombre = projectNameInput ? projectNameInput.value || this.currentProject.name : this.currentProject.name;
            // POST para crear proyecto y obtener id
            const createRes = await fetch('api/create_project.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre: nombre, descripcion: '' })
            });
            const createText = await createRes.text();
            let createData;
            try { createData = JSON.parse(createText); } catch(e){ throw new Error('Respuesta inválida al crear proyecto: '+createText); }
            if (!createData.success) throw new Error(createData.message || 'No se pudo crear proyecto');

            const realId = String(createData.projectId);
            // Reemplazar id temporal en la lista de proyectos
            const idx = this.projects.findIndex(p => p.id === this.currentProject.id);
            if (idx !== -1) {
                this.projects[idx].id = realId;
                this.projects[idx].persisted = true;
                this.projects[idx].name = nombre;
            } else {
                this.projects.unshift({ id: realId, name: nombre, elements: [], created: new Date().toISOString(), modified: new Date().toISOString() });
            }
            // Actualizar currentProject id
            this.currentProject.id = realId;
        }
        // Actualizar datos del proyecto actual
        this.currentProject.elements = this.getAllCanvasElements();
        this.currentProject.modified = new Date().toISOString();
        
        const projectNameInput = document.getElementById('project-name');
        if (projectNameInput) {
            this.currentProject.name = projectNameInput.value;
        }
        
        // Preparar datos para enviar
        const saveData = {
            projectId: this.currentProject.id,
            nombre: this.currentProject.name,
            elementos: this.currentProject.elements
        };
        
        console.log('Enviando datos de guardado:', {
            projectId: saveData.projectId,
            nombre: saveData.nombre,
            numElementos: saveData.elementos.length,
            elementos: saveData.elementos
        });
        
        const response = await fetch('api/save_project.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(saveData)
        });
        
        // Verificar si la respuesta es JSON válido
        const responseText = await response.text();
        console.log('Respuesta del servidor:', responseText);
        
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (jsonError) {
            console.error('Error parseando JSON:', jsonError);
            throw new Error(`Respuesta no válida del servidor: ${responseText}`);
        }
        
        if (data.success) {
            this.showNotification('Proyecto guardado exitosamente');
            
            // Actualizar la lista de proyectos después de guardar
            await this.loadProjects();
            this.updateProjectsList();
        } else {
            throw new Error(data.message || 'Error desconocido al guardar');
        }
        
    } catch (error) {
        console.error('Error saving project:', error);
        this.showNotification('Error al guardar: ' + error.message);
    } finally {
        this.isSaving = false;
    }
}

    getAllCanvasElements() {
    const elements = [];
    
    // Recorrer todas las capas y elementos
    this.board.layers.forEach(layer => {
        layer.elements.forEach(element => {
            // Solo procesar elementos válidos (incluyendo dibujos y borradores)
            if (element && element.type) {
                const dbElement = {
                    id: element.id,
                    type: element.type,
                    x: element.x || 0,
                    y: element.y || 0,
                    width: element.width || 200,
                    height: element.height || 200,
                    rotation: element.rotation || 0,
                    opacity: element.opacity || 100,
                    layer: element.layer || 0,
                    // Propiedades específicas por tipo
                    ...this.getElementDataForDB(element)
                };
                elements.push(dbElement);
            }
        });
    });
    
    return elements;
}

    getElementDataForDB(element) {
        switch(element.type) {
            case 'image':
                return {
                    src: element.src,
                    flipScale: element.flipScale || { x: 1, y: 1 }
                };
            case 'text':
                return {
                    text: element.text || '',
                    styles: element.styles || {
                        fontSize: '16px',
                        fontFamily: 'Arial',
                        color: '#000000',
                        fontWeight: 'normal',
                        fontStyle: 'normal',
                        textDecoration: 'none',
                        textAlign: 'left',
                        isHighlighted: false,
                        highlightColor: '#ffff00'
                    }
                };
            case 'drawing':
                return {
                    path: element.path,
                    style: element.style || {
                        stroke: '#000000',
                        strokeWidth: 3,
                        fill: 'none',
                        opacity: 100
                    }
                };
                case 'eraser_path':
                    return {
                        path: element.path,
                        style: element.style || {
                            stroke: '#ffffff',
                            strokeWidth: 3,
                            fill: 'none',
                            opacity: 100
                        }
                    };
            case 'document':
                return {
                    src: element.src,
                    name: element.name || '',
                    fileType: element.fileType || '',
                    scale: element.scale || 100,
                    flipScale: element.flipScale || { x: 1, y: 1 },
                    annotations: element.annotations || []
                };
            default:
                return {};
        }
    }

    updateProjectName() {
        const projectNameInput = document.getElementById('project-name');
        if (this.currentProject && projectNameInput) {
            projectNameInput.value = this.currentProject.name;
        }
    }

    updateProjectsList() {
        const projectsList = document.getElementById('projects-list');
        if (!projectsList) return;
        
        projectsList.innerHTML = '';

        this.projects.forEach(project => {
            const projectItem = document.createElement('div');
            projectItem.className = 'project-item';
            projectItem.innerHTML = `
                <h4>${project.name}</h4>
                <p>Creado: ${new Date(project.created).toLocaleDateString()}</p>
                <p>Modificado: ${new Date(project.modified).toLocaleDateString()}</p>
                <div class="project-actions">
                    <button onclick="app.loadProject('${project.id}')">Abrir</button>
                    <button onclick="app.duplicateProject('${project.id}')">Duplicar</button>
                    <button onclick="app.deleteProject('${project.id}')">Eliminar</button>
                </div>
            `;
            projectsList.appendChild(projectItem);
        });
    }

    // ===== INTERFAZ DE USUARIO =====
    setupEventListeners() {
        // Event listeners individuales para cada botón
        document.getElementById('menu-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleSidebar();
        });
        
        document.getElementById('save-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.saveCurrentProject();
        });
        
        // Listeners para Deshacer y Rehacer (los botones se añadirán dinámicamente)
        document.body.addEventListener('click', e => {
            if (e.target.closest('#undo-btn')) this.undo();
            if (e.target.closest('#redo-btn')) this.redo();
        });
        
        document.getElementById('image-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const button = e.currentTarget;
            button.classList.add('processing');
            setTimeout(() => button.classList.remove('processing'), 100);
            this.selectTool('image');
        });
        
        document.getElementById('text-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const button = e.currentTarget;
            button.classList.add('processing');
            setTimeout(() => button.classList.remove('processing'), 100);
            this.selectTool('text');
        });
        
        document.getElementById('draw-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const button = e.currentTarget;
            button.classList.add('processing');
            setTimeout(() => button.classList.remove('processing'), 100);
            this.selectTool('draw');
        });
        
        document.getElementById('document-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const button = e.currentTarget;
            button.classList.add('processing');
            setTimeout(() => button.classList.remove('processing'), 100);
            this.selectTool('document');
        });

        // Otros eventos con delegación
        document.addEventListener('click', (e) => {
            if (e.target.id === 'close-sidebar') this.closeSidebar();
            else if (e.target.id === 'sidebar-overlay') this.closeSidebar();
            else if (e.target.id === 'new-project') this.createNewProject();
        });

        // Inputs de archivos
        document.getElementById('file-input-img')?.addEventListener('change', (e) => this.handleImageUpload(e));
        document.getElementById('file-input-doc')?.addEventListener('change', (e) => this.handleDocumentUpload(e));

        // Tutorial
        document.getElementById('tutorial-btn')?.addEventListener('click', () => this.openTutorial());
        document.getElementById('close-tutorial')?.addEventListener('click', () => this.closeTutorial());
        document.getElementById('prev-slide')?.addEventListener('click', () => this.prevSlide());
        document.getElementById('next-slide')?.addEventListener('click', () => this.nextSlide());

        // Canvas - Optimización de eventos
        const canvas = document.getElementById('canvas');
        canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
        canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        canvas.addEventListener('mousemove', this.throttle((e) => this.handleMouseMove(e), 16));
        canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        
        // Prevenir eventos de scroll en canvas para mejor rendimiento
        canvas.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });

        // Cambio de nombre del proyecto
        document.getElementById('project-name')?.addEventListener('change', () => {
            if (this.currentProject) {
                this.currentProject.name = document.getElementById('project-name').value;
            }
        });
    }

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        
        if (sidebar && overlay) {
            sidebar.classList.toggle('open');
            overlay.classList.toggle('active');
        }
    }

    closeSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        
        if (sidebar) sidebar.classList.remove('open');
        if (overlay) overlay.classList.remove('active');
    }

    selectTool(tool) {
        const toolBtn = document.getElementById(tool + '-btn');
        const toolbar = document.getElementById('toolbar');
        
        // Si la herramienta ya está activa, desactivarla y cerrar la barra
        if (this.selectedTool === tool && toolBtn?.classList.contains('active')) {
            toolBtn.classList.remove('active');
            this.selectedTool = null;
            
            if (toolbar) {
                toolbar.classList.remove('open');
                toolbar.removeAttribute('data-current-tool');
            }
            
            const canvas = document.getElementById('canvas');
            canvas.style.cursor = 'default';
            return;
        }
        
        // Desactivar herramienta anterior
        document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
        
        // Activar nueva herramienta
        this.selectedTool = tool;
        if (toolBtn) {
            toolBtn.classList.add('active');
        }
        
        this.textMode = null;
        
        // Actualizar cursor para herramientas de dibujo
        if (tool === 'draw') {
            this.drawingTool.updateCursor();
        } else {
            const canvas = document.getElementById('canvas');
            canvas.style.cursor = 'default';
        }
        
        // Mostrar panel de herramientas
        this.showToolPanel(tool);
    }

    deselectTool() {
        document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
        this.selectedTool = null;
        
        const toolbar = document.getElementById('toolbar');
        if (toolbar) {
            toolbar.classList.remove('open');
        }
    }

    showToolPanel(tool) {
        const toolbar = document.getElementById('toolbar');
        if (!toolbar) return;
        
        const currentTool = toolbar.getAttribute('data-current-tool');
        if (currentTool === tool && toolbar.classList.contains('open')) {
            this.setupToolEvents(tool);
            return;
        }
        
        toolbar.classList.remove('open');
        
        let content = document.querySelector('.toolbar-content');
        if (!content) {
            content = document.createElement('div');
            content.className = 'toolbar-content';
            toolbar.appendChild(content);
        }
        
        switch(tool) {
            case 'image':
                content.innerHTML = this.getImageToolPanel();
                break;
            case 'text':
                content.innerHTML = this.getTextToolPanel();
                break;
            case 'draw':
                content.innerHTML = this.getDrawToolPanel();
                break;
            case 'document':
                content.innerHTML = this.getDocumentToolPanel();
                break;
            default:
                content.innerHTML = `<div>Herramienta: ${tool}</div>`;
        }
        
        toolbar.setAttribute('data-current-tool', tool);
        
        requestAnimationFrame(() => {
            toolbar.classList.add('open');
            this.setupToolEvents(tool);
        });
    }

    getImageToolPanel() {
        return `
            <button onclick="app.triggerImageUpload()" class="toolbar-btn"><i class="fas fa-file-upload"></i> Subir Imagen</button>
            <span class="toolbar-divider"></span>
            <button onclick="app.setImageMode('crop')" class="toolbar-btn"><i class="fas fa-crop-alt"></i> Recortar</button>
            <span class="toolbar-divider"></span>
            <div class="tool-option">
                <label>Rotación:</label>
                <input type="range" id="image-rotation" min="0" max="360" value="0" class="toolbar-range">
                <span id="rotation-value" class="toolbar-value">0°</span>
            </div>
            <div class="tool-option">
                <label>Opacidad:</label>
                <input type="range" id="image-opacity" min="0" max="100" value="100" class="toolbar-range">
                <span id="opacity-value" class="toolbar-value">100%</span>
            </div>
        `;
    }

    getTextToolPanel() {
        return `
            <button id="create-text-box-btn" class="toolbar-btn"><i class="fas fa-plus-square"></i> Crear Cuadro de Texto</button>
            <span class="toolbar-divider"></span>
            <div class="tool-option">
                <button class="toolbar-btn text-style-btn" data-style="bold"><b>B</b></button>
                <button class="toolbar-btn text-style-btn" data-style="italic"><i>I</i></button>
                <button class="toolbar-btn text-style-btn" data-style="underline"><u>U</u></button>
            </div>
            <div class="tool-option">
                <button class="toolbar-btn text-align-btn" data-align="left"><i class="fas fa-align-left"></i></button>
                <button class="toolbar-btn text-align-btn" data-align="center"><i class="fas fa-align-center"></i></button>
                <button class="toolbar-btn text-align-btn" data-align="right"><i class="fas fa-align-right"></i></button>
            </div>
            <span class="toolbar-divider"></span>
            <div class="tool-option">
                <label>Fuente:</label>
                <select id="text-font" class="toolbar-select">
                    <option value="Arial">Arial</option>
                    <option value="Verdana">Verdana</option>
                    <option value="Times New Roman">Times New Roman</option>
                    <option value="Courier New">Courier New</option>
                    <option value="Georgia">Georgia</option>
                    <option value="Comic Sans MS">Comic Sans MS</option>
                </select>
            </div>
            <div class="tool-option">
                <label>Tamaño:</label>
                <input type="range" id="text-size" min="8" max="120" value="16" class="toolbar-range">
                <span id="size-value" class="toolbar-value">16px</span>
            </div>
            <div class="tool-option">
                <label>Color:</label>
                <input type="color" id="text-color" value="#000000" class="toolbar-color">
            </div>
        `;
    }

    getDrawToolPanel() {
        return `
            <button onclick="app.drawingTool.setTool('pen')" class="toolbar-btn active" data-tool="pen"><i class="fas fa-pen"></i> Lápiz</button>
            <button onclick="app.drawingTool.setTool('eraser')" class="toolbar-btn" data-tool="eraser"><i class="fas fa-eraser"></i> Borrador</button>
            <span class="toolbar-divider"></span>
            <button onclick="app.drawingTool.setShape('line')" class="toolbar-btn" data-shape="line"><i class="fas fa-minus"></i> Línea</button>
            <button onclick="app.drawingTool.setShape('rectangle')" class="toolbar-btn" data-shape="rectangle"><i class="far fa-square"></i> Rectángulo</button>
            <button onclick="app.drawingTool.setShape('circle')" class="toolbar-btn" data-shape="circle"><i class="far fa-circle"></i> Círculo</button>
            <span class="toolbar-divider"></span>
            <div class="tool-option">
                <label>Grosor:</label>
                <input type="range" id="draw-width" min="1" max="50" value="3" class="toolbar-range">
                <span id="width-value" class="toolbar-value">3px</span>
            </div>
            <div class="tool-option">
                <label>Opacidad:</label>
                <input type="range" id="draw-opacity" min="0" max="100" value="100" class="toolbar-range">
                <span id="opacity-value" class="toolbar-value">100%</span>
            </div>
            <div class="tool-option">
                <label>Color:</label>
                <input type="color" id="draw-color" value="#000000" class="toolbar-color">
            </div>
            <span class="toolbar-divider"></span>
            <button id="undo-btn" class="toolbar-btn" title="Deshacer"><i class="fas fa-undo"></i></button>
            <button id="redo-btn" class="toolbar-btn" title="Rehacer"><i class="fas fa-redo"></i></button>
            <button onclick="app.drawingTool.clear()" class="toolbar-btn danger" title="Limpiar Todo"><i class="fas fa-trash"></i></button>
        `;
    }

    getDocumentToolPanel() {
        return `
            <button onclick="app.triggerDocumentUpload()" class="toolbar-btn"><i class="fas fa-file-upload"></i> Subir Documento</button>
            <span class="toolbar-divider"></span>
            <button id="delete-doc-btn" class="toolbar-btn danger" title="Eliminar Documento"><i class="fas fa-trash-alt"></i> Eliminar</button>
        `;
    }

    setupToolEvents(tool) {
        switch(tool) {
            case 'image':
                this.setupImageToolEvents();
                break;
            case 'document':
                this.setupDocumentToolEvents();
                break;
            case 'text':
                this.setupTextToolEvents();
                break;
            case 'draw':
                this.setupDrawToolEvents();
                break;
        }
    }

    setupImageToolEvents() {
        const rotationSlider = document.getElementById('image-rotation');
        const opacitySlider = document.getElementById('image-opacity');
        
        if (rotationSlider) {
            rotationSlider.addEventListener('input', (e) => {
                const rotationValue = document.getElementById('rotation-value');
                if (rotationValue) rotationValue.textContent = e.target.value + '°';
                this.applyImageTransform('rotation', e.target.value);
            });
        }
        
        if (opacitySlider) {
            opacitySlider.addEventListener('input', (e) => {
                const opacityValue = document.getElementById('opacity-value');
                if (opacityValue) opacityValue.textContent = e.target.value + '%';
                this.applyImageTransform('opacity', e.target.value);
            });
        }
    }

    setupTextToolEvents() {
        document.getElementById('create-text-box-btn')?.addEventListener('click', () => this.createNewTextBox());

        const sizeSlider = document.getElementById('text-size');
        const colorPicker = document.getElementById('text-color');
        const fontSelect = document.getElementById('text-font');
        
        const update = (prop, val) => this.applyTextTransform(prop, val);

        if (sizeSlider) {
            sizeSlider.addEventListener('input', (e) => {
                const sizeValue = document.getElementById('size-value');
                if (sizeValue) sizeValue.textContent = e.target.value + 'px';
                update('fontSize', `${e.target.value}px`);
            });
        }
        
        if (colorPicker) {
            colorPicker.addEventListener('change', (e) => update('color', e.target.value));
        }
        
        if (fontSelect) {
            fontSelect.addEventListener('change', (e) => update('fontFamily', e.target.value));
        }

        document.querySelectorAll('.text-style-btn').forEach(btn => {
            btn.addEventListener('click', () => update(btn.dataset.style, null));
        });

        document.querySelectorAll('.text-align-btn').forEach(btn => {
            btn.addEventListener('click', () => update('textAlign', btn.dataset.align));
        });
    }

    setupDrawToolEvents() {
        this.drawingTool.setupEvents();
    }

    setupDocumentToolEvents() {
        document.getElementById('delete-doc-btn')?.addEventListener('click', () => {
            if (this.selectedElement) {
                this.deleteElement(this.selectedElement.id.replace('element-', ''));
                const toolbar = document.getElementById('toolbar');
                if (toolbar) {
                    toolbar.classList.remove('open');
                }
                this.deselectTool();
            }
        });
    }

    // ===== MÉTODOS DE HERRAMIENTAS =====
    setImageMode(mode) {
        if (!this.selectedElement || this.selectedElement.getAttribute('data-type') !== 'image') {
            this.showNotification('Por favor, selecciona una imagen primero.', 'warning');
            return;
        }

        const currentMode = this.selectedElement.getAttribute('data-image-mode');

        if (currentMode === mode) {
            this.exitImageMode();
            return;
        }

        if (currentMode) {
            this.exitImageMode(false);
        }

        this.selectedElement.setAttribute('data-image-mode', mode);
        this.selectedElement.classList.add(`${mode}-mode`);
        this.imageMode = mode;
        
        const toolBtn = document.querySelector(`.toolbar-btn[onclick="app.setImageMode('${mode}')"]`);
        if(toolBtn) toolBtn.classList.add('active');

        if (mode === 'crop') {
            this.initCropMode();
        } else if (mode === 'deform') {
            this.initDeformMode();
        }
    }

    exitImageMode(notify = true) {
        if (this.selectedElement) {
            const currentMode = this.selectedElement.getAttribute('data-image-mode');
            if (currentMode) {
                if (currentMode === 'crop') {
                    const cropContainer = this.selectedElement.querySelector('.crop-container');
                    if (cropContainer) cropContainer.remove();
                    const cropActions = this.selectedElement.querySelector('.crop-actions');
                    if (cropActions) cropActions.remove();
                }

                const toolBtn = document.querySelector(`.toolbar-btn[onclick="app.setImageMode('${currentMode}')"]`);
                if(toolBtn) toolBtn.classList.remove('active');

                this.selectedElement.classList.remove(`${currentMode}-mode`);
                this.selectedElement.removeAttribute('data-image-mode');
                if(notify) this.showNotification(`Modo ${currentMode} desactivado.`, 'info');
            }
        }
        this.imageMode = null;
    }

    initCropMode() {
        if (!this.selectedElement) return;
        
        // Prevenir que se inicie de nuevo si ya está en modo recorte
        if (this.selectedElement.querySelector('.crop-container')) return;

        const cropContainer = document.createElement('div');
        cropContainer.className = 'crop-container';
        
        const cropBox = document.createElement('div');
        cropBox.className = 'crop-box';
        
        const handles = ['nw', 'ne', 'sw', 'se'];
        handles.forEach(h => {
            const handle = document.createElement('div');
            handle.className = `crop-resize-handle ${h}`;
            cropBox.appendChild(handle);
        });

        // Añadir botones de confirmar y cancelar
        const cropActions = document.createElement('div');
        cropActions.className = 'crop-actions';
        cropActions.innerHTML = `
            <button class="crop-btn confirm"><i class="fas fa-check"></i> Confirmar</button>
            <button class="crop-btn cancel"><i class="fas fa-times"></i> Cancelar</button>
        `;

        cropActions.querySelector('.confirm').addEventListener('click', (e) => {
            e.stopPropagation();
            this.applyCrop();
        });

        cropActions.querySelector('.cancel').addEventListener('click', (e) => {
            e.stopPropagation();
            this.exitImageMode(true);
        });
        
        cropContainer.appendChild(cropBox);
        this.selectedElement.appendChild(cropContainer);
        this.selectedElement.appendChild(cropActions);

        this.makeDraggable(cropBox, cropContainer);
        this.makeResizable(cropBox, cropContainer);

        this.showNotification('Ajusta el recuadro y confirma o cancela el recorte.', 'info');
    }
    
    applyCrop() {
        if (!this.selectedElement) return;

        const cropBox = this.selectedElement.querySelector('.crop-box');
        const img = this.selectedElement.querySelector('img');
        const elementId = this.selectedElement.id.replace('element-', '');
        const elementData = this.findElementById(elementId);

        if (!cropBox || !img || !elementData) {
            this.exitImageMode();
            return;
        }

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const originalImage = new Image();
        originalImage.crossOrigin = "Anonymous";

        originalImage.onload = () => {
            const ratioX = originalImage.naturalWidth / img.clientWidth;
            const ratioY = originalImage.naturalHeight / img.clientHeight;

            const sx = cropBox.offsetLeft * ratioX;
            const sy = cropBox.offsetTop * ratioY;
            const sWidth = cropBox.offsetWidth * ratioX;
            const sHeight = cropBox.offsetHeight * ratioY;

            if (sWidth < 1 || sHeight < 1) {
                this.showNotification('El área de recorte es demasiado pequeña.', 'warning');
                return;
            }

            canvas.width = sWidth;
            canvas.height = sHeight;
            ctx.drawImage(originalImage, sx, sy, sWidth, sHeight, 0, 0, sWidth, sHeight);

            const newDataUrl = canvas.toDataURL('image/png');
            elementData.src = newDataUrl;
            img.src = newDataUrl;

            const newAspectRatio = sWidth / sHeight;
            const newHeight = this.selectedElement.clientWidth / newAspectRatio;
            
            this.selectedElement.style.height = newHeight + 'px';
            elementData.height = newHeight;
            
            this.showNotification('Imagen recortada.', 'success');
            this.exitImageMode(false);
        };

        originalImage.src = elementData.src;
    }

    initDeformMode() {
        this.showNotification('La función de deformar aún no está implementada.', 'info');
    }

    applyDeform() {
        // Lógica para aplicar la deformación
    }

    setTextStyle(style) {
        this.applyTextTransform(style, null);
    }

    setTextAlign(align) {
        this.applyTextTransform('textAlign', align);
    }

    applyImageTransform(property, value) {
        if (this.selectedElement) {
            const elementId = this.selectedElement.id.replace('element-', '');
            const element = this.findElementById(elementId);
            
            if (element && element.type === 'image') {
                if (property === 'rotation') {
                    element.rotation = parseInt(value);
                    this.selectedElement.style.transform = `rotate(${element.rotation}deg)`;
                } else if (property === 'opacity') {
                    element.opacity = parseInt(value);
                    const img = this.selectedElement.querySelector('img');
                    if (img) {
                        img.style.opacity = element.opacity / 100;
                    }
                }
            }
        }
    }

    applyTextTransform(property, value) {
        if (this.selectedElement) {
            const elementId = this.selectedElement.id.replace('element-', '');
            const element = this.findElementById(elementId);
            
            if (element && element.type === 'text') {
                const textarea = document.querySelector(`#element-${elementId} .text-element`);
                if (!textarea) return;

                if (property === 'fontSize') {
                    element.styles.fontSize = value;
                } else if (property === 'color') {
                    element.styles.color = value;
                } else if (property === 'fontFamily') {
                    element.styles.fontFamily = value;
                } else if (property === 'bold') {
                    element.styles.fontWeight = element.styles.fontWeight === 'bold' ? 'normal' : 'bold';
                } else if (property === 'italic') {
                    element.styles.fontStyle = element.styles.fontStyle === 'italic' ? 'normal' : 'italic';
                } else if (property === 'underline') {
                    element.styles.textDecoration = element.styles.textDecoration === 'underline' ? 'none' : 'underline';
                } else if (property === 'textAlign') {
                    element.styles.textAlign = value;
                }
                
                this.updateTextElement(this.selectedElement, element);
                this.updateTextToolbar(element);
            }
        }
    }

    applyDocumentTransform(property, value) {
        if (this.selectedElement) {
            const elementId = this.selectedElement.id.replace('element-', '');
            const element = this.findElementById(elementId);
            if (element && element.type === 'document') {
                element[property] = property === 'scale' ? parseInt(value) : parseInt(value);
                this.renderElement(element);
            }
        }
    }

    // ===== GESTIÓN DE ELEMENTOS =====
    addImageElement(src, x, y) {
        const element = {
            id: Date.now().toString(),
            type: 'image',
            src: src,
            x: x,
            y: y,
            width: 200,
            height: 200,
            rotation: 0,
            opacity: 100,
            layer: this.currentLayer
        };
        
        const action = {
            app: this,
            element: element,
            execute: function() { this.app.internal_addElement(this.element); },
            undo: function() { this.app.internal_removeElement(this.element.id); }
        };

        this.history.execute(action);
        action.execute();
    }

    createTextBoxAtPosition(x, y) {
        const element = {
            id: Date.now().toString(),
            type: 'text',
            text: 'Escribe aquí...',
            x: Math.max(0, x - 100),
            y: Math.max(0, y - 25),
            width: 200,
            height: 50,
            styles: {
                fontSize: '16px',
                fontFamily: 'Arial',
                color: '#000000',
                fontWeight: 'normal',
                fontStyle: 'normal',
                textDecoration: 'none',
                textAlign: 'left'
            },
            rotation: 0,
            layer: this.currentLayer,
            isEditing: true
        };
        
        const action = {
            app: this,
            element: element,
            execute: function() {
                this.app.internal_addElement(this.element, true);
            },
            undo: function() {
                this.app.internal_removeElement(this.element.id);
            }
        };

        this.history.execute(action);
        action.execute();
        
        this.showNotification('Cuadro de texto creado');
    }

    internal_addElement(element, isNewText = false) {
        const activeLayer = this.getActiveLayer();
        if (activeLayer) {
            activeLayer.elements.push(element);
        }
        this.renderElement(element);

        if (isNewText) {
            setTimeout(() => {
                const elementDiv = document.getElementById(`element-${element.id}`);
                if (elementDiv) {
                    this.selectElement(null, elementDiv);
                    const textarea = elementDiv.querySelector('.text-element');
                    if (textarea) {
                        textarea.focus();
                        textarea.select();
                    }
                }
            }, 100);
        }
    }

    createNewTextBox() {
        const canvas = document.getElementById('canvas');
        const canvasContent = canvas.querySelector('.canvas-content');
        const rect = canvasContent.getBoundingClientRect();
        
        const randomOffset = Math.floor(Math.random() * 100) - 50;
        const centerX = rect.width / 2 + randomOffset;
        const centerY = rect.height / 2 + randomOffset;
        
        this.createTextBoxAtPosition(centerX, centerY);
    }

    addDrawingElement(elementData) {
        const action = {
            app: this,
            element: elementData,
            execute: function() { this.app.internal_addDrawingElement(this.element); },
            undo: function() { this.app.internal_removeElement(this.element.id); }
        };

        this.history.execute(action);
        action.execute();
    }

    internal_addDrawingElement(elementData) {
        const activeLayer = this.getActiveLayer();
        if (activeLayer) {
            // Verificar que el elemento no exista ya
            const existingIndex = activeLayer.elements.findIndex(el => el.id === elementData.id);
            if (existingIndex === -1) {
                activeLayer.elements.push(elementData);
                console.log('Elemento añadido a la capa activa:', elementData.id);
            }
        }
        this.renderDrawingElement(elementData);
    }

    addDocumentElement(src, type, name) {
        const canvas = document.getElementById('canvas');
        const canvasRect = canvas.getBoundingClientRect();
        const centerX = Math.max(50, (canvasRect.width - 600) / 2);
        const centerY = Math.max(50, (canvasRect.height - 800) / 2);
        
        const element = {
            id: Date.now().toString(),
            type: 'document',
            src: src,
            name: name,
            fileType: type,
            x: centerX,
            y: centerY,
            width: 600,
            height: 800,
            rotation: 0,
            opacity: 100,
            layer: this.currentLayer,
            scale: 100
        };
        
        const action = {
            app: this,
            element: element,
            execute: function() { this.app.internal_addElement(this.element); },
            undo: function() { this.app.internal_removeElement(this.element.id); }
        };

        this.history.execute(action);
        action.execute();
        this.showNotification(`Documento "${name}" cargado correctamente`);
    }

    // ===== RENDERIZADO DE ELEMENTOS =====
    renderElement(element) {
        const canvas = document.getElementById('canvas');
        const canvasContent = canvas.querySelector('.canvas-content');
        
        const existingElement = document.getElementById(`element-${element.id}`);
        if (existingElement) {
            this.updateElementProperties(existingElement, element);
            return;
        }
        
        const elementDiv = this.createElementDiv(element);
        if (elementDiv) {
            canvasContent.appendChild(elementDiv);
        }
    }

    // NUEVO MÉTODO ESPECÍFICO PARA DIBUJOS
    renderDrawingElement(element) {
        const layerIndex = element.layer || 0;
        
        // Asegurarse de que existe el contenedor para esta capa
        this.createLayerDrawingSurface(layerIndex);
        let container;
        if (element.type === 'eraser_path') {
            // Para borradores, usar el grupo de máscara (que está dentro de <defs>)
            container = document.getElementById(`eraser-paths-${layerIndex}`);
        } else {
            // Para dibujos normales, usar el grupo de dibujo
            container = document.getElementById(`g-layer-${layerIndex}`);
        }
        
        if (!container) {
            console.error(`No se pudo encontrar el contenedor para el elemento: ${element.id}`);
            return;
        }

        // Eliminar elemento existente si hay duplicado
        const existingPath = container.querySelector(`[data-id="${element.id}"]`);
        if (existingPath) {
            existingPath.remove();
        }

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        
        if (typeof element.path === 'string' && !element.path.includes('NaN')) {
            path.setAttribute('d', element.path);
            path.setAttribute('data-id', element.id);
            
            this.applyDrawingStyle(path, element.style);
            
            container.appendChild(path);
        } else {
            console.warn('Path inválido para el elemento:', element.id);
        }
    }

    createElementDiv(element) {
        // Para elementos de dibujo, no crear div, solo renderizar en SVG
        if (element.type === 'drawing' || element.type === 'eraser_path') {
            this.renderDrawingElement(element);
            return null;
        }

        const elementDiv = document.createElement('div');
        elementDiv.className = 'canvas-element';
        elementDiv.id = `element-${element.id}`;
        elementDiv.setAttribute('data-type', element.type);
        elementDiv.style.left = (element.x || 100) + 'px';
        elementDiv.style.top = (element.y || 100) + 'px';
        elementDiv.style.width = (element.width || 200) + 'px';
        elementDiv.style.height = (element.height || 200) + 'px';
        elementDiv.style.transform = `rotate(${element.rotation || 0}deg)`;
        if (element.type !== 'image') {
            elementDiv.style.opacity = (element.opacity || 100) / 100;
        }
    elementDiv.style.zIndex = 100 + (element.layer * 10) || 100;

        if (element.type !== 'text') {
            elementDiv.addEventListener('mousedown', (e) => this.selectElement(e, elementDiv));
            elementDiv.addEventListener('mousedown', (e) => this.startDrag(e, elementDiv));
        } else if (element.type === 'text') {
            elementDiv.addEventListener('mousedown', (e) => this.selectElement(e, elementDiv));
            elementDiv.addEventListener('mousedown', (e) => this.startDrag(e, elementDiv));
        }

        switch(element.type) {
            case 'image':
                elementDiv.innerHTML = `
                    <img src="${element.src}" style="width: 100%; height: 100%; object-fit: contain; opacity: ${(element.opacity || 100) / 100};">
                    <div class="image-controls">
                        <button class="image-control-btn" onclick="event.stopPropagation(); app.deleteElement('${element.id}')" title="Eliminar">×</button>
                    </div>
                `;
                break;
            case 'text':
                elementDiv.innerHTML = `
                    <div class="text-box-container">
                        <textarea class="text-element" 
                                  style="font-family: ${element.styles.fontFamily || 'Arial'}; 
                                         font-size: ${element.styles.fontSize || '16px'}; 
                                         color: ${element.styles.color || '#000000'}; 
                                         font-weight: ${element.styles.fontWeight || 'normal'}; 
                                         font-style: ${element.styles.fontStyle || 'normal'}; 
                                         text-decoration: ${element.styles.textDecoration || 'none'}; 
                                         text-align: ${element.styles.textAlign || 'left'};
                                         width: 100%; 
                                         height: 100%; 
                                         border: none; 
                                         outline: none; 
                                         resize: none; 
                                         background: transparent;
                                         padding: 8px;
                                         box-sizing: border-box;
                                         overflow: hidden;">${element.text || ''}</textarea>
                        <div class="text-controls">
                            <button class="text-control-btn" onclick="event.stopPropagation(); app.deleteElement('${element.id}')" title="Eliminar">×</button>
                        </div>
                    </div>
                `;
                
                setTimeout(() => {
                    const textarea = elementDiv.querySelector('.text-element');
                    if (textarea) {
                        textarea.removeAttribute('readonly');
                        textarea.removeAttribute('disabled');
                        
                        textarea.addEventListener('input', (e) => {
                            this.handleTextInput(e, element.id);
                        });
                        
                        textarea.addEventListener('blur', (e) => {
                            const el = this.findElementById(element.id);
                            if (el) {
                                el.text = e.target.value;
                            }
                        });
                    }
                }, 10);
                break;
            case 'document':
                elementDiv.innerHTML = `
                    <div style="width: 100%; height: 100%; background: #f5f5f5; display: flex; align-items: center; justify-content: center;">
                        <div style="text-align: center; color: #666;">
                            <div style="font-size: 48px; margin-bottom: 10px;"><i class="fas fa-file"></i></div>
                            <h3>${element.name}</h3>
                            <p>${element.fileType}</p>
                        </div>
                    </div>
                    <div class="image-controls">
                        <button class="image-control-btn" onclick="event.stopPropagation(); app.deleteElement('${element.id}')" title="Eliminar">×</button>
                    </div>
                `;
                break;
        }

        if (element.type !== 'drawing') {
            this.addResizeHandles(elementDiv);
        }
        
        if (element.type === 'document' && element.fileType === 'application/pdf') {
            this.renderPdfToElement(element, elementDiv);
        }

        return elementDiv;
    }

    async renderPdfToElement(element, elementDiv) {
        elementDiv.innerHTML = '<div class="pdf-loading">Cargando PDF...</div>';

        try {
            if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
                pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.worker.min.js`;
            }

            const pdf = await pdfjsLib.getDocument(element.src).promise;
            elementDiv.innerHTML = ''; 
            const pagesContainer = document.createElement('div');
            pagesContainer.className = 'pdf-pages-container';
            elementDiv.appendChild(pagesContainer);

            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const viewport = page.getViewport({ scale: 1.5 });
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                await page.render({ canvasContext: context, viewport: viewport }).promise;
                
                const img = document.createElement('img');
                img.src = canvas.toDataURL();
                img.className = 'pdf-page-image';
                pagesContainer.appendChild(img);
            }
        } catch (error) {
            console.error('Error rendering PDF:', error);
            elementDiv.innerHTML = '<div class="pdf-error">Error al cargar PDF</div>';
        }
    }

    applyDrawingStyle(path, style) {
        if (!style) return;
        path.setAttribute('stroke', style.stroke || '#000000');
        path.setAttribute('stroke-width', style.strokeWidth || 1);
        path.setAttribute('fill', style.fill || 'none');
        path.setAttribute('stroke-linecap', style.strokeLinecap || 'round');
        path.setAttribute('stroke-linejoin', style.strokeLinejoin || 'round');
        if (style.opacity) {
            path.setAttribute('opacity', style.opacity);
        }
    }

    updateElementProperties(elementDiv, element) {
        elementDiv.style.left = element.x + 'px';
        elementDiv.style.top = element.y + 'px';
        elementDiv.style.width = element.width + 'px';
        elementDiv.style.height = element.height + 'px';
        elementDiv.style.transform = `rotate(${element.rotation || 0}deg)`;
        elementDiv.style.opacity = (element.opacity || 100) / 100;
        elementDiv.style.zIndex = element.layer || 0;
    }

    // ===== INTERACCIÓN CON EL CANVAS =====
    handleCanvasClick(e) {
        if (e.target.classList.contains('canvas-content') || e.target.id === 'canvas') {
            this.deselectElement();
        }
    }

    handleMouseDown(e) {
        const activeLayer = this.getActiveLayer();
        if (activeLayer && activeLayer.locked) {
            this.showNotification("La capa activa está bloqueada.");
            return;
        }
        
        if (this.selectedTool === 'draw') {
            this.isDrawing = true;
            this.drawingTool.startDrawing(e);
            return;
        }

        // Para dispositivos táctiles, seleccionar elemento inmediatamente
        if ('ontouchstart' in window) {
            const elementDivTouch = e.target && e.target.closest ? e.target.closest('.canvas-element') : null;
            if (elementDivTouch) {
                this.selectElement(e, elementDivTouch);
            }
        }

        const elementDiv = e.target && e.target.closest ? e.target.closest('.canvas-element') : null;
        if (elementDiv) {
            this.selectElement(e, elementDiv);
            const rect = elementDiv.getBoundingClientRect();
            this.dragOffsetX = e.clientX - rect.left;
            this.dragOffsetY = e.clientY - rect.top;
            this.isDragging = true;
        }
    }

    handleMouseMove(e) {
        if (this.selectedTool === 'draw' && this.drawingTool.isDrawing) {
            e.preventDefault();
            this.drawingTool.updateDrawing(e);
        } else if (this.isDragging && this.selectedElement) {
            const canvas = document.getElementById('canvas');
            const canvasRect = canvas.getBoundingClientRect();
            const x = e.clientX - canvasRect.left - this.dragOffsetX;
            const y = e.clientY - canvasRect.top - this.dragOffsetY;
            
            const element = this.selectedElement;
            element.style.left = Math.max(0, Math.min(x, canvasRect.width - element.offsetWidth)) + 'px';
            element.style.top = Math.max(0, Math.min(y, canvasRect.height - element.offsetHeight)) + 'px';
        }
    }

    handleMouseUp(e) {
        if (this.selectedTool === 'draw' && this.drawingTool.isDrawing) {
            e.preventDefault();
            this.drawingTool.finishDrawing();
            this.isDrawing = false; // Asegurarse de resetear el estado
            return; // Detener la ejecución para evitar conflictos
        }

        // Si no se está dibujando, se puede manejar el final de un arrastre de elemento
        if (this.isDragging && this.selectedElement) {
            this.updateElementPosition(this.selectedElement);
            this.isDragging = false;
        }
    }

    startDrag(e, element) {
        if (this.selectedTool === 'draw') return;

        const isTextElement = element.getAttribute('data-type') === 'text';
        if (isTextElement && e.target.classList.contains('text-element')) {
            return; 
        }

        e.preventDefault();
        this.selectedElement = element;
        const rect = element.getBoundingClientRect();
        const offsetX = e.clientX - rect.left;
        const offsetY = e.clientY - rect.top;

        const handleMouseMove = (e) => {
            const canvas = document.getElementById('canvas');
            const canvasRect = canvas.getBoundingClientRect();
            const x = e.clientX - canvasRect.left - offsetX;
            const y = e.clientY - canvasRect.top - offsetY;
            
            element.style.left = Math.max(0, Math.min(x, canvasRect.width - element.offsetWidth)) + 'px';
            element.style.top = Math.max(0, Math.min(y, canvasRect.height - element.offsetHeight)) + 'px';
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            this.updateElementPosition(element);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }

    selectElement(e, element) {
        if (this.selectedTool === 'draw') return;
        if (e) e.stopPropagation();
        
        if (this.selectedElement !== element) {
            this.deselectElement();
            
            element.classList.add('selected');
            this.selectedElement = element;
            this.addResizeHandles(element);

            const elementType = element.getAttribute('data-type');
            if (elementType === 'text') {
                const elementId = element.id.replace('element-', '');
                const elementData = this.findElementById(elementId);
                
                if (this.selectedTool !== 'text') {
                    this.selectTool('text');
                } else {
                    const toolbar = document.getElementById('toolbar');
                    if (toolbar && !toolbar.classList.contains('open')) {
                        toolbar.classList.add('open');
                    }
                }
                
                setTimeout(() => this.updateTextToolbar(elementData), 50);
            } else {
                this.deselectTool();
            }
        }
    }

    deselectElement() {
        if (this.selectedElement) {
            this.selectedElement.classList.remove('selected');
            this.selectedElement = null;
        }
    }

    // ===== UTILIDADES =====
    showNotification(message) {
        if (this.lastNotification === message) return;
        this.lastNotification = message;
        
        const existingNotifications = document.querySelectorAll('.notification');
        existingNotifications.forEach(notif => notif.remove());
        
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 15px 20px;
            border-radius: 5px;
            z-index: 1000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            animation: slideIn 0.3s ease;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
            this.lastNotification = null;
        }, 2000);
    }

    undo() {
        this.history.undo();
    }

    redo() {
        this.history.redo();
    }

    updateUndoRedoButtons() {
        const undoBtn = document.getElementById('undo-btn');
        const redoBtn = document.getElementById('redo-btn');
        if (undoBtn) undoBtn.disabled = this.history.undoStack.length === 0;
        if (redoBtn) redoBtn.disabled = this.history.redoStack.length === 0;
    }

    triggerImageUpload() {
        const fileInput = document.getElementById('file-input-img');
        if (fileInput) fileInput.click();
    }

    triggerDocumentUpload() {
        const fileInput = document.getElementById('file-input-doc');
        if (fileInput) fileInput.click();
    }

    handleImageUpload(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                this.addImageElement(event.target.result, 100, 100);
            };
            reader.readAsDataURL(file);
        }

        // Resetear el valor del input para permitir volver a subir el mismo archivo
        e.target.value = null;
    }

    handleDocumentUpload(e) {
        const file = e.target.files[0];
        if (file) {
            const allowedTypes = [
                'application/pdf',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            ];
            
            if (!allowedTypes.includes(file.type)) {
                alert('Tipo de archivo no soportado. Por favor, selecciona un archivo PDF o Word.');
                return;
            }
            
            const reader = new FileReader();
            reader.onload = (event) => {
                this.addDocumentElement(event.target.result, file.type, file.name);
            };
            reader.readAsDataURL(file);
        }
        
        e.target.value = '';
    }

    // ===== GESTIÓN DE CAPAS =====
    toggleLayersPanel(forceState) {
        const panel = document.getElementById('layers-panel');
        if (panel) {
            if (forceState !== undefined) {
                panel.classList.toggle('active', forceState);
            } else {
                panel.classList.toggle('active');
            }
            if (panel.classList.contains('active')) {
                this.renderLayersPanel();
            }
        }
    }

    renderLayersPanel() {
        const layersList = document.getElementById('layers-list');
        if (!layersList) return;
        
        layersList.innerHTML = '';
        [...this.board.layers].reverse().forEach(layer => {
            const layerGroup = this.createLayerGroupUI(layer);
            layersList.appendChild(layerGroup);
        });
    }

    createLayerGroupUI(layer) {
        const group = document.createElement('div');
        group.className = `layer-group ${this.activeLayerId === layer.id ? 'active' : ''}`;
        group.addEventListener('click', () => this.setActiveLayer(layer.id));

        const header = document.createElement('div');
        header.className = 'layer-header';

        // Hacer el nombre editable
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'layer-name-input';
        nameInput.value = layer.name;
        nameInput.addEventListener('change', (e) => {
            this.renameLayer(layer.id, e.target.value);
        });
        nameInput.addEventListener('blur', (e) => {
            this.renameLayer(layer.id, e.target.value);
        });
        nameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.target.blur();
            }
        });

        header.appendChild(nameInput);
        header.appendChild(this.createLayerActionsUI(layer));
        group.appendChild(header);

        // Agregar contador de elementos
        const elementCount = document.createElement('div');
        elementCount.className = 'layer-element-count';
        elementCount.textContent = `${layer.elements.length} elementos`;
        group.appendChild(elementCount);

        return group;
    }

    createLayerActionsUI(layer) {
        const actions = document.createElement('div');
        actions.className = 'layer-actions';
        
        const visibilityBtn = document.createElement('button');
        visibilityBtn.innerHTML = `<i class="fas ${layer.visible ? 'fa-eye' : 'fa-eye-slash'}"></i>`;
        visibilityBtn.onclick = (e) => { e.stopPropagation(); this.toggleLayerVisibility(layer.id); };

        const lockBtn = document.createElement('button');
        lockBtn.innerHTML = `<i class="fas ${layer.locked ? 'fa-lock' : 'fa-lock-open'}"></i>`;
        lockBtn.onclick = (e) => { e.stopPropagation(); this.toggleLayerLock(layer.id); };

        actions.appendChild(visibilityBtn);
        actions.appendChild(lockBtn);

        if (this.board.layers.length > 1) {
            const deleteBtn = document.createElement('button');
            deleteBtn.innerHTML = `<i class="fas fa-trash-alt"></i>`;
            deleteBtn.onclick = (e) => { e.stopPropagation(); this.deleteLayer(layer.id); };
            actions.appendChild(deleteBtn);
        }
        return actions;
    }

    // MÉTODOS DE GESTIÓN DE CAPAS (FALTANTES)
    toggleLayerVisibility(layerId) {
        const layer = this.board.layers.find(l => l.id === layerId);
        if (layer) {
            layer.visible = !layer.visible;
            // Actualizar visibilidad sin forzar redibujo completo
            this.updateElementsVisibility(); // Cambiado para usar el método específico
            this.renderLayersPanel();
        }
    }

    toggleLayerLock(layerId) {
        const layer = this.board.layers.find(l => l.id === layerId);
        if (layer) {
            layer.locked = !layer.locked;
            this.renderLayersPanel();
        }
    }

    renameLayer(layerId, newName) {
        const layer = this.board.layers.find(l => l.id === layerId);
        if (layer && newName.trim()) {
            layer.name = newName.trim();
            this.renderLayersPanel();
            this.showNotification('Capa renombrada');
        }
    }
    
    addLayer() {
        const newLayerIndex = this.board.layers.length;
        const newLayer = {
            id: `layer-${Date.now()}`,
            name: `Capa ${newLayerIndex + 1}`,
            elements: [],
            visible: true,
            locked: false
        };
        this.board.layers.push(newLayer);
        this.createLayerDrawingSurface(newLayerIndex); // Crear la superficie de dibujo para la nueva capa
        this.setActiveLayer(newLayer.id);
        this.renderLayersPanel();
        this.showNotification(`Nueva capa creada: ${newLayer.name}`);
    }

    deleteLayer(layerId) {
        if (this.board.layers.length <= 1) {
            this.showNotification('No se puede eliminar la única capa');
            return;
        }
        
        if (confirm('¿Estás seguro de que quieres eliminar esta capa y TODOS sus elementos?')) {
            const layerIndex = this.board.layers.findIndex(l => l.id === layerId);
            if (layerIndex === -1) return;

            // Eliminar TODOS los elementos de la capa
            const layerToDelete = this.board.layers[layerIndex];
            
            // 1. Eliminar elementos del DOM
            layerToDelete.elements.forEach(element => {
                // Eliminar elementos visuales del canvas
                const elementDiv = document.getElementById(`element-${element.id}`);
                if (elementDiv) elementDiv.remove();
                
                // Eliminar elementos de dibujo del SVG
                if (element.type === 'drawing' || element.type === 'eraser_path') {
                    const drawingLayer = document.getElementById('drawing-layer');
                    if (drawingLayer) {
                        const path = drawingLayer.querySelector(`[data-id="${element.id}"]`);
                        if (path) path.remove();
                    }
                }
            });

            // 2. Eliminar la máscara y grupo SVG de esta capa
            const mask = document.getElementById(`mask-layer-${layerIndex}`);
            if (mask) mask.remove();
            const group = document.getElementById(`g-layer-${layerIndex}`);
            if (group) group.remove();
            const eraserPaths = document.getElementById(`eraser-paths-${layerIndex}`);
            if (eraserPaths) eraserPaths.remove();

            // 3. Eliminar la capa del array
            this.board.layers.splice(layerIndex, 1);

            // 4. Si la capa activa era la que se eliminó, cambiar a otra capa
            if (this.activeLayerId === layerId) {
                const newActiveIndex = Math.max(0, layerIndex - 1);
                this.setActiveLayer(this.board.layers[newActiveIndex].id);
            }

            this.renderLayersPanel();
            this.showNotification('Capa eliminada con todos sus elementos');
        }
    }

    setActiveLayer(layerId) {
        this.activeLayerId = layerId;
        this.currentLayer = this.board.layers.findIndex(l => l.id === layerId);
        this.deselectElement();
        this.renderLayersPanel();
        this.updateLayerInteractivity();

        // If eraser is active, re-apply its logic to the new active layer
        if (this.drawingTool.activeToolName === 'eraser') {
            this.drawingTool.setTool('eraser');
        }
        
        console.log('Capa activa cambiada:', {
            id: layerId,
            index: this.currentLayer,
            nombre: this.board.layers[this.currentLayer]?.name,
            elementos: this.board.layers[this.currentLayer]?.elements.length
        });
        
        this.showNotification(`Capa activa: ${this.board.layers[this.currentLayer]?.name}`);
    }

    getActiveLayer() {
        return this.board.layers.find(l => l.id === this.activeLayerId);
    }

    // ===== MÉTODOS AUXILIARES =====
    findElementById(elementId) {
        for (const layer of this.board.layers) {
            const element = layer.elements.find(el => el.id === elementId);
            if (element) return element;
        }
        return null;
    }

    loadCanvasElements(elements) {
    this.clearCanvas();
    
    if (elements && elements.length > 0) {
        // Encontrar el número máximo de capas necesario
        const maxLayer = elements.reduce((max, el) => Math.max(max, el.layer || 0), 0);
        
        // Asegurar que todas las capas tengan superficies de dibujo
        for (let i = 0; i <= maxLayer; i++) {
            this.createLayerDrawingSurface(i);
        }
        
        const canvas = document.getElementById('canvas');
        const canvasContent = canvas.querySelector('.canvas-content');
        
        elements.forEach(element => {
            if (element && (element.type === 'drawing' || element.type === 'eraser_path')) {
                // Renderizar tanto dibujos normales como trazos de borrador
                this.renderDrawingElement(element);
            } else if (element) {
                const elementDiv = this.createElementDiv(element);
                if (elementDiv) canvasContent.appendChild(elementDiv);
            }
        });
    }
}

    clearCanvas() {
        // Limpiar todo el DOM del canvas (elementos HTML y SVG) y resetear capas en memoria
        const canvas = document.getElementById('canvas');
        if (canvas) {
            const canvasContent = canvas.querySelector('.canvas-content');
            if (canvasContent) canvasContent.innerHTML = '';
        }

        // Limpiar el SVG de dibujo por completo, preservando <defs> si existe
        const drawingLayer = document.getElementById('drawing-layer');
        if (drawingLayer) {
            const defs = drawingLayer.querySelector('defs');
            drawingLayer.innerHTML = '';
            if (defs) drawingLayer.appendChild(defs);
        }

        // Eliminar cualquier grupo o máscara residual
        document.querySelectorAll('[id^="g-layer-"]').forEach(el => el.remove());
        document.querySelectorAll('[id^="mask-layer-"]').forEach(el => el.remove());

        // Resetear capas en memoria
        if (this.board && Array.isArray(this.board.layers)) {
            this.board.layers.forEach(layer => layer.elements = []);
        }

        // Restaurar capa inicial si hace falta
        this.board.layers = this.board.layers && this.board.layers.length ? this.board.layers : [{ id: 'layer-0', name: 'Capa 1', elements: [], visible: true, locked: false }];
        this.activeLayerId = this.board.layers[0].id;
        this.currentLayer = 0;
        this.createLayerDrawingSurface(0);

        // Notificación usando el método correcto
        this.showNotification('Lienzo limpiado');
    }

    addResizeHandles(element) {
        const handles = {
            'top-left': 'nw',
            'top-right': 'ne',
            'bottom-left': 'sw',
            'bottom-right': 'se'
        };

        for (const [pos, cursor] of Object.entries(handles)) {
            const handle = document.createElement('div');
            handle.className = `resize-handle ${pos}`;
            handle.dataset.cursor = `${cursor}-resize`;
            element.appendChild(handle);

            handle.addEventListener('mousedown', (e) => this.startResize(e, element, pos));
        }
    }

    startResize(e, element, handlePos) {
        e.preventDefault();
        e.stopPropagation();

        const rect = element.getBoundingClientRect();
        const canvas = document.getElementById('canvas');
        const canvasRect = canvas.getBoundingClientRect();

        const initialMouseX = e.clientX;
        const initialMouseY = e.clientY;
        const initialWidth = rect.width;
        const initialHeight = rect.height;
        const initialLeft = rect.left - canvasRect.left;
        const initialTop = rect.top - canvasRect.top;

        const doResize = (moveEvent) => {
            const dx = moveEvent.clientX - initialMouseX;
            const dy = moveEvent.clientY - initialMouseY;

            let newWidth = initialWidth;
            let newHeight = initialHeight;
            let newLeft = initialLeft;
            let newTop = initialTop;

            if (handlePos.includes('right')) {
                newWidth = initialWidth + dx;
            } else if (handlePos.includes('left')) {
                newWidth = initialWidth - dx;
                newLeft = initialLeft + dx;
            }

            if (handlePos.includes('bottom')) {
                newHeight = initialHeight + dy;
            } else if (handlePos.includes('top')) {
                newHeight = initialHeight - dy;
                newTop = initialTop + dy;
            }
            
            if (newWidth > 20) {
                element.style.width = `${newWidth}px`;
                element.style.left = `${newLeft}px`;
            }
            if (newHeight > 20) {
                element.style.height = `${newHeight}px`;
                element.style.top = `${newTop}px`;
            }

            // Actualizar contenido si es necesario (ej. imagen, texto)
            const img = element.querySelector('img');
            if (img) {
                img.style.width = '100%';
                img.style.height = '100%';
            }
            const textarea = element.querySelector('textarea');
            if (textarea) {
                textarea.style.width = '100%';
                textarea.style.height = '100%';
            }
        };

        const stopResize = () => {
            document.removeEventListener('mousemove', doResize);
            document.removeEventListener('mouseup', stopResize);
            document.body.style.cursor = 'default';

            const elementId = element.id.replace('element-', '');
            this.updateElementSize(elementId, element.style.width, element.style.height);
        };

        document.addEventListener('mousemove', doResize);
        document.addEventListener('mouseup', stopResize);
        document.body.style.cursor = e.target.dataset.cursor;
    }

    updateElementPosition(element) {
        const elementId = element.id.replace('element-', '');
        const elementData = this.findElementById(elementId);
        if (elementData) {
            elementData.x = parseInt(element.style.left);
            elementData.y = parseInt(element.style.top);
        }
    }

    updateTextElement(elementDiv, data) {
        const textArea = elementDiv.querySelector('textarea');
        if (textArea) {
            textArea.style.fontFamily = data.styles.fontFamily || 'Arial';
            textArea.style.fontSize = data.styles.fontSize || '16px';
            textArea.style.color = data.styles.color || '#000000';
            textArea.style.fontWeight = data.styles.fontWeight || 'normal';
            textArea.style.fontStyle = data.styles.fontStyle || 'normal';
            textArea.style.textDecoration = data.styles.textDecoration || 'none';
            textArea.style.textAlign = data.styles.textAlign || 'left';
        }
    }

    handleTextInput(e, elementId) {
        const textarea = e.target;
        const element = this.findElementById(elementId);
        if (element) element.text = textarea.value;
    }

    deleteElement(elementId) {
        this.removeElementById(elementId, true);
    }

    removeElementById(elementId, withConfirmation = true) {
        const element = this.findElementById(elementId);
        if (!element) return;
        
        const performDelete = () => {
            const action = {
                app: this,
                element: JSON.parse(JSON.stringify(element)), // Deep copy
                execute: function() {
                    this.app.internal_removeElement(this.element.id);
                },
                undo: function() {
                    if (this.element.type === 'drawing') {
                        this.app.internal_addDrawingElement(this.element);
                    } else {
                        this.app.internal_addElement(this.element);
                    }
                }
            };
            this.history.execute(action);
            action.execute();
            if (withConfirmation) {
                this.showNotification('Elemento eliminado');
            }
        };

        if (withConfirmation) {
            if (confirm('¿Estás seguro de que quieres eliminar este elemento?')) {
                performDelete();
            }
        } else {
            performDelete();
        }
    }

    internal_removeElement(elementId) {
    // Remover de todas las capas
    this.board.layers.forEach(layer => {
        layer.elements = layer.elements.filter(el => el.id !== elementId);
    });
    
    // Remover del DOM
    const elementDiv = document.getElementById(`element-${elementId}`);
    if (elementDiv) elementDiv.remove();
    
    // Remover del SVG si es un dibujo
    const drawingLayer = document.getElementById('drawing-layer');
    if (drawingLayer) {
        const path = drawingLayer.querySelector(`[data-id="${elementId}"]`);
        if (path) path.remove();
    }
    
    if (this.selectedElement && this.selectedElement.id === `element-${elementId}`) {
        this.selectedElement = null;
    }
}

    hideToolbar() {
        const toolbar = document.getElementById('toolbar');
        if (toolbar) toolbar.classList.remove('open');
    }

    redrawAllElements() {
        this.clearCanvas();
        this.board.layers.forEach((layer, index) => {
            this.createLayerDrawingSurface(index); // Asegurar que todas las superficies existan
            if (layer.visible) {
                layer.elements.forEach(element => {
                    this.renderElement(element);
                });
            }
        });
        this.updateElementsVisibility(); // Sincronizar visibilidad final
    }

    // MÉTODO FALTANTE PARA ZOOM/PAN
    handleWheel(e) {
        e.preventDefault();
        const zoomIntensity = 0.1;
        const wheel = e.deltaY < 0 ? 1 : -1;
        const zoom = Math.exp(wheel * zoomIntensity);
        
        this.board.zoom *= zoom;
        this.board.zoom = Math.max(0.1, Math.min(5, this.board.zoom)); // Limitar zoom entre 0.1x y 5x
        
        this.updateCanvasTransform();
    }

    updateCanvasTransform() {
        const canvas = document.getElementById('canvas');
        if (canvas) {
            const canvasContent = canvas.querySelector('.canvas-content');
            if (canvasContent) {
                canvasContent.style.transform = `translate(${this.board.pan.x}px, ${this.board.pan.y}px) scale(${this.board.zoom})`;
            }
        }
    }

    throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    cleanup() {
        if (this.notificationTimeout) {
            clearTimeout(this.notificationTimeout);
            this.notificationTimeout = null;
        }
    }

    // ===== TUTORIAL =====
    openTutorial() {
        const tutorialModal = document.getElementById('tutorial-modal');
        if (tutorialModal) {
            tutorialModal.classList.add('active');
            this.currentSlide = 0;
            this.updateTutorialSlide();
        }
    }

    closeTutorial() {
        const tutorialModal = document.getElementById('tutorial-modal');
        if (tutorialModal) {
            tutorialModal.classList.remove('active');
        }
    }

    prevSlide() {
        if (this.currentSlide > 0) {
            this.currentSlide--;
            this.updateTutorialSlide();
        }
    }

    nextSlide() {
        const slides = document.querySelectorAll('.tutorial-slide');
        if (this.currentSlide < slides.length - 1) {
            this.currentSlide++;
            this.updateTutorialSlide();
        }
    }

    updateTutorialSlide() {
        const slides = document.querySelectorAll('.tutorial-slide');
        const indicators = document.querySelectorAll('.indicator');
        
        slides.forEach((slide, index) => {
            slide.classList.toggle('active', index === this.currentSlide);
        });
        
        indicators.forEach((indicator, index) => {
            indicator.classList.toggle('active', index === this.currentSlide);
        });
    }

    updateTextToolbar(element) {
        const styles = element ? element.styles : {
            fontSize: '16px',
            fontFamily: 'Arial',
            color: '#000000',
            fontWeight: 'normal',
            fontStyle: 'normal',
            textDecoration: 'none',
            textAlign: 'left'
        };

        const size = parseInt(styles.fontSize, 10);
        const sizeSlider = document.getElementById('text-size');
        const sizeValue = document.getElementById('size-value');
        if (sizeSlider) sizeSlider.value = size;
        if (sizeValue) sizeValue.textContent = `${size}px`;

        const colorPicker = document.getElementById('text-color');
        if (colorPicker) colorPicker.value = styles.color;
        
        const fontSelect = document.getElementById('text-font');
        if (fontSelect) fontSelect.value = styles.fontFamily;

        const boldBtn = document.querySelector('.text-style-btn[data-style="bold"]');
        if (boldBtn) boldBtn.classList.toggle('active', styles.fontWeight === 'bold');

        const italicBtn = document.querySelector('.text-style-btn[data-style="italic"]');
        if (italicBtn) italicBtn.classList.toggle('active', styles.fontStyle === 'italic');

        const underlineBtn = document.querySelector('.text-style-btn[data-style="underline"]');
        if (underlineBtn) underlineBtn.classList.toggle('active', styles.textDecoration === 'underline');

        document.querySelectorAll('.text-align-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.align === styles.textAlign);
        });
    }

    updateElementSize(elementId, width, height) {
        const elementData = this.findElementById(elementId);
        if (elementData) {
            elementData.width = parseInt(width);
            elementData.height = parseInt(height);
            const elementDiv = document.getElementById(`element-${elementId}`);
            if (elementDiv) {
                elementData.x = parseInt(elementDiv.style.left);
                elementData.y = parseInt(elementDiv.style.top);
            }
        }
    }

    makeDraggable(element, container) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        element.onmousedown = dragMouseDown;

        function dragMouseDown(e) {
            e.preventDefault();
            e.stopPropagation();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }

        function elementDrag(e) {
            e.preventDefault();
            e.stopPropagation();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            
            let newTop = element.offsetTop - pos2;
            let newLeft = element.offsetLeft - pos1;

            const containerRect = container.getBoundingClientRect();
            const elementRect = element.getBoundingClientRect();

            if (newLeft < 0) newLeft = 0;
            if (newTop < 0) newTop = 0;
            if (newLeft + elementRect.width > containerRect.width) newLeft = containerRect.width - elementRect.width;
            if (newTop + elementRect.height > containerRect.height) newTop = containerRect.height - elementRect.height;
            
            element.style.top = newTop + "px";
            element.style.left = newLeft + "px";
        }

        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
        }
    }

    makeResizable(element, container) {
        const handles = element.querySelectorAll('.crop-resize-handle');
        let initialMouseX, initialMouseY, initialWidth, initialHeight, initialLeft, initialTop;
        let currentHandle;

        handles.forEach(handle => {
            handle.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                currentHandle = handle;
                initialMouseX = e.clientX;
                initialMouseY = e.clientY;
                const rect = element.getBoundingClientRect();
                const containerRect = container.getBoundingClientRect();
                initialWidth = rect.width;
                initialHeight = rect.height;
                initialLeft = element.offsetLeft;
                initialTop = element.offsetTop;
                document.addEventListener('mousemove', doResize);
                document.addEventListener('mouseup', stopResize);
            });
        });

        const doResize = (e) => {
            e.preventDefault();
            e.stopPropagation();

            const dx = e.clientX - initialMouseX;
            const dy = e.clientY - initialMouseY;

            let newWidth = initialWidth;
            let newHeight = initialHeight;
            let newLeft = initialLeft;
            let newTop = initialTop;

            if (currentHandle.classList.contains('se')) {
                newWidth = initialWidth + dx;
                newHeight = initialHeight + dy;
            } else if (currentHandle.classList.contains('sw')) {
                newWidth = initialWidth - dx;
                newLeft = initialLeft + dx;
                newHeight = initialHeight + dy;
            } else if (currentHandle.classList.contains('ne')) {
                newWidth = initialWidth + dx;
                newHeight = initialHeight - dy;
                newTop = initialTop + dy;
            } else if (currentHandle.classList.contains('nw')) {
                newWidth = initialWidth - dx;
                newLeft = initialLeft + dx;
                newHeight = initialHeight - dy;
                newTop = initialTop + dy;
            }

            if (newWidth > 20) {
                element.style.width = newWidth + 'px';
                element.style.left = newLeft + 'px';
            }
            if (newHeight > 20) {
                element.style.height = newHeight + 'px';
                element.style.top = newTop + 'px';
            }
        };

        const stopResize = () => {
            document.removeEventListener('mousemove', doResize);
            document.removeEventListener('mouseup', stopResize);
        };
    }

    loadCanvasState() {
        const savedState = localStorage.getItem('canvasState');
        if (savedState) {
            this.board = JSON.parse(savedState);
            this.renderLayersPanel();
            this.loadCanvasElements(this.board.layers.flatMap(layer => layer.elements));
        }
    }

    updateLayerInteractivity() {
        const activeLayerIndex = this.currentLayer;
        const allElements = document.querySelectorAll('.canvas-element');

        allElements.forEach(elementDiv => {
            const elementId = elementDiv.id.replace('element-', '');
            const elementData = this.findElementById(elementId);

            if (elementData && elementData.layer !== activeLayerIndex) {
                elementDiv.classList.add('locked-by-layer');
            } else {
                elementDiv.classList.remove('locked-by-layer');
            }
        });
    }

    setLayerVisibility(layerId, isVisible) {
        const layer = this.board.layers.find(l => l.id === layerId);
        if (layer) {
            layer.visible = isVisible;
            this.updateElementsVisibility();
            this.renderLayersPanel();
        }
    }

    updateElementsVisibility() {
        this.board.layers.forEach((layer, index) => {
            const isVisible = layer.visible;
            
            // Actualizar elementos DIV
            layer.elements.forEach(elementData => {
                if (elementData.type !== 'drawing') {
                    const elementDiv = document.getElementById(`element-${elementData.id}`);
                    if (elementDiv) {
                        elementDiv.style.display = isVisible ? '' : 'none';
                    }
                }
            });

            // Actualizar capa de dibujo SVG
            const drawingGroup = document.getElementById(`g-layer-${index}`);
            if (drawingGroup) {
                drawingGroup.style.display = isVisible ? '' : 'none';
            }
        });
    }

    setLayerLock(layerId, isLocked) {
        const layer = this.board.layers.find(l => l.id === layerId);
        if (layer) {
            layer.locked = isLocked;
            this.renderLayersPanel();
        }
    }
}

// ===== CLASES DE HERRAMIENTAS DE DIBUJO MODULARES =====

class BaseDrawingTool {
    constructor(drawingTool) {
        this.drawingTool = drawingTool;
        this.board = drawingTool.board;
        this.config = drawingTool.config;
        this.isDrawing = false;
        this.startPoint = null;
    }

    onMouseDown(e) {
        this.isDrawing = true;
        this.startPoint = this.drawingTool.getCanvasCoordinates(e);
    }

    onMouseMove(e) {
        if (!this.isDrawing) return;
    }

    onMouseUp(e) {
        if (!this.isDrawing) return;
        this.isDrawing = false;
    }
}

class PenTool extends BaseDrawingTool {
    constructor(drawingTool) {
        super(drawingTool);
        this.path = [];
    }

    onMouseDown(e) {
        super.onMouseDown(e);
        this.path = [this.startPoint];
        this.drawingTool.createTempSvg();
    }

    onMouseMove(e) {
        if (!this.isDrawing) return;
        const currentPoint = this.drawingTool.getCanvasCoordinates(e);
        this.path.push(currentPoint);
        this.drawingTool.drawCurrentPath(this.path);
    }

    onMouseUp(e) {
        if (!this.isDrawing) {
            return;
        }
        super.onMouseUp(e);
        if (this.path.length > 1) {
            this.drawingTool.finalizePath(this.path);
        }
        this.drawingTool.cleanupAfterDrawing();
        this.path = [];
    }
}


class EraserTool extends BaseDrawingTool {
    constructor(drawingTool) {
        super(drawingTool);
        this.path = [];
    }

    onMouseDown(e) {
        super.onMouseDown(e);
        this.path = [this.startPoint];
        this.drawingTool.createTempSvg();
    }

    onMouseMove(e) {
        if (!this.isDrawing) return;
        const currentPoint = this.drawingTool.getCanvasCoordinates(e);
        this.path.push(currentPoint);
        this.drawingTool.drawCurrentPath(this.path);
    }

    onMouseUp(e) {
        if (!this.isDrawing) {
            return;
        }
        super.onMouseUp(e);
        if (this.path.length > 1) {
            this.drawingTool.finalizePath(this.path);
        }
        this.drawingTool.cleanupAfterDrawing();
        this.path = [];
    }
}


class ShapeTool extends BaseDrawingTool {
    constructor(drawingTool) {
        super(drawingTool);
        this.lastPoint = null;
    }

    onMouseDown(e) {
        super.onMouseDown(e);
        this.lastPoint = this.startPoint;
        this.drawingTool.createTempSvg();
    }

    onMouseMove(e) {
        if (!this.isDrawing) return;
        this.lastPoint = this.drawingTool.getCanvasCoordinates(e);
        const pathData = this.createShapePath(this.startPoint, this.lastPoint);
        this.drawingTool.drawShapePreview(pathData);
    }

    onMouseUp(e) {
        if (!this.isDrawing) return;
        super.onMouseUp(e);
        const pathData = this.createShapePath(this.startPoint, this.lastPoint);
        if (pathData) {
            this.drawingTool.finalizeShape(pathData, this.startPoint, this.lastPoint);
        }
        this.drawingTool.cleanupAfterDrawing();
    }

    createShapePath(start, end) {
        throw new Error("createShapePath must be implemented by subclasses");
    }
}

class LineTool extends ShapeTool {
    createShapePath(start, end) {
        return `M${start.x},${start.y} L${end.x},${end.y}`;
    }
}

class RectangleTool extends ShapeTool {
    createShapePath(start, end) {
        const rectX = Math.min(start.x, end.x);
        const rectY = Math.min(start.y, end.y);
        const width = Math.abs(start.x - end.x);
        const height = Math.abs(start.y - end.y);
        return `M${rectX},${rectY} h${width} v${height} h${-width} Z`;
    }
}

class CircleTool extends ShapeTool {
    createShapePath(start, end) {
        const radiusX = Math.abs(end.x - start.x) / 2;
        const radiusY = Math.abs(end.y - start.y) / 2;
        if (radiusX === 0 || radiusY === 0) return '';
        const centerX = start.x + (end.x > start.x ? 1 : -1) * radiusX;
        const centerY = start.y + (end.y > start.y ? 1 : -1) * radiusY;
        return `M${centerX - radiusX},${centerY} a${radiusX},${radiusY} 0 1,0 ${2 * radiusX},0 a${radiusX},${radiusY} 0 1,0 -${2 * radiusX},0 Z`;
    }
}

// ===== CLASE DE HERRAMIENTA DE DIBUJO REFACTORIZADA =====
class DrawingTool {
    constructor(board) {
        this.board = board;
        this.activeToolInstance = null;
        this.activeToolName = 'pen';
        this.activeShapeName = null;
        this.tempSvg = null;
        
        this.config = {
            color: '#000000',
            width: 3,
            opacity: 100
        };

        this.tools = {
    'pen': new PenTool(this),
    'eraser': new EraserTool(this),
    'line': new LineTool(this),
    'rectangle': new RectangleTool(this),
    'circle': new CircleTool(this)
};
        this.activeToolInstance = this.tools['pen'];
    }
    
    setTool(toolName) {
        this.activeToolName = toolName;
        
        // Actualizar la clase activa en los botones
        const toolbar = document.querySelector('#toolbar');
        toolbar.querySelectorAll('.toolbar-btn[data-tool]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tool === toolName);
        });
        
        const colorPicker = document.getElementById('draw-color');
        if (colorPicker) {
            colorPicker.disabled = toolName === 'eraser';
        }
        
        this.updateCursor();
        this.updateToolInstance();
    }
    
    setShape(shapeName) {
        this.activeShapeName = shapeName;
        this.activeToolName = null;
        this.activeToolInstance = this.tools[shapeName];
        if (this.activeToolInstance) {
            this.board.showNotification(`Forma: ${this.getShapeName(shapeName)}`);
            this.updateCursor();
        }
    }
    
    getToolName(tool) {
        return { 'pen': 'Lápiz', 'eraser': 'Borrador' }[tool] || tool;
    }
    
    getShapeName(shape) {
        return { 'line': 'Línea', 'rectangle': 'Rectángulo', 'circle': 'Círculo' }[shape] || shape;
    }
    
    updateCursor() {
    const canvas = document.getElementById('canvas');
    if (this.activeToolName === 'eraser') {
        // Crear un cursor circular para el borrador
        const size = Math.max(10, this.config.width * 2);
        canvas.style.cursor = `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${size/2}" cy="${size/2}" r="${size/2 - 1}" fill="none" stroke="red" stroke-width="1"/></svg>') ${size/2} ${size/2}, auto`;
    } else {
        canvas.style.cursor = 'crosshair';
    }
}
    
    setupEvents() {
    const widthSlider = document.getElementById('draw-width');
    const colorPicker = document.getElementById('draw-color');
    const opacitySlider = document.getElementById('draw-opacity');
    
    if (widthSlider) {
        widthSlider.addEventListener('input', (e) => {
            this.config.width = parseInt(e.target.value, 10);
            const widthValue = document.getElementById('width-value');
            if (widthValue) widthValue.textContent = `${e.target.value}px`;
            
            // Actualizar cursor del borrador si está activo
            if (this.activeToolName === 'eraser') {
                this.updateCursor();
            }
        });
    }
    
    if (opacitySlider) {
        opacitySlider.addEventListener('input', (e) => {
            this.config.opacity = parseInt(e.target.value, 10);
            const opacityValue = document.getElementById('opacity-value');
            if (opacityValue) opacityValue.textContent = `${e.target.value}%`;
        });
    }

    if (colorPicker) {
        colorPicker.addEventListener('change', (e) => {
            // No permitir cambiar color cuando el borrador está activo
            if (this.activeToolName !== 'eraser') {
                this.config.color = e.target.value;
            }
        });
    }
}
    
    get isDrawing() {
        return this.activeToolInstance ? this.activeToolInstance.isDrawing : false;
    }
    
    startDrawing(e) {
        if (this.activeToolInstance) this.activeToolInstance.onMouseDown(e);
    }

    updateDrawing(e) {
        if (this.activeToolInstance) this.activeToolInstance.onMouseMove(e);
    }
    
    finishDrawing() {
        if (this.activeToolInstance) this.activeToolInstance.onMouseUp();
    }
    
    createTempSvg() {
        // Ya no es necesario crear un SVG temporal. El dibujo se hará en la capa activa.
    }
    
    drawCurrentPath(path) {
        const layerIndex = this.board.currentLayer;
        const isEraser = this.activeToolName === 'eraser';
        const containerId = isEraser ? `eraser-paths-${layerIndex}` : `g-layer-${layerIndex}`;
        const container = document.getElementById(containerId);

        if (!container) return;

        // Eliminar el trazo temporal anterior
        const oldTempPath = container.querySelector('#temp-path');
        if (oldTempPath) {
            oldTempPath.remove();
        }

        if (path.length < 1) return;
        
        const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        pathEl.id = 'temp-path'; // ID para identificarlo y borrarlo
        const pathData = this.createPathData(path);
        
        pathEl.setAttribute('d', pathData);
        this.applyStyleToPath(pathEl);
        container.appendChild(pathEl);
    }
    
    drawShapePreview(pathData) {
        if (!this.tempSvg) return;
        this.tempSvg.innerHTML = '';
        if (!pathData) return;
        
        const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        pathEl.setAttribute('d', pathData);
        this.applyStyleToPath(pathEl);
        this.tempSvg.appendChild(pathEl);
    }
    
    applyStyleToPath(path) {
        const style = this.getDrawingStyle();
        Object.entries(style).forEach(([key, value]) => {
            const attr = key.replace(/([A-Z])/g, (g) => `-${g[0].toLowerCase()}`);
            path.setAttribute(attr, value);
        });
    }

    finalizePath(path) {
            if (path.length < 2) return;

            const isEraser = this.activeToolName === 'eraser';
            const style = this.getDrawingStyle();
            const pathData = this.createPathData(path);
            const bounds = this.calculatePathBounds(pathData);

            const element = {
                id: `draw-${Date.now()}`,
                type: isEraser ? 'eraser_path' : 'drawing', // Tipo diferente para borrador
                path: pathData,
                style: style,
                x: bounds.x,
                y: bounds.y,
                width: bounds.width,
                height: bounds.height,
                rotation: 0,
                layer: this.board.currentLayer
            };

            this.board.addDrawingElement(element);
}

    finalizeShape(pathData, start, end) {
        const style = this.getDrawingStyle();
        const bounds = this.calculateShapeBounds(start, end, this.activeShapeName);
        
        const element = {
            id: `draw-${Date.now()}`,
            type: 'drawing', path: pathData, style: style,
            x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height,
            rotation: 0, layer: this.board.currentLayer
        };
        
        this.board.addDrawingElement(element);
    }
    
    createPathData(points) {
        if (points.length === 0) return "";
        let path = "M" + points[0].x + "," + points[0].y;
        for (let i = 1; i < points.length; i++) {
            path += " L" + points[i].x + "," + points[i].y;
        }
        return path;
    }
    
   getDrawingStyle() {
    if (this.activeToolName === 'eraser') {
        return {
            stroke: '#000000', // El borrador SIEMPRE debe ser negro para la máscara
            strokeWidth: this.config.width,
            fill: 'none',
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            opacity: 1
        };
    }
    
    return {
        stroke: this.config.color,
        strokeWidth: this.config.width,
        fill: 'none',
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        opacity: this.config.opacity / 100
    };
}
    
    calculatePathBounds(pathData) {
        if (!pathData) return { x: 0, y: 0, width: 0, height: 0 };
        const points = (pathData.match(/[\d\.]+/g) || []).map(Number);
        if (points.length < 2) return { x: 0, y: 0, width: 0, height: 0 };

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (let i = 0; i < points.length; i += 2) {
            minX = Math.min(minX, points[i]);
            maxX = Math.max(maxX, points[i]);
            minY = Math.min(minY, points[i + 1]);
            maxY = Math.max(maxY, points[i + 1]);
        }
        const margin = this.config.width;
        return { x: minX - margin, y: minY - margin, width: maxX - minX + margin * 2, height: maxY - minY + margin * 2 };
    }
    
    calculateShapeBounds(start, end, shape) {
        const margin = this.config.width;
        const x = Math.min(start.x, end.x) - margin;
        const y = Math.min(start.y, end.y) - margin;
        const width = Math.abs(start.x - end.x) + margin * 2;
        const height = Math.abs(start.y - end.y) + margin * 2;
        return { x, y, width, height };
    }
    
    getCanvasCoordinates(e) {
        const canvas = document.getElementById('canvas');
        const rect = canvas.getBoundingClientRect();
        // Incorporar pan y zoom para coordenadas precisas
        const pan = this.board.board.pan;
        const zoom = this.board.board.zoom;
        const x = (e.clientX - rect.left - pan.x) / zoom;
        const y = (e.clientY - rect.top - pan.y) / zoom;
        return { x, y };
    }
    
    clear() {
        const activeLayer = this.board.getActiveLayer();
        if (activeLayer && activeLayer.elements) {
            // Vaciar la lista de elementos de la capa
            activeLayer.elements = [];
            
            // Limpiar el contenedor SVG directamente
            const layerIndex = this.board.currentLayer || 0;
            const container = document.getElementById(`g-layer-${layerIndex}`);
            if (container) {
                container.innerHTML = '';
            }
            
            // También limpiar las rutas del borrador de la máscara
            const eraserPaths = document.getElementById(`eraser-paths-${layerIndex}`);
            if (eraserPaths) {
                eraserPaths.innerHTML = '';
            }

            this.board.showNotification('Lienzo limpiado');
        }
    }
    
    cleanupAfterDrawing() {
        // Buscar y eliminar el trazo temporal de cualquier capa
        const tempPath = document.querySelector('#temp-path');
        if (tempPath) {
            tempPath.remove();
        }
    }

    // Eliminar solo los trazos de borrador de la capa activa
    clearEraserPaths() {
        const activeLayer = this.board.getActiveLayer();
        if (activeLayer) {
            // Eliminar elementos de tipo 'eraser_path' de la capa activa
            activeLayer.elements = activeLayer.elements.filter(el => el.type !== 'eraser_path');

            // Limpiar visualmente los trazos de borrador del SVG (grupo dentro de <defs>)
            const layerIndex = this.board.currentLayer || 0;
            const eraserGroup = document.getElementById(`eraser-paths-${layerIndex}`);
            if (eraserGroup) {
                eraserGroup.innerHTML = '';
            }
        }
    }

    updateToolInstance() {
        if (this.tools[this.activeToolName]) {
            this.activeToolInstance = this.tools[this.activeToolName];
        } else if (this.tools[this.activeShapeName]) {
            this.activeToolInstance = this.tools[this.activeShapeName];
        }
    }
}

// Inicializar la aplicación
const app = new PizarraApp();
window.app = app;