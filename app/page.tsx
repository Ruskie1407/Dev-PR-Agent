export default function Home() {
  return (
    <main style={{padding:24,fontFamily:"system-ui"}}>
      <h1>Dev PR Agent</h1>
      <p>Deployment OK ✅</p>
      <ul>
        <li><a href="/api/health">API Health Check</a></li>
        <li><a href="/api/webhook">Webhook (POST only)</a></li>
      </ul>
    </main>
  );
}
