<?php

use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

// Don't advertise the PHP version (InfinityFree has no mod_headers to do this in .htaccess).
header_remove('X-Powered-By');

if (file_exists($maintenance = __DIR__.'/storage/framework/maintenance.php')) {
    require $maintenance;
}

require __DIR__.'/vendor/autoload.php';

(require __DIR__.'/bootstrap/app.php')
    ->handleRequest(Request::capture());
