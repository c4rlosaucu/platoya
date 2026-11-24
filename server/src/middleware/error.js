export function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err?.type === "entity.too.large") {
    res.status(413).json({
      error: { code: "VALIDATION_ERROR", message: "La solicitud es demasiado grande" },
    });
    return;
  }

  if (err instanceof SyntaxError && err.status === 400) {
    res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "El cuerpo no es JSON válido" },
    });
    return;
  }

  const status = err.status || 500;
  const code = err.code || "INTERNAL";
  let message = err.message || "Error interno";

  if (status >= 500) {
    console.error(err.name || "Error", status);
    if (process.env.NODE_ENV === "production") message = "Error interno";
  }

  res.status(status).json({ error: { code, message } });
}
