<?php
session_start();
include("../includes/db_functions.php");

if (!isset($_SESSION['usuario_id'])) {
    echo json_encode(['success' => false, 'message' => 'No autenticado']);
    exit;
}

$projectId = $_GET['id'];
$db = new DBFunctions($conexion);

// Verificar que el proyecto pertenece al usuario
$proyectos = $db->getProyectos($_SESSION['usuario_id']);
$proyecto = array_filter($proyectos, function($p) use ($projectId) {
    return $p['id'] == $projectId;
});

if (empty($proyecto)) {
    echo json_encode(['success' => false, 'message' => 'Proyecto no encontrado']);
    exit;
}

$elementos = $db->getElementos($projectId);

// Convertir elementos al formato del frontend
$elements = [];
foreach ($elementos as $elemento) {
    $element = [
        'id' => $elemento['id'],
        'type' => $elemento['tipo'],
        'x' => floatval($elemento['ubicacion_x']),
        'y' => floatval($elemento['ubicacion_y']),
        'layer' => intval($elemento['capa'])
    ];
    
    // Procesar datos según el tipo
    if ($elemento['datos_json']) {
        $datos = json_decode($elemento['datos_json'], true);
        $element = array_merge($element, $datos);
    }
    
    // Para imágenes y documentos, usar el contenido BLOB si existe
    if (in_array($elemento['tipo'], ['imagen', 'documento']) && $elemento['contenido']) {
        $element['src'] = 'data:image/jpeg;base64,' . base64_encode($elemento['contenido']);
    }
    
    $elements[] = $element;
}

echo json_encode([
    'success' => true,
    'project' => $proyectos[array_key_first($proyecto)],
    'elements' => $elements
]);
?>
