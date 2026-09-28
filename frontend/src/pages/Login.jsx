import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import AuthLayout from "../components/story/AuthLayout";

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
    <AuthLayout
      eyebrow="Secure session"
      lines={["Welcome", <span key="b" className="text-gradient">back.</span>]}
      sub="Log in to continue your verification."
    >
      <form onSubmit={submit} className="glass-panel rounded-[1.75rem] p-6 sm:p-8">
        <div className="mb-7 flex items-center justify-between">
          <span className="eyebrow">Log in</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-700">01 / 01</span>
        </div>

        {error && (
          <div role="alert" className="alert-danger mb-5">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <label htmlFor="login-email" className="field-label">Email</label>
        <input
          id="login-email"
          type="email"
          required
          autoComplete="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder="you@example.com"
          className="field mb-5"
        />

        <label htmlFor="login-password" className="field-label">Password</label>
        <input
          id="login-password"
          type="password"
          required
          autoComplete="current-password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          placeholder="••••••••"
          className="field mb-7"
        />

        <button type="submit" disabled={loading} className="btn btn-light w-full py-3.5">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {loading ? "Signing in…" : "Log in"}
          {!loading && <ArrowRight className="btn-arrow h-4 w-4" />}
        </button>

        <p className="mt-6 rounded-xl border border-dashed border-white/[0.08] px-4 py-3 text-center text-xs text-ink-500">
          Demo admin: <span className="font-mono text-ink-300">admin@securix.io</span> / <span className="font-mono text-ink-300">Admin@123</span>
        </p>
      </form>

      <p className="mt-6 text-center text-sm text-ink-500">
        New here?{" "}
        <Link to="/register" className="font-medium text-ink-100 underline decoration-white/20 underline-offset-4 transition hover:decoration-accent-soft">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
}
