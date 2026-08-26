# Security policy

## Supported versions

Security fixes are provided for the latest published 1.x release and current 1.0 release candidate.

## Reporting

Please report vulnerabilities privately through GitHub's security-advisory form for `coji/perlscript-web`. Do not open a public issue before a fix is available.

Perl source is page-authored executable code and `perlscript-web` is not a sandbox. A report should distinguish escaping the documented interpreter boundary from executing capabilities already granted to page JavaScript. DOM output is text-only by design; regressions that interpret untrusted output as HTML are security issues.
