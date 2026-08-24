<?php
/**
 * One-time extraction script for InfinityFree deployment.
 *
 * How it works:
 * 1. Upload deploy.zip via FTP (fast — single file)
 * 2. This script extracts deploy.zip into the parent directory
 * 3. After extraction, DELETE this file for security
 *
 * Usage: Visit https://ailearn.gt.tc/extract.php?key=YOUR_DEPLOY_KEY
 */

$DEPLOY_KEY = getenv('DEPLOY_SECRET') ?: 'ailearn-deploy-2026';

// Security: only allow with correct key
if (!isset($_GET['key']) || $_GET['key'] !== $DEPLOY_KEY) {
    http_response_code(403);
    echo json_encode(['error' => 'Forbidden. Invalid deploy key.']);
    exit;
}

// Set max execution time
set_time_limit(300);

$zipPath = dirname(__DIR__) . '/deploy.zip';

if (!file_exists($zipPath)) {
    echo json_encode(['error' => 'deploy.zip not found at: ' . $zipPath]);
    exit;
}

$zip = new ZipArchive();
$result = $zip->open($zipPath);

if ($result === true) {
    // Extract to parent of htdocs (the root)
    $extractPath = dirname(__DIR__);
    $zip->extractTo($extractPath);
    $zip->close();

    // Remove the zip after extraction
    unlink($zipPath);

    echo json_encode([
        'success' => true,
        'message' => 'Deployed successfully! Site should be live now.',
        'extracted_to' => $extractPath,
    ]);
} else {
    echo json_encode([
        'error' => 'Failed to open deploy.zip. ZipArchive error code: ' . $result
    ]);
}
