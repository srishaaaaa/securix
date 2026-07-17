import { Link, useNavigate } from "react-router-dom";
import { ShieldCheck, LogOut, LayoutDashboard, ScanFace } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-void-900/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-glow/20 to-signal-emerald/10 ring-1 ring-cyan-glow/30">
            <ShieldCheck className="h-4.5 w-4.5 text-cyan-glow" strokeWidth={2.2} />
          </div>
          <span className="font-display text-lg font-semibold tracking-tight text-ink-100">
            SECURI<span className="text-cyan-glow">X</span>
          </span>
        </Link>

        <nav className="flex items-center gap-2">
          {user ? (
            <>
              <Link
                to={user.role === "admin" ? "/admin" : "/dashboard"}
                className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium text-ink-300 transition hover:text-ink-100"
              >
                <LayoutDashboard className="h-4 w-4" />
                {user.role === "admin" ? "Admin console" : "Dashboard"}
              </Link>
              {user.role !== "admin" && (
                <Link
                  to="/verify"
                  className="flex items-center gap-1.5 rounded-lg bg-cyan-glow/10 px-3.5 py-2 text-sm font-medium text-cyan-glow ring-1 ring-cyan-glow/25 transition hover:bg-cyan-glow/15"
                >
                  <ScanFace className="h-4 w-4" />
                  Verify identity
                </Link>
              )}
              <button
                onClick={() => {
                  logout();
                  navigate("/");
                }}
                className="ml-1 flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-500 transition hover:text-signal-crimson"
                title="Log out"
              >
                <LogOut className="h-4 w-4" />
              </button>
              <div className="ml-1 hidden items-center gap-2 rounded-lg border border-white/[0.06] px-3 py-1.5 sm:flex">
                <div className="h-1.5 w-1.5 rounded-full bg-signal-emerald shadow-[0_0_6px_#34d399]" />
                <span className="font-mono text-xs text-ink-300">{user.full_name}</span>
              </div>
            </>
          ) : (
            <>
              <Link to="/login" className="rounded-lg px-3.5 py-2 text-sm font-medium text-ink-300 transition hover:text-ink-100">
                Log in
              </Link>
              <Link
                to="/register"
                className="rounded-lg bg-cyan-glow px-4 py-2 text-sm font-semibold text-void-950 shadow-glow transition hover:bg-cyan-glow/90"
              >
                Get verified
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
