"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navLinks = [
  { href: "/", label: "Review Library" },
  { href: "/new", label: "Draft a New Review" },
];

export default function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40">
      <div className="bg-un-blue-950 text-un-blue-100 text-xs">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-8 flex items-center justify-between">
          <span className="tracking-wide">
            United Nations &middot; Department of Operational Support
          </span>
          <span className="hidden sm:inline text-un-blue-400">
            After Action Review Programme
          </span>
        </div>
      </div>

      <div className="bg-un-surface border-b border-un-border shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-3 sm:gap-6">
            <Link href="/" className="flex min-w-0 items-center shrink">
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="text-[0.65rem] sm:text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-un-blue-600">
                  United Nations
                </span>
                <span className="truncate font-serif text-base sm:text-lg font-semibold text-un-ink">
                  <span className="sm:hidden">AAR Library</span>
                  <span className="hidden sm:inline">
                    After Action Review Library
                  </span>
                </span>
              </span>
            </Link>

            <nav className="flex shrink-0 items-center gap-1 sm:gap-2">
              {navLinks.map((link) => {
                const isActive =
                  link.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={
                      "rounded-full px-2.5 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm font-medium whitespace-nowrap transition-colors " +
                      (isActive
                        ? "bg-un-blue-600 text-white shadow-sm"
                        : "text-un-blue-800 hover:bg-un-blue-50")
                    }
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
}
