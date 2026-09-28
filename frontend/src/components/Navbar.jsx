import { useEffect, useId, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "framer-motion";
import { LogOut, LayoutDashboard, ScanFace, ArrowUpRight, X, LogIn, UserPlus, Activity, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import Cursor from "./Cursor";
import Atmosphere from "./Atmosphere";

/** The SECURIX mark: an iris ring around a verified core. */
export function Logo({ className = "h-8 w-8" }) {
  // unique gradient id: several logos can be mounted at once (sidebar + top bar)
  const gid = `lg${useId().replace(/:/g, "")}`;
  return (
    <span className={`relative inline-flex items-center justify-center ${className}`}>
      <svg viewBox="0 0 32 32" className="h-full w-full" fill="none">
        <circle cx="16" cy="16" r="14.5" stroke={`url(#${gid})`} strokeWidth="1.2" />
        <circle cx="16" cy="16" r="9.5" stroke="rgba(7,8,13,0.35)" strokeWidth="1" strokeDasharray="2 2.6" />
        <circle cx="16" cy="16" r="4.2" fill={`url(#${gid})`} />
        <path d="M16 1.5v4M16 26.5v4M1.5 16h4M26.5 16h4" stroke="rgba(7,8,13,0.5)" strokeWidth="1" />
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="32" y2="32">
            <stop stopColor="#3d3dff" />
            <stop offset="1" stopColor="#8d6bff" />
          </linearGradient>
        </defs>
      </svg>
    </span>
  );
}

function PublicNav() {
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

  const [menuOpen, setMenuOpen] = useState(false);

  // mobile menu: close on navigation / Escape, lock page scroll while open
  useEffect(() => setMenuOpen(false), [location.pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  const isActive = (path) => location.pathname.startsWith(path);
  const navLink =
    "relative flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-medium transition-colors sm:px-3.5";

  return (
    <>
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

          <nav className="hidden items-center gap-1 sm:flex">
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

          {/* phone: SECURIX · MENU */}
          <button
            onClick={() => setMenuOpen(true)}
            className="flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.22em] text-ink-100 sm:hidden"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
          >
            Menu <span className="flex flex-col gap-[3px]"><span className="block h-px w-3.5 bg-ink-100" /><span className="block h-px w-2.5 bg-ink-100" /></span>
          </button>
        </motion.div>
      </header>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            id="mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="no-print fixed inset-0 z-[80] flex flex-col bg-void-950/85 px-5 pb-safe pt-safe backdrop-blur-2xl sm:hidden"
          >
            <div className="flex items-center justify-between py-3">
              <span className="flex items-center gap-2.5">
                <Logo className="h-7 w-7" />
                <span className="font-display text-[15px] font-semibold tracking-[0.18em] text-ink-50">SECURIX</span>
              </span>
              <button onClick={() => setMenuOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-ink-100" aria-label="Close menu">
                <X className="h-4 w-4" />
              </button>
            </div>
            <span className="mt-6 font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500">SECURIX / Identity engine</span>
            <motion.ul
              className="mt-6 flex flex-col"
              initial="h"
              animate="s"
              variants={{ s: { transition: { staggerChildren: 0.06, delayChildren: 0.08 } } }}
            >
              {(user
                ? [
                    { to: user.role === "admin" ? "/admin" : "/dashboard", label: user.role === "admin" ? "Console" : "Dashboard", Icon: LayoutDashboard },
                    ...(user.role !== "admin" ? [{ to: "/verify", label: "Verify identity", Icon: ScanFace }] : []),
                  ]
                : [
                    { to: "/login", label: "Log in", Icon: LogIn },
                    { to: "/register", label: "Get verified", Icon: UserPlus },
                  ]
              ).map(({ to, label, Icon }, i) => (
                <motion.li
                  key={to}
                  variants={{ h: { opacity: 0, y: 24, filter: "blur(6px)" }, s: { opacity: 1, y: 0, filter: "blur(0px)" } }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  className="border-b border-white/[0.07]"
                >
                  <Link to={to} className="flex items-center justify-between py-5">
                    <span className="flex items-baseline gap-4">
                      <span className="font-mono text-[11px] text-ink-700">0{i + 1}</span>
                      <span className="font-display text-4xl font-semibold uppercase tracking-tight text-ink-50">{label}</span>
                    </span>
                    <Icon className="h-5 w-5 text-ink-500" />
                  </Link>
                </motion.li>
              ))}
            </motion.ul>
            <div className="mt-auto flex items-center justify-between border-t border-white/[0.07] pt-5">
              {user ? (
                <>
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent/40 to-violet/40 text-xs font-semibold text-ink-50">
                      {user.full_name?.[0]?.toUpperCase() || "U"}
                    </span>
                    <span className="truncate text-sm text-ink-300">{user.full_name}</span>
                  </span>
                  <button
                    onClick={() => {
                      logout();
                      navigate("/");
                    }}
                    className="flex items-center gap-2 rounded-full border border-signal-crimson/30 px-4 py-2 text-sm text-signal-crimson"
                    aria-label="Log out"
                  >
                    <LogOut className="h-4 w-4" /> Log out
                  </button>
                </>
              ) : (
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-700">System status / online</span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Dashboard-first app shell for the signed-in routes                  */
/* ------------------------------------------------------------------ */

const PUBLIC_ROUTES = ["/", "/login", "/register"];

function AppNav() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isActive = (path) => location.pathname.startsWith(path);

  const items = [
    { to: user.role === "admin" ? "/admin" : "/dashboard", label: user.role === "admin" ? "Console" : "Dashboard", Icon: LayoutDashboard },
    ...(user.role !== "admin" ? [{ to: "/verify", label: "Verify identity", Icon: ScanFace }] : []),
  ];
  const doLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <>
      {/* laptop / desktop: fixed sidebar */}
      <aside className="app-sidebar no-print fixed inset-y-0 left-0 z-50 hidden w-[16rem] flex-col border-r border-white/[0.08] bg-paper/80 px-4 py-5 backdrop-blur-xl lg:flex">
        <Link to="/" className="group flex items-center gap-2.5 px-2" aria-label="Securix home">
          <Logo className="h-8 w-8 transition-transform duration-700 group-hover:rotate-90" />
          <span className="font-display text-[15px] font-semibold tracking-[0.18em] text-ink-50">SECURIX</span>
        </Link>
        <span className="mt-2 px-2 font-mono text-[9.5px] uppercase tracking-[0.22em] text-ink-500">Identity intelligence</span>

        <nav className="mt-8 flex flex-col gap-1" aria-label="App">
          <span className="mb-1 px-3 font-mono text-[9.5px] uppercase tracking-[0.22em] text-ink-700">Workspace</span>
          {items.map(({ to, label, Icon }) => {
            const on = isActive(to);
            return (
              <Link
                key={to}
                to={to}
                className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  on ? "bg-ink-50 text-paper" : "text-ink-300 hover:bg-white/[0.05] hover:text-ink-50"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
                {on && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_10px_#3d3dff]" />}
              </Link>
            );
          })}
        </nav>

        <div className="mt-8 rounded-2xl border border-white/[0.08] bg-paper p-4">
          <div className="flex items-center gap-2 font-mono text-[9.5px] uppercase tracking-[0.2em] text-ink-500">
            <Activity className="h-3.5 w-3.5 text-accent" /> System status
          </div>
          <ul className="mt-3 space-y-2 text-xs text-ink-300">
            {["Risk engine", "Biometric core", "Fraud graph"].map((k) => (
              <li key={k} className="flex items-center justify-between">
                {k}
                <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-signal-emerald">
                  <span className="h-1.5 w-1.5 rounded-full bg-signal-emerald" /> online
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-auto flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-paper p-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-ink-50 text-xs font-semibold text-paper">
            {user.full_name?.[0]?.toUpperCase() || "U"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink-50">{user.full_name}</p>
            <p className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-500">{user.role}</p>
          </div>
          <button
            onClick={doLogout}
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink-500 transition hover:bg-signal-crimson/10 hover:text-signal-crimson"
            title="Log out"
            aria-label="Log out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>

      {/* phone / tablet: compact top bar */}
      <header className="no-print sticky top-0 z-50 flex items-center justify-between border-b border-white/[0.08] bg-paper/85 px-4 py-3 backdrop-blur-xl lg:hidden">
        <Link to="/" className="flex items-center gap-2" aria-label="Securix home">
          <Logo className="h-7 w-7" />
          <span className="font-display text-[14px] font-semibold tracking-[0.18em] text-ink-50">SECURIX</span>
        </Link>
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-50 text-xs font-semibold text-paper">
            {user.full_name?.[0]?.toUpperCase() || "U"}
          </span>
          <button
            onClick={doLogout}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.1] text-ink-500"
            title="Log out"
            aria-label="Log out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* phone / tablet: bottom tab bar, within thumb reach */}
      <nav
        className="no-print fixed inset-x-3 bottom-3 z-50 flex items-center justify-around rounded-2xl border border-white/[0.1] bg-paper/90 px-2 py-2 shadow-soft-lg backdrop-blur-xl lg:hidden"
        style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        aria-label="App"
      >
        {items.map(({ to, label, Icon }) => {
          const on = isActive(to);
          return (
            <Link
              key={to}
              to={to}
              className={`flex flex-1 flex-col items-center gap-1 rounded-xl py-1.5 text-[10.5px] font-medium ${on ? "bg-ink-50 text-paper" : "text-ink-500"}`}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          );
        })}
        <Link to="/" className="flex flex-1 flex-col items-center gap-1 rounded-xl py-1.5 text-[10.5px] font-medium text-ink-500">
          <ShieldCheck className="h-5 w-5" />
          Home
        </Link>
      </nav>
    </>
  );
}

export default function Navbar() {
  const { user } = useAuth();
  const location = useLocation();
  const appRoute = !!user && !PUBLIC_ROUTES.includes(location.pathname);

  // lets index.css offset <main> for the sidebar / bottom bar (App.jsx is untouched)
  useEffect(() => {
    document.body.classList.toggle("app-shell", appRoute);
    return () => document.body.classList.remove("app-shell");
  }, [appRoute]);

  return (
    <>
      <Atmosphere />
      <Cursor />
      {appRoute ? <AppNav /> : <PublicNav />}
    </>
  );
}
