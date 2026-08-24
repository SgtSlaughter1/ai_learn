<?php
/**
 * One-time extraction script for InfinityFree deployment.
 *
 * 1. Upload deploy.zip + this script via FTP
 * 2. Visit https://ailearn.gt.tc/extract.php?key=KEY
 * 3. Script extracts, creates .htaccess, cleans up
 */

$DEPLOY_KEY = 'ailearn-deploy-2026';

if (!isset($_GET['key']) || $_GET['key'] !== $DEPLOY_KEY) {
    http_response_code(403);
    echo 'Forbidden.';
    exit;
}

set_time_limit(300);

// deploy.zip is in the same directory as this script (htdocs/)
$zipPath = __DIR__ . '/deploy.zip';

if (!file_exists($zipPath)) {
    echo 'ERROR: deploy.zip not found at ' . $zipPath;
    exit;
}

$zip = new ZipArchive();
$result = $zip->open($zipPath);

if ($result === true) {
    // Extract to parent of htdocs (the FTP root)
    // The ZIP contains files like app/, vendor/, public/, etc.
    // So extracting to parent puts them inside htdocs/
    $extractPath = dirname(__DIR__);
    $zip->extractTo($extractPath);
    $zip->close();

    // Now create the root .htaccess (rewrite to public/)
    $htaccess = $extractPath . '/.htaccess';
    file_put_contents($htaccess, "RewriteEngine On\nRewriteRule ^storage/(.*)$ /storage/app/public/\$1 [END]\nRewriteRule (.*) /public/\$1 [L]\n");

    // Clean up: remove zip and this script
    unlink($zipPath);
    unlink(__FILE__);

    echo 'SUCCESS! Deployed. Site is live.';
} else {
    echo 'ERROR: Failed to open deploy.zip. Code: ' . $result;
}
