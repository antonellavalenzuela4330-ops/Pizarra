<?php
session_start();
if (!isset($_SESSION['usuario_id'])) {
    header("Location: login.php");
    exit;
}
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pizarra Digital - Editor de Proyectos</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.min.js"></script>
    <link rel="stylesheet" href="styles.css">
    <link rel="icon" href="img/boardly.png" type="image/png">
</head>
<body>
    <!-- Menú lateral -->
    <div id="sidebar" class="sidebar">
        <div class="sidebar-header">
            <h3>Proyectos</h3>
            <button id="close-sidebar" class="close-btn">&times;</button>
        </div>
        <div class="sidebar-content">
            <button id="new-project" class="new-project-btn">
                <i class="fas fa-plus"></i> Nuevo Proyecto
            </button>
            <div id="projects-list" class="projects-list">
                <!-- Los proyectos se cargarán aquí dinámicamente -->
            </div>
        </div>
    </div>

    <!-- Overlay para cerrar sidebar -->
    <div id="sidebar-overlay" class="sidebar-overlay"></div>

    <header>
        <!-- Inputs de archivos ocultos -->
        <input type="file" id="file-input-img" accept="image/*" style="display: none;">
        <input type="file" id="file-input-doc" accept=".pdf,.doc,.docx,.ppt,.pptx" style="display: none;">
        <input type="file" id="file-input-load" accept=".pizarra" style="display: none;">
        
        <div class="header-content">
            <!-- Lado izquierdo -->
            <div class="header-left">
                <!-- Menú -->
                <button id="menu-btn" class="header-btn">
                    <img src="img/menu.png" alt="Menú" style="width: 20px; height: 20px;">
                </button>
                
                <!-- Logo -->
                <div class="logo">
                    <img src="img/Boardly.png" alt="Logo" style="width: 85px; height: 40px;">
                </div>

                <!-- Guardar -->
                <button id="save-btn" class="header-btn">
                    <img src="img/guardar.png" alt="Guardar" style="width: 20px; height: 20px;">
                </button>   
                
                <!-- Campo de nombre del proyecto -->
                <div class="project-name-container">
                    <input type="text" id="project-name" placeholder="Nombre proyecto" value="Proyecto sin nombre">
                </div>
            </div>
            
            <!-- Lado derecho - Herramientas -->
            <div class="header-right">
                <!-- Imagen -->
                <button id="image-btn" class="tool-btn" title="Insertar imagen">
                    <img src="img/imagen.png" alt="Imagen" style="width: 20px; height: 20px;">
                </button>
                
                <!-- Texto -->
                <button id="text-btn" class="tool-btn" title="Insertar texto">
                    <img src="img/texto.png" alt="Texto" style="width: 20px; height: 20px;">
                </button>
                
                <!-- Lápiz/Dibujar -->
                <button id="draw-btn" class="tool-btn" title="Herramienta de dibujo">
                    <img src="img/dibujar.png" alt="Dibujar" style="width: 25px; height: 25px;">
                </button>
                
                <!-- Documento -->
                <button id="document-btn" class="tool-btn" title="Insertar documento">
                    <img src="img/documento.png" alt="Documento" style="width: 20px; height: 20px;">
                </button>
                <button id="layers-btn" class="tool-btn" title="Gestionar capas"><i class="fas fa-layer-group"></i></button>
                
                <!-- Usuario -->
                <div class="user-info">
                    <span>Hola, <?php echo htmlspecialchars($_SESSION['usuario_nombre']); ?></span>
                    <a href="logout.php" class="logout-btn">Cerrar Sesión</a>
                </div>
            </div>
        </div>
        
        <!-- Barra de herramientas desplegable -->
        <div id="toolbar" class="toolbar">
            <div class="toolbar-content">
                <!-- Contenido dinámico según la herramienta seleccionada -->
            </div>
        </div>
    </header>

    <!-- Canvas principal -->
    <main id="canvas" class="canvas">
        <div class="canvas-content">
            <svg id="drawing-layer" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;"></svg>
        </div>
    </main>

    <!-- Botón de tutorial -->
    <button id="tutorial-btn" class="tutorial-btn">
        <img src="img/informacion.png" alt="Tutorial" style="width: 20px; height: 20px;">
    </button>

    <!-- Modal de tutorial -->
    <div id="tutorial-modal" class="tutorial-modal">
        <div class="tutorial-content">
            <div class="tutorial-header">
                <h2>Tutorial de la Pizarra</h2>
                <button id="close-tutorial" class="close-btn">&times;</button>
            </div>
            <div class="tutorial-body">
                <div class="tutorial-slide active" data-slide="0">
                    <h3>Bienvenido a la Pizarra Digital</h3>
                    <p>Esta es una pizarra interactiva donde puedes crear, editar y guardar proyectos de manera dinámica.</p>
                </div>
                <div class="tutorial-slide" data-slide="1">
                    <h3>Menú de Proyectos</h3>
                    <p>Haz clic en el botón de menú para ver todos tus proyectos guardados, crear nuevos, abrir, eliminar o duplicar proyectos existentes.</p>
                </div>
                <div class="tutorial-slide" data-slide="2">
                    <h3>Herramientas de Imagen</h3>
                    <p>Inserta imágenes y modifícalas: mueve, cambia el tamaño, recorta, deforma, rota, cambia de capa y ajusta la opacidad.</p>
                </div>
                <div class="tutorial-slide" data-slide="3">
                    <h3>Herramientas de Texto</h3>
                    <p>Agrega cuadros de texto con opciones completas: mueve, redimensiona, modifica fuente, color, estilo y rota.</p>
                </div>
                <div class="tutorial-slide" data-slide="4">
                    <h3>Herramienta de Dibujo</h3>
                    <p>Dibuja libremente con diferentes tipos de trazo, grosor y colores. Incluye borrador integrado.</p>
                </div>
                <div class="tutorial-slide" data-slide="5">
                    <h3>Documentos</h3>
                    <p>Inserta archivos Word o PDF, visualízalos, muévelos y usa las herramientas de dibujo y texto sobre ellos.</p>
                </div>
            </div>
            <div class="tutorial-navigation">
                <button id="prev-slide" class="nav-btn">Anterior</button>
                <div class="slide-indicators">
                    <span class="indicator active"></span>
                    <span class="indicator"></span>
                    <span class="indicator"></span>
                    <span class="indicator"></span>
                    <span class="indicator"></span>
                    <span class="indicator"></span>
                </div>
                <button id="next-slide" class="nav-btn">Siguiente</button>
            </div>
        </div>
    </div>

    <!-- Panel de Capas -->
    <div id="layers-panel" class="floating-panel">
        <div class="panel-header">
            <h3>Capas</h3>
            <button id="close-layers-panel" class="close-btn"><i class="fas fa-times"></i></button>
        </div>
        <div id="layers-list" class="panel-content">
            <!-- Las capas se generarán dinámicamente aquí -->
        </div>
        <div class="panel-footer">
            <button id="add-layer-btn" class="btn-primary"><i class="fas fa-plus"></i> Añadir Capa</button>
        </div>
    </div>

    <script src="script.js"></script>
</body>
</html>
