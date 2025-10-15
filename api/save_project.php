<?php
session_start();
include("../includes/db_functions.php");

header('Content-Type: application/json');

if (!isset($_SESSION['usuario_id'])) {
    echo json_encode(['success' => false, 'message' => 'No autenticado']);
    exit;
}

try {
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);
    
    if (!$data) {
        throw new Exception('Datos JSON inválidos');
    }
    
    $db = new DBFunctions($conexion);

    // Verificar que el proyecto pertenece al usuario
    $proyectos = $db->getProyectos($_SESSION['usuario_id']);
    $proyectoEncontrado = false;
    
    foreach ($proyectos as $proyecto) {
        if ($proyecto['id'] == $data['projectId']) {
            $proyectoEncontrado = true;
            break;
        }
    }

    if (!$proyectoEncontrado) {
        echo json_encode(['success' => false, 'message' => 'Proyecto no encontrado']);
        exit;
    }

    // Actualizar nombre del proyecto
    $db->actualizarProyecto($data['projectId'], $data['nombre']);

    // Limpiar elementos existentes
    $db->limpiarElementos($data['projectId']);

    // Guardar nuevos elementos
    foreach ($data['elementos'] as $elemento) {
        $contenido = null;
        $datos_json = [];
        
        switch ($elemento['type']) {
            case 'image':
                // Convertir data URL a BLOB
                if (isset($elemento['src']) && strpos($elemento['src'], 'data:') === 0) {
                    $parts = explode(',', $elemento['src']);
                    $contenido = base64_decode($parts[1]);
                }
                $datos_json = [
                    'width' => $elemento['width'] ?? 200,
                    'height' => $elemento['height'] ?? 200,
                    'rotation' => $elemento['rotation'] ?? 0,
                    'opacity' => $elemento['opacity'] ?? 100,
                    'flipScale' => $elemento['flipScale'] ?? ['x' => 1, 'y' => 1]
                ];
                break;
                
            case 'text':
                $datos_json = [
                    'text' => $elemento['text'] ?? '',
                    'styles' => $elemento['styles'] ?? [
                        'fontSize' => '16px',
                        'fontFamily' => 'Arial',
                        'color' => '#000000',
                        'fontWeight' => 'normal',
                        'fontStyle' => 'normal',
                        'textDecoration' => 'none',
                        'textAlign' => 'left'
                    ],
                    'width' => $elemento['width'] ?? 200,
                    'height' => $elemento['height'] ?? 50,
                    'rotation' => $elemento['rotation'] ?? 0
                ];
                break;
                
            case 'drawing':
                $datos_json = [
                    'path' => $elemento['path'] ?? '',
                    'style' => $elemento['style'] ?? [
                        'stroke' => '#000000',
                        'strokeWidth' => 3,
                        'fill' => 'none',
                        'opacity' => 100
                    ],
                    'width' => $elemento['width'] ?? 100,
                    'height' => $elemento['height'] ?? 100
                ];
                break;
                
            case 'document':
                if (isset($elemento['src']) && strpos($elemento['src'], 'data:') === 0) {
                    $parts = explode(',', $elemento['src']);
                    $contenido = base64_decode($parts[1]);
                }
                $datos_json = [
                    'name' => $elemento['name'] ?? '',
                    'fileType' => $elemento['fileType'] ?? '',
                    'width' => $elemento['width'] ?? 600,
                    'height' => $elemento['height'] ?? 800,
                    'rotation' => $elemento['rotation'] ?? 0,
                    'opacity' => $elemento['opacity'] ?? 100,
                    'scale' => $elemento['scale'] ?? 100,
                    'flipScale' => $elemento['flipScale'] ?? ['x' => 1, 'y' => 1],
                    'annotations' => $elemento['annotations'] ?? []
                ];
                break;
        }
        
        $db->guardarElemento(
            $data['projectId'],
            $elemento['type'],
            $contenido,
            json_encode($datos_json),
            $elemento['x'] ?? 0,
            $elemento['y'] ?? 0,
            $elemento['layer'] ?? 0
        );
    }

    echo json_encode(['success' => true]);
} catch (Exception $e) {
    error_log("Error en save_project.php: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Error del servidor: ' . $e->getMessage()]);
}
?>
