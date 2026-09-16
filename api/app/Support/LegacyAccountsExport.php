<?php

namespace App\Support;

use RuntimeException;

/**
 * Reads `regis_accounts_export.sql` — the account extract from the old
 * regis.ph CMS — without loading it into MySQL. The file is plain INSERT
 * statements for three tables (`cms_user`, `client_account`,
 * `client_data_quality`); this walks the VALUES tuples and returns each row
 * keyed by the column list the statement names.
 */
class LegacyAccountsExport
{
    private string $sql;

    public function __construct(string $path)
    {
        if (! is_file($path)) {
            throw new RuntimeException("No export file at {$path}");
        }
        $this->sql = file_get_contents($path);
        if (! str_contains($this->sql, 'REGIS PARTNERS - ACCOUNT EXPORT')) {
            throw new RuntimeException('That file does not look like the Regis accounts export.');
        }
    }

    /** @return array<int, array<string, string|null>> */
    public function cmsUsers(): array
    {
        return $this->rows('cms_user');
    }

    /** @return array<int, array<string, string|null>> */
    public function clientAccounts(): array
    {
        return $this->rows('client_account');
    }

    /** Data-quality flags keyed by legacy client id. @return array<int, string[]> */
    public function dataQuality(): array
    {
        $out = [];
        foreach ($this->rows('client_data_quality') as $r) {
            $out[(int) $r['client_id']][] = $r['issue'];
        }

        return $out;
    }

    /** Every row of every INSERT for the table, as column => value. */
    private function rows(string $table): array
    {
        $out = [];
        $offset = 0;
        $needle = "INSERT INTO `{$table}`";

        while (($start = strpos($this->sql, $needle, $offset)) !== false) {
            $open = strpos($this->sql, '(', $start);
            $close = strpos($this->sql, ')', $open);
            $columns = array_map(
                fn (string $c) => trim($c, " \n\r\t`"),
                explode(',', substr($this->sql, $open + 1, $close - $open - 1)),
            );

            $values = stripos($this->sql, 'VALUES', $close);
            $pos = $values + 6;
            foreach ($this->tuples($pos) as $tuple) {
                if (count($tuple) !== count($columns)) {
                    throw new RuntimeException("Column count mismatch in {$table} near byte {$pos}");
                }
                $out[] = array_combine($columns, $tuple);
            }
            $offset = $pos;
        }

        return $out;
    }

    /**
     * Parses `(a, 'b', NULL), (...)…;` starting at $pos, leaving $pos after
     * the terminating semicolon. Handles backslash escapes and doubled quotes.
     */
    private function tuples(int &$pos): array
    {
        $sql = $this->sql;
        $n = strlen($sql);
        $rows = [];

        while ($pos < $n) {
            $this->skipSpace($pos);
            $c = $sql[$pos];
            if ($c === ';') {
                $pos++;
                break;
            }
            if ($c === ',') {
                $pos++;

                continue;
            }
            if ($c !== '(') {
                throw new RuntimeException('Expected a tuple at byte '.$pos.': '.substr($sql, $pos, 40));
            }
            $pos++;

            $row = [];
            while (true) {
                $this->skipSpace($pos);
                $c = $sql[$pos];

                if ($c === "'") {
                    $row[] = $this->quoted($pos);
                } elseif (strncasecmp(substr($sql, $pos, 4), 'NULL', 4) === 0) {
                    $row[] = null;
                    $pos += 4;
                } else {
                    $end = $pos;
                    while ($sql[$end] !== ',' && $sql[$end] !== ')') {
                        $end++;
                    }
                    $row[] = trim(substr($sql, $pos, $end - $pos));
                    $pos = $end;
                }

                $this->skipSpace($pos);
                if ($sql[$pos] === ',') {
                    $pos++;

                    continue;
                }
                if ($sql[$pos] === ')') {
                    $pos++;
                    break;
                }
                throw new RuntimeException('Malformed tuple at byte '.$pos.': '.substr($sql, $pos, 40));
            }
            $rows[] = $row;
        }

        return $rows;
    }

    private function quoted(int &$pos): string
    {
        $sql = $this->sql;
        $pos++; // opening quote
        $s = '';
        while (true) {
            $c = $sql[$pos];
            if ($c === '\\') {
                $next = $sql[$pos + 1];
                $s .= match ($next) {
                    'n' => "\n", 'r' => "\r", 't' => "\t", '0' => "\0", 'Z' => "\x1a",
                    default => $next,
                };
                $pos += 2;

                continue;
            }
            if ($c === "'") {
                if ($sql[$pos + 1] === "'") {
                    $s .= "'";
                    $pos += 2;

                    continue;
                }
                $pos++;

                return $s;
            }
            $s .= $c;
            $pos++;
        }
    }

    private function skipSpace(int &$pos): void
    {
        while ($pos < strlen($this->sql) && ctype_space($this->sql[$pos])) {
            $pos++;
        }
    }

    /* ── Decoding the CMS permission blob ─────────────────────── */

    /**
     * The legacy `CMS_Users_Access` blob: base64 of a JSON map of module =>
     * { options: { view }, items: { sub => { options: { view } } } }. Returns
     * the module and sub-module keys the account could open.
     *
     * @return string[]
     */
    public static function grantedModules(?string $b64): array
    {
        if (! $b64) {
            return [];
        }
        $json = json_decode(base64_decode($b64, true) ?: '', true);
        if (! is_array($json)) {
            return [];
        }

        $on = [];
        foreach ($json as $module => $def) {
            if (! empty($def['options']['view'])) {
                $on[] = $module;
            }
            foreach ((array) ($def['items'] ?? []) as $sub => $subDef) {
                if (! empty($subDef['options']['view'])) {
                    $on[] = $sub;
                }
            }
        }

        return $on;
    }
}
