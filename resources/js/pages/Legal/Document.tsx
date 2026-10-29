import { Head, Link } from '@inertiajs/react';
import { BrandLogo } from '@/components/brand/BrandLogo';
import ThemeToggle from '@/components/ui/ThemeToggle';
import LegalText from '@/components/legal/LegalText';

interface Props {
    title: string;
    version: string;
    markdown: string;
}

/** The Terms of Use or Privacy Policy, readable by anyone, signed in or not. */
export default function Document({ title, version, markdown }: Props) {
    return (
        <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)]">
            <Head title={`${title} | AceDrill`} />
            <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
                <nav className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
                    <Link href="/" aria-label="AceDrill home">
                        <BrandLogo className="h-7 w-auto" title="" />
                    </Link>
                    <div className="flex items-center gap-3 text-sm font-semibold">
                        <Link href="/terms" className="text-[var(--color-muted)] hover:text-[var(--color-primary)]">
                            Terms
                        </Link>
                        <Link href="/privacy" className="text-[var(--color-muted)] hover:text-[var(--color-primary)]">
                            Privacy
                        </Link>
                        <ThemeToggle />
                    </div>
                </nav>
            </header>

            <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
                <h1 className="text-3xl font-extrabold tracking-tight text-[var(--color-text)]">{title}</h1>
                <p className="mt-2 text-sm text-[var(--color-muted)]">Effective {version}</p>
                <div className="mt-6 max-w-[70ch]">
                    <LegalText markdown={markdown} />
                </div>
            </main>
        </div>
    );
}
