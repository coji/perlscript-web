# Security policy

## Supported versions

Security fixes are provided for the latest published 1.x release.

## Reporting

Please report vulnerabilities privately through GitHub's security-advisory form for `coji/perlscript-web`. Do not open a public issue before a fix is available.

Perl source is page-authored executable code and `perlscript-web` is not a sandbox. A report should distinguish escaping the documented interpreter boundary from executing capabilities already granted to page JavaScript. DOM output and PerlUI `text()` are text-only by design. PerlUI rejects active document tags, event-handler attributes, HTML injection properties, and `javascript:` URL attributes. Regressions that interpret untrusted text as HTML or bypass those structured-UI checks are security issues.
