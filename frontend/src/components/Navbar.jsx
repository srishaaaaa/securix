import { Link, useNavigate } from "react-router-dom";
import { ShieldCheck, LogOut, LayoutDashboard, ScanFace } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-void-900/75 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5">
        <Link to="/" className="group flex items-center gap-2.5">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-violet shadow-glow">
            <ShieldCheck className="h-4.5 w-4.5 text-white" strokeWidth={2.2} />
          </div>
          <span className="font-display text-lg font-semibold tracking-tight text-ink-100">
            Securix
          </span>
        </Link>

        <nav className="flex items-center gap-1.5">
          {user ? (
            <>
              <Link
                to={user.role === "admin" ? "/admin" : "/dashboard"}
                className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium text-ink-300 transition hover:bg-white/[0.04] hover:text-ink-100"
              >
                <LayoutDashboard className="h-4 w-4" />
                {user.role === "admin" ? "Console" : "Dashboard"}
              </Link>
              {user.role !== "admin" && (
                <Link
                  to="/verify"
                  className="flex items-center gap-1.5 rounded-lg bg-accent/10 px-3.5 py-2 text-sm font-medium text-accent-soft ring-1 ring-inset ring-accent/25 transition hover:bg-accent/15"
                >
                  <ScanFace className="h-4 w-4" />
                  Verify identity
                </Link>
              )}
              <div className="mx-1 hidden h-6 w-px bg-white/[0.08] sm:block" />
              <div className="hidden items-center gap-2 rounded-lg px-2.5 py-1.5 sm:flex">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/[0.06] text-[11px] font-semibold text-ink-100">
                  {user.full_name?.[0]?.toUpperCase() || "U"}
                </div>
                <span className="max-w-[140px] truncate text-xs font-medium text-ink-300">{user.full_name}</span>
              </div>
              <button
                onClick={() => {
                  logout();
                  navigate("/");
                }}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-ink-500 transition hover:bg-white/[0.04] hover:text-signal-crimson"
                title="Log out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="rounded-lg px-3.5 py-2 text-sm font-medium text-ink-300 transition hover:text-ink-100">
                Log in
              </Link>
              <Link
                to="/register"
                className="rounded-lg bg-gradient-to-r from-accent to-violet px-4 py-2 text-sm font-semibold text-white shadow-glow transition hover:brightness-110"
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
