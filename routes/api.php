<?php

// Every JSON endpoint lives in routes/web.php under /api/v1 so it shares the browser session,
// CSRF protection and the account-status check. This file is kept (bootstrap/app.php loads it)
// for any future token-authenticated API.
