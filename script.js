// Variables globales
let currentTool = null;
let isDrawing = false;
let lastX = 0;
let lastY = 0;
let projects = [];
let currentProject = null;
let drawingCanvas = null;
let drawingContext = null;
let layers = [];
let selectedElement = null;
let isResizing = false;
let isRotating = false;
let isDragging = false;

// Elementos del DOM
const menuBtn = document.getElementById('menuBtn');
const sidebar = document.getElementById('sidebar');
const closeSidebar = document.getElementById('closeSidebar');
const saveBtn = document.getElementById('saveBtn');
const projectName = document.getElementById('projectName');
const imageBtn = document.getElementById('imageBtn');
const textBtn = document.getElementById('textBtn');
const drawBtn = document.getElementById('drawBtn');
const documentBtn = document.getElementById('documentBtn');
const imageOptions = document.getElementById('imageOptions');
const drawingPanel = document.getElementById('drawingPanel');
const textPanel = document.getElementById('textPanel');
const tutorialBtn = document.getElementById('tutorialBtn');
const tutorialModal = document.getElementById('tutorialModal');
const closeTutorialModal = document.getElementById('closeTutorialModal');
const canvas = document.getElementById('canvas');
const imageInput = document.getElementById('imageInput');
const documentInput = document.getElementById('documentInput');

// Inicialización
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    loadProjects();
    setupDrawingCanvas();
    setupLayers();
});

function initializeApp() {
    currentProject = {
        id: Date.now(),
        name: 'Mi Proyecto',
        elements: [],
        canvas: canvas.innerHTML
    };
    
    if (currentProject.elements.length > 0) {
        document.querySelector('.placeholder-text').style.display = 'none';
    }
}

function setupLayers() {
    layers = [
        { id: 'drawing', name: 'Dibujo', visible: true, locked: false, zIndex: 1 },
        { id: 'shapes', name: 'Formas', visible: true, locked: false, zIndex: 2 },
        { id: 'text', name: 'Texto', visible: true, locked: false, zIndex: 3 },
        { id: 'images', name: 'Imágenes', visible: true, locked: false, zIndex: 4 },
        { id: 'documents', name: 'Documentos', visible: true, locked: false, zIndex: 5 }
    ];
}

function setupDrawingCanvas() {
    drawingCanvas = document.createElement('canvas');
    drawingCanvas.width = canvas.offsetWidth;
    drawingCanvas.height = canvas.offsetHeight;
    drawingCanvas.style.position = 'absolute';
    drawingCanvas.style.top = '0';
    drawingCanvas.style.left = '0';
    drawingCanvas.style.zIndex = '1';
    drawingCanvas.style.pointerEvents = 'none';
    canvas.appendChild(drawingCanvas);
    
    drawingContext = drawingCanvas.getContext('2d');
    drawingContext.lineCap = 'round';
    drawingContext.lineJoin = 'round';
}

function setupEventListeners() {
    menuBtn.addEventListener('click', toggleSidebar);
    closeSidebar.addEventListener('click', toggleSidebar);
    saveBtn.addEventListener('click', saveProject);
    
    imageBtn.addEventListener('click', () => toggleTool('image'));
    textBtn.addEventListener('click', () => toggleTool('text'));
    drawBtn.addEventListener('click', () => toggleTool('draw'));
    documentBtn.addEventListener('click', () => toggleTool('document'));
    
    tutorialBtn.addEventListener('click', showTutorial);
    closeTutorialModal.addEventListener('click', hideTutorial);
    
    window.addEventListener('click', function(event) {
        if (event.target === tutorialModal) {
            hideTutorial();
        }
    });
    
    imageInput.addEventListener('change', handleImageUpload);
    documentInput.addEventListener('change', handleDocumentUpload);
    
    setupCanvas();
    
    document.getElementById('closeDrawingPanel').addEventListener('click', () => {
        drawingPanel.style.display = 'none';
        currentTool = null;
        updateToolButtons();
    });
    
    document.getElementById('closeTextPanel').addEventListener('click', () => {
        textPanel.style.display = 'none';
        currentTool = null;
        updateToolButtons();
    });
    
    document.getElementById('insertTextBtn').addEventListener('click', insertText);
    
    document.querySelectorAll('.shape-btn').forEach(btn => {
        btn.addEventListener('click', () => insertShape(btn.dataset.shape));
    });
    
    document.getElementById('cropBtn').addEventListener('click', cropImage);
    document.getElementById('resizeBtn').addEventListener('click', resizeImage);
    
    document.getElementById('newProjectBtn').addEventListener('click', createNewProject);
    
    document.querySelectorAll('.project-item').forEach(item => {
        item.addEventListener('click', () => loadProject(item.textContent));
    });
    
    document.getElementById('fontSize').addEventListener('input', function() {
        document.getElementById('fontSizeValue').textContent = this.value + 'px';
    });
    
    document.getElementById('colorPicker').addEventListener('change', function() {
        if (drawingContext) {
            drawingContext.strokeStyle = this.value;
        }
    });
    
    document.getElementById('penType').addEventListener('change', function() {
        updatePenStyle(this.value);
    });
}

function updatePenStyle(penType) {
    if (!drawingContext) return;
    
    switch(penType) {
        case 'pencil':
            drawingContext.lineWidth = 2;
            drawingContext.globalAlpha = 0.8;
            break;
        case 'brush':
            drawingContext.lineWidth = 4;
            drawingContext.globalAlpha = 0.6;
            break;
        case 'marker':
            drawingContext.lineWidth = 6;
            drawingContext.globalAlpha = 0.4;
            break;
        case 'highlighter':
            drawingContext.lineWidth = 15;
            drawingContext.globalAlpha = 0.3;
            break;
    }
}

function toggleSidebar() {
    sidebar.classList.toggle('open');
}

function toggleTool(tool) {
    imageOptions.style.display = 'none';
    drawingPanel.style.display = 'none';
    textPanel.style.display = 'none';
    
    currentTool = null;
    updateToolButtons();
    
    if (tool === 'image') {
        imageOptions.style.display = 'flex';
        currentTool = 'image';
        imageInput.click();
    } else if (tool === 'text') {
        textPanel.style.display = 'block';
        currentTool = 'text';
        document.getElementById('textInput').focus();
    } else if (tool === 'draw') {
        drawingPanel.style.display = 'block';
        currentTool = 'draw';
        setupDrawingMode();
    } else if (tool === 'document') {
        documentInput.click();
    }
    
    updateToolButtons();
}

function updateToolButtons() {
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    if (currentTool === 'image') {
        imageBtn.classList.add('active');
    } else if (currentTool === 'text') {
        textBtn.classList.add('active');
    } else if (currentTool === 'draw') {
        drawBtn.classList.add('active');
    }
}

function setupCanvas() {
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseleave', stopDrawing);
}

function startDrawing(e) {
    if (currentTool !== 'draw') return;
    
    isDrawing = true;
    const rect = canvas.getBoundingClientRect();
    lastX = e.clientX - rect.left;
    lastY = e.clientY - rect.top;
    
    if (drawingContext) {
        drawingContext.strokeStyle = document.getElementById('colorPicker').value;
        updatePenStyle(document.getElementById('penType').value);
    }
}

function draw(e) {
    if (!isDrawing || currentTool !== 'draw' || !drawingContext) return;
    
    const rect = canvas.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;
    
    drawingContext.beginPath();
    drawingContext.moveTo(lastX, lastY);
    drawingContext.lineTo(currentX, currentY);
    drawingContext.stroke();
    
    lastX = currentX;
    lastY = currentY;
}

function stopDrawing() {
    isDrawing = false;
}

function setupDrawingMode() {
    if (drawingCanvas) {
        drawingCanvas.style.pointerEvents = 'auto';
    }
    
    const placeholder = document.querySelector('.placeholder-text');
    if (placeholder) {
        placeholder.style.display = 'none';
    }
}

function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = document.createElement('img');
        img.src = e.target.result;
        img.style.maxWidth = '300px';
        img.style.maxHeight = '300px';
        img.style.position = 'absolute';
        img.style.top = '50px';
        img.style.left = '50px';
        img.style.zIndex = '4';
        img.classList.add('draggable', 'resizable', 'rotatable');
        img.dataset.type = 'image';
        
        const placeholder = document.querySelector('.placeholder-text');
        if (placeholder) {
            placeholder.style.display = 'none';
        }
        
        canvas.appendChild(img);
        makeElementInteractive(img);
        
        currentProject.elements.push({
            type: 'image',
            src: e.target.result,
            x: 50,
            y: 50,
            width: 300,
            height: 300,
            rotation: 0,
            zIndex: 4
        });
    };
    reader.readAsDataURL(file);
}

function handleDocumentUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (file.type === 'application/pdf') {
        createDocumentPreview(file, 'pdf', '#ff6b6b', '#ee5a24', 'fa-file-pdf');
    } else {
        createDocumentPreview(file, 'word', '#4ecdc4', '#44a08d', 'fa-file-word');
    }
}

function createDocumentPreview(file, type, color1, color2, iconClass) {
    const docElement = document.createElement('div');
    docElement.className = `document-element draggable resizable rotatable ${type}-preview`;
    docElement.style.cssText = `
        position: absolute;
        top: 100px;
        left: 100px;
        width: 250px;
        height: 180px;
        background: linear-gradient(135deg, ${color1} 0%, ${color2} 100%);
        border: 3px solid ${type === 'pdf' ? '#c44569' : '#2c3e50'};
        border-radius: 12px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 5;
        cursor: move;
        box-shadow: 0 8px 25px rgba(0,0,0,0.2);
    `;
    
    docElement.innerHTML = `
        <i class="fas ${iconClass}" style="font-size: 48px; color: white; margin-bottom: 15px; text-shadow: 0 2px 4px rgba(0,0,0,0.3);"></i>
        <div style="text-align: center; color: white;">
            <div style="font-weight: bold; font-size: 16px; margin-bottom: 5px;">${file.name}</div>
            <div style="font-size: 12px; opacity: 0.9;">${(file.size / 1024).toFixed(1)} KB</div>
            <div style="font-size: 10px; opacity: 0.8; margin-top: 5px;">${type.toUpperCase()} Document</div>
        </div>
    `;
    
    docElement.dataset.type = type;
    
    const placeholder = document.querySelector('.placeholder-text');
    if (placeholder) {
        placeholder.style.display = 'none';
    }
    
    canvas.appendChild(docElement);
    makeElementInteractive(docElement);
    
    currentProject.elements.push({
        type: type,
        name: file.name,
        size: file.size,
        x: 100,
        y: 100,
        width: 250,
        height: 180,
        rotation: 0,
        zIndex: 5
    });
}

function insertText() {
    const text = document.getElementById('textInput').value;
    const fontFamily = document.getElementById('fontFamily').value;
    const fontSize = document.getElementById('fontSize').value;
    
    if (!text.trim()) return;
    
    const textElement = document.createElement('div');
    textElement.className = 'text-element draggable resizable rotatable';
    textElement.style.cssText = `
        position: absolute;
        top: 150px;
        left: 150px;
        font-family: ${fontFamily};
        font-size: ${fontSize}px;
        color: #333;
        cursor: move;
        z-index: 3;
        user-select: none;
        min-width: 100px;
        padding: 5px;
        border: 1px solid transparent;
    `;
    textElement.textContent = text;
    textElement.dataset.type = 'text';
    
    const placeholder = document.querySelector('.placeholder-text');
    if (placeholder) {
        placeholder.style.display = 'none';
    }
    
    canvas.appendChild(textElement);
    makeElementInteractive(textElement);
    
    currentProject.elements.push({
        type: 'text',
        content: text,
        fontFamily: fontFamily,
        fontSize: fontSize,
        x: 150,
        y: 150,
        rotation: 0,
        zIndex: 3
    });
    
    document.getElementById('textInput').value = '';
    textPanel.style.display = 'none';
    currentTool = null;
    updateToolButtons();
}

function insertShape(shapeType) {
    const shapeElement = document.createElement('div');
    shapeElement.className = 'shape-element draggable resizable rotatable';
    shapeElement.dataset.type = 'shape';
    shapeElement.dataset.shape = shapeType;
    
    let shapeContent = '';
    let shapeStyle = '';
    
    switch(shapeType) {
        case 'rectangle':
            shapeContent = '<i class="fas fa-square"></i>';
            shapeStyle = 'width: 100px; height: 80px; background: #e0e0e0; border: 2px solid #ccc;';
            break;
        case 'circle':
            shapeContent = '<i class="fas fa-circle"></i>';
            shapeStyle = 'width: 80px; height: 80px; background: #e0e0e0; border: 2px solid #ccc; border-radius: 50%;';
            break;
        case 'triangle':
            shapeContent = '<i class="fas fa-play"></i>';
            shapeStyle = 'width: 0; height: 0; border-left: 40px solid transparent; border-right: 40px solid transparent; border-bottom: 70px solid #e0e0e0;';
            break;
        case 'arrow':
            shapeContent = '<i class="fas fa-arrow-right"></i>';
            shapeStyle = 'width: 120px; height: 60px; background: #e0e0e0; border: 2px solid #ccc; border-radius: 8px;';
            break;
    }
    
    shapeElement.style.cssText = `
        position: absolute;
        top: 200px;
        left: 200px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: move;
        z-index: 2;
        ${shapeStyle}
    `;
    
    shapeElement.innerHTML = shapeContent;
    
    const placeholder = document.querySelector('.placeholder-text');
    if (placeholder) {
        placeholder.style.display = 'none';
    }
    
    canvas.appendChild(shapeElement);
    makeElementInteractive(shapeElement);
    
    currentProject.elements.push({
        type: 'shape',
        shape: shapeType,
        x: 200,
        y: 200,
        rotation: 0,
        zIndex: 2
    });
}

function makeElementInteractive(element) {
    let isDragging = false;
    let isResizing = false;
    let isRotating = false;
    let currentX, currentY, initialX, initialY;
    let initialWidth, initialHeight, initialRotation;
    
    // Agregar controles de transformación
    addTransformControls(element);
    
    element.addEventListener('mousedown', startInteraction);
    element.addEventListener('mousemove', handleInteraction);
    element.addEventListener('mouseup', stopInteraction);
    element.addEventListener('mouseleave', stopInteraction);
    
    function startInteraction(e) {
        if (e.target.classList.contains('transform-control')) return;
        
        initialX = e.clientX - element.offsetLeft;
        initialY = e.clientY - element.offsetTop;
        initialWidth = element.offsetWidth;
        initialHeight = element.offsetHeight;
        initialRotation = parseFloat(element.style.transform.replace('rotate(', '').replace('deg)', '') || 0);
        
        if (e.target.classList.contains('resize-handle')) {
            isResizing = true;
        } else if (e.target.classList.contains('rotate-handle')) {
            isRotating = true;
        } else {
            isDragging = true;
        }
        
        e.preventDefault();
    }
    
    function handleInteraction(e) {
        if (!isDragging && !isResizing && !isRotating) return;
        
        e.preventDefault();
        
        if (isDragging) {
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;
            
            element.style.left = currentX + 'px';
            element.style.top = currentY + 'px';
        } else if (isResizing) {
            const deltaX = e.clientX - (initialX + element.offsetLeft);
            const deltaY = e.clientY - (initialY + element.offsetTop);
            
            const newWidth = Math.max(50, initialWidth + deltaX);
            const newHeight = Math.max(50, initialHeight + deltaY);
            
            element.style.width = newWidth + 'px';
            element.style.height = newHeight + 'px';
        } else if (isRotating) {
            const rect = element.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            
            const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * 180 / Math.PI;
            element.style.transform = `rotate(${angle}deg)`;
        }
    }
    
    function stopInteraction() {
        isDragging = false;
        isResizing = false;
        isRotating = false;
        
        updateProjectElement(element);
    }
}

function addTransformControls(element) {
    const controls = document.createElement('div');
    controls.className = 'transform-controls';
    controls.style.cssText = `
        position: absolute;
        top: -20px;
        left: -20px;
        right: -20px;
        bottom: -20px;
        pointer-events: none;
        z-index: 1000;
    `;
    
    // Controles de redimensionamiento
    const resizeHandles = ['nw', 'ne', 'sw', 'se'];
    resizeHandles.forEach(pos => {
        const handle = document.createElement('div');
        handle.className = `resize-handle resize-${pos}`;
        handle.style.cssText = `
            position: absolute;
            width: 10px;
            height: 10px;
            background: #007bff;
            border: 2px solid white;
            border-radius: 50%;
            pointer-events: all;
            cursor: ${pos.includes('n') ? 'n' : ''}${pos.includes('s') ? 's' : ''}${pos.includes('e') ? 'e' : ''}${pos.includes('w') ? 'w' : ''}-resize;
        `;
        
        if (pos.includes('n')) handle.style.top = '0';
        if (pos.includes('s')) handle.style.bottom = '0';
        if (pos.includes('e')) handle.style.right = '0';
        if (pos.includes('w')) handle.style.left = '0';
        
        controls.appendChild(handle);
    });
    
    // Control de rotación
    const rotateHandle = document.createElement('div');
    rotateHandle.className = 'rotate-handle';
    rotateHandle.style.cssText = `
        position: absolute;
        top: -30px;
        left: 50%;
        transform: translateX(-50%);
        width: 20px;
        height: 20px;
        background: #28a745;
        border: 2px solid white;
        border-radius: 50%;
        pointer-events: all;
        cursor: grab;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 12px;
    `;
    rotateHandle.innerHTML = '⟲';
    controls.appendChild(rotateHandle);
    
    element.appendChild(controls);
}

function updateProjectElement(element) {
    const index = currentProject.elements.findIndex(el => {
        if (el.type === 'image' && element.tagName === 'IMG') return true;
        if (el.type === 'pdf' && element.classList.contains('pdf-preview')) return true;
        if (el.type === 'word' && element.classList.contains('word-preview')) return true;
        if (el.type === 'text' && element.classList.contains('text-element')) return true;
        if (el.type === 'shape' && element.classList.contains('shape-element')) return true;
        return false;
    });
    
    if (index !== -1) {
        currentProject.elements[index].x = parseFloat(element.style.left);
        currentProject.elements[index].y = parseFloat(element.style.top);
        currentProject.elements[index].width = element.offsetWidth;
        currentProject.elements[index].height = element.offsetHeight;
        currentProject.elements[index].rotation = parseFloat(element.style.transform.replace('rotate(', '').replace('deg)', '') || 0);
    }
}

function cropImage() {
    alert('Función de recorte de imagen - En desarrollo');
}

function resizeImage() {
    alert('Función de redimensionado de imagen - En desarrollo');
}

function saveProject() {
    currentProject.name = projectName.value;
    currentProject.canvas = canvas.innerHTML;
    
    const existingProjects = JSON.parse(localStorage.getItem('pizarraProjects') || '[]');
    const projectIndex = existingProjects.findIndex(p => p.id === currentProject.id);
    
    if (projectIndex !== -1) {
        existingProjects[projectIndex] = currentProject;
    } else {
        existingProjects.push(currentProject);
    }
    
    localStorage.setItem('pizarraProjects', JSON.stringify(existingProjects));
    
    showNotification('Proyecto guardado exitosamente', 'success');
    loadProjects();
}

function createNewProject() {
    if (currentProject.elements.length > 0) {
        if (confirm('¿Quieres guardar el proyecto actual antes de crear uno nuevo?')) {
            saveProject();
        }
    }
    
    currentProject = {
        id: Date.now(),
        name: 'Nuevo Proyecto',
        elements: [],
        canvas: ''
    };
    
    canvas.innerHTML = '<div class="placeholder-text">PIZARRA</div>';
    setupDrawingCanvas();
    
    projectName.value = currentProject.name;
    toggleSidebar();
    
    showNotification('Nuevo proyecto creado', 'info');
}

function loadProject(projectName) {
    const existingProjects = JSON.parse(localStorage.getItem('pizarraProjects') || '[]');
    const project = existingProjects.find(p => p.name === projectName);
    
    if (project) {
        currentProject = project;
        canvas.innerHTML = project.canvas || '<div class="placeholder-text">PIZARRA</div>';
        this.projectName.value = project.name;
        
        setupDrawingCanvas();
        
        showNotification(`Proyecto "${project.name}" cargado`, 'success');
    }
    
    toggleSidebar();
}

function loadProjects() {
    const existingProjects = JSON.parse(localStorage.getItem('pizarraProjects') || '[]');
    const projectsList = document.getElementById('projectsList');
    
    projectsList.innerHTML = '';
    
    existingProjects.forEach(project => {
        const projectItem = document.createElement('div');
        projectItem.className = 'project-item';
        projectItem.textContent = project.name;
        projectItem.addEventListener('click', () => loadProject(project.name));
        projectsList.appendChild(projectItem);
    });
    
    if (existingProjects.length === 0) {
        const exampleProjects = [
            'Nombre proyecto 1', 'Nombre proyecto 2', 'Nombre proyecto 3',
            'Nombre proyecto 4', 'Nombre proyecto 5', 'Nombre proyecto 6',
            'Nombre proyecto 7', 'Nombre proyecto 8'
        ];
        
        exampleProjects.forEach(name => {
            const projectItem = document.createElement('div');
            projectItem.className = 'project-item';
            projectItem.textContent = name;
            projectsList.appendChild(projectItem);
        });
    }
}

function showTutorial() {
    tutorialModal.style.display = 'flex';
}

function hideTutorial() {
    tutorialModal.style.display = 'none';
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        background: ${type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#2196f3'};
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        z-index: 1002;
        transform: translateX(400px);
        transition: transform 0.3s ease;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    setTimeout(() => {
        notification.style.transform = 'translateX(400px)';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

document.addEventListener('dragstart', function(e) {
    if (e.target.tagName === 'IMG') {
        e.preventDefault();
    }
});

document.addEventListener('keydown', function(e) {
    if (e.ctrlKey || e.metaKey) {
        switch(e.key) {
            case 's':
                e.preventDefault();
                saveProject();
                break;
            case 'n':
                e.preventDefault();
                createNewProject();
                break;
            case 'o':
                e.preventDefault();
                toggleSidebar();
                break;
        }
    }
    
    if (e.key === 'Escape') {
        if (drawingPanel.style.display === 'block') {
            drawingPanel.style.display = 'none';
            currentTool = null;
            updateToolButtons();
        }
        if (textPanel.style.display === 'block') {
            textPanel.style.display = 'none';
            currentTool = null;
            updateToolButtons();
        }
        if (tutorialModal.style.display === 'flex') {
            hideTutorial();
        }
    }
});
