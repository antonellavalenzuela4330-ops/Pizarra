<?php
session_start();
include("includes/conexion.php");

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $nombre_usuario = $_POST["nombre_usuario"];
    $email = $_POST["email"];
    $contraseña = password_hash($_POST["contraseña"], PASSWORD_BCRYPT);

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
    $sql = "INSERT INTO usuarios (nombre_usuario, email, contraseña) VALUES (?, ?, ?)";
    $stmt = $conexion->prepare($sql);
    $stmt->bind_param("sss", $nombre_usuario, $email, $contraseña);
    
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
    <link rel="stylesheet" href="styles.css">
    <link rel="stylesheet" href="auth.css">
</head>
<body>
    <div class="auth-container">
        <div class="auth-box">
            <img src="img/logo2.png" alt="Logo" class="auth-logo">
            <h2>Regístrate</h2>

            <?php if (!empty($mensaje)): ?>
                <div class="success-message"><?php echo $mensaje; ?></div>
            <?php endif; ?>
            
            <?php if (!empty($error)): ?>
                <div class="error-message"><?php echo $error; ?></div>
            <?php endif; ?>
            
            <form method="POST" action="">
                <div class="input-group">
                    <input type="text" name="nombre_usuario" placeholder="Nombre de usuario" required>
                </div>
                <div class="input-group">
                    <input type="email" name="email" placeholder="Correo electrónico" required>
                </div>
                <div class="input-group">
                    <input type="password" name="contraseña" placeholder="Contraseña" required>
                </div>
                <button type="submit">Registrarse</button>
            </form>
            <p class="auth-switch">¿Ya tienes cuenta? <a href="login.php">Inicia sesión</a></p>
        </div>
    </div>
</body>
</html>

