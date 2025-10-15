// Pizarra Digital - Aplicación Principal
class PizarraApp {
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
        
        // Usar requestAnimationFrame para inicialización no crítica
        requestAnimationFrame(() => this.init());
        
        // Limpiar recursos al cerrar la página
        window.addEventListener('beforeunload', () => this.cleanup());

        this.board = {
            layers: [{
                id: `layer-${Date.now()}`,
                name: 'Capa 1',
                elements: [],
                visible: true,
                locked: false
            }],
            backgroundColor: '#ffffff',
            width: 3840,
            height: 2160,
            zoom: 1,
            pan: { x: 0, y: 0 }
        };
        this.activeLayerId = this.board.layers[0].id;

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
    }
    
    async init() {
        this.setupEventListeners();
        
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
            const projects = await response.json();
            this.projects = projects;
            return projects;
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
        const projectName = document.getElementById('project-name').value || 'Proyecto sin nombre';
        
        try {
            const response = await fetch('api/create_project.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    nombre: projectName,
                    descripcion: ''
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                const newProject = {
                    id: data.projectId.toString(),
                    name: projectName,
                    elements: [],
                    created: new Date().toISOString(),
                    modified: new Date().toISOString()
                };
                
                this.projects.push(newProject);
                this.currentProject = newProject;
                this.updateProjectsList();
                this.clearCanvas();
                this.updateProjectName();
                this.showNotification('Proyecto creado exitosamente');
            } else {
                this.showNotification('Error al crear proyecto: ' + data.message);
            }
        } catch (error) {
            console.error('Error creating project:', error);
            this.showNotification('Error al crear proyecto');
        }
    }

    async loadProject(projectId) {
        try {
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
                    const duplicatedProject = {
                        id: data.newProjectId.toString(),
                        name: project.name + ' (Copia)',
                        elements: [...project.elements],
                        created: new Date().toISOString(),
                        modified: new Date().toISOString()
                    };
                    
                    this.projects.push(duplicatedProject);
                    this.updateProjectsList();
                    this.showNotification('Proyecto duplicado');
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
        if (this.currentProject && !this.isSaving) {
            this.isSaving = true;
            
            this.currentProject.elements = this.getAllCanvasElements();
            this.currentProject.modified = new Date().toISOString();
            this.currentProject.name = document.getElementById('project-name').value || 'Proyecto sin nombre';
            
            try {
                const response = await fetch('api/save_project.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        projectId: this.currentProject.id,
                        nombre: this.currentProject.name,
                        elementos: this.currentProject.elements
                    })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    this.showNotification('Proyecto guardado exitosamente');
                    
                    // Actualizar lista de proyectos
                    await this.loadProjects();
                    this.updateProjectsList();
                } else {
                    this.showNotification('Error al guardar: ' + data.message);
                }
            } catch (error) {
                console.error('Error saving project:', error);
                this.showNotification('Error al guardar el proyecto');
            } finally {
                this.isSaving = false;
            }
        }
    }

    getAllCanvasElements() {
        const elements = [];
        
        // Recorrer todas las capas y elementos
        this.board.layers.forEach(layer => {
            layer.elements.forEach(element => {
                // Asegurarse de que cada elemento tenga las propiedades necesarias para la BD
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
        if (this.currentProject) {
            document.getElementById('project-name').value = this.currentProject.name;
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
        document.getElementById('document-btn')?.addEventListener('click', () => document.getElementById('file-input-doc').click());
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
        
        sidebar.classList.toggle('open');
        overlay.classList.toggle('active');
    }

    closeSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
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
            <button onclick="app.setImageMode('deform')" class="toolbar-btn"><i class="fas fa-draw-polygon"></i> Deformar</button>
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
            <button onclick="app.createNewTextBox()" class="toolbar-btn"><i class="fas fa-plus-square"></i> Crear Cuadro de Texto</button>
            <span class="toolbar-divider"></span>
            <div class="tool-option">
                <button onclick="app.setTextStyle('bold')" class="toolbar-btn text-style-btn"><b>B</b></button>
                <button onclick="app.setTextStyle('italic')" class="toolbar-btn text-style-btn"><i>I</i></button>
                <button onclick="app.setTextStyle('underline')" class="toolbar-btn text-style-btn"><u>U</u></button>
            </div>
            <div class="tool-option">
                <button onclick="app.setTextAlign('left')" class="toolbar-btn text-align-btn"><i class="fas fa-align-left"></i></button>
                <button onclick="app.setTextAlign('center')" class="toolbar-btn text-align-btn"><i class="fas fa-align-center"></i></button>
                <button onclick="app.setTextAlign('right')" class="toolbar-btn text-align-btn"><i class="fas fa-align-right"></i></button>
            </div>
            <span class="toolbar-divider"></span>
            <div class="tool-option">
                <label>Fuente:</label>
                <select id="text-font" class="toolbar-select">
                    <option value="Arial">Arial</option>
                    <option value="Verdana">Verdana</option>
                    <option value="Times New Roman">Times New Roman</option>
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
            <button onclick="app.drawingTool.setTool('brush')" class="toolbar-btn" data-tool="brush"><i class="fas fa-paint-brush"></i> Pincel</button>
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
                <label>Color:</label>
                <input type="color" id="draw-color" value="#000000" class="toolbar-color">
            </div>
            <span class="toolbar-divider"></span>
            <button onclick="app.drawingTool.clear()" class="toolbar-btn danger"><i class="fas fa-trash"></i> Limpiar Todo</button>
        `;
    }

    getDocumentToolPanel() {
        return `
            <button onclick="app.triggerDocumentUpload()" class="toolbar-btn"><i class="fas fa-file-upload"></i> Subir Documento</button>
            <span class="toolbar-divider"></span>
            <div class="tool-option">
                <label>Escala:</label>
                <input type="range" id="doc-scale" min="25" max="300" value="100" class="toolbar-range">
                <span id="scale-value" class="toolbar-value">100%</span>
            </div>
        `;
    }

    setupToolEvents(tool) {
        switch(tool) {
            case 'image':
                this.setupImageToolEvents();
                break;
            case 'text':
                this.setupTextToolEvents();
                break;
            case 'draw':
                this.setupDrawToolEvents();
                break;
            case 'document':
                this.setupDocumentToolEvents();
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
        const scaleSlider = document.getElementById('doc-scale');
        
        if (scaleSlider) {
            scaleSlider.addEventListener('input', (e) => {
                document.getElementById('scale-value').textContent = e.target.value + '%';
                this.applyDocumentTransform('scale', e.target.value);
            });
        }
    }

    // ===== MÉTODOS DE HERRAMIENTAS =====
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
                    this.selectedElement.style.opacity = element.opacity / 100;
                }
            }
        }
    }

    applyTextTransform(property, value) {
        if (this.selectedElement) {
            const elementId = this.selectedElement.id;
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
            }
        }
    }

    applyDocumentTransform(property, value) {
        if (this.selectedElement) {
            const element = this.findElementById(this.selectedElement.id);
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
        
        const activeLayer = this.getActiveLayer();
        if (activeLayer) {
            activeLayer.elements.push(element);
        }
        this.renderElement(element);
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
        
        const activeLayer = this.getActiveLayer();
        if (activeLayer) {
            activeLayer.elements.push(element);
        }
        this.renderElement(element);
        
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
        
        this.showNotification('Cuadro de texto creado');
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
        const activeLayer = this.getActiveLayer();
        if (activeLayer) {
            activeLayer.elements.push(elementData);
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
        
        const activeLayer = this.getActiveLayer();
        if (activeLayer) {
            activeLayer.elements.push(element);
        }
        this.renderElement(element);
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
        const drawingLayer = document.getElementById('drawing-layer');
        if (!drawingLayer) return;

        // Limpiar dibujo existente con el mismo ID
        const existingPath = drawingLayer.querySelector(`[data-id="${element.id}"]`);
        if (existingPath) {
            existingPath.remove();
        }

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        
        if (typeof element.path === 'string' && !element.path.includes('NaN')) {
            path.setAttribute('d', element.path);
            path.setAttribute('data-id', element.id);
            this.applyDrawingStyle(path, element.style);
            drawingLayer.appendChild(path);
        }
    }

    createElementDiv(element) {
        // Para elementos de dibujo, no crear div, solo renderizar en SVG
        if (element.type === 'drawing') {
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
        elementDiv.style.opacity = (element.opacity || 100) / 100;
        elementDiv.style.zIndex = element.layer || 0;

        if (element.type !== 'text') {
            elementDiv.addEventListener('mousedown', (e) => this.selectElement(e, elementDiv));
            elementDiv.addEventListener('mousedown', (e) => this.startDrag(e, elementDiv));
        } else if (element.type === 'text') {
            elementDiv.addEventListener('mousedown', (e) => this.selectElement(e, elementDiv));
        }

        switch(element.type) {
            case 'image':
                elementDiv.innerHTML = `
                    <img src="${element.src}" style="width: 100%; height: 100%; object-fit: contain;">
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
        
        return elementDiv;
    }

    applyDrawingStyle(path, style) {
        if (!style) return;
        path.setAttribute('stroke', style.stroke || '#000000');
        path.setAttribute('stroke-width', style.strokeWidth || 1);
        path.setAttribute('fill', style.fill || 'none');
        path.setAttribute('stroke-linecap', style.lineCap || 'round');
        path.setAttribute('stroke-linejoin', style.lineJoin || 'round');
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

        const elementDiv = e.target.closest('.canvas-element');
        if (elementDiv) {
            this.selectElement(e, elementDiv);
            this.dragStart.x = e.clientX;
            this.dragStart.y = e.clientY;
            this.isDragging = true;
        }
    }

    handleMouseMove(e) {
        if (this.selectedTool === 'draw' && this.drawingTool.isDrawing) {
            e.preventDefault();
            this.drawingTool.updateDrawing(e);
        }
    }

    handleMouseUp(e) {
        if (this.selectedTool === 'draw' && this.drawingTool.isDrawing) {
            e.preventDefault();
            this.drawingTool.finishDrawing();
        }
    }

    startDrag(e, element) {
        if (this.selectedTool === 'draw') return;
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
        }
    }

    deselectElement() {
        if (this.selectedElement) {
            this.selectedElement.classList.remove('selected');
            this.selectedElement = null;
            this.hideToolbar();
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

    triggerImageUpload() {
        document.getElementById('file-input-img').click();
    }

    triggerDocumentUpload() {
        document.getElementById('file-input-doc').click();
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
        panel.classList.toggle('active', forceState);
        if (panel.classList.contains('active')) {
            this.renderLayersPanel();
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

        const name = document.createElement('span');
        name.className = 'layer-name';
        name.textContent = layer.name;
        name.contentEditable = true;
        name.addEventListener('blur', (e) => this.renameLayer(layer.id, e.target.textContent));
        
        header.appendChild(name);
        header.appendChild(this.createLayerActionsUI(layer));
        group.appendChild(header);
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
    
    addLayer() {
        const newLayer = {
            id: `layer-${Date.now()}`,
            name: `Capa ${this.board.layers.length + 1}`,
            elements: [],
            visible: true,
            locked: false
        };
        this.board.layers.push(newLayer);
        this.setActiveLayer(newLayer.id);
    }

    deleteLayer(layerId) {
        if (this.board.layers.length <= 1) return;
        if (confirm('¿Eliminar capa y su contenido?')) {
            this.board.layers = this.board.layers.filter(l => l.id !== layerId);
            if (this.activeLayerId === layerId) {
                this.setActiveLayer(this.board.layers[this.board.layers.length - 1].id);
            }
            this.redrawAllElements();
            this.renderLayersPanel();
        }
    }

    setActiveLayer(layerId) {
        this.activeLayerId = layerId;
        this.currentLayer = this.board.layers.findIndex(l => l.id === layerId);
        this.deselectElement();
        this.renderLayersPanel();
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
            const canvas = document.getElementById('canvas');
            const canvasContent = canvas.querySelector('.canvas-content');
            const drawingLayer = document.getElementById('drawing-layer');
            
            // Limpiar el SVG de dibujos
            if (drawingLayer) {
                drawingLayer.innerHTML = '';
            }
            
            elements.forEach(element => {
                if (element.type === 'drawing') {
                    this.renderDrawingElement(element);
                } else {
                    const elementDiv = this.createElementDiv(element);
                    if (elementDiv) canvasContent.appendChild(elementDiv);
                }
            });
        }
    }

    clearCanvas() {
        const canvas = document.getElementById('canvas');
        const canvasContent = canvas.querySelector('.canvas-content');
        const drawingLayer = document.getElementById('drawing-layer');
        
        canvasContent.innerHTML = '<span class="canvas-title">PIZARRA</span>';
        if (drawingLayer) drawingLayer.innerHTML = '';
        
        this.board.layers.forEach(layer => {
            layer.elements = [];
        });
    }

    addResizeHandles(element) {
        const handles = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
        handles.forEach(pos => {
            const handle = document.createElement('div');
            handle.className = `resize-handle ${pos}`;
            element.appendChild(handle);
        });
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
        if (confirm('¿Estás seguro de que quieres eliminar este elemento?')) {
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
            
            this.selectedElement = null;
            this.showNotification('Elemento eliminado');
        }
    }

    hideToolbar() {
        const toolbar = document.getElementById('toolbar');
        if (toolbar) toolbar.classList.remove('open');
    }

    redrawAllElements() {
        const canvasContent = document.querySelector('.canvas-content');
        const drawingLayer = document.getElementById('drawing-layer');
        
        if (drawingLayer) drawingLayer.innerHTML = '';
        canvasContent.querySelectorAll('.canvas-element').forEach(el => el.remove());

        this.board.layers.forEach(layer => {
            if (layer.visible) {
                layer.elements.forEach(element => {
                    if (element.type === 'drawing') {
                        this.renderDrawingElement(element);
                    } else {
                        this.renderElement(element);
                    }
                });
            }
        });
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
        document.getElementById('tutorial-modal').classList.add('active');
        this.currentSlide = 0;
        this.updateTutorialSlide();
    }

    closeTutorial() {
        document.getElementById('tutorial-modal').classList.remove('active');
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
}

// ===== CLASE DE HERRAMIENTA DE DIBUJO CORREGIDA =====
class DrawingTool {
    constructor(board) {
        this.board = board;
        this.isDrawing = false;
        this.currentTool = 'pen';
        this.currentShape = null;
        this.currentPath = [];
        this.startPoint = null;
        this.lastPoint = null;
        this.tempSvg = null;
        
        this.config = {
            color: '#000000',
            width: 3,
            opacity: 100
        };
    }
    
    setTool(tool) {
        document.querySelectorAll('[data-tool]').forEach(btn => btn.classList.remove('active'));
        const btn = document.querySelector(`[data-tool="${tool}"]`);
        if (btn) btn.classList.add('active');
        
        this.currentTool = tool;
        this.currentShape = null;
        this.board.showNotification(`Herramienta: ${this.getToolName(tool)}`);
        this.updateCursor();
    }
    
    setShape(shape) {
        document.querySelectorAll('[data-shape]').forEach(btn => btn.classList.remove('active'));
        const btn = document.querySelector(`[data-shape="${shape}"]`);
        if (btn) btn.classList.add('active');
        
        this.currentShape = shape;
        this.board.showNotification(`Forma: ${this.getShapeName(shape)}`);
        this.updateCursor();
    }
    
    getToolName(tool) {
        const names = {
            'pen': 'Lápiz',
            'brush': 'Pincel',
            'eraser': 'Borrador'
        };
        return names[tool] || tool;
    }
    
    getShapeName(shape) {
        const names = {
            'line': 'Línea',
            'rectangle': 'Rectángulo',
            'circle': 'Círculo'
        };
        return names[shape] || shape;
    }
    
    updateCursor() {
        const canvas = document.getElementById('canvas');
        if (this.currentTool === 'eraser') {
            canvas.style.cursor = 'grab';
        } else {
            canvas.style.cursor = 'crosshair';
        }
    }
    
    setupEvents() {
        const widthSlider = document.getElementById('draw-width');
        const colorPicker = document.getElementById('draw-color');
        
        if (widthSlider) {
            widthSlider.addEventListener('input', (e) => {
                this.config.width = parseInt(e.target.value);
                document.getElementById('width-value').textContent = e.target.value + 'px';
            });
        }
        
        if (colorPicker) {
            colorPicker.addEventListener('change', (e) => {
                this.config.color = e.target.value;
            });
        }
    }
    
    startDrawing(e) {
        this.isDrawing = true;
        const { x, y } = this.getCanvasCoordinates(e);
        this.startPoint = { x, y };
        this.lastPoint = { x, y };

        if (this.currentTool === 'eraser') {
            this.eraseAtPoint(x, y);
        } else {
            this.currentPath = [this.startPoint];
            this.createTempSvg();
        }
    }

    updateDrawing(e) {
        if (!this.isDrawing) return;
        const { x, y } = this.getCanvasCoordinates(e);

        if (this.currentTool === 'eraser') {
            this.eraseAtPoint(x, y);
            return;
        }

        if (['pen', 'brush'].includes(this.currentTool)) {
            this.currentPath.push({ x, y });
            this.drawCurrentPath();
        } else if (this.currentShape) {
            this.lastPoint = { x, y };
            this.drawShapePreview();
        }
    }
    
    finishDrawing() {
        if (!this.isDrawing) return;
        this.isDrawing = false;

        // Finalizar dibujo libre
        if (this.currentPath && this.currentPath.length > 1) {
            const style = this.getDrawingStyle();
            const pathData = this.createPathData(this.currentPath);
            const bounds = this.calculatePathBounds(pathData);
            
            const element = {
                id: `draw-${Date.now()}`,
                type: 'drawing',
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
        
        // Finalizar formas
        if (this.currentShape && this.startPoint && this.lastPoint) {
            const style = this.getDrawingStyle();
            const pathData = this.createShapePath(this.startPoint, this.lastPoint);
            
            if (pathData) {
                const bounds = this.calculateShapeBounds(this.startPoint, this.lastPoint);
                
                const element = {
                    id: `draw-${Date.now()}`,
                    type: 'drawing',
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
        }
        
        this.cleanupAfterDrawing();
    }
    
    createTempSvg() {
        const canvas = document.getElementById('canvas');
        const canvasContent = canvas.querySelector('.canvas-content');
        this.tempSvg = document.getElementById('temp-drawing-svg');
        
        if (!this.tempSvg) {
            this.tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            this.tempSvg.id = 'temp-drawing-svg';
            this.tempSvg.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
                z-index: 1000;
            `;
            canvasContent.appendChild(this.tempSvg);
        }
        
        this.tempSvg.innerHTML = '';
    }
    
    drawCurrentPath() {
        if (!this.tempSvg || this.currentPath.length < 2) return;
        
        this.tempSvg.innerHTML = '';
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const pathData = this.createPathData(this.currentPath);
        
        path.setAttribute('d', pathData);
        this.applyStyleToPath(path);
        this.tempSvg.appendChild(path);
    }
    
    drawShapePreview() {
        if (!this.tempSvg || !this.startPoint || !this.lastPoint) return;
        
        this.tempSvg.innerHTML = '';
        const pathData = this.createShapePath(this.startPoint, this.lastPoint);
        if (!pathData) return;
        
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', pathData);
        this.applyStyleToPath(path);
        this.tempSvg.appendChild(path);
    }
    
    applyStyleToPath(path) {
        const style = this.getDrawingStyle();
        
        path.setAttribute('stroke', style.stroke);
        path.setAttribute('stroke-width', style.strokeWidth);
        path.setAttribute('fill', style.fill);
        path.setAttribute('stroke-linecap', style.lineCap);
        path.setAttribute('stroke-linejoin', style.lineJoin);
        path.setAttribute('opacity', style.opacity);
    }
    
    createPathData(points) {
        if (points.length < 2) return '';
        
        let pathData = `M${points[0].x},${points[0].y}`;
        for (let i = 1; i < points.length; i++) {
            pathData += ` L${points[i].x},${points[i].y}`;
        }
        
        return pathData;
    }
    
    createShapePath(start, end) {
        switch(this.currentShape) {
            case 'line':
                return `M${start.x},${start.y} L${end.x},${end.y}`;
            case 'rectangle':
                const rectX = Math.min(start.x, end.x);
                const rectY = Math.min(start.y, end.y);
                const width = Math.abs(start.x - end.x);
                const height = Math.abs(start.y - end.y);
                return `M${rectX},${rectY} h${width} v${height} h${-width} Z`;
            case 'circle':
                const radiusX = Math.abs(end.x - start.x) / 2;
                const radiusY = Math.abs(end.y - start.y) / 2;
                const centerX = start.x + (end.x > start.x ? 1 : -1) * radiusX;
                const centerY = start.y + (end.y > start.y ? 1 : -1) * radiusY;
                return `M${centerX - radiusX},${centerY} a${radiusX},${radiusY} 0 1,0 ${radiusX * 2},0 a${radiusX},${radiusY} 0 1,0 -${radiusX * 2},0 Z`;
            default:
                return '';
        }
    }
    
    getDrawingStyle() {
        return {
            stroke: this.config.color,
            strokeWidth: this.config.width,
            fill: 'none',
            lineCap: 'round',
            lineJoin: 'round',
            opacity: this.config.opacity / 100
        };
    }
    
    eraseAtPoint(x, y) {
        const eraserPath = `M ${x - 0.1},${y - 0.1} L ${x},${y}`;
        const style = {
            stroke: '#FFFFFF',
            strokeWidth: this.config.width * 2,
            fill: 'none',
            lineCap: 'round',
            lineJoin: 'round',
            opacity: 1
        };
        
        const bounds = this.calculatePathBounds(eraserPath);
        const element = {
            id: `draw-${Date.now()}`,
            type: 'drawing',
            path: eraserPath,
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
    
    calculatePathBounds(pathData) {
        const points = this.parseSVGPath(pathData);
        if (points.length === 0) {
            return { x: 0, y: 0, width: 100, height: 100 };
        }
        
        let minX = points[0].x;
        let maxX = points[0].x;
        let minY = points[0].y;
        let maxY = points[0].y;
        
        points.forEach(point => {
            minX = Math.min(minX, point.x);
            maxX = Math.max(maxX, point.x);
            minY = Math.min(minY, point.y);
            maxY = Math.max(maxY, point.y);
        });
        
        return {
            x: minX,
            y: minY,
            width: maxX - minX + 10,
            height: maxY - minY + 10
        };
    }
    
    calculateShapeBounds(start, end) {
        let x, y, width, height;
        const margin = this.config.width;

        switch(this.currentShape) {
            case 'line':
                x = Math.min(start.x, end.x);
                y = Math.min(start.y, end.y);
                width = Math.abs(start.x - end.x);
                height = Math.abs(start.y - end.y);
                break;
            case 'rectangle':
                x = Math.min(start.x, end.x);
                y = Math.min(start.y, end.y);
                width = Math.abs(start.x - end.x);
                height = Math.abs(start.y - end.y);
                break;
            case 'circle':
                const centerX = (start.x + end.x) / 2;
                const centerY = (start.y + end.y) / 2;
                const radius = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2)) / 2;
                x = centerX - radius;
                y = centerY - radius;
                width = radius * 2;
                height = radius * 2;
                break;
            default:
                x = Math.min(start.x, end.x);
                y = Math.min(start.y, end.y);
                width = Math.abs(start.x - end.x);
                height = Math.abs(start.y - end.y);
        }
        
        return { 
            x: x - margin, 
            y: y - margin, 
            width: width + margin * 2, 
            height: height + margin * 2 
        };
    }
    
    parseSVGPath(path) {
        const points = [];
        const commands = path.match(/[ML]\d+\.?\d*,\d+\.?\d*/g) || [];
        
        commands.forEach(cmd => {
            const coords = cmd.substring(1).split(',');
            points.push({
                x: parseFloat(coords[0]),
                y: parseFloat(coords[1])
            });
        });
        
        return points;
    }
    
    getCanvasCoordinates(e) {
        const canvas = document.getElementById('canvas');
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left);
        const y = (e.clientY - rect.top);
        return { x, y };
    }
    
    clear() {
        const drawingLayer = document.getElementById('drawing-layer');
        if (drawingLayer) drawingLayer.innerHTML = '';
        
        // Limpiar elementos de dibujo de todas las capas
        this.board.layers.forEach(layer => {
            layer.elements = layer.elements.filter(el => el.type !== 'drawing');
        });
        
        this.board.showNotification('Dibujos limpiados');
    }
    
    cleanupAfterDrawing() {
        if (this.tempSvg) {
            this.tempSvg.remove();
            this.tempSvg = null;
        }
        this.currentPath = [];
        this.currentShape = null;
        this.startPoint = null;
        this.lastPoint = null;
    }
}

// Inicializar la aplicación
const app = new PizarraApp();
window.app = app;
