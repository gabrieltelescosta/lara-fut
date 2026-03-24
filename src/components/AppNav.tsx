"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavLink = { href: string; label: string };

const groupData: NavLink[] = [
  { href: "/", label: "Início" },
  { href: "/live", label: "Ao vivo" },
  { href: "/history", label: "Histórico" },
  { href: "/teams", label: "Times" },
];

const groupSignals: NavLink[] = [
  { href: "/tracker", label: "Tracker" },
  { href: "/strategy", label: "Estratégia" },
];

const groupExtra: NavLink[] = [{ href: "/stats", label: "Estatísticas" }];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavButton({ href, label }: NavLink) {
  const pathname = usePathname();
  const active = isActive(pathname, href);
  return (
    <Link
      href={href}
      className={
        active
          ? "rounded-md border border-red-900/60 bg-red-950/50 px-3 py-1.5 font-medium text-red-100"
          : "rounded-md px-3 py-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
      }
    >
      {label}
    </Link>
  );
}

export function AppNav() {
  return (
    <header className="border-b border-zinc-800 bg-zinc-950/95 shadow-sm shadow-black/30 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/"
          className="text-sm font-bold tracking-tight text-red-400 drop-shadow-sm"
        >
          Superbet Virtuais
        </Link>
        <nav className="flex flex-wrap items-center gap-x-1 gap-y-2 text-sm">
          {groupData.map((l) => (
            <NavButton key={l.href} {...l} />
          ))}
          <span
            className="hidden px-1 text-zinc-700 sm:inline"
            aria-hidden
          >
            |
          </span>
          {groupSignals.map((l) => (
            <NavButton key={l.href} {...l} />
          ))}
          <span
            className="hidden px-1 text-zinc-700 sm:inline"
            aria-hidden
          >
            |
          </span>
          {groupExtra.map((l) => (
            <NavButton key={l.href} {...l} />
          ))}
        </nav>
      </div>
    </header>
  );
}
