import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, useMotionValueEvent, useScroll } from "framer-motion";
import { LogOut, LayoutDashboard, ScanFace, ArrowUpRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import Cursor from "./Cursor";

/** The SECURIX mark: an iris ring around a verified core. */
export function Logo({ className = "h-8 w-8" }) {
  return (
    <span className={`relative inline-flex items-center justify-center ${className}`}>
      <svg viewBox="0 0 32 32" className="h-full w-full" fill="none">
        <circle cx="16" cy="16" r="14.5" stroke="url(#lg)" strokeWidth="1.2" />
        <circle cx="16" cy="16" r="9.5" stroke="rgba(238,240,246,0.35)" strokeWidth="1" strokeDasharray="2 2.6" />
        <circle cx="16" cy="16" r="4.2" fill="url(#lg)" />
        <path d="M16 1.5v4M16 26.5v4M1.5 16h4M26.5 16h4" stroke="rgba(238,240,246,0.5)" strokeWidth="1" />
        <defs>
          <linearGradient id="lg" x1="0" y1="0" x2="32" y2="32">
            <stop stopColor="#9db0ff" />
            <stop offset="1" stopColor="#8d6bff" />
          </linearGradient>
        </defs>
      </svg>
    </span>
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);

  // only flips at the threshold - no per-pixel re-renders
  useMotionValueEvent(scrollY, "change", (v) => {
    const next = v > 24;
    if (next !== scrolled) setScrolled(next);
  });

  const isActive = (path) => location.pathname.startsWith(path);
  const navLink =
    "relative flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-medium transition-colors sm:px-3.5";

  return (
    <>
      <Cursor />
      <header className="no-print sticky top-0 z-50 px-3 pt-3 sm:px-5 sm:pt-4">
        <motion.div
          initial={{ y: -24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className={`mx-auto flex max-w-6xl items-center justify-between rounded-full border pl-3 pr-1.5 transition-all duration-500 sm:pl-4 ${
            scrolled
              ? "border-white/[0.09] bg-void-900/80 py-1.5 shadow-[0_18px_50px_-20px_rgba(0,0,0,0.9)] backdrop-blur-2xl"
              : "border-white/[0.06] bg-void-900/40 py-2 backdrop-blur-xl"
          }`}
        >
          <Link to="/" className="group flex items-center gap-2.5 py-1" aria-label="Securix home">
            <Logo className="h-7 w-7 transition-transform duration-700 group-hover:rotate-90" />
            <span className="font-display text-[15px] font-semibold tracking-[0.18em] text-ink-50">SECURIX</span>
          </Link>

          <nav className="flex items-center gap-0.5 sm:gap-1">
            {user ? (
              <>
                <Link
                  to={user.role === "admin" ? "/admin" : "/dashboard"}
                  className={`${navLink} ${
                    isActive(user.role === "admin" ? "/admin" : "/dashboard") ? "bg-white/[0.07] text-ink-50" : "text-ink-300 hover:text-ink-50"
                  }`}
                >
                  <LayoutDashboard className="h-4 w-4" />
                  <span className="hidden sm:inline">{user.role === "admin" ? "Console" : "Dashboard"}</span>
                </Link>
                {user.role !== "admin" && (
                  <Link
                    to="/verify"
                    className={`${navLink} ${isActive("/verify") ? "bg-accent/15 text-accent-soft" : "text-ink-300 hover:text-ink-50"}`}
                  >
                    <ScanFace className="h-4 w-4" />
                    <span className="hidden sm:inline">Verify identity</span>
                  </Link>
                )}
                <div className="mx-1 hidden h-5 w-px bg-white/[0.08] md:block" />
                <div className="hidden items-center gap-2 rounded-full py-1 pl-1 pr-2.5 md:flex">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-accent/40 to-violet/40 text-[11px] font-semibold text-ink-50 ring-1 ring-white/10">
                    {user.full_name?.[0]?.toUpperCase() || "U"}
                  </div>
                  <span className="max-w-[140px] truncate text-xs font-medium text-ink-300">{user.full_name}</span>
                </div>
                <button
                  onClick={() => {
                    logout();
                    navigate("/");
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-ink-500 transition hover:bg-signal-crimson/10 hover:text-signal-crimson"
                  title="Log out"
                  aria-label="Log out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className={`${navLink} text-ink-300 hover:text-ink-50`}>
                  Log in
                </Link>
                <Link to="/register" className="btn btn-light btn-sm ml-1">
                  Get verified <ArrowUpRight className="btn-arrow h-3.5 w-3.5" />
                </Link>
              </>
            )}
          </nav>
        </motion.div>
      </header>
    </>
  );
}
