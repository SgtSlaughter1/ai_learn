<?php

namespace App\Http\Controllers;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Gate;

abstract class Controller
{
    /**
     * Attach what the current user may do with each record (`can.update`, `can.delete`),
     * computed by the same policies that guard the endpoints, so the UI only offers
     * actions the server will accept.
     *
     * @param  iterable<Model>  $records
     */
    protected function withAbilities(iterable $records, array $abilities = ['update', 'delete']): void
    {
        foreach ($records as $record) {
            $record->setAttribute('can', collect($abilities)->mapWithKeys(
                fn (string $ability) => [$ability => Gate::allows($ability, $record)]
            )->all());
        }
    }
}
