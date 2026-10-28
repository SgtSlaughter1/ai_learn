import { useId, useState } from 'react';
import type { LucideIcon } from 'lucide-react';

interface Props {
    /** The school's endpoint for this switch, e.g. /api/v1/admin/schools/3/recess. */
    endpoint: string;
    enabled: boolean;
    icon: LucideIcon;
    title: string;
    description: string;
    onLabel: string;
    offLabel: string;
    showToast: (text: string, type?: 'success' | 'error') => void;
    onChanged: () => void;
}

/** A school admin's on/off switch for something learners use (Recess, School CBT). */
export default function SchoolSettingSwitch({ endpoint, enabled: initial, icon: Icon, title, description, onLabel, offLabel, showToast, onChanged }: Props) {
    const [enabled, setEnabled] = useState(initial);
    const [saving, setSaving] = useState(false);
    const labelId = useId();

    const toggle = async () => {
        const next = !enabled;
        setSaving(true);
        try {
            const res = await fetch(endpoint, {
                method: 'PATCH',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ enabled: next }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) throw new Error(data?.message || 'Could not change the setting.');
            setEnabled(next);
            showToast(data?.message ?? (next ? onLabel : offLabel), 'success');
            onChanged();
        } catch (e) {
            showToast(navigator.onLine ? (e as Error).message : 'Connect to the internet to change this setting.', 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <section className="flex flex-wrap items-center gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary-10)] text-[var(--color-primary)]">
                <Icon className="w-5 h-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
                <h2 id={labelId} className="text-sm font-bold text-[var(--color-text)]">{title}</h2>
                <p className="text-xs text-[var(--color-muted)]">{description}</p>
            </div>
            <button
                type="button"
                role="switch"
                aria-checked={enabled}
                aria-labelledby={labelId}
                disabled={saving}
                onClick={toggle}
                className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors cursor-pointer disabled:opacity-50 ${enabled ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border)]'}`}
            >
                <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
        </section>
    );
}
