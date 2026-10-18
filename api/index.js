// Punto de entrada serverless de Vercel: reutiliza la misma app Express que en local.
import { createApp } from '../server/src/app.js';

export default createApp();
