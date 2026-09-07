<?php

namespace Tests\Unit\Crms;

use App\Casts\LegacyJson;
use App\Casts\LegacyTime;
use App\Models\Crms\Interaction;
use PHPUnit\Framework\TestCase;

/** The legacy columns hold '', 'null', malformed strings and the timepicker JSON — every shape must read cleanly. */
class LegacyCastsTest extends TestCase
{
    private function model(): Interaction
    {
        return new Interaction;
    }

    public function test_time_reads_timepicker_json_and_plain_strings(): void
    {
        $cast = new LegacyTime;
        $m = $this->model();

        $this->assertSame('13:30', $cast->get($m, 't', '{"hour":13,"minute":30,"second":0}', []));
        $this->assertSame('09:05', $cast->get($m, 't', '{"hour":9,"minute":5}', []));
        $this->assertSame('08:15', $cast->get($m, 't', '08:15', []));
        $this->assertSame('08:15', $cast->get($m, 't', '8:15:00', []));
        $this->assertNull($cast->get($m, 't', '', []));
        $this->assertNull($cast->get($m, 't', 'null', []));
        $this->assertNull($cast->get($m, 't', null, []));
        $this->assertNull($cast->get($m, 't', '{broken', []));
    }

    public function test_time_writes_byte_compatible_json(): void
    {
        $cast = new LegacyTime;
        $m = $this->model();

        $this->assertSame('{"hour":13,"minute":30,"second":0}', $cast->set($m, 't', '13:30', []));
        $this->assertNull($cast->set($m, 't', '', []));
        $this->assertNull($cast->set($m, 't', null, []));
    }

    public function test_json_tolerates_production_values(): void
    {
        $cast = new LegacyJson;
        $m = $this->model();

        $this->assertSame([], $cast->get($m, 'j', '', []));
        $this->assertSame([], $cast->get($m, 'j', 'null', []));
        $this->assertSame([], $cast->get($m, 'j', '[{"id":1', []));
        $this->assertSame([['id' => 1, 'name' => 'A']], $cast->get($m, 'j', '[{"id":1,"name":"A"}]', []));
        $this->assertSame('[{"id":1}]', $cast->set($m, 'j', [['id' => 1]], []));
        $this->assertSame('[]', $cast->set($m, 'j', 'not-an-array', []));
    }

    public function test_minutes_prefers_duration_then_time_span(): void
    {
        $i = new Interaction(['duration' => '45', 'time_start' => '09:00', 'time_end' => '10:30']);
        $this->assertSame(45, $i->minutes());

        $i = new Interaction(['duration' => null, 'time_start' => '09:00', 'time_end' => '10:30']);
        $this->assertSame(90, $i->minutes());

        $i = new Interaction(['duration' => '', 'time_start' => '10:30', 'time_end' => '09:00']);
        $this->assertSame(0, $i->minutes());
    }

    public function test_reference_is_zero_padded_to_ten_digits(): void
    {
        $i = new Interaction;
        $i->id = 48;
        $this->assertSame('0000000048', $i->reference());
    }
}
