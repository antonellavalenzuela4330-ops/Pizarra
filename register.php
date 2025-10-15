<?php
session_start();
include("includes/conexion.php");

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $nombre = $_POST["nombre"];
    $email = $_POST["email"];
    $password = password_hash($_POST["password"], PASSWORD_BCRYPT);

    // 1. Primero verifica si el email ya existe
    $sql_check = "SELECT id FROM usuarios WHERE email = ?";
    $stmt = $conexion->prepare($sql_check);
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows > 0) {
        $_SESSION["error"] = "El email ya está registrado. ¿Quieres <a href='login.php'>iniciar sesión</a>?";
        header("Location: register.php");
        exit;
    }

    // 2. Si no existe, inserta el nuevo usuario
    $sql = "INSERT INTO usuarios (nombre, email, password) VALUES (?, ?, ?)";
    $stmt = $conexion->prepare($sql);
    $stmt->bind_param("sss", $nombre, $email, $password);
    
    if ($stmt->execute()) {
        $_SESSION["mensaje"] = "¡Registro exitoso! Ahora puedes iniciar sesión.";
        header("Location: login.php");
        exit;
    } else {
        $_SESSION["error"] = "Error al registrar: " . $conexion->error;
        header("Location: register.php");
        exit;
    }
}

// Mostrar mensajes de sesión
$error = isset($_SESSION['error']) ? $_SESSION['error'] : '';
$mensaje = isset($_SESSION['mensaje']) ? $_SESSION['mensaje'] : '';
unset($_SESSION['error']);
unset($_SESSION['mensaje']);
?>

<!DOCTYPE html>
<html>
<head>
    <title>Registro</title>
    <link rel="stylesheet" href="css/styles.css">
</head>
<body>
    <div class="register-container">
        <?php if (!empty($mensaje)): ?>
            <div class="success"><?php echo $mensaje; ?></div>
        <?php endif; ?>
        
        <?php if (!empty($error)): ?>
            <div class="error"><?php echo $error; ?></div>
        <?php endif; ?>
        
        <form method="POST" action="">
            <h2>Regístrate</h2>
            <input type="text" name="nombre" placeholder="Nombre completo" required>
            <input type="email" name="email" placeholder="Correo electrónico" required>
            <input type="password" name="password" placeholder="Contraseña" required>
            <button type="submit">Registrarse</button>
            <p>¿Ya tienes cuenta? <a href="login.php">Inicia sesión</a></p>
        </form>
    </div>
</body>
</html>