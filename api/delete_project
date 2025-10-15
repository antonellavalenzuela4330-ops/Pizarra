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
    $success = $db->eliminarProyecto($data['projectId']);

    if ($success) {
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Error al eliminar proyecto']);
    }
} catch (Exception $e) {
    error_log("Error en delete_project.php: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Error del servidor: ' . $e->getMessage()]);
}
?>
