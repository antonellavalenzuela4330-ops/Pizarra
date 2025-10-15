<?php
// Mostrar errores
error_reporting(E_ALL);
ini_set('display_errors', 1);

$host = "193.203.175.157";
$usuario = "u157683007_anthony";
$password = "Boardly12";
$bd = "u157683007_boardly";

// Crear conexión
$conexion = new mysqli($host, $usuario, $password, $bd);

// Verificar si hay error
if ($conexion->connect_error) {
    die("Error de conexión: " . $conexion->connect_error);
}

// Establecer el charset a utf8mb4 para soportar emojis
$conexion->set_charset("utf8mb4");

// También establecer la collation
$conexion->query("SET NAMES 'utf8mb4'");
$conexion->query("SET CHARACTER SET utf8mb4");
$conexion->query("SET COLLATION_CONNECTION = 'utf8mb4_unicode_ci'");

?>
