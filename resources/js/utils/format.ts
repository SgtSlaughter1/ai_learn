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
 * Returns the grade levels a school allows, from its allowed_grade_levels or its category_ids.
 * A school with neither (or no school) gets every grade.
 */
export function getGradeLevelsForSchool(
    school?: { category_ids?: number[] | null; allowed_grade_levels?: string[] | null } | null
): GradeGroup[] {
    const ids = school?.category_ids || undefined;
    const allowed = school?.allowed_grade_levels || undefined;

    if (allowed && allowed.length > 0) {
        const allowedSet = new Set(allowed.map((g) => g.toUpperCase()));
        const groups = ALL_GRADE_GROUPS.map((grp) => ({
            ...grp,
            options: grp.options.filter((opt) => allowedSet.has(opt.value.toUpperCase())),
        })).filter((grp) => grp.options.length > 0);
        if (groups.length > 0) return groups;
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

    return ALL_GRADE_GROUPS;
}

/**
 * Returns grade levels accessible to a teacher, strictly bounded by:
 * 1. The grade level(s) of the classes they are attached to in their school.
 * 2. If no classes with specific grade levels are attached, fallback to the grades in their school.
 */
export function getGradeLevelsForTeacher(
    classes?: { grade_level?: string | null }[] | null,
    school?: { category_ids?: number[] | null; allowed_grade_levels?: string[] | null } | null
): GradeGroup[] {
    const schoolGroups = getGradeLevelsForSchool(school);
    const schoolGradeSet = new Set(
        schoolGroups.flatMap((g) => g.options.map((o) => o.value.toUpperCase()))
    );

    if (classes && classes.length > 0) {
        const teacherClassGrades = new Set(
            classes
                .map((c) => c.grade_level?.toUpperCase())
                .filter(Boolean) as string[]
        );

        if (teacherClassGrades.size > 0) {
            const allowedSet = schoolGradeSet.size > 0
                ? new Set([...teacherClassGrades].filter((g) => schoolGradeSet.has(g)))
                : teacherClassGrades;

            const filtered = ALL_GRADE_GROUPS.map((grp) => ({
                ...grp,
                options: grp.options.filter((opt) => allowedSet.has(opt.value.toUpperCase())),
            })).filter((grp) => grp.options.length > 0);

            if (filtered.length > 0) return filtered;
        }
    }

    return schoolGroups;
}

/**
 * Returns a human readable badge/label for a school's category_ids.
 */
export function formatSchoolCategoryLabel(school?: { category_ids?: number[] | null; category_type_label?: string } | null): string {
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

    return 'All levels';
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
