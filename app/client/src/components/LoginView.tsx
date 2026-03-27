import { useState } from 'react';

export default function LoginView({ onLogin }: { onLogin: (username: string, password: string) => Promise<void> }) {
  const [username, setUsername] = useState('Haby');
  const [password, setPassword] = useState('Haby');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onLogin(username, password);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-shell">
      <form className="login-card" onSubmit={submit}>
        <h1>Haby</h1>
        <p>Track habits, goals, widgets, and progress in one place.</p>
        <label>Username<input value={username} onChange={(e) => setUsername(e.target.value)} /></label>
        <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        {error ? <div className="error-box">{error}</div> : null}
        <button className="primary-btn" disabled={loading}>{loading ? 'Signing in...' : 'Sign in'}</button>
        <small>Default first-run account: Haby / Haby</small>
      </form>
    </div>
  );
}
