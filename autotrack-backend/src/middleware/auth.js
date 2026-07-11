const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const header = req.headers.authorization;
  // Las descargas de archivos usan <a href>, que no puede enviar headers → token por query
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
