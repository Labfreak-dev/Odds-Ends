#!/usr/bin/env python3
"""Stamp index.html with the current hash of art.js so a changed art file busts the browser cache.
Run after any change to art.js:  python3 ironhold/stamp-art.py"""
import hashlib,re,os
here=os.path.dirname(os.path.abspath(__file__))
h=hashlib.sha1(open(os.path.join(here,'art.js'),'rb').read()).hexdigest()[:8]
p=os.path.join(here,'index.html'); s=open(p).read()
s2,n=re.subn(r"const ART_V='[0-9a-f]*';","const ART_V='%s';"%h,s)
assert n==1,'ART_V not found exactly once'
size=os.path.getsize(os.path.join(here,'art.js'))
s2,n=re.subn(r"const ART_BYTES=\d+;","const ART_BYTES=%d;"%size,s2)
assert n==1,'ART_BYTES not found exactly once'
open(p,'w').write(s2); print('art.js stamped',h,size,'bytes')
