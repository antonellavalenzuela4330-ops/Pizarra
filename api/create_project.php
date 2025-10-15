<?php
session_start();
include("../includes/db_functions.php");

if (!isset($_SESSION['usuario_id'])) {
    echo json_encode(['success' => false, 'message' => 'No autenticado']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
$db = new DBFunctions($conexion);

$projectId = $db->crearProyecto($_SESSION['usuario_id'], $data['nombre'], $data['descripcion']);

if ($projectId) {
    echo json_encode(['success' => true, 'projectId' => $projectId]);
} else {
    echo json_encode(['success' => false, 'message' => 'Error al crear proyecto']);
}
?>
