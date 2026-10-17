# Offline sync load test

Simulates a classroom reconnecting: N learners sync an offline backlog through
`POST /api/v1/sync/batch`, then every device re-sends everything (as if all responses
were lost). Run it against a **staging copy with its own database**, never production.

1. Create the test learners (password `password`) on the staging app:

   ```bash
   php artisan tinker --execute='$h=Hash::make("password"); foreach(range(1,150) as $i) App\Models\User::create(["name"=>"Load Learner $i","email"=>"load$i@loadtest.local","password"=>$h,"role"=>"learner"]);'
   ```

2. Record row counts, run, wait for the queue to drain, record again:

   ```bash
   php artisan tinker --execute="require 'tests/Load/verify.php';"
   BASE=https://staging.example.com ATTEMPTS=5 JITTER_MS=20000 node tests/Load/sync-storm.mjs   # realistic
   BASE=https://staging.example.com ATTEMPTS=30 JITTER_MS=0 node tests/Load/sync-storm.mjs      # worst case
   php artisan tinker --execute="require 'tests/Load/verify.php';"
   ```

The counts must grow by exactly the `EXPECTED new rows` the script prints (each change
applied once despite the re-send), with `attempts_without_xp` and `failed_jobs` at 0.
