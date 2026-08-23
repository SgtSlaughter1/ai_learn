<?php

namespace App\Enums;

enum UserRole: string
{
    case LEARNER = 'learner';
    case TEACHER = 'teacher';
    case ADMIN = 'admin';
}
