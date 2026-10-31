export async function sendRecoveryEmail({ to, token }) {
  const key = process.env.RESEND_API_KEY;
  const sender = process.env.RESET_EMAIL_FROM;
  const origin = process.env.FRONTEND_URL?.split(',')[0]?.trim();
  if (!key || !sender || !origin) return false;
  const url = new URL(origin);
  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') throw new Error('FRONTEND_URL requer HTTPS em produção');
  url.searchParams.set('reset_token', token);
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: sender,
      to: [to],
      subject: 'Facilita — recuperação de senha',
      text: 'Foi solicitada a redefinição de sua senha. O link vence em 15 minutos: ' + url.toString() + '\nSe não foi você, ignore esta mensagem.',
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error('Falha no provedor de e-mail: HTTP ' + response.status);
  return true;
}
