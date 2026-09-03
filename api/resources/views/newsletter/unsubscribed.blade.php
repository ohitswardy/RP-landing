<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>{{ $found ? 'Unsubscribed' : 'Link not recognised' }} · REGIS Partners</title>
<style>
  body { margin: 0; background: #f4f4f2; font-family: Arial, Helvetica, sans-serif; color: #2b2b2b; }
  main { max-width: 520px; margin: 12vh auto; background: #fff; border: 1px solid #e3e3df; padding: 36px 40px; }
  .eyebrow { font-size: 10.5px; letter-spacing: 0.18em; text-transform: uppercase; color: #b07a1c; margin: 0 0 14px; }
  h1 { font-size: 22px; line-height: 1.3; color: #0f1b33; margin: 0 0 12px; }
  p { font-size: 14px; line-height: 1.6; margin: 0 0 10px; }
  .muted { color: #6b6f76; font-size: 12.5px; }
</style>
</head>
<body>
<main>
  <p class="eyebrow">REGIS Partners · Research mailings</p>
@if (! $found)
  <h1>That link is not recognised.</h1>
  <p>The unsubscribe link may have been copied incompletely. Reply to any REGIS mailing and we will remove you by hand.</p>
@elseif ($already)
  <h1>You are already unsubscribed.</h1>
  <p>{{ $email }} no longer receives REGIS research mailings.</p>
@else
  <h1>You have been unsubscribed.</h1>
  <p>{{ $email }} will no longer receive REGIS research mailings.</p>
@endif
  <p class="muted">Changed your mind? Subscribe again from the newsletter form on the REGIS website.</p>
</main>
</body>
</html>
