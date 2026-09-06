import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShieldCheck, ArrowRight, AlertCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: "", email: "", mobile: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const update = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(form);
      navigate("/verify");
    } catch (err) {
      setError(err?.response?.data?.detail || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-[85vh] items-center justify-center px-6 py-16">
      <div className="pointer-events-none absolute inset-0 bg-aurora" />
      <div className="relative w-full max-w-md animate-fadeUp">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-violet shadow-glow">
            <ShieldCheck className="h-6 w-6 text-white" />
          </div>
          <h1 className="font-display text-2xl font-semibold text-ink-100">Create your account</h1>
          <p className="mt-1.5 text-sm text-ink-300">One minute to register, two to get verified.</p>
        </div>

        <form onSubmit={submit} className="rounded-2xl glass-panel p-7 shadow-soft-lg">
          {error && (
            <div className="mb-5 flex items-start gap-2 rounded-lg bg-signal-crimson/10 px-3.5 py-2.5 text-sm text-signal-crimson ring-1 ring-inset ring-signal-crimson/20">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <label className="mb-1.5 block text-xs font-medium text-ink-500">Full name</label>
          <input
            required
            value={form.full_name}
            onChange={update("full_name")}
            placeholder="Rohan Sharma"
            className="mb-5 w-full rounded-lg border border-white/[0.08] bg-void-800 px-3.5 py-2.5 text-sm text-ink-100 placeholder:text-ink-700 outline-none transition focus:border-accent/50"
          />

          <label className="mb-1.5 block text-xs font-medium text-ink-500">Email</label>
          <input
            type="email"
            required
            value={form.email}
            onChange={update("email")}
            placeholder="you@example.com"
            className="mb-5 w-full rounded-lg border border-white/[0.08] bg-void-800 px-3.5 py-2.5 text-sm text-ink-100 placeholder:text-ink-700 outline-none transition focus:border-accent/50"
          />

          <label className="mb-1.5 block text-xs font-medium text-ink-500">Mobile number</label>
          <input
            required
            value={form.mobile}
            onChange={update("mobile")}
            placeholder="9876543210"
            className="mb-5 w-full rounded-lg border border-white/[0.08] bg-void-800 px-3.5 py-2.5 text-sm text-ink-100 placeholder:text-ink-700 outline-none transition focus:border-accent/50"
          />

          <label className="mb-1.5 block text-xs font-medium text-ink-500">Password</label>
          <input
            type="password"
            required
            minLength={6}
            value={form.password}
            onChange={update("password")}
            placeholder="At least 6 characters"
            className="mb-6 w-full rounded-lg border border-white/[0.08] bg-void-800 px-3.5 py-2.5 text-sm text-ink-100 placeholder:text-ink-700 outline-none transition focus:border-accent/50"
          />

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-accent to-violet px-4 py-3 text-sm font-semibold text-white shadow-glow transition hover:brightness-110 disabled:opacity-60"
          >
            {loading ? "Creating account…" : "Create account"}
            {!loading && <ArrowRight className="h-4 w-4" />}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-ink-500">
          Already registered?{" "}
          <Link to="/login" className="font-medium text-accent-soft hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
