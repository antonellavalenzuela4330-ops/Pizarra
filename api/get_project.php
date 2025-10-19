<?php
session_start();
include("../includes/db_functions.php");

header('Content-Type: application/json');

if (!isset($_SESSION['usuario_id'])) {
    echo json_encode(['success' => false, 'message' => 'No autenticado']);
    exit;
}

try {
    $projectId = $_GET['id'] ?? '';
    
    if (empty($projectId)) {
        throw new Exception('ID de proyecto no proporcionado');
    }
    
    $db = new DBFunctions($conexion);

    // Verificar que el proyecto pertenece al usuario
    $proyectos = $db->getProyectos($_SESSION['usuario_id']);
    $proyectoEncontrado = null;
    
    foreach ($proyectos as $proyecto) {
        if ($proyecto['id'] == $projectId) {
            $proyectoEncontrado = $proyecto;
            break;
        }
    }

    if (!$proyectoEncontrado) {
        echo json_encode(['success' => false, 'message' => 'Proyecto no encontrado']);
        exit;
    }

    $elementos = $db->getElementos($projectId);

    // Convertir elementos al formato del frontend
    $elements = [];
    foreach ($elementos as $elemento) {
        // CONVERSIÓN DE TIPOS: Base de datos → Frontend
        $tipo_frontend = '';
        switch ($elemento['tipo']) {
            case 'imagen':
                $tipo_frontend = 'image';
                break;
            case 'texto':
                $tipo_frontend = 'text';
                break;
            case 'dibujo':
                $tipo_frontend = 'drawing';
                break;
            case 'documento':
                $tipo_frontend = 'document';
                break;
            default:
                $tipo_frontend = $elemento['tipo'];
        }
        
        $element = [
            'id' => (string)$elemento['id'],
            'type' => $tipo_frontend, // ← Tipo convertido para frontend
            'x' => floatval($elemento['ubicacion_x']),
            'y' => floatval($elemento['ubicacion_y']),
            'layer' => intval($elemento['capa'])
        ];
        
        // Procesar datos según el tipo
        if ($elemento['datos_json']) {
            $datos = json_decode($elemento['datos_json'], true);
            if ($datos) {
                $element = array_merge($element, $datos);
            }
        }
        
        // Para imágenes y documentos, usar el contenido BLOB si existe
        if (in_array($elemento['tipo'], ['imagen', 'documento']) && $elemento['contenido']) {
            // Determinar el tipo MIME correcto
            $mime_type = 'image/jpeg'; // por defecto para imágenes
            if ($elemento['tipo'] === 'documento') {
                // Para documentos, intentar determinar el tipo desde datos_json
                $datos = json_decode($elemento['datos_json'], true);
                $fileType = $datos['fileType'] ?? '';
                if (strpos($fileType, 'pdf') !== false) {
                    $mime_type = 'application/pdf';
                } elseif (strpos($fileType, 'word') !== false || strpos($fileType, 'document') !== false) {
                    $mime_type = 'application/msword';
                } else {
                    $mime_type = 'application/octet-stream';
                }
            }
            $element['src'] = 'data:' . $mime_type . ';base64,' . base64_encode($elemento['contenido']);
        }
        
        $elements[] = $element;
    }

    echo json_encode([
        'success' => true,
        'project' => [
            'id' => (string)$proyectoEncontrado['id'],
            'nombre' => $proyectoEncontrado['nombre'],
            'fecha_creacion' => $proyectoEncontrado['fecha_creacion'],
            'ultima_modificacion' => $proyectoEncontrado['ultima_modificacion']
        ],
        'elements' => $elements
    ]);
} catch (Exception $e) {
    error_log("Error en get_project.php: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Error del servidor: ' . $e->getMessage()]);
}
?>
