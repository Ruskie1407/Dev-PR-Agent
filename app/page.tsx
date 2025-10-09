export default function Home() {
  return (
    <main style={{padding:24,fontFamily:"system-ui"}}>
      <h1>Dev PR Agent</h1>
      <p>Deployment OK ✅</p>
      <ul>
        <li><a href="/dashboard">Dashboard</a></li>
        <li><a href="/api/status">API Status (JSON)</a></li>
        <li><a href="/api/health">Health</a></li>
        <li><a href="/api/webhook">Webhook (GET=405)</a></li>
      </ul>
    </main>
  );
}
