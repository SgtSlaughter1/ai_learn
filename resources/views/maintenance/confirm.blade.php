<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <title>Maintenance · {{ $action }}</title>
    <style>
        body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #F7F4EC; color: #202522;
               font: 16px/1.5 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; padding: 16px; box-sizing: border-box; }
        main { width: 100%; max-width: 420px; background: #FFFCF5; border: 1px solid #DDE1D9; border-radius: 14px; padding: 24px; }
        h1 { font-size: 20px; margin: 0 0 8px; }
        p { margin: 0 0 16px; color: #4a524d; }
        .danger { color: #B94A48; font-weight: 600; }
        label { display: block; font-size: 14px; font-weight: 600; margin-bottom: 6px; }
        input { width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid #DDE1D9; border-radius: 10px; font: inherit; }
        button { margin-top: 16px; width: 100%; padding: 11px; border: 0; border-radius: 10px; font: inherit; font-weight: 600;
                 color: #fff; background: {{ $destructive ? '#B94A48' : '#183B2B' }}; cursor: pointer; }
    </style>
</head>
<body>
<main>
    <h1>/{{ $action }}</h1>
    <p class="{{ $destructive ? 'danger' : '' }}">{{ $description }}</p>
    <form method="POST" action="/{{ $action }}">
        @csrf
        <label for="token">Maintenance token</label>
        <input id="token" name="token" type="password" autocomplete="off" required autofocus>
        <button type="submit">Run</button>
    </form>
</main>
</body>
</html>
