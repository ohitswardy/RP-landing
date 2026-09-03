{{-- The house mailer for report and ad-hoc blasts. Tables and inline styles
     only: Outlook desktop renders with Word's engine. Every field is escaped;
     $body is the editor fragment after Html::clean. --}}
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{ $subject }}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f2;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f2;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="680" cellpadding="0" cellspacing="0" border="0" style="width:680px;max-width:100%;background:#ffffff;border:1px solid #e3e3df;">
  <tr>
    <td style="padding:22px 28px;border-bottom:1px solid #e3e3df;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td valign="middle"><img src="{{ $logo }}" alt="REGIS Partners" width="150" style="display:block;border:0;height:auto;max-width:150px;"></td>
          <td valign="middle" align="right" style="font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#6b6f76;">Research</td>
        </tr>
      </table>
    </td>
  </tr>
@if ($report)
@php
  $tags = array_values(array_filter([$report->company?->symbol, $report->company?->name, $report->category]));
  $meta = array_values(array_filter([
      $report->analyst,
      $report->date?->format('j F Y'),
      $report->rating ? $report->rating.' rating' : null,
      $report->pages > 0 ? $report->pages.' pages' : null,
  ]));
@endphp
  <tr>
    <td style="padding:24px 28px 0;font-family:Arial,Helvetica,sans-serif;">
@if ($tags !== [])
      <p style="margin:0 0 8px;font-size:10.5px;letter-spacing:0.16em;text-transform:uppercase;color:#b07a1c;">{{ implode(' · ', $tags) }}</p>
@endif
      <h1 style="margin:0 0 8px;font-size:21px;line-height:1.3;font-weight:bold;color:#0f1b33;">{{ $report->title }}</h1>
@if ($meta !== [])
      <p style="margin:0;font-size:12.5px;color:#6b6f76;">{{ implode(' · ', $meta) }}</p>
@endif
    </td>
  </tr>
@endif
  <tr>
    <td style="padding:22px 28px 8px;font-family:Arial,Helvetica,sans-serif;font-size:13.5px;line-height:1.6;color:#2b2b2b;">
      {!! $body !!}
    </td>
  </tr>
@if ($link)
  <tr>
    <td style="padding:8px 28px 24px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr><td style="background:#0f1b33;">
          <a href="{{ $link }}" style="display:inline-block;padding:12px 22px;font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#ffffff;text-decoration:none;">{{ $linkLabel }} &rarr;</a>
        </td></tr>
      </table>
@if ($variant === 'local')
      <p style="margin:10px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#6b6f76;">The link opens on the REGIS client portal once you sign in.</p>
@endif
    </td>
  </tr>
@endif
@if ($analyst)
  <tr>
    <td style="padding:20px 28px;border-top:1px solid #e3e3df;font-family:Arial,Helvetica,sans-serif;font-size:12.5px;line-height:1.55;color:#2b2b2b;">
      <p style="margin:0;font-weight:bold;color:#0f1b33;">{{ $analyst->name }}</p>
@if (($analyst->roles[0] ?? '') !== '')
      <p style="margin:0;color:#6b6f76;">{{ $analyst->roles[0] }}</p>
@endif
      <p style="margin:6px 0 0;">
@if ($analyst->phone)
        {{ $analyst->phone }}<br>
@endif
@if ($analyst->email)
        <a href="mailto:{{ $analyst->email }}" style="color:#0f1b33;">{{ $analyst->email }}</a>
@endif
      </p>
    </td>
  </tr>
@endif
  <tr>
    <td style="padding:18px 28px;background:#0f1b33;font-family:Arial,Helvetica,sans-serif;font-size:10.5px;line-height:1.6;color:#b9c0cc;">
      <p style="margin:0;">REGIS Partners, Inc. &middot; <a href="{{ $site }}" style="color:#e9d29a;text-decoration:none;">{{ preg_replace('#^https?://#', '', $site) }}</a></p>
      <p style="margin:6px 0 0;">For institutional and qualified investors only. This message and any attachment are confidential and intended solely for the addressee; onward distribution is not permitted.</p>
@if ($unsubscribeUrl)
      <p style="margin:6px 0 0;"><a href="{{ $unsubscribeUrl }}" style="color:#b9c0cc;">Unsubscribe from REGIS mailings</a></p>
@endif
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>
