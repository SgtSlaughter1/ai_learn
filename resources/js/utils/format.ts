export interface GradeOption {
    value: string;
    label: string;
}

export interface GradeGroup {
    group: string;
    options: GradeOption[];
}

export const ALL_GRADE_GROUPS: GradeGroup[] = [
    {
        group: 'Early Childhood',
        options: [
            { value: 'CRECHE', label: 'Creche' },
            { value: 'KG1', label: 'KG 1' },
            { value: 'KG2', label: 'KG 2' },
            { value: 'NUR1', label: 'Nursery 1' },
            { value: 'NUR2', label: 'Nursery 2' },
        ],
    },
    {
        group: 'Primary School',
        options: [
            { value: 'PRI1', label: 'Primary 1' },
            { value: 'PRI2', label: 'Primary 2' },
            { value: 'PRI3', label: 'Primary 3' },
            { value: 'PRI4', label: 'Primary 4' },
            { value: 'PRI5', label: 'Primary 5' },
            { value: 'PRI6', label: 'Primary 6' },
        ],
    },
    {
        group: 'Junior Secondary',
        options: [
            { value: 'JSS1', label: 'JSS 1' },
            { value: 'JSS2', label: 'JSS 2' },
            { value: 'JSS3', label: 'JSS 3' },
        ],
    },
    {
        group: 'Senior Secondary',
        options: [
            { value: 'SS1', label: 'SS 1' },
            { value: 'SS2', label: 'SS 2' },
            { value: 'SS3', label: 'SS 3' },
        ],
    },
];

/**
 * Returns the relevant grade levels based on school category or category_ids.
 * If school has category_ids array, resolves grade levels for all assigned categories.
 * Otherwise falls back to category string.
 */
export function getGradeLevelsForSchool(
    categoryOrSchool?: string | null | { category?: string | null; category_ids?: number[] | null },
    categoryIdsParam?: number[] | null
): GradeGroup[] {
    let cat: string | undefined;
    let ids: number[] | undefined;

    if (typeof categoryOrSchool === 'object' && categoryOrSchool !== null) {
        cat = categoryOrSchool.category?.toLowerCase();
        ids = categoryOrSchool.category_ids || undefined;
    } else {
        cat = categoryOrSchool?.toLowerCase();
        ids = categoryIdsParam || undefined;
    }

    if (ids && ids.length > 0) {
        const groups: GradeGroup[] = [];
        if (ids.includes(1)) {
            const earlyChildhood = ALL_GRADE_GROUPS.find((g) => g.group === 'Early Childhood');
            const primary = ALL_GRADE_GROUPS.find((g) => g.group === 'Primary School');
            if (earlyChildhood) groups.push(earlyChildhood);
            if (primary) groups.push(primary);
        }
        if (ids.includes(2)) {
            const junior = ALL_GRADE_GROUPS.find((g) => g.group === 'Junior Secondary');
            if (junior) groups.push(junior);
        }
        if (ids.includes(3)) {
            const senior = ALL_GRADE_GROUPS.find((g) => g.group === 'Senior Secondary');
            if (senior) groups.push(senior);
        }
        return groups.length > 0 ? groups : ALL_GRADE_GROUPS;
    }

    if (cat === 'senior') {
        return ALL_GRADE_GROUPS.filter((g) => g.group === 'Senior Secondary');
    }
    if (cat === 'junior') {
        return ALL_GRADE_GROUPS.filter((g) => g.group === 'Junior Secondary');
    }
    if (cat === 'primary') {
        return ALL_GRADE_GROUPS.filter((g) => g.group === 'Primary School' || g.group === 'Early Childhood');
    }
    if (cat === 'early_childhood') {
        return ALL_GRADE_GROUPS.filter((g) => g.group === 'Early Childhood');
    }
    return ALL_GRADE_GROUPS;
}

/**
 * Returns formatted human readable badge/label for school category or category_ids.
 */
export function formatSchoolCategoryLabel(school?: { category?: string | null; category_ids?: number[] | null; category_type_label?: string } | null): string {
    if (!school) return 'Secondary';
    if (school.category_type_label) return school.category_type_label;

    const ids = (school.category_ids || []).map(Number).sort((a, b) => a - b);
    if (ids.length === 1) {
        if (ids[0] === 1) return 'Primary School';
        if (ids[0] === 2) return 'Junior Secondary';
        if (ids[0] === 3) return 'Senior Secondary';
    } else if (ids.length > 1) {
        if (ids.length === 2 && ids[0] === 1 && ids[1] === 2) return 'Combined (Primary & Junior)';
        if (ids.length === 2 && ids[0] === 2 && ids[1] === 3) return 'Combined (Junior & Senior)';
        if (ids.length === 2 && ids[0] === 1 && ids[1] === 3) return 'Combined (Primary & Senior)';
        if (ids.length === 3) return 'Combined (All-Through)';
        return 'Combined';
    }

    switch (school.category?.toLowerCase()) {
        case 'primary':
            return 'Primary School';
        case 'junior':
            return 'Junior Secondary';
        case 'senior':
            return 'Senior Secondary';
        case 'combined':
            return 'Combined';
        default:
            return 'Secondary';
    }
}

/**
 * Formats a class label for select dropdowns to avoid redundant suffixes
 * like "SS1 Science (SS1)". If the name already includes the grade level,
 * it returns the clean name.
 */
export function formatClassOptionLabel(cls: { name: string; grade_level?: string | null }): string {
    if (!cls.grade_level) return cls.name;
    const normalizedName = cls.name.replace(/[\s_-]+/g, '').toLowerCase();
    const normalizedGrade = cls.grade_level.replace(/[\s_-]+/g, '').toLowerCase();
    if (normalizedName.includes(normalizedGrade)) {
        return cls.name;
    }
    return `${cls.name} (${cls.grade_level})`;
}
