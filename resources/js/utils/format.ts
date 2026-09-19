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
 * Returns the relevant grade levels based on school category.
 * If school category is senior, only returns Senior Secondary grades.
 * If junior, only returns Junior Secondary.
 * If primary, only returns Primary.
 * If early_childhood, only returns Early Childhood.
 * Otherwise (combined / all), returns all grade groups.
 */
export function getGradeLevelsForSchool(category?: string | null): GradeGroup[] {
    const cat = category?.toLowerCase();
    if (cat === 'senior') {
        return ALL_GRADE_GROUPS.filter((g) => g.group === 'Senior Secondary');
    }
    if (cat === 'junior') {
        return ALL_GRADE_GROUPS.filter((g) => g.group === 'Junior Secondary');
    }
    if (cat === 'primary') {
        return ALL_GRADE_GROUPS.filter((g) => g.group === 'Primary School');
    }
    if (cat === 'early_childhood') {
        return ALL_GRADE_GROUPS.filter((g) => g.group === 'Early Childhood');
    }
    return ALL_GRADE_GROUPS;
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
