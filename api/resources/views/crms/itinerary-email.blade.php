{{-- The body of the "email me the itinerary" message; the PDF rides along as an attachment. --}}
@php
    $ev = $event;
    $kindLabel = ['meeting' => 'MEETING', 'flight' => 'FLIGHT', 'transport' => 'GROUND TRANSPORTATION', 'hotel' => 'ACCOMMODATION'];
@endphp
<div style="font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #111; line-height: 1.5;">
    <p style="font-size: 16px; margin: 0 0 4px;"><b>{{ $title }}</b></p>
    <p style="margin: 0 0 16px; color: #555;">{{ $rangeLabel }}{{ $filteredTo ? ' · Personal schedule' : '' }}</p>

    <p style="margin: 0 0 4px;"><b>INVESTORS:</b></p>
    @if (count($participants['investors']) === 0)
        <p style="margin: 0 0 16px; color: #777;">—</p>
    @else
        <ul style="margin: 0 0 16px; padding-left: 18px;">
            @foreach ($participants['investors'] as $inv)
                <li>{{ $inv['client'] }}{{ $inv['contacts'] ? ' - '.implode(', ', array_column($inv['contacts'], 'name')) : '' }}</li>
            @endforeach
        </ul>
    @endif

    @foreach ($days as $day)
        <p style="margin: 14px 0 4px; padding: 3px 6px; background: #1c2745; color: #fff;"><b>{{ $dayLabel($day['date']) }}</b></p>
        <table cellpadding="0" cellspacing="0" style="border-collapse: collapse; width: 100%;">
            @foreach ($day['items'] as $it)
                <tr>
                    <td style="padding: 3px 8px 3px 0; white-space: nowrap; vertical-align: top; color: #555; width: 90px;">{{ $it['time'] }}{{ $it['timeEnd'] ? '–'.$it['timeEnd'] : '' }} {{ $it['timezone'] }}</td>
                    <td style="padding: 3px 0; vertical-align: top;">
                        <span style="font-size: 10px; color: #999; letter-spacing: 1px;">{{ $kindLabel[$it['kind']] }}</span><br>
                        <b>{{ $it['title'] }}</b>{{ $it['subtitle'] ? ' · '.$it['subtitle'] : '' }}
                        @if ($it['detail'])<br><span style="color: #555;">{{ $it['detail'] }}</span>@endif
                        @if ($it['people'])<br><span style="color: #555;">{{ implode(' · ', $it['people']) }}</span>@endif
                        @if ($it['note'])<br><span style="color: #b26a17;">NOTE: {{ $it['note'] }}</span>@endif
                    </td>
                </tr>
            @endforeach
        </table>
    @endforeach

    <p style="margin: 20px 0 0; font-size: 11px; color: #777;">Primary Coordinator: {{ $ev['coordinator'] ?: '—' }}{{ $ev['mobileNo'] ? ' · M: '.$ev['mobileNo'] : '' }}{{ $ev['telNo'] ? ' · T: '.$ev['telNo'] : '' }}{{ $ev['email'] ? ' · E: '.$ev['email'] : '' }}<br>Generated {{ $generatedLabel }} · The full itinerary is attached as a PDF.</p>
</div>
