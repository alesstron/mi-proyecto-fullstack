/**
 * Valida params, query y body con esquemas Zod.
 * Los datos limpios quedan en req.valid (en Express 5 req.query es de solo lectura).
 * Un ZodError llega al manejador central y se convierte en 400.
 */
export const validate = schemas => (req, _res, next) => {
  const valid = {};
  for (const key of ['params', 'query', 'body']) {
    if (!schemas[key]) continue;
    const result = schemas[key].safeParse(req[key] ?? {});
    if (!result.success) return next(result.error);
    valid[key] = result.data;
  }
  req.valid = valid;
  next();
};
