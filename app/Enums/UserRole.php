<?php

namespace App\Enums;

enum UserRole: string
{
    case SUPER_ADMIN = 'super_admin';
    case SCHOOL_ADMIN = 'school_admin';
    case ADMIN = 'admin';
    case TEACHER = 'teacher';
    case LEARNER = 'learner';
}
