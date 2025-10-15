<?php
session_start();
include("../includes/db_functions.php");

if (!isset($_SESSION['usuario_id'])) {
    echo json_encode(['success' => false, 'message' => 'No autenticado']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
$db = new DBFunctions($conexion);

// Verificar que el proyecto pertenece al usuario
$proyectos = $db->getProyectos($_SESSION['usuario_id']);
$proyecto = array_filter($proyectos, function($p) use ($data) {
    return $p['id'] == $data['projectId'];
});

if (empty($proyecto)) {
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
        case 'imagen':
            // Convertir data URL a BLOB
            if (isset($elemento['src']) && strpos($elemento['src'], 'data:') === 0) {
                $parts = explode(',', $elemento['src']);
                $contenido = base64_decode($parts[1]);
            }
            $datos_json = [
                'src' => $elemento['src'],
                'width' => $elemento['width'],
                'height' => $elemento['height'],
                'rotation' => $elemento['rotation'],
                'opacity' => $elemento['opacity'],
                'flipScale' => $elemento['flipScale'] ?? ['x' => 1, 'y' => 1]
            ];
            break;
            
        case 'texto':
            $datos_json = [
                'text' => $elemento['text'],
                'styles' => $elemento['styles'],
                'width' => $elemento['width'],
                'height' => $elemento['height'],
                'rotation' => $elemento['rotation']
            ];
            break;
            
        case 'dibujo':
            $datos_json = [
                'path' => $elemento['path'],
                'style' => $elemento['style'],
                'width' => $elemento['width'],
                'height' => $elemento['height']
            ];
            break;
            
        case 'documento':
            if (isset($elemento['src']) && strpos($elemento['src'], 'data:') === 0) {
                $parts = explode(',', $elemento['src']);
                $contenido = base64_decode($parts[1]);
            }
            $datos_json = [
                'src' => $elemento['src'],
                'name' => $elemento['name'],
                'fileType' => $elemento['fileType'],
                'width' => $elemento['width'],
                'height' => $elemento['height'],
                'rotation' => $elemento['rotation'],
                'opacity' => $elemento['opacity'],
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
        $elemento['x'],
        $elemento['y'],
        $elemento['layer']
    );
}

echo json_encode(['success' => true]);
?>
