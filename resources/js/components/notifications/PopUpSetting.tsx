import { BellOff, BellRing } from 'lucide-react';
import { usePopUpSetting } from '@/services/Notifications';

/** In the profile: turn browser pop-ups on or off for this device. */
export default function PopUpSetting({ userId, isLearner }: { userId: string | number | undefined; isLearner: boolean }) {
    const { state, turnOn, turnOff } = usePopUpSetting(userId);

    return (
        <div className="space-y-3">
            <p className="text-sm text-[var(--color-text)] leading-relaxed">
                {isLearner
                    ? 'Get a pop-up on this device when your teacher sends you practice.'
                    : 'Get a pop-up on this device when learners report an AI explanation or someone checks one, even while you work in another tab.'}{' '}
                <span className="text-[var(--color-muted)]">Pop-ups never show names or scores. The bell at the top lists everything either way.</span>
            </p>

            {state === 'unsupported' && <p className="text-sm font-semibold text-[var(--color-muted)]">This browser can’t show pop-ups.</p>}
            {state === 'blocked' && (
                <p className="text-sm text-[var(--color-muted)]">
                    <span className="font-semibold text-[var(--color-text)]">Blocked by your browser.</span> To turn them on, allow notifications for this site in your browser’s
                    site settings, then come back here.
                </p>
            )}
            {(state === 'on' || state === 'off' || state === 'ask') && (
                <label className="flex items-center gap-3 text-sm font-semibold text-[var(--color-text)] cursor-pointer">
                    <input
                        type="checkbox"
                        role="switch"
                        checked={state === 'on'}
                        onChange={(e) => void (e.target.checked ? turnOn() : turnOff())}
                        className="w-4 h-4 accent-[var(--color-primary)]"
                    />
                    {state === 'on' ? (
                        <span className="inline-flex items-center gap-1.5">
                            <BellRing className="w-4 h-4 text-[var(--color-primary)]" aria-hidden />
                            Pop-ups are on for this device
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1.5">
                            <BellOff className="w-4 h-4 text-[var(--color-muted)]" aria-hidden />
                            Show pop-ups on this device
                        </span>
                    )}
                </label>
            )}
            {state === 'ask' && <p className="text-xs text-[var(--color-muted)]">Your browser will ask you to allow them.</p>}
        </div>
    );
}
