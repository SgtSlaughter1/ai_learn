import type { SchoolItem } from '@/types/admin';

interface ClassFilterBarProps {
    schools: SchoolItem[];
    classSchoolFilter: string;
    setClassSchoolFilter: (v: string) => void;
    classGradeFilter: string;
    setClassGradeFilter: (v: string) => void;
    onOpenCreateModal: () => void;
}

export default function ClassFilterBar({
    schools,
    classSchoolFilter,
    setClassSchoolFilter,
    classGradeFilter,
    setClassGradeFilter,
    onOpenCreateModal,
}: ClassFilterBarProps) {
    return (
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
                {schools.length > 1 && (
                    <select
                        value={classSchoolFilter}
                        onChange={(e) => setClassSchoolFilter(e.target.value)}
                        className="px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs font-semibold text-[var(--color-text)] outline-none"
                    >
                        <option value="">All Schools</option>
                        {schools.map((s) => (
                            <option key={s.id} value={s.id}>
                                {s.name}
                            </option>
                        ))}
                    </select>
                )}
                <select
                    value={classGradeFilter}
                    onChange={(e) => setClassGradeFilter(e.target.value)}
                    className="px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs font-semibold text-[var(--color-text)] outline-none"
                >
                    <option value="">All Grade Levels</option>
                    <optgroup label="Early Childhood">
                        <option value="CRECHE">Creche</option>
                        <option value="KG1">KG 1</option>
                        <option value="KG2">KG 2</option>
                        <option value="NUR1">Nursery 1</option>
                        <option value="NUR2">Nursery 2</option>
                    </optgroup>
                    <optgroup label="Primary School">
                        <option value="PRI1">Primary 1</option>
                        <option value="PRI2">Primary 2</option>
                        <option value="PRI3">Primary 3</option>
                        <option value="PRI4">Primary 4</option>
                        <option value="PRI5">Primary 5</option>
                        <option value="PRI6">Primary 6</option>
                    </optgroup>
                    <optgroup label="Junior Secondary">
                        <option value="JSS1">JSS 1</option>
                        <option value="JSS2">JSS 2</option>
                        <option value="JSS3">JSS 3</option>
                    </optgroup>
                    <optgroup label="Senior Secondary">
                        <option value="SS1">SS 1</option>
                        <option value="SS2">SS 2</option>
                        <option value="SS3">SS 3</option>
                    </optgroup>
                </select>
            </div>

            <button
                type="button"
                onClick={onOpenCreateModal}
                className="px-5 py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-bold rounded-xl shadow-sm transition-all duration-200 cursor-pointer active:scale-[0.98] flex items-center gap-2"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>Create New Class</span>
            </button>
        </div>
    );
}
