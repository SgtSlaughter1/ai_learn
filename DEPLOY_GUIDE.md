# InfinityFree Deployment Guide for AceDrill Platform

This guide walks you through the steps to successfully deploy this Laravel + React project to InfinityFree and resolve the **403 Forbidden** error.

---

## 1. How the 403 Forbidden Error is Resolved
On InfinityFree, the web root is fixed to the `htdocs` directory. However, Laravel expects requests to serve from the `public/` directory (where `index.php` and your compiled assets reside).

We have created a `.htaccess` file in the project's root directory:
```apache
<IfModule mod_rewrite.c>
    RewriteEngine On

    # Prevent direct access to sensitive files and folders
    RedirectMatch 404 /\.(env|git|gitignore|gitattributes|editorconfig|styleci\.yml|phpunit\.result\.cache)$
    RedirectMatch 404 ^/(app|bootstrap|config|database|resources|routes|storage|tests|vendor)/

    # Rewrite all requests to the public/ folder
    RewriteCond %{REQUEST_URI} !^/public/
    RewriteRule ^(.*)$ public/$1 [L]
</IfModule>
```
When you upload the entire project to your `htdocs` directory, this file will automatically route all web traffic to the `public/` folder, resolving the `403 Forbidden` error.

---

## 2. Local Setup & Build Steps (Before Uploading)

Since InfinityFree servers do not run Node.js/Vite or Composer, you must compile your assets and install production dependencies locally before uploading:

### A. Compile Front-End Assets (Vite)
Compile your React/TypeScript/Tailwind files:
```bash
npm run build
```
This updates the `public/build/` directory with production-ready assets. Make sure this folder is uploaded.

### B. Install Production PHP Dependencies
Ensure your `vendor/` folder is fully installed and optimized for production:
```bash
composer install --no-dev --optimize-autoloader
```

---

## 3. Database Migration Workaround

You cannot run `php artisan migrate` on InfinityFree because SSH access is not available.

1. **Export Local Database:**
   Export your local database schema (e.g., using phpMyAdmin at `http://localhost/phpmyadmin` or your database manager) into a `.sql` file.
2. **Create Database on InfinityFree:**
   Go to the InfinityFree Control Panel, click **MySQL Databases**, and create a new database.
3. **Import SQL File:**
   Open **phpMyAdmin** on InfinityFree for your newly created database, and import the `.sql` file you exported in step 1.

---

## 4. Configuring the `.env` File Online

Create a `.env` file in the root `htdocs/` folder on InfinityFree (you can copy your local `.env` and edit it):

* Set environment to production and disable debug mode:
  ```env
  APP_ENV=production
  APP_DEBUG=false
  ```
* Set your live InfinityFree URL:
  ```env
  APP_URL=https://yourdomain.infinityfreeapp.com
  VITE_API_URL=https://yourdomain.infinityfreeapp.com/api
  ```
* Enter your InfinityFree database credentials (found in the InfinityFree Control Panel under MySQL Databases):
  ```env
  DB_CONNECTION=mysql
  DB_HOST=sqlXXX.infinityfree.com  # Copy this from control panel
  DB_PORT=3306
  DB_DATABASE=if0_xxxxxx_database  # Copy this from control panel
  DB_USERNAME=if0_xxxxxx           # Copy this from control panel
  DB_PASSWORD=your_mysql_password
  ```
* Ensure you copy the `APP_KEY` from your local `.env` file so sessions/passwords can be decrypted properly.
* Ensure you set your Gemini / OpenAI API keys if needed:
  ```env
  GEMINI_API_KEY=your_live_key
  ```

---

## 5. Directory Permissions (If needed)

If you get a `500 Server Error` or permission issues after uploading:
1. Ensure the `storage` and `bootstrap/cache` directories are writable by the web server.
2. In your FTP client (like FileZilla), right-click the `storage` and `bootstrap/cache` folders, select **File permissions...**, and set them to `775` (or `755`).

---

## 6. Serving Uploaded Files (No Symbolic Links)

InfinityFree does not allow symbolic links (`storage:link`). If you plan to allow users to upload files/avatars and view them, update the `public` disk in `config/filesystems.php` to save files directly into the web-accessible directory:

In `config/filesystems.php` (around line 41):
```diff
         'public' => [
             'driver' => 'local',
-            'root' => storage_path('app/public'),
+            'root' => public_path('storage'),
             'url' => rtrim(env('APP_URL', 'http://localhost'), '/').'/storage',
             'visibility' => 'public',
             'throw' => false,
             'report' => false,
         ],
```
This forces all public uploads to write directly into `public/storage`, removing the need for a symlink!

---

## 7. Running for Many Users at Once (Offline Sync at Scale)

When a whole class reconnects, every device syncs its offline work. The app is built so
this never creates duplicates or loses data (idempotency keys, row locks, unique indexes),
and so it stays fast:

* Devices spread their first sync over ~20 seconds after reconnecting.
* Each device sends its backlog in batches of up to 25 changes (`POST /api/v1/sync/batch`).
* Per-user rate limits protect the server (`api` 600/min, `sync-batch` 60/min, `ai` 20/min,
  `login` 10/min); the app waits and retries automatically when limited.
* Quiz XP, streaks and achievements run as a queued job, exactly once per attempt.

### `.env` settings

```env
SESSION_DRIVER=database
CACHE_STORE=database
QUEUE_CONNECTION=database   # or "sync" on hosts that can't run a queue worker
```

The `sessions`, `cache` and `jobs` tables are created by the normal migrations.

### On InfinityFree (shared hosting)

* Use `QUEUE_CONNECTION=sync` (no background workers are allowed). Jobs then run inside the
  request; they are still applied exactly once.
* There is no cron, so the daily cleanup can't be scheduled; old idempotency keys are also
  pruned automatically during normal requests.
* **Free shared hosting caps how many PHP requests run at the same time.** It suits a pilot,
  but not 100+ learners syncing together: requests beyond the cap are refused or delayed.

### On a VPS (recommended for schools)

A small server (2 vCPU, 4 GB RAM) with nginx + PHP-FPM + MySQL comfortably handles a
classroom-scale reconnect:

* PHP-FPM: `pm = dynamic`, `pm.max_children = 24` (roughly RAM available ÷ 60 MB).
* Queue worker kept running by Supervisor:
  `php artisan queue:work --tries=5 --max-time=3600`
* Scheduler via cron: `* * * * * cd /path/to/app && php artisan schedule:run >> /dev/null 2>&1`
* Later, for thousands of users, switch the three drivers above to `redis`.

