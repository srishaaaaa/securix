import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShieldCheck, ArrowRight, AlertCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      navigate(user.role === "admin" ? "/admin" : "/dashboard");
    } catch (err) {
      setError(err?.response?.data?.detail || "Login failed. Check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-[85vh] items-center justify-center px-6 py-16">
      <div className="pointer-events-none absolute inset-0 bg-grid-fade" />
      <div className="relative w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-glow/10 ring-1 ring-cyan-glow/25">
            <ShieldCheck className="h-6 w-6 text-cyan-glow" />
          </div>
          <h1 className="font-display text-2xl font-semibold text-ink-100">Welcome back</h1>
          <p className="mt-1.5 text-sm text-ink-300">Log in to continue your verification.</p>
        </div>

        <form onSubmit={submit} className="rounded-2xl glass-panel p-7">
          {error && (
            <div className="mb-5 flex items-start gap-2 rounded-lg bg-signal-crimson/10 px-3.5 py-2.5 text-sm text-signal-crimson ring-1 ring-signal-crimson/20">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-ink-500">Email</label>
          <input
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="you@example.com"
            className="mb-5 w-full rounded-lg border border-white/[0.08] bg-void-800 px-3.5 py-2.5 text-sm text-ink-100 placeholder:text-ink-500 outline-none transition focus:border-cyan-glow/50"
          />

          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-ink-500">Password</label>
          <input
            type="password"
            required
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="••••••••"
            className="mb-6 w-full rounded-lg border border-white/[0.08] bg-void-800 px-3.5 py-2.5 text-sm text-ink-100 placeholder:text-ink-500 outline-none transition focus:border-cyan-glow/50"
          />

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-glow px-4 py-3 text-sm font-semibold text-void-950 shadow-glow transition hover:bg-cyan-glow/90 disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Log in"}
            {!loading && <ArrowRight className="h-4 w-4" />}
          </button>

          <p className="mt-5 text-center text-xs text-ink-500">
            Demo admin: <span className="font-mono text-ink-300">admin@securix.io</span> / <span className="font-mono text-ink-300">Admin@123</span>
          </p>
        </form>

        <p className="mt-6 text-center text-sm text-ink-500">
          New here?{" "}
          <Link to="/register" className="font-medium text-cyan-glow hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
