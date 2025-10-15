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
    $projectId = $db->crearProyecto($_SESSION['usuario_id'], $data['nombre'], $data['descripcion']);

    if ($projectId) {
        echo json_encode(['success' => true, 'projectId' => $projectId]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Error al crear proyecto en la base de datos']);
    }
} catch (Exception $e) {
    error_log("Error en create_project.php: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Error del servidor: ' . $e->getMessage()]);
}
?>
