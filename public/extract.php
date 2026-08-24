<?php
/**
 * Extraction script — upload this + vendor.tar.gz, then hit this URL.
 * It extracts vendor, creates .htaccess, and self-deletes.
 */
header('Content-Type: text/plain');

$key = $_GET['key'] ?? '';
if ($key !== 'ailearn-deploy-2026') {
    http_response_code(403);
    die('Forbidden');
}

$zip = __DIR__ . '/vendor.tar.gz';
if (!file_exists($zip)) {
    die('ERROR: vendor.tar.gz not found');
}

echo "Extracting vendor.tar.gz...\n";
$descriptors = [0 => ['pipe','r'], 1 => ['pipe','w'], 2 => ['pipe','w']];
$proc = proc_open("tar -xzf " . escapeshellarg($zip) . " -C " . escapeshellarg(__DIR__ . '/..'), $descriptors, $pipes);
if (is_resource($proc)) {
    $stdout = stream_get_contents($pipes[1]);
    $stderr = stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);
    $exit = proc_close($proc);
    if ($exit !== 0) {
        die("ERROR: tar extraction failed (exit $exit)\n$stderr\n$stdout");
    }
}

// Create .htaccess to route to public/
$htaccess = __DIR__ . '/../.htaccess';
file_put_contents($htaccess, "RewriteEngine On\nRewriteRule ^storage/(.*)$ /storage/app/public/\$1 [END]\nRewriteRule (.*) /public/\$1 [L]\n");

// Cleanup
unlink($zip);
unlink(__FILE__);

echo "Done! Site is live.\n";
