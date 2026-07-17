const jwt = require('jsonwebtoken');

// Solo para /api/uploads: los links de descarga son <a href>, que no puede mandar
// headers, así que aquí (y únicamente aquí) se acepta el token por query string.
module.exports = (req, res, next) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.split(' ')[1] : req.query.token;
  if (!token) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' });
  }
};
