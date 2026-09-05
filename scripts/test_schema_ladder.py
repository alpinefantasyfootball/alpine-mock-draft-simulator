"""listLeagues()'s schema ladder, against every database a deploy can meet.

The site deploys itself from git and the worker does not, so worker code is
at some point live against a database that has not had the latest migration
applied. listLeagues() answers that by trying progressively older queries --
and the value of that is entirely in whether the older ones actually work,
which nothing checked.

They did not. Adding 0008's draft columns to a SELECT fragment SHARED by both
attempts meant both named `draft_at`, so against a database without 0008 both
threw and the function answered `[]` -- a signed-in manager told they have no
leagues at all, which is the exact failure the fallback existed to prevent.

So this reads the real SQL out of store.js rather than restating it. A copy
here would pass while the shipped query was broken, which is the failure being
tested for wearing a test's clothes.

Standard library only, like the rest of the pipeline. sqlite3 is what D1 is.

    py scripts/test_schema_ladder.py
"""

import sqlite3, io, re, sys

# Pull the SQL out of store.js rather than restating it: a copy here would
# pass while the real query was broken, which is the whole failure being
# tested for.
src = io.open('worker/store.js', encoding='utf-8').read()
block = src[src.index('const LEAGUE_READS = ['):src.index('];', src.index('const LEAGUE_READS = ['))]
reads = []
for chunk in re.findall(r'((?:\s*"[^"]*"\s*\+?)+),', block + ','):
    sql = ''.join(re.findall(r'"([^"]*)"', chunk))
    if sql.strip().upper().startswith('SELECT'):
        reads.append(sql)

print('rungs found in store.js:', len(reads))
assert len(reads) == 3, reads

MIGRATIONS = ['0005_leagues.sql', '0006_active_league.sql', '0008_draft_time.sql']

def db_at(level):
    """A database with the first `level` league migrations applied."""
    db = sqlite3.connect(':memory:')
    db.executescript("CREATE TABLE users (clerk_id TEXT PRIMARY KEY);")
    for f in MIGRATIONS[:level]:
        db.executescript(io.open('worker/migrations/' + f, encoding='utf-8').read())
    if level:
        db.execute("INSERT INTO users VALUES ('u1')")
        db.execute(
            "INSERT INTO connected_leagues"
            " (clerk_id,provider,league_id,owner_id,name,season,total_teams,connected_at,refreshed_at)"
            " VALUES ('u1','espn','65142363',NULL,'D-Town Boogie','2026',10,100,100)")
    return db

failures = 0
def check(what, ok):
    global failures
    print(('ok  ' if ok else 'x   ') + what)
    if not ok:
        failures += 1

# The real question: at every schema level a deploy can meet, does SOME rung
# answer, and is it the newest one that can?
for level, label in [(3, 'fully migrated'), (2, '0008 missing'), (1, '0005 only')]:
    db = db_at(level)
    winner = None
    for i, sql in enumerate(reads):
        try:
            rows = db.execute(sql, ('u1',)).fetchall()
            winner = i
            break
        except sqlite3.OperationalError:
            continue
    check('%-16s -> rung %s answers' % (label, winner), winner is not None and len(rows) == 1)
    # The newest rung that CAN work is the one that should win.
    expected = {3: 0, 2: 1, 1: 2}[level]
    check('%-16s -> and it is the newest usable one (%d)' % (label, expected), winner == expected)

# No table at all is an account with no leagues, not a crash.
db = db_at(0)
survived = True
for sql in reads:
    try:
        db.execute(sql, ('u1',)).fetchall()
        survived = False   # a missing table must not succeed
    except sqlite3.OperationalError:
        pass
check('no connected_leagues table -> every rung refuses, caller answers []', survived)

print('\nFAIL' if failures else '\nOK — the schema ladder')
sys.exit(1 if failures else 0)
