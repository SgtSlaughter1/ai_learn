<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\Pivot;

/** Which classes sit a school exam. */
class SchoolExamClass extends Pivot
{
    protected $table = 'school_exam_classes';

    public $timestamps = false;
}
