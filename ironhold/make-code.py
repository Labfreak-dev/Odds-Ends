#!/usr/bin/env python3
"""Cut a redeem code for Ironhold Idle.

  python3 ironhold/make-code.py LAUNCH1 G5000 C3 R2
  -> IRON-LAUNCH1.G5000.C3.R2-XXXXXX

The first word is the code's name: a save can redeem each name once, so use a
new name for each hand-out. Rewards are a letter and a number:
  G gold   S scrap   C chests   F shrimp   H shards   R of every rune
  I Starsteel   K delve keys   E essence
  U reveals the unlimited-resources switch under Redeem (any number)
  L every combat skill to that level (99 at most)
  Y the Sovereign harness and its three weapons, into storage (any number)
  T Legendary kits for all three styles and every weapon at that tier index
    (9 = Starsteel), into storage and then the pack
The signature is the same hash the game checks (see rdSig in index.html).
"""
import sys
SALT='ironhold'+'-keeper-'+'2026'
def sig(body):
    h=2166136261
    for ch in body+SALT:
        h^=ord(ch); h=(h*16777619)&0xffffffff
    s=''
    n=h
    while n: s='0123456789abcdefghijklmnopqrstuvwxyz'[n%36]+s; n//=36
    return s.rjust(7,'0')[-6:].upper()
def main(a):
    if len(a)<2: print(__doc__); sys.exit(1)
    name=a[0].upper(); parts=[x.upper() for x in a[1:]]
    for p in parts:
        if p[0] not in 'GSCFHRIKELYTU' or not p[1:].isdigit() or int(p[1:])<=0: sys.exit('bad reward: '+p)
    if not name.isalnum(): sys.exit('the name must be letters and digits only')
    body='.'.join([name]+parts); print('IRON-'+body+'-'+sig(body))
if __name__=='__main__': main(sys.argv[1:])
