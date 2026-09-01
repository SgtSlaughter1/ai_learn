import { ProgressBar } from '@/components/ui/ProgressBar';

interface FlashcardProgressBarProps {
    currentIndex: number;
    totalCards: number;
}

export function FlashcardProgressBar({
    currentIndex,
    totalCards,
}: FlashcardProgressBarProps) {
    const progressPercent = totalCards > 0 ? (currentIndex / totalCards) * 100 : 0;

    return (
        <ProgressBar
            percent={progressPercent}
            showLabel={true}
            label="Progress"
        />
    );
}
