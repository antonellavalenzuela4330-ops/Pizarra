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

    // Verificar que el proyecto pertenece al usuario
    $proyectos = $db->getProyectos($_SESSION['usuario_id']);
    $proyectoEncontrado = false;
    
    foreach ($proyectos as $proyecto) {
        if ($proyecto['id'] == $data['projectId']) {
            $proyectoEncontrado = true;
            break;
        }
    }

    if (!$proyectoEncontrado) {
        echo json_encode(['success' => false, 'message' => 'Proyecto no encontrado']);
        exit;
    }

    // Actualizar nombre del proyecto
    $db->actualizarProyecto($data['projectId'], $data['nombre']);

    // Obtener elementos existentes en la base de datos
    $elementosExistentes = $db->getElementos($data['projectId']);
    
    // Crear mapa de elementos existentes por ID
    $elementosExistentesMap = [];
    foreach ($elementosExistentes as $elemento) {
        $elementosExistentesMap[$elemento['id']] = $elemento;
    }

    // Crear mapa de elementos nuevos por ID
    $elementosNuevosMap = [];
    foreach ($data['elementos'] as $elemento) {
        if (isset($elemento['id'])) {
            $elementosNuevosMap[$elemento['id']] = $elemento;
        }
    }

    // Identificar elementos a eliminar (existen en BD pero no en los nuevos datos)
    $elementosAEliminar = [];
    foreach ($elementosExistentesMap as $id => $elemento) {
        if (!isset($elementosNuevosMap[$id])) {
            $elementosAEliminar[] = $id;
        }
    }

    // Identificar elementos a actualizar/insertar
    $elementosAGuardar = [];
    foreach ($data['elementos'] as $elemento) {
        $elementosAGuardar[] = $elemento;
    }

    // ELIMINAR SOLO LOS ELEMENTOS QUE YA NO EXISTEN
    if (!empty($elementosAEliminar)) {
        $placeholders = str_repeat('?,', count($elementosAEliminar) - 1) . '?';
        $sql = "DELETE FROM elementos_proyecto WHERE id IN ($placeholders)";
        $stmt = $conexion->prepare($sql);
        $stmt->bind_param(str_repeat('s', count($elementosAEliminar)), ...$elementosAEliminar);
        $stmt->execute();
    }

    // ACTUALIZAR O INSERTAR ELEMENTOS
    foreach ($elementosAGuardar as $elemento) {
        $contenido = null;
        $datos_json = [];
        
        // CONVERSIÓN DE TIPOS: Frontend → Base de datos
        $tipo_bd = '';
        switch ($elemento['type']) {
            case 'image':
                $tipo_bd = 'imagen';
                // Convertir data URL a BLOB
                if (isset($elemento['src']) && strpos($elemento['src'], 'data:') === 0) {
                    $parts = explode(',', $elemento['src']);
                    $contenido = base64_decode($parts[1]);
                }
                $datos_json = [
                    'width' => $elemento['width'] ?? 200,
                    'height' => $elemento['height'] ?? 200,
                    'rotation' => $elemento['rotation'] ?? 0,
                    'opacity' => $elemento['opacity'] ?? 100,
                    'flipScale' => $elemento['flipScale'] ?? ['x' => 1, 'y' => 1]
                ];
                break;
                
            case 'text':
                $tipo_bd = 'texto';
                $datos_json = [
                    'text' => $elemento['text'] ?? '',
                    'styles' => $elemento['styles'] ?? [
                        'fontSize' => '16px',
                        'fontFamily' => 'Arial',
                        'color' => '#000000',
                        'fontWeight' => 'normal',
                        'fontStyle' => 'normal',
                        'textDecoration' => 'none',
                        'textAlign' => 'left'
                    ],
                    'width' => $elemento['width'] ?? 200,
                    'height' => $elemento['height'] ?? 50,
                    'rotation' => $elemento['rotation'] ?? 0
                ];
                break;
                
            case 'drawing':
                $tipo_bd = 'dibujo';
                $datos_json = [
                    'path' => $elemento['path'] ?? '',
                    'style' => $elemento['style'] ?? [
                        'stroke' => '#000000',
                        'strokeWidth' => 3,
                        'fill' => 'none',
                        'opacity' => 100
                    ],
                    'width' => $elemento['width'] ?? 100,
                    'height' => $elemento['height'] ?? 100
                ];
                break;
                
            case 'document':
                $tipo_bd = 'documento';
                if (isset($elemento['src']) && strpos($elemento['src'], 'data:') === 0) {
                    $parts = explode(',', $elemento['src']);
                    $contenido = base64_decode($parts[1]);
                }
                $datos_json = [
                    'name' => $elemento['name'] ?? '',
                    'fileType' => $elemento['fileType'] ?? '',
                    'width' => $elemento['width'] ?? 600,
                    'height' => $elemento['height'] ?? 800,
                    'rotation' => $elemento['rotation'] ?? 0,
                    'opacity' => $elemento['opacity'] ?? 100,
                    'scale' => $elemento['scale'] ?? 100,
                    'flipScale' => $elemento['flipScale'] ?? ['x' => 1, 'y' => 1],
                    'annotations' => $elemento['annotations'] ?? []
                ];
                break;
                
            default:
                // Tipo no reconocido, saltar
                continue 2;
        }
        
        // VERIFICAR SI EL ELEMENTO EXISTE O ES NUEVO
        $elementoExiste = isset($elemento['id']) && isset($elementosExistentesMap[$elemento['id']]);
        
        if ($elementoExiste) {
            // ACTUALIZAR ELEMENTO EXISTENTE
            $this->actualizarElementoExistente(
                $elemento['id'],
                $tipo_bd,
                $contenido,
                json_encode($datos_json),
                $elemento['x'] ?? 0,
                $elemento['y'] ?? 0,
                $elemento['layer'] ?? 0
            );
        } else {
            // INSERTAR NUEVO ELEMENTO
            $db->guardarElemento(
                $data['projectId'],
                $tipo_bd,
                $contenido,
                json_encode($datos_json),
                $elemento['x'] ?? 0,
                $elemento['y'] ?? 0,
                $elemento['layer'] ?? 0
            );
        }
    }

    echo json_encode(['success' => true]);
} catch (Exception $e) {
    error_log("Error en save_project.php: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Error del servidor: ' . $e->getMessage()]);
}

// Función para actualizar elemento existente
function actualizarElementoExistente($elemento_id, $tipo, $contenido, $datos_json, $x, $y, $capa) {
    global $conexion;
    
    if ($contenido === null) {
        // Actualizar sin contenido BLOB
        $sql = "UPDATE elementos_proyecto SET tipo = ?, datos_json = ?, ubicacion_x = ?, ubicacion_y = ?, capa = ? WHERE id = ?";
        $stmt = $conexion->prepare($sql);
        $stmt->bind_param("ssddis", $tipo, $datos_json, $x, $y, $capa, $elemento_id);
    } else {
        // Actualizar con contenido BLOB
        $sql = "UPDATE elementos_proyecto SET tipo = ?, contenido = ?, datos_json = ?, ubicacion_x = ?, ubicacion_y = ?, capa = ? WHERE id = ?";
        $stmt = $conexion->prepare($sql);
        $stmt->bind_param("ssssdis", $tipo, $contenido, $datos_json, $x, $y, $capa, $elemento_id);
    }
    
    return $stmt->execute();
}
?>
