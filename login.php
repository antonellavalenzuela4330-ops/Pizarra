<?php
session_start();
include("includes/conexion.php");

// Procesar el formulario si se envió
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $email = $_POST["email"];
    $password = $_POST["password"];

    // Usar prepared statements para evitar SQL injection
    $stmt = $conexion->prepare("SELECT id, nombre_usuario, contraseña FROM usuarios WHERE email = ?");
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result && $result->num_rows > 0) {
        $usuario = $result->fetch_assoc();
        if (password_verify($password, $usuario["contraseña"])) {
            $_SESSION["usuario_id"] = $usuario["id"];
            $_SESSION["usuario_nombre"] = $usuario["nombre_usuario"];
            
            // Actualizar último login
            $update_stmt = $conexion->prepare("UPDATE usuarios SET ultimo_login = NOW() WHERE id = ?");
            $update_stmt->bind_param("i", $usuario["id"]);
            $update_stmt->execute();
            
            header("Location: index.php");
            exit;
        } else {
            $error = "Contraseña incorrecta";
        }
    } else {
        $error = "Usuario no encontrado";
    }
}
?>

<!DOCTYPE html>
<html>
<head>
    <title>Iniciar Sesión</title>
    <link rel="stylesheet" href="css/styles.css">
</head>
<body>
    <div class="login-container">
        <?php if (isset($error)): ?>
            <div class="error"><?php echo $error; ?></div>
        <?php endif; ?>
        
        <form method="POST" action="">
            <h2>Iniciar Sesión</h2>
            <input type="email" name="email" placeholder="Correo electrónico" required>
            <input type="password" name="password" placeholder="Contraseña" required>
            <button type="submit">Entrar</button>
            <p>¿No tienes cuenta? <a href="register.php">Regístrate aquí</a></p>
        </form>
    </div>
</body>
</html>

