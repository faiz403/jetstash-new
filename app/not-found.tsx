import Link from 'next/link';
import { LinkButton } from '@/components/ui/button';

export default function NotFound() {
  return (
    <section className="flex min-h-[60vh] items-center bg-white py-20">
      <div className="mx-auto max-w-content px-5 text-center sm:px-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-terracotta-600">404</p>
        <h1 className="mt-3 font-display text-4xl text-ink-900">That page isn't here</h1>
        <p className="mx-auto mt-3 max-w-md text-ink-500">
          The page you're looking for may have moved. Try one of these instead.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <LinkButton href="/" variant="dark">Go home</LinkButton>
          <LinkButton href="/deals" variant="outline" className="border-ink-200 text-ink-900 hover:bg-ink-50">
            See current fares
          </LinkButton>
        </div>
      </div>
    </section>
  );
}
