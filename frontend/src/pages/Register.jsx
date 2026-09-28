import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import AuthLayout from "../components/story/AuthLayout";

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
    <AuthLayout
      eyebrow="New identity"
      lines={["Create your", <span key="b" className="text-gradient">identity.</span>]}
      sub="One minute to register, two to get verified."
    >
      <form onSubmit={submit} className="glass-panel rounded-[1.75rem] p-6 sm:p-8">
        <div className="mb-7 flex items-center justify-between">
          <span className="eyebrow">Create account</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-700">Step 00</span>
        </div>

        {error && (
          <div role="alert" className="alert-danger mb-5">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <label htmlFor="reg-name" className="field-label">Full name</label>
        <input
          id="reg-name"
          required
          autoComplete="name"
          value={form.full_name}
          onChange={update("full_name")}
          placeholder="Rohan Sharma"
          className="field mb-5"
        />

        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <div>
            <label htmlFor="reg-email" className="field-label">Email</label>
            <input
              id="reg-email"
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={update("email")}
              placeholder="you@example.com"
              className="field mb-5"
            />
          </div>
          <div>
            <label htmlFor="reg-mobile" className="field-label">Mobile number</label>
            <input
              id="reg-mobile"
              required
              autoComplete="tel"
              inputMode="tel"
              value={form.mobile}
              onChange={update("mobile")}
              placeholder="9876543210"
              className="field mb-5"
            />
          </div>
        </div>

        <label htmlFor="reg-password" className="field-label">Password</label>
        <input
          id="reg-password"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          value={form.password}
          onChange={update("password")}
          placeholder="At least 6 characters"
          className="field mb-7"
        />

        <button type="submit" disabled={loading} className="btn btn-light w-full py-3.5">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {loading ? "Creating account…" : "Create account"}
          {!loading && <ArrowRight className="btn-arrow h-4 w-4" />}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-500">
        Already registered?{" "}
        <Link to="/login" className="font-medium text-ink-100 underline decoration-white/20 underline-offset-4 transition hover:decoration-accent-soft">
          Log in
        </Link>
      </p>
    </AuthLayout>
  );
}
