<?php
session_start();
include("../includes/db_functions.php");

header('Content-Type: application/json');

if (!isset($_SESSION['usuario_id'])) {
    echo json_encode(['success' => false, 'message' => 'No autenticado']);
    exit;
}

try {
    $db = new DBFunctions($conexion);
    $proyectos = $db->getProyectos($_SESSION['usuario_id']);

    // Convertir al formato que espera el frontend
    $projects = [];
    foreach ($proyectos as $proyecto) {
        $projects[] = [
            'id' => (string)$proyecto['id'],
            'name' => $proyecto['nombre'],
            'created' => $proyecto['fecha_creacion'],
            'modified' => $proyecto['ultima_modificacion']
        ];
    }

    echo json_encode($projects);
} catch (Exception $e) {
    error_log("Error en get_projects.php: " . $e->getMessage());
    echo json_encode([]);
}
?>
