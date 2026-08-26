<?php

namespace App\Support;

use DOMComment;
use DOMDocument;
use DOMElement;
use DOMNode;
use DOMProcessingInstruction;

/**
 * Sanitizer for rich-text fields. The composer emits the tags the mailer
 * template can print (emphasis, alignment, lists, links, images, tables,
 * rules); everything else is unwrapped or dropped on the way in, and only
 * the attributes each tag needs survive, so the stored document is inert
 * no matter what the client sent.
 */
class Html
{
    /** tag => allowed attributes. Unlisted tags are unwrapped (text kept). */
    private const TAGS = [
        'p' => ['style'],
        'br' => [],
        'hr' => [],
        'strong' => [], 'b' => [],
        'em' => [], 'i' => [],
        'u' => [], 's' => [],
        'ul' => [], 'ol' => [],
        'li' => [],
        'a' => ['href'],
        'img' => ['src', 'alt'],
        'table' => [], 'thead' => [], 'tbody' => [], 'tfoot' => [], 'tr' => [],
        'th' => ['colspan', 'rowspan'],
        'td' => ['colspan', 'rowspan'],
    ];

    /** Removed with their content — never meaningful in a newsletter body. */
    private const DROP = [
        'script', 'style', 'iframe', 'object', 'embed', 'svg', 'math',
        'form', 'input', 'button', 'textarea', 'select', 'colgroup', 'col',
    ];

    private const ALIGNMENTS = ['left', 'right', 'center', 'justify'];

    public static function clean(?string $html): string
    {
        $html = trim($html ?? '');
        if ($html === '') {
            return '';
        }

        $doc = new DOMDocument();
        libxml_use_internal_errors(true);
        $doc->loadHTML(
            '<?xml encoding="UTF-8"><div>'.$html.'</div>',
            LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD,
        );
        libxml_clear_errors();

        $root = $doc->getElementsByTagName('div')->item(0);
        if (! $root) {
            return '';
        }

        self::scrub($root);

        $out = '';
        foreach (iterator_to_array($root->childNodes) as $child) {
            $out .= $doc->saveHTML($child);
        }

        return trim($out);
    }

    private static function scrub(DOMNode $node): void
    {
        // Copy first: unwrapping and removal mutate the live child list.
        foreach (iterator_to_array($node->childNodes) as $child) {
            if ($child instanceof DOMComment || $child instanceof DOMProcessingInstruction) {
                $node->removeChild($child);
                continue;
            }

            if (! $child instanceof DOMElement) {
                continue;
            }

            self::scrub($child);

            $tag = strtolower($child->nodeName);

            if (in_array($tag, self::DROP, true)) {
                $node->removeChild($child);
                continue;
            }

            if (! array_key_exists($tag, self::TAGS)) {
                // Unknown tag (div, span, h1, ...): keep its content, lose the tag.
                while ($child->firstChild) {
                    $node->insertBefore($child->firstChild, $child);
                }
                $node->removeChild($child);
                continue;
            }

            self::scrubAttributes($child, self::TAGS[$tag]);
        }
    }

    private static function scrubAttributes(DOMElement $el, array $allowed): void
    {
        foreach (iterator_to_array($el->attributes) as $attr) {
            $name = strtolower($attr->name);
            $value = $attr->value;

            if (! in_array($name, $allowed, true)) {
                $el->removeAttribute($attr->name);
                continue;
            }

            $kept = match ($name) {
                'style' => self::alignmentOnly($value),
                'href', 'src' => self::safeUrl($value),
                'colspan', 'rowspan' => ctype_digit($value) ? $value : null,
                default => $value, // alt
            };

            if ($kept === null) {
                $el->removeAttribute($attr->name);
            } else {
                $el->setAttribute($attr->name, $kept);
            }
        }
    }

    /** The only inline style the template honors is text alignment. */
    private static function alignmentOnly(string $style): ?string
    {
        if (preg_match('/text-align\s*:\s*(left|right|center|justify)/i', $style, $m)) {
            return 'text-align: '.strtolower($m[1]);
        }

        return null;
    }

    private static function safeUrl(string $url): ?string
    {
        $url = trim($url);
        if ($url === '') {
            return null;
        }

        // Scheme check on a copy with whitespace/control chars removed, so
        // "java\nscript:" style smuggling cannot slip through.
        $flat = preg_replace('/[\s\x00-\x1f]+/', '', $url) ?? '';
        if (preg_match('/^(?:javascript|data|vbscript):/i', $flat)) {
            return null;
        }

        return $url;
    }
}
