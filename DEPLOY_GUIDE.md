# InfinityFree Deployment Guide for AceDrill Platform

This guide walks you through the steps to successfully deploy this Laravel + React project to InfinityFree and resolve the **403 Forbidden** error.

---

## 0. Production Checklist (do every item before going live)

### Release
- [ ] All work is committed, merged into `main`, and that is the code being deployed.
- [ ] `npm ci && npm run build` was run, and `public/build/` (including `sw.js`) is uploaded.
- [ ] `composer install --no-dev --optimize-autoloader` was run.

### `.env`
- [ ] `APP_ENV=production` and `APP_DEBUG=false` (debug pages leak secrets and SQL).
- [ ] `APP_KEY` is set (generate once with `php artisan key:generate`; never change it afterwards).
- [ ] `APP_URL=https://your-domain` — **HTTPS is required**: without it the service worker does not run (no offline mode) and offline quiz grading marks every answer wrong.
- [ ] `SESSION_SECURE_COOKIE=true`.
- [ ] `SESSION_DRIVER=database`, `CACHE_STORE=database`, `QUEUE_CONNECTION=database` (or `redis` for all three on a VPS). Not `file`/`sync`.
- [ ] `LOG_LEVEL=warning`.
- [ ] Database credentials for a production database user.
- [ ] Mail settings (`MAIL_*`) so password resets work.
- [ ] AI: `AI_PROVIDER=groq` and `GROQ_API_KEY` (fastest; models default to `openai/gpt-oss-120b`, then `openai/gpt-oss-20b`, each with its own free-tier limits). Keep `GEMINI_API_KEY` set too: Gemini answers automatically when Groq fails or hits its rate limit, and the built-in offline answers cover the rest. Check that the host can reach `api.groq.com`.
- [ ] `MAINTENANCE_TOKEN` left **empty** if you can run Artisan over SSH. Only on hosts without SSH: set it to `openssl rand -hex 32`, use it, then empty it again. To use a maintenance page (their paths are in `routes/web.php`), open it in the browser: it shows a confirmation page where you paste the token and press **Run**. The token is never put in the URL, and opening a link alone runs nothing. Each action is rate limited and logged.
- [ ] `ALLOW_DESTRUCTIVE_MAINTENANCE`: `true` only while you are still testing and want the migrate-fresh-and-seed maintenance page (drops **every** table, then migrates and seeds the test accounts). Set it back to `false` once real schools have data on the site.

### Database
- [ ] Migrations applied (`php artisan migrate --force`, or the run-migrations maintenance page with the token on hosts without SSH).
- [ ] **Do not import your local database** (a local export carries your own test records). Seed instead.
- [ ] Test accounts: `php artisan db:seed --force` (or the seed maintenance page with the token) creates one test account per role for checking the live site (see `database/seeders/DatabaseSeeder.php`). Re-running it is safe; it also resets those accounts' passwords.
- [ ] Before real schools use the site: create your own platform admin, then deactivate or delete every seeded test account (Admin → Users), since their passwords are not secret.
- [ ] Automatic daily database backups are enabled.

### PHP security (critical, October 2026)
- [ ] PHP is **8.3.36 or later** (or 8.2.35, 8.4.27, 8.5.12 on those lines). Earlier releases have CVE-2026-109618 and CVE-2026-109619: unauthenticated remote code execution on every PHP that serves web requests (PHP-FPM, Apache `mod_php`, CGI, LiteSpeed). Upgrading is the only complete fix.
- [ ] Check it: `php artisan php:security-check` over SSH, or open the PHP check maintenance page with the token on hosts without SSH. Both say `patched` and the version needed.
- [ ] **InfinityFree / shared hosting:** the host controls PHP, so only the host can patch it. Run the PHP check; if it is not patched, ask the host when it will be (on InfinityFree: their forum and status page) and consider taking the site offline until it is, as the UK NCSC advises. A VPS lets you patch the same day.
- [ ] **VPS:** update the PHP packages from your distribution (for example `sudo apt update && sudo apt install --only-upgrade 'php8.3*'`), restart PHP-FPM and the web server, then run the check. Until then, in the FPM pool or `php.ini` (not `.user.ini`, which applies too late): `session.upload_progress.enabled = 0` (the app does not use it) and `post_max_size = 32M` with `upload_max_filesize` below it (question pictures are at most 5 MB). These reduce exposure; they do not fix it.

### Server processes
- [ ] After every deploy: `php artisan config:cache && php artisan route:cache && php artisan view:cache && php artisan event:cache`, then `php artisan queue:restart`.
- [ ] A queue worker runs permanently (Supervisor/systemd): `php artisan queue:work --tries=3 --max-time=3600`. Without it, queued jobs (quiz XP) never run.
- [ ] Cron: `* * * * * cd /path/to/app && php artisan schedule:run >> /dev/null 2>&1` (prunes old sync idempotency keys daily).
- [ ] InfinityFree cannot run a worker or cron: there keep `QUEUE_CONNECTION=sync` (works, slower) and expect limited concurrency. Use a VPS for real school traffic (see section 7).

### Smoke test after deploying
- [ ] Every maintenance page returns **404** while `MAINTENANCE_TOKEN` is empty, and its Run button returns **404** with a wrong token. The migrate-fresh-and-seed page returns **403** in production unless `ALLOW_DESTRUCTIVE_MAINTENANCE=true`.
- [ ] Sign in as each role (learner, teacher, school admin, platform admin) and open their dashboard.
- [ ] The header shows **Offline Ready**; on a phone over HTTPS, switch to airplane mode, reload, take a quiz, reconnect, and confirm the score and XP appear.
- [ ] On the server, delete any old `htdocs/public/robots.txt`, `sitemap.xml`, `llms.txt` and `llms-full.txt` (uploads never delete files; `.htaccess` routes these URLs to Laravel anyway).
- [ ] Search: `https://your-domain/robots.txt`, `/sitemap.xml` and `/llms.txt` show your own domain (they are built from `APP_URL`; only `APP_ENV=production` is indexable). View the home page source: it has the FAQ as text and as `FAQPage` JSON-LD.
- [ ] Add the site to [Google Search Console](https://search.google.com/search-console) and [Bing Webmaster Tools](https://www.bing.com/webmasters) (Bing also feeds ChatGPT search and Copilot), submit `https://your-domain/sitemap.xml`, and check the home page with Google's [Rich Results Test](https://search.google.com/test/rich-results).

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

1. **Export Local Database Structure Only:**
   Export your local database **structure only (no data)** (e.g., in phpMyAdmin choose *Export → Custom → Structure*) into a `.sql` file. Exporting data would copy local test records and test accounts into production. Alternatively use the run-migrations maintenance page with a `MAINTENANCE_TOKEN` (see section 0).
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
* Each device sends its backlog in small batches.
* Per-user rate limits protect the server; the app waits and retries automatically when limited.
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

