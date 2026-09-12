'use client';
export default function ErrorBoundary({reset}:{reset:()=>void}){return <main className="auth-page" id="main"><h1>A brief interruption.</h1><p>We couldn’t load this page. You can retry safely; reservations and credits are stored on the server.</p><button onClick={reset} className="button primary">Try again</button></main>;}
