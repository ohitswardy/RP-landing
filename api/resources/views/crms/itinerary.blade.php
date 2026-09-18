{{-- The itinerary PDF (dompdf). Same sections as the on-screen view in web/src/crms/modules/events/Itinerary.tsx. --}}
@php
    $ev = $event;
    $kindLabel = ['meeting' => 'Meeting', 'flight' => 'Flight', 'transport' => 'Ground Transportation', 'hotel' => 'Accommodation'];
    $coordinator = implode(' · ', array_filter([
        'Primary Coordinator: '.($ev['coordinator'] ?: '—'),
        $ev['telNo'] ? 'T: '.$ev['telNo'] : null,
        $ev['mobileNo'] ? 'M: '.$ev['mobileNo'] : null,
        $ev['email'] ? 'E: '.$ev['email'] : null,
    ]));
@endphp
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>{{ $title }}</title>
<style>
    @page { margin: 22mm 16mm 24mm 16mm; }
    body { font-family: "DejaVu Sans", sans-serif; font-size: 9.5pt; line-height: 1.45; color: #111; margin: 0; }
    .foot { position: fixed; bottom: -14mm; left: 0; right: 0; font-size: 7pt; color: #777; border-top: 0.5pt solid #ccc; padding-top: 3pt; }
    .cover { page-break-after: always; position: relative; height: 240mm; }
    .cover .bg { position: absolute; left: 0; right: 0; top: 60mm; width: 100%; }
    .cover .text { position: absolute; left: 6mm; top: 72mm; width: 110mm; color: #fff; }
    .cover .k { font-size: 8pt; letter-spacing: 2pt; text-transform: uppercase; opacity: .85; }
    .cover h1 { font-size: 22pt; font-weight: normal; margin: 6pt 0 4pt; line-height: 1.15; }
    .cover .range { font-size: 10.5pt; }
    /* Section titles as the legacy schedule set them: blue italic. */
    h2 { font-size: 15pt; font-weight: normal; font-style: italic; color: #1f6fb2; margin: 6pt 0 10pt; }
    h3 { font-size: 7.5pt; letter-spacing: 1.6pt; text-transform: uppercase; color: #777; margin: 10pt 0 4pt; }
    table { width: 100%; border-collapse: collapse; }
    td, th { vertical-align: top; padding: 3pt 4pt; border-bottom: 0.4pt dotted #ddd; }
    th { text-align: left; font-size: 7pt; letter-spacing: 1pt; text-transform: uppercase; color: #777; border-bottom: 0.6pt solid #bbb; }
    /* Participants as the legacy page set them: a dark group bar, a grey row per firm, name over title, contact lines on the right. */
    .group { background: #595959; color: #fff; font-size: 11pt; text-transform: uppercase; padding: 5pt 7pt; margin: 8pt 0 0; }
    .people td { border: 0; padding: 5pt 7pt; font-size: 9pt; line-height: 1.35; vertical-align: top; }
    .people tr.firm td { background: #e6e6e6; text-transform: uppercase; padding: 4pt 7pt; }
    .people tr.person td { background: #f2f2f2; border-top: 2pt solid #fff; }
    .people .title { color: #444; }
    .muted { color: #777; }
    .m { font-size: 8.5pt; }
    .day { background: #1c2745; color: #fff; font-size: 7.5pt; letter-spacing: 1.6pt; text-transform: uppercase; padding: 3pt 6pt; margin: 10pt 0 4pt; }
    .note { color: #b26a17; font-size: 8.5pt; }
    .time { width: 70pt; white-space: nowrap; }
    .avoid { page-break-inside: avoid; }
    /* Detailed schedule: a dark day banner, then a grey category bar over each entry's where / when / what / who block. */
    .fresh { page-break-before: always; margin-top: 0; }
    .dday { background: #595959; color: #fff; font-size: 12pt; padding: 6pt 7pt; margin: 14pt 0 12pt; }
    .entry { margin: 0 0 10pt; }
    .cat { background: #b3b3b3; color: #111; font-size: 10.5pt; text-transform: uppercase; padding: 5pt 7pt; }
    .entry table { background: #efefef; }
    .entry td { border: 0; padding: 5pt 7pt; font-size: 9pt; line-height: 1.35; }
    .entry tr + tr td { border-top: 2pt solid #fff; }
    .entry .up { text-transform: uppercase; }
    .c-where { width: 17%; }
    .c-when { width: 15%; white-space: nowrap; }
    .c-who { width: 28%; }
    .entry .note { padding-top: 0; }
</style>
</head>
<body>

<div class="cover">
    @if ($coverImage)<img class="bg" src="{{ $coverImage }}" alt="">@endif
    <div class="text">
        <div class="k">{{ $ev['categoryLabel'] }}{{ $ev['classification'] ? ' · '.$ev['classification'] : '' }}{{ $filteredTo ? ' · Personal schedule' : '' }}</div>
        <h1>{{ $ev['subject'] }}</h1>
        <div class="range">{{ $rangeLabel }}</div>
    </div>
</div>

<div class="foot">{{ $coordinator }} · Generated {{ $generatedLabel }}</div>

<h2>Participants</h2>
<div class="group">Investors</div>
@if (count($participants['investors']) === 0)
    <p class="muted">—</p>
@else
    <table class="people">
        @foreach ($participants['investors'] as $inv)
            <tr class="firm"><td colspan="2">{{ $inv['client'] }}</td></tr>
            @foreach ($inv['contacts'] as $c)
                <tr class="person">
                    <td style="width:55%">{{ $c['name'] }}<br><span class="title">{{ $c['position'] ?: '-' }}</span></td>
                    <td>Office: {{ $c['phone'] ?: '-' }}<br>Email: {{ $c['email'] ?: '-' }}</td>
                </tr>
            @endforeach
        @endforeach
    </table>
@endif
<div class="group">Regis</div>
@if (count($participants['regis']) === 0)
    <p class="muted">—</p>
@else
    <table class="people">
        @foreach ($participants['regis'] as $r)
            <tr class="person">
                <td style="width:55%">{{ $r['name'] }}<br><span class="title">{{ $r['position'] ?: '-' }}</span></td>
                <td>Office: {{ $r['office'] ?: '-' }}<br>Mobile: {{ $r['mobile'] ?: '-' }}<br>Email: {{ $r['email'] ?: '-' }}</td>
            </tr>
        @endforeach
    </table>
@endif

<h2>Summary Schedule</h2>
@if (count($summary) === 0)
    <p class="muted">No meetings scheduled.</p>
@else
    @foreach ($summary as $day)
        <div class="avoid">
            <div class="day">{{ $dayLabel($day['date']) }}</div>
            <table>
                @foreach ($day['meetings'] as $m)
                    <tr>
                        <td class="m time">{{ $m['time'] }}–{{ $m['timeEnd'] }} {{ $m['timezone'] }}</td>
                        <td>{{ $m['title'] }} <span class="muted">{{ $m['type'] }}</span></td>
                        <td class="muted">{{ $m['location'] }}</td>
                    </tr>
                @endforeach
            </table>
        </div>
    @endforeach
@endif

<h2 class="fresh">Detailed Schedule</h2>
@if (count($days) === 0)
    <p class="muted">Nothing scheduled{{ $filteredTo ? ' for this contact' : '' }}.</p>
@endif
@foreach ($days as $day)
    {{-- The day banner travels with its first entry so it never sits alone at the foot of a page. --}}
    {{-- Every entry the preview shows, a stay on each day it covers included, so the PDF never differs from the screen. --}}
    @foreach ($day['items'] as $it)
        @php $hasWho = collect($it['columns'])->contains(fn ($r) => $r['who'] !== []); @endphp
        @if ($loop->first)<div class="avoid"><div class="dday">{{ $dayLabel($day['date']) }}</div>@endif
        <div class="entry avoid">
            <div class="cat">{{ $kindLabel[$it['kind']] }}</div>
            <table>
                @foreach ($it['columns'] as $row)
                    <tr>
                        <td class="c-where">{{ $row['where'] }}</td>
                        <td class="c-when">{!! implode('<br>', array_map('e', [...$row['when'], ...($row['label'] ? [$row['label']] : [])])) !!}</td>
                        <td>@foreach ($row['what'] as $line)@if ($loop->first && $it['kind'] === 'meeting')<span class="up">{{ $line }}</span>@else{{ $line }}@endif<br>@endforeach</td>
                        @if ($hasWho)<td class="c-who">{!! implode('<br>', array_map('e', $row['who'])) !!}</td>@endif
                    </tr>
                @endforeach
                @if ($it['note'])
                    <tr><td colspan="{{ $hasWho ? 4 : 3 }}" class="note">NOTE: {{ $it['note'] }}</td></tr>
                @endif
            </table>
        </div>
        @if ($loop->first)</div>@endif
    @endforeach
@endforeach

</body>
</html>
