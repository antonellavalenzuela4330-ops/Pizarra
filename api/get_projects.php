<?php
session_start();
include("../includes/db_functions.php");

if (!isset($_SESSION['usuario_id'])) {
    echo json_encode([]);
    exit;
}

$db = new DBFunctions($conexion);
$proyectos = $db->getProyectos($_SESSION['usuario_id']);

// Convertir al formato que espera el frontend
$projects = [];
foreach ($proyectos as $proyecto) {
    $projects[] = [
        'id' => $proyecto['id'],
        'name' => $proyecto['nombre'],
        'created' => $proyecto['fecha_creacion'],
        'modified' => $proyecto['ultima_modificacion']
    ];
}

echo json_encode($projects);
?>
