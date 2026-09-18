<?php

namespace App\Services\Crms;

use App\Models\Crms\Event;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\CarbonImmutable;

/**
 * The printed itinerary as a real PDF file — cover, participants, summary
 * and detailed schedule, the coordinator in every footer — built from the
 * same ScheduleAggregator data the on-screen view uses, so the two never
 * drift. Also the HTML digest that goes in the body when it is emailed.
 */
class ItineraryPdf
{
    public function __construct(private readonly ScheduleAggregator $aggregator) {}

    /** The aggregated schedule plus everything the templates need. */
    public function data(Event $event, ?int $contactId = null): array
    {
        $data = $this->aggregator->build($event, $contactId);
        $data['title'] = $this->title($event);
        $data['generatedLabel'] = CarbonImmutable::parse($data['generatedAt'])->timezone(config('app.timezone'))->format('d M Y H:i');
        $data['dayLabel'] = fn (string $ymd) => CarbonImmutable::parse($ymd)->format('l, d M Y');
        $data['rangeLabel'] = $this->range($data['event']['startDate'], $data['event']['endDate']);
        $data['coverImage'] = $this->asset('itinerary-cover.png');

        return $data;
    }

    /** PDF bytes. */
    public function render(Event $event, ?int $contactId = null): string
    {
        $data = $this->data($event, $contactId);
        $pdf = Pdf::loadView('crms.itinerary', $data)->setPaper('a4');
        $pdf->render();

        // Page numbers only exist once the document has flowed, so they go on as canvas text;
        // the logo is stamped on every page after the cover, which carries its own.
        $canvas = $pdf->getDomPDF()->getCanvas();
        $font = $pdf->getDomPDF()->getFontMetrics()->getFont('DejaVu Sans');
        $canvas->page_text($canvas->get_width() - 100, $canvas->get_height() - 28, 'Page {PAGE_NUM} of {PAGE_COUNT}', $font, 7, [0.47, 0.47, 0.47]);
        $logo = resource_path('pdf/regis-logo.png');
        if (is_file($logo)) {
            $canvas->page_script(function (int $page, int $count, $canvas) use ($logo) {
                if ($page > 1) {
                    $canvas->image($logo, $canvas->get_width() - 46 - 80, 22, 80, 35);
                }
            });
        }

        return $pdf->output();
    }

    /** The email body: a day-by-day digest with the PDF attached. */
    public function emailHtml(Event $event, ?int $contactId = null): string
    {
        return view('crms.itinerary-email', $this->data($event, $contactId))->render();
    }

    /** "<Classification|Category> Schedule - <Subject>", the legacy file and subject line. */
    public function title(Event $event): string
    {
        $kind = $event->classification ?: ($event->category()?->label() ?? 'Event');

        return "$kind Schedule - ".$event->subject();
    }

    public function filename(Event $event): string
    {
        $safe = preg_replace('/[\\\\\/:*?"<>|]+/', '-', $this->title($event)) ?? 'Itinerary';

        return trim($safe).' ('.now()->format('d M Y Hi').').pdf';
    }

    private function range(?string $from, ?string $to): string
    {
        if (! $from) {
            return '';
        }
        $a = CarbonImmutable::parse($from);
        $b = $to ? CarbonImmutable::parse($to) : $a;

        return $a->equalTo($b) ? $a->format('l, d M Y') : $a->format('l, d M Y').' – '.$b->format('l, d M Y');
    }

    private function asset(string $file): ?string
    {
        $path = resource_path('pdf/'.$file);

        return is_file($path) ? 'data:image/png;base64,'.base64_encode((string) file_get_contents($path)) : null;
    }
}
