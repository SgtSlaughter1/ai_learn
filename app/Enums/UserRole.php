<?php

namespace App\Enums;

enum UserRole: string
{
    case PLATFORM_ADMIN = 'platform_admin';
    case SCHOOL_ADMIN = 'school_admin';
    case LEARNER = 'learner';
}
