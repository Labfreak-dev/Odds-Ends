"""Headless proof of the three binder puzzles - The Case, Connections and Odd
One Out (batch 133). Each mode is built and PLAYED through its real tiles and
buttons; the builders are also hammered directly for fairness."""
import sys, pathlib
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = (ROOT / "index.html").as_uri()
ok = fail = 0
def check(name, cond, detail=""):
    global ok, fail
    if cond: ok += 1; print(f"  ok   {name}")
    else: fail += 1; print(f"  FAIL {name}  {detail}")
def show(pg, tab):
    pg.evaluate(f"()=>{{ uiEnterSection('{tab}'); document.querySelectorAll('main > section').forEach(s=>s.style.display='none'); document.getElementById('tab-{tab}').style.display='block'; }}")
    pg.wait_for_timeout(300)
with sync_playwright() as pw:
    br = pw.chromium.launch()
    pg = br.new_page(viewport={"width":1100,"height":1000})
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(URL); pg.wait_for_timeout(2400)
    pg.evaluate("()=>localStorage.clear()"); pg.reload(); pg.wait_for_timeout(2200)
    pg.evaluate("()=>{ state.credits=0; state.player.level=99; }")

    # ================= THE CASE =================
    print("=== the case ===")
    r = pg.evaluate("""()=>{ const out={}; for(const shape of ["line","grid"]) for(const diff of ["easy","normal","hard"]){
        const L=Object.assign({shape,diff}, CS_LAYOUTS[shape][diff]); let good=0, dealt=0, up=0;
        for(let i=0;i<20;i++){ const p=csBuild(L); if(!p) continue; dealt++;
          const solv = p.slots.every((s,j)=>{ const k=csKind(s.kind); if(!k.rel) return k.ok(p.answer[j], s.req, null); const ri=csRefIndex(j, s.req.dir, p.cols); return ri>=0 && k.ok(p.answer[j], s.req, p.answer[ri]); });
          if(solv) good++; p.slots.forEach(s=>{ if(csKind(s.kind).rel && s.req.dir==="up") up++; }); }
        out[shape+"/"+diff]={dealt, good, up, slots:L.cols*L.rows, hand:L.hand}; } return out; }""")
    check("every layout deals 20 of 20", all(v["dealt"]==20 for v in r.values()), r)
    check("the answer solves every case it dealt", all(v["good"]==v["dealt"] for v in r.values()), r)
    check("grid cases carry rules that look up", all(v["up"]>0 for k,v in r.items() if k.startswith("grid")), r)
    check("line cases never look up", all(v["up"]==0 for k,v in r.items() if k.startswith("line")), r)
    pg.evaluate("()=>{ csStats().mode='grid'; csStats().diff='hard'; }"); show(pg, "showcase")
    check("the lobby offers shape and difficulty pills", pg.locator(".cs-opt").count()==5)
    pg.evaluate("()=>document.getElementById('csStart').click()"); pg.wait_for_timeout(300)
    st = pg.evaluate("()=>({n:cs.n, cols:cs.cols, cells:document.querySelectorAll('.cs-slot').length, hand:document.querySelectorAll('.cs-card').length, cssCols:getComputedStyle(document.querySelector('.cs-case')).gridTemplateColumns.split(' ').length})")
    check("a 3x3 hard case lays nine slots in three columns", st["n"]==9 and st["cells"]==9 and st["cssCols"]==3 and st["hand"]==16, st)
    pg.evaluate("()=>{ for(let i=0;i<cs.n;i++){ const id=cs.answer[i].id; document.querySelector(`.cs-card[data-id='${id}']`).click(); document.querySelector(`.cs-slot[data-slot='${i}']`).click(); } }"); pg.wait_for_timeout(300)
    check("placing the answer through the real tiles closes the case", pg.evaluate("()=>cs.done && !!document.querySelector('.cs-summary') && document.querySelector('.cs-summary h3').textContent.includes('9 of 9')"))
    prize = pg.evaluate("()=>state.credits")
    check("the grid/hard prize is the reduced one (23,680)", prize==23680, prize)
    pg.evaluate("()=>{ state.credits=0; csStats().mode='line'; csStats().diff='normal'; cs=null; csStart(); for(let i=0;i<cs.n;i++){ cs.selected=cs.answer[i].id; csPlace(i); } }"); pg.wait_for_timeout(200)
    check("a normal line case pays 10,000", pg.evaluate("()=>state.credits")==10000, pg.evaluate("()=>state.credits"))
    pg.evaluate("()=>{ cs=null; csPaintLobby(); document.querySelector(\".cs-opt[data-key='easy']\").click(); }"); pg.wait_for_timeout(200)
    check("a picked difficulty persists in the save", pg.evaluate("()=>csStats().diff")=="easy")
    check("case wording says lower, never humbler", pg.evaluate("()=>!CS_KINDS.some(k=>/humbler/i.test(k.text({v:0})))"))

    # ================= CONNECTIONS =================
    print("=== connections ===")
    r = pg.evaluate("""()=>{ let n=0, dup=0, nulls=0, seen={}, bad=0;
        for(let i=0;i<100;i++){ const b=cxBuild(); if(!b){ nulls++; continue; } n++;
          const rules=b.groups.map(g=>g.rule); if(new Set(rules).size!==4) dup++; rules.forEach(x=>seen[x]=(seen[x]||0)+1);
          for(const g of b.groups){ const l=cxGroupLabel(g); if(!l||/undefined|NaN/.test(l)) bad++; if(g.cards.length!==4) bad++; } }
        return {boards:n, nulls, dup, bad, rules:Object.keys(seen).length}; }""")
    check("100 boards deal", r["boards"]==100 and r["nulls"]==0, r)
    check("no board repeats a rule type", r["dup"]==0, r)
    check("every group is four cards with a label", r["bad"]==0, r)
    check("all eight rule types come up", r["rules"]==8, r)
    show(pg, "connections")
    pg.evaluate("()=>document.getElementById('cxStart').click()"); pg.wait_for_timeout(300)
    check("a board of sixteen tiles", pg.locator(".cx-tile").count()==16)
    # near miss: three of group 0 plus one of group 1
    pg.evaluate("()=>{ const g0=cx.groups[0].cards.slice(0,3), g1=cx.groups[1].cards[0]; for(const c of g0.concat([g1])) document.querySelector(`.cx-tile[data-id='${c.id}']`).click(); document.getElementById('cxSubmit').click(); }"); pg.wait_for_timeout(200)
    check("three of a kind reads 'One away.'", pg.evaluate("()=>cx.note")=="One away.", pg.evaluate("()=>cx.note"))
    pg.evaluate("()=>{ document.getElementById('cxClear').click(); }"); pg.wait_for_timeout(500)
    pg.evaluate("""()=>{ for(const g of cx.groups.slice()){ if(cx.over) break; cx.picked=[]; for(const c of g.cards){ const t=document.querySelector(`.cx-tile[data-id='${c.id}']`); if(t) t.click(); } document.getElementById('cxSubmit').click(); } }"""); pg.wait_for_timeout(400)
    check("submitting the four groups through the tiles wins the board", pg.evaluate("()=>cx && cx.over && cx.found.length===4"), pg.evaluate("()=>cx && [cx.over, cx.found.length, cx.mistakes]"))

    # ================= ODD ONE OUT =================
    print("=== odd one out ===")
    r = pg.evaluate("""()=>{ let n=0, unfair=0, nulls=0, byName=0;
        for(let round=0; round<200; round++){ const q=ooMakeRound(round%12); if(!q){ nulls++; continue; } n++;
          const outs=ooOutliers(q.cards); if(outs.length!==1 || outs[0].index!==q.correct) unfair++;
          // the three must visibly agree on the shared property: for rarity that means the tier NAME
          const rest=q.cards.filter((c,i)=>i!==q.correct); const v=q.shared.of(rest[0]);
          if(!rest.every(c=>q.shared.of(c)===v) || q.shared.of(q.cards[q.correct])===v) unfair++;
          if(q.shared.id==="rarity" && new Set(rest.map(c=>RARITIES[c.rarity].name)).size!==1) byName++; }
        return {rounds:n, nulls, unfair, byName}; }""")
    check("200 rounds deal", r["rounds"]==200 and r["nulls"]==0, r)
    check("every round has exactly one arguable exception", r["unfair"]==0, r)
    check("rarity rounds agree on the tier NAME, not a hidden id", r["byName"]==0, r)
    show(pg, "oddone")
    pg.evaluate("()=>document.getElementById('ooStart').click()"); pg.wait_for_timeout(300)
    check("four tiles on the table", pg.locator("[data-i]").count()==4)
    pg.evaluate("()=>document.querySelector(`[data-i='${oo.q.correct}']`).click()"); pg.wait_for_timeout(200)
    check("the right call scores and keeps the lives", pg.evaluate("()=>oo.right===1 && oo.lives===OO_LIVES && oo.credits>0"))
    pg.evaluate("()=>document.getElementById('ooNext').click()"); pg.wait_for_timeout(300)
    pg.evaluate("()=>{ const wrong=(oo.q.correct+1)%4; document.querySelector(`[data-i='${wrong}']`).click(); }"); pg.wait_for_timeout(200)
    check("a wrong call costs a life", pg.evaluate("()=>oo.lives===OO_LIVES-1 && oo.streak===0"))
    check("the explanation names the shared property", pg.evaluate("()=>document.getElementById('ooStage').textContent.includes('The other three share')"))

    check("zero page errors across all three", not errs, errs[:3])
    br.close()
print()
if fail == 0: print("PUZZLES: all %d checks passed." % ok)
else: print("PUZZLES: %d FAILED, %d passed." % (fail, ok))
sys.exit(1 if fail else 0)
