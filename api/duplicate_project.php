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
    
    // Obtener el proyecto original
    $proyectos = $db->getProyectos($_SESSION['usuario_id']);
    $proyectoOriginal = null;
    
    foreach ($proyectos as $proyecto) {
        if ($proyecto['id'] == $data['projectId']) {
            $proyectoOriginal = $proyecto;
            break;
        }
    }
    
    if (!$proyectoOriginal) {
        echo json_encode(['success' => false, 'message' => 'Proyecto original no encontrado']);
        exit;
    }
    
    // Crear nuevo proyecto
    $newProjectId = $db->crearProyecto($_SESSION['usuario_id'], $data['newName'], $proyectoOriginal['descripcion']);
    
    if ($newProjectId) {
        // Obtener elementos del proyecto original
        $elementos = $db->getElementos($data['projectId']);
        
        // Copiar elementos al nuevo proyecto
        foreach ($elementos as $elemento) {
            $db->guardarElemento(
                $newProjectId,
                $elemento['tipo'],
                $elemento['contenido'],
                $elemento['datos_json'],
                $elemento['ubicacion_x'],
                $elemento['ubicacion_y'],
                $elemento['capa']
            );
        }
        
        echo json_encode(['success' => true, 'newProjectId' => $newProjectId]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Error al crear proyecto duplicado']);
    }
} catch (Exception $e) {
    error_log("Error en duplicate_project.php: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Error del servidor: ' . $e->getMessage()]);
}
?>
