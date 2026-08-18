"""Brace depth through style.css, ignoring comments.

Counting braces is not enough and that is not theoretical: moving a block with
a slice that ended at the first `}` after a one-line rule left the media query
open *and* an orphan `}` behind, twice in one sitting. The two cancel, so the
count balances and every rule below the open query silently becomes
conditional on a phone width — the board's gold rings vanished at desktop and
nothing looked wrong.

Walking the depth catches both halves: a `}` at depth zero is an orphan, and a
non-zero depth at the end is a block nobody closed.

    python scripts/check_css.py
"""

import re
import sys
from pathlib import Path

CSS = Path(__file__).resolve().parent.parent / "style.css"


def main() -> int:
    text = CSS.read_text(encoding="utf-8")
    # Comments can hold braces, and several in this file do.
    plain = re.sub(r"/\*.*?\*/", lambda m: "\n" * m.group().count("\n"), text, flags=re.S)

    depth = 0
    problems = []
    for lineno, line in enumerate(plain.splitlines(), 1):
        for ch in line:
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth < 0:
                    problems.append(f"line {lineno}: a closing brace with nothing open")
                    depth = 0

    if depth:
        problems.append(f"end of file: {depth} block(s) never closed")

    for p in problems:
        print("style.css:", p)
    print("OK" if not problems else "FAILED")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
