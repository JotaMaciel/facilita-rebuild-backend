export function validateProductionConfig(env = process.env) {
  if (env.NODE_ENV !== 'production') return true;
  const errors = [];
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 48 || /SUBSTITUA|CHANGE_ME|test|local/i.test(env.JWT_SECRET)) errors.push('JWT_SECRET deve ser uma chave forte de produção');
  if (!env.DATABASE_URL?.startsWith('mysql://')) errors.push('DATABASE_URL precisa apontar para MySQL');
  const origins = (env.FRONTEND_URL || '').split(',').map(x=>x.trim()).filter(Boolean);
  if (!origins.length || origins.some(origin => {
    try { const url = new URL(origin); return url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash; }
    catch { return true; }
  })) errors.push('FRONTEND_URL precisa conter apenas origens HTTPS válidas');
  if (env.DEV_PASSWORD_RESET_LOG === 'true') errors.push('DEV_PASSWORD_RESET_LOG não pode ser habilitado em produção');
  if (errors.length) throw new Error('Configuração de produção inválida: ' + errors.join('; '));
  return true;
}
