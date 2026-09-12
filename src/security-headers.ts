export function securityHeaders(development=false):Record<string,string>{
  return {
    'X-Content-Type-Options':'nosniff',
    'Referrer-Policy':'strict-origin-when-cross-origin',
    'X-Frame-Options':'DENY',
    'Permissions-Policy':'camera=(), microphone=(), geolocation=(), payment=()',
    'Content-Security-Policy':`default-src 'self'; script-src 'self' 'unsafe-inline'${development?" 'unsafe-eval'":''}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://*.supabase.co${development?' ws://localhost:* ws://127.0.0.1:*':''}; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'`,
    ...(development?{}:{'Strict-Transport-Security':'max-age=31536000'})
  };
}
