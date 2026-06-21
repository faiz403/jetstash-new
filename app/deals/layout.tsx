import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Example Fares',
  description:
    'Example fares from UK airports to Pakistan, India, the Gulf and Umrah — flights, packages, business class and more, filterable by category.',
};

export default function DealsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
