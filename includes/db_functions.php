<?php
include("conexion.php");

class DBFunctions {
    private $conexion;
    
    public function __construct($conexion) {
        $this->conexion = $conexion;
    }
    
    // Obtener proyectos del usuario
    public function getProyectos($usuario_id) {
        $sql = "SELECT id, nombre, descripcion, fecha_creacion, ultima_modificacion 
                FROM proyectos WHERE usuario_id = ? ORDER BY ultima_modificacion DESC";
        $stmt = $this->conexion->prepare($sql);
        $stmt->bind_param("i", $usuario_id);
        $stmt->execute();
        $result = $stmt->get_result();
        
        $proyectos = [];
        while ($row = $result->fetch_assoc()) {
            $proyectos[] = $row;
        }
        return $proyectos;
    }
    
    // Crear nuevo proyecto
    public function crearProyecto($usuario_id, $nombre, $descripcion = '') {
        $sql = "INSERT INTO proyectos (usuario_id, nombre, descripcion) VALUES (?, ?, ?)";
        $stmt = $this->conexion->prepare($sql);
        $stmt->bind_param("iss", $usuario_id, $nombre, $descripcion);
        
        if ($stmt->execute()) {
            return $this->conexion->insert_id;
        }
        return false;
    }
    
    // Actualizar proyecto
    public function actualizarProyecto($proyecto_id, $nombre, $descripcion = '') {
        $sql = "UPDATE proyectos SET nombre = ?, descripcion = ? WHERE id = ?";
        $stmt = $this->conexion->prepare($sql);
        $stmt->bind_param("ssi", $nombre, $descripcion, $proyecto_id);
        return $stmt->execute();
    }
    
    // Eliminar proyecto
    public function eliminarProyecto($proyecto_id) {
        // Los elementos se eliminarán automáticamente por CASCADE
        $sql = "DELETE FROM proyectos WHERE id = ?";
        $stmt = $this->conexion->prepare($sql);
        $stmt->bind_param("i", $proyecto_id);
        return $stmt->execute();
    }
    
    // Guardar elemento en el proyecto
    public function guardarElemento($proyecto_id, $tipo, $contenido, $datos_json, $ubicacion_x, $ubicacion_y, $capa) {
        $sql = "INSERT INTO elementos_proyecto (proyecto_id, tipo, contenido, datos_json, ubicacion_x, ubicacion_y, capa) 
                VALUES (?, ?, ?, ?, ?, ?, ?)";
        $stmt = $this->conexion->prepare($sql);
        
        // Si es null, convertir a NULL de SQL
        $contenido = $contenido === null ? null : $contenido;
        
        $stmt->bind_param("isssddi", $proyecto_id, $tipo, $contenido, $datos_json, $ubicacion_x, $ubicacion_y, $capa);
        return $stmt->execute();
    }
    
    // Obtener elementos del proyecto
    public function getElementos($proyecto_id) {
        $sql = "SELECT id, tipo, contenido, datos_json, ubicacion_x, ubicacion_y, capa 
                FROM elementos_proyecto WHERE proyecto_id = ? ORDER BY capa, fecha_creacion";
        $stmt = $this->conexion->prepare($sql);
        $stmt->bind_param("i", $proyecto_id);
        $stmt->execute();
        $result = $stmt->get_result();
        
        $elementos = [];
        while ($row = $result->fetch_assoc()) {
            $elementos[] = $row;
        }
        return $elementos;
    }
    
    // Limpiar elementos del proyecto (antes de guardar nuevos)
    public function limpiarElementos($proyecto_id) {
        $sql = "DELETE FROM elementos_proyecto WHERE proyecto_id = ?";
        $stmt = $this->conexion->prepare($sql);
        $stmt->bind_param("i", $proyecto_id);
        return $stmt->execute();
    }
}
?>
