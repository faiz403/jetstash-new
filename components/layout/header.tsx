'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Menu, X, ChevronDown } from 'lucide-react';
import { mainNav, siteConfig } from '@/lib/site-config';
import { LinkButton } from '../ui/button';

export function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-ink-900/95 backdrop-blur-md">
      <div className="mx-auto flex h-20 max-w-content items-center justify-between px-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <Logomark />
          <span className="font-display text-2xl tracking-tight text-sand-50">{siteConfig.name}</span>
        </Link>

        <nav className="hidden items-center gap-7 lg:flex">
          {mainNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-[15px] font-medium text-ink-200 transition-colors hover:text-brass-300"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden lg:block">
          <LinkButton href="/travel-club" size="sm" variant="primary">
            Join Travel Club
          </LinkButton>
        </div>

        <button
          onClick={() => setOpen(!open)}
          className="flex h-10 w-10 items-center justify-center rounded-sm text-sand-50 lg:hidden"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-white/5 bg-ink-900 px-5 pb-6 pt-2 lg:hidden">
          <nav className="flex flex-col">
            {mainNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex items-center justify-between border-b border-white/5 py-4 text-base font-medium text-sand-100"
              >
                {item.label}
                <ChevronDown className="h-4 w-4 -rotate-90 text-ink-400" />
              </Link>
            ))}
          </nav>
          <LinkButton href="/travel-club" className="mt-5 w-full" onClick={() => setOpen(false)}>
            Join Travel Club
          </LinkButton>
        </div>
      )}
    </header>
  );
}

function Logomark() {
  return (
    <svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="16" cy="16" r="15" stroke="#C8932E" strokeWidth="1.4" />
      <path
        d="M9 19.5L16 8L23 19.5M11.5 16H20.5"
        stroke="#C8932E"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="23.5" r="1.6" fill="#C8932E" />
    </svg>
  );
}
