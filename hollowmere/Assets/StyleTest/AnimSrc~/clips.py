# Attack clip recipes (30 fps). Each clip's contact/release frame equals the owning skill's damage/projectile time
# (skill duration x 30 x normalised time), so StSkillDb effects/VFX land on the new hit frames.
import math
from mathutils import Vector
import hmanim as H
from hmanim import UP, FWD, LEFT

V = lambda x, y, z: Vector((x, y, z))
Z0 = V(0, 0, 0)


def shake(f0, f1, amp, step=1.5):
    """Alternating +/- keys (hold tremble / hit-stop impact buzz)."""
    k = [(f0, 0.0)]; f = f0 + step; s = 1
    while f < f1: k.append((f, amp * s)); s = -s; f += step
    k.append((f1, 0.0)); return k


def side_frame(M):
    R = (M['upperarm.r'].translation - M['upperarm.l'].translation).normalized()
    F = UP.cross(R).normalized(); return R, F


def cheek(M, f):
    """String-hand anchor: beside the jaw on the draw side (chibi head: ~0.2 out from the head bone, a bit up)."""
    R, F = side_frame(M); h = M['head'].translation
    return h + UP * 0.10 + R * 0.20 + F * 0.06


def cheek_pole(M, f):
    R, F = side_frame(M); return M['upperarm.r'].translation + R * 0.35 - F * 0.25 + UP * 0.05


def gather(M, f):
    """Off hand cups the staff just above the casting hand (spell gather)."""
    return M['wrist.r'].translation + UP * 0.16 + LEFT * 0.06 + FWD * 0.04


def gather_pole(M, f): return M['upperarm.l'].translation + LEFT * 0.35 - UP * 0.2


def build(kk, ual):
    C = []
    D = kk
    # ================================================= KNIGHT (sword R, shield L)
    c = H.Clip('HM_K_Slash', 24, hits=[11])
    c.src(D['Melee_1H_Attack_Slice_Diagonal'], [(0, 0), (5, 7, 'out'), (8, 9), (11, 13.2, 'snap'), (14, 13.6), (17, 17, 'out'), (24, 30, 'io')])
    c.add('spine', UP, [(0, 0), (7, -28), (9, -32), (11, 14), (14, 17), (17, 22), (24, 0)])
    c.add('spine', LEFT, [(0, 0), (8, -6), (11, 12), (14, 13), (18, 8), (24, 0)])
    c.add('chest', LEFT, shake(11, 14, 1.5))
    c.hips([(0, Z0), (8, V(0, -.03, -.02)), (11, V(0, -.06, .06)), (15, V(0, -.06, .07)), (24, Z0)])
    C.append(c)

    c = H.Clip('HM_K_Whirlwind', 36, hits=[18, 27])
    c.src(D['Melee_2H_Attack_Spin'], [(0, 0), (9, 18, 'out'), (12, 20), (30, 47, 'in'), (36, 57, 'io')])
    c.add('spine', UP, [(0, 0), (10, -35), (12, -42), (15, 0), (36, 0)])
    c.add('spine', LEFT, [(0, 0), (10, -4), (14, 10), (28, 10), (36, 0)])
    c.hips([(0, Z0), (10, V(0, -.05, 0)), (13, V(0, -.07, 0)), (28, V(0, -.07, 0)), (36, Z0)])
    C.append(c)

    c = H.Clip('HM_K_Bash', 30, hits=[14])
    c.src(D['Melee_Block_Attack'], [(0, 0), (9, 9, 'out'), (12, 10.5), (14, 15, 'snap'), (17, 15.4), (21, 20, 'out'), (30, 32, 'io')])
    c.add('spine', UP, [(0, 0), (9, 22), (12, 26), (14, -14), (17, -16), (20, -20), (30, 0)])
    c.add('spine', LEFT, [(0, 0), (10, -8), (14, 14), (17, 15), (30, 0)])
    c.add('chest', UP, shake(14, 17, 1.5))
    c.hips([(0, Z0), (10, V(0, -.03, -.03)), (14, V(0, -.05, .10)), (18, V(0, -.05, .11)), (30, Z0)])
    C.append(c)

    c = H.Clip('HM_K_Charge', 30, hits=[18])
    c.src(D['Melee_1H_Attack_Stab'], [(0, 0), (6, 8, 'out'), (8, 9), (16, 12), (18, 22, 'snap'), (21, 22.4), (24, 28, 'out'), (30, 48, 'io')])
    c.add('spine', LEFT, [(0, 0), (6, -8), (8, -10), (10, 22), (16, 26), (18, 20), (21, 20), (30, 0)])
    c.hips([(0, Z0), (6, V(0, -.05, -.04)), (9, V(0, -.08, 0)), (16, V(0, -.08, .05)), (18, V(0, -.06, .12)), (21, V(0, -.06, .12)), (30, Z0)])
    C.append(c)

    c = H.Clip('HM_K_Slam', 36, hits=[21]); c.max_arm = 20  # ground smash: let the blade tip meet the floor rather than lift the arm
    c.src(D['Melee_1H_Attack_Jump_Chop'], [(0, 0), (7, 5, 'out'), (10, 6), (17, 16, 'out'), (19, 18), (21, 24, 'snap'), (25, 24.5), (29, 29, 'out'), (36, 40, 'io')])
    c.add('spine', LEFT, [(0, 0), (10, 6), (17, -12), (19, -14), (21, 20), (25, 24), (36, 0)])
    c.add('chest', UP, shake(21, 25, 2))
    c.hips([(0, Z0), (7, V(0, -.06, 0)), (10, V(0, -.09, 0)), (13, V(0, .03, 0)), (19, V(0, .06, 0)), (21, V(0, -.08, .05)), (26, V(0, -.10, .05)), (36, Z0)])
    C.append(c)

    c = H.Clip('HM_K_Banner', 60, hits=[13])
    c.src(D['Melee_2H_Attack_Chop'], [(0, 0), (9, 20, 'out'), (11, 22), (13, 28, 'snap'), (17, 28.5), (24, 34, 'out'), (40, 48, 'io'), (60, 48)])
    c.add('spine', LEFT, [(0, 0), (9, -10), (13, 22), (17, 24), (30, 8), (44, 0)])
    c.hips([(0, Z0), (9, V(0, 0, -.02)), (13, V(0, -.09, .06)), (18, V(0, -.10, .06)), (40, Z0)])
    C.append(c)

    c = H.Clip('HM_P_Consecrate', 48, hits=[24])
    c.src(D['Ranged_Magic_Raise'], [(0, 0), (14, 22, 'out'), (18, 24)])
    c.src(D['Melee_1H_Attack_Chop'], [(16, 13), (21, 15), (24, 22, 'snap'), (28, 22.4), (34, 26, 'out'), (48, 33, 'io')], start=16, fade=3)
    c.add('spine', LEFT, [(0, 0), (14, -12), (21, -14), (24, 24), (30, 26), (48, 0)])
    c.add('chest', UP, shake(24, 28, 1.5))
    c.hips([(0, Z0), (14, V(0, .02, 0)), (21, Z0), (24, V(0, -.12, .04)), (30, V(0, -.12, .04)), (44, Z0)])
    C.append(c)

    c = H.Clip('HM_P_Judgement', 39, hits=[23])
    c.src(D['Melee_2H_Attack_Chop'], [(0, 0), (14, 21, 'out'), (19, 22.5), (23, 28, 'snap'), (27, 28.4), (32, 34, 'out'), (39, 48, 'io')])
    c.add('spine', LEFT, [(0, 0), (14, -12), (19, -14), (23, 22), (27, 26), (39, 0)])
    c.add('chest', LEFT, shake(15, 19, 1.0, 1.0) + shake(23, 27, 2.0)[1:])
    c.hips([(0, Z0), (19, V(0, .02, -.03)), (23, V(0, -.09, .06)), (28, V(0, -.10, .06)), (39, Z0)])
    C.append(c)

    # ================================================= RANGER (bow L, string hand R)
    def shot(name, n, draw_end, rels, up=False, tremble=0.0, settle=None):
        dr = D['Ranged_Bow_Draw_Up' if up else 'Ranged_Bow_Draw']; rl = D['Ranged_Bow_Release_Up' if up else 'Ranged_Bow_Release']
        aim = D['Ranged_Bow_Aiming_Idle']
        c = H.Clip(name, n, hits=list(rels))
        c.src(dr, [(0, 10), (2, 11), (draw_end, 31, 'io')])
        if not up: c.src(aim, [(draw_end, 0), (rels[0], min(44, rels[0] - draw_end))], start=draw_end, fade=2)
        ikw = [(0, 0), (max(1, draw_end - 3), 0), (draw_end, 1)]
        lean = [(0, 0), (2, 3)]; bowkick = [(0, 0)]; hips = [(0, Z0), (2, V(0, -.02, 0)), (draw_end, V(0, -.03, -.02))]
        for i, r in enumerate(rels):
            end = rels[i + 1] if i + 1 < len(rels) else n
            c.src(rl, [(r, 0), (r + 3, 4, 'snap'), (r + 6, 8, 'out'), (end if i + 1 == len(rels) else r + 7, 31 if i + 1 == len(rels) else 9, 'io')], start=r, fade=0.6)
            if i + 1 < len(rels):  # quick re-draw for the next arrow
                nd = min(r + 8, rels[i + 1] - 2)
                c.src(dr, [(r + 4, 22), (nd, 31, 'io')], start=r + 4, fade=3)
                if not up: c.src(aim, [(nd, 0), (rels[i + 1], 3)], start=nd, fade=1.5)
                ikw += [(r, 1), (r + 0.6, 0), (nd - 2, 0), (nd, 1)]
            else:
                ikw += [(r, 1), (r + 0.6, 0)]
            lean += [(r, 0), (r + 2, -7), (r + 7, -1)]
            bowkick += [(r, 0), (r + 2, -9), (r + 6, -2)]
            hips += [(r, V(0, -.03, -.02)), (r + 2, V(0, -.03, -.06)), (r + 8, V(0, -.02, -.02))]
        lean.append((n, 0)); bowkick.append((n, 0)); hips.append((n, Z0))
        c.ik('r', cheek, ikw, cheek_pole)
        c.add('spine', LEFT, lean)
        c.add('upperarm.l', LEFT, bowkick)
        if tremble: c.add('chest', UP, shake(draw_end + 1, rels[0] - 1, tremble, 2.0))
        c.hips(hips)
        return c

    C.append(shot('HM_R_QuickShot', 24, 7, [9]))
    C.append(shot('HM_R_Piercing', 33, 10, [20], tremble=0.8))
    C.append(shot('HM_R_Volley', 39, 11, [14], up=True))
    C.append(shot('HM_R_Multishot', 27, 6, [8]))
    C.append(shot('HM_R_Rain', 66, 9, [12], up=True))
    C.append(shot('HM_S_Snipe', 42, 12, [27], tremble=0.6))
    C.append(shot('HM_S_DeathMark', 36, 8, [11]))
    C.append(shot('HM_S_Deadeye', 66, 10, [21, 33, 45]))

    # ================================================= MAGE (staff R)
    sh = D['Ranged_Magic_Shoot']; ra = D['Ranged_Magic_Raise']; ch = D['Melee_2H_Attack_Chop']

    def bolt(name, n, rel, hold_to):
        c = H.Clip(name, n, hits=[rel])
        c.src(sh, [(0, 0), (rel - 3, 6, 'out'), (rel - 1, 7), (rel, 11, 'snap'), (rel + 2, 11.3), (hold_to, 13.5, 'out'), (n, 22, 'io')])
        c.ik('l', gather, [(0, 0), (rel - 4, 1), (rel - 1, 1), (rel, 0)], gather_pole)
        c.add('spine', UP, [(0, 0), (rel - 3, -16), (rel - 1, -18), (rel, 10), (rel + 3, 12), (n, 0)])
        c.add('spine', LEFT, [(0, 0), (rel - 3, -8), (rel, 12), (rel + 3, 13), (hold_to, 6), (n, 0)])
        c.add('chest', LEFT, shake(rel, rel + 2, 1.5, 1.0))
        c.hips([(0, Z0), (rel - 2, V(0, -.01, -.03)), (rel, V(0, -.03, .05)), (hold_to, V(0, -.02, .03)), (n, Z0)])
        return c

    C.append(bolt('HM_M_Bolt', 24, 9, 14))
    C.append(bolt('HM_M_Chain', 30, 9, 21))
    C.append(bolt('HM_F_Bomb', 54, 9, 20))

    c = H.Clip('HM_M_Meteor', 45, hits=[19, 36])
    c.src(ra, [(0, 0), (12, 22, 'out'), (17, 25)])
    c.src(sh, [(17, 7), (19, 11, 'snap'), (24, 11.3), (36, 14), (45, 22, 'io')], start=17, fade=1.5)
    c.ik('l', gather, [(0, 0), (6, 1), (16, 1), (19, 0)], gather_pole)
    c.add('spine', LEFT, [(0, 0), (12, -10), (17, -12), (19, 14), (24, 14), (36, 6), (38, -4), (45, 0)])
    c.add('chest', UP, shake(12, 17, 1.0, 1.0))
    c.hips([(0, Z0), (17, V(0, .02, 0)), (19, V(0, -.05, .05)), (36, V(0, -.03, .02)), (38, V(0, -.03, -.03)), (45, Z0)])
    C.append(c)

    c = H.Clip('HM_M_Nova', 36, hits=[20])
    c.src(ra, [(0, 0), (15, 20, 'out'), (18, 22)])
    c.src(ch, [(17, 22), (20, 28, 'snap'), (24, 28.4), (36, 48, 'io')], start=17, fade=1.5)
    c.ik('l', gather, [(0, 0), (5, 1), (17, 1), (20, 0)], gather_pole)
    c.add('spine', LEFT, [(0, 0), (15, -10), (18, -12), (20, 12), (24, 14), (36, 0)])
    c.add('chest', UP, shake(20, 24, 2.0))
    c.hips([(0, Z0), (15, V(0, .02, 0)), (20, V(0, -.11, .03)), (25, V(0, -.11, .03)), (36, Z0)])
    C.append(c)

    def push(M, f):
        R, F = side_frame(M); return M['chest'].translation + F * 0.55 + UP * 0.12 - R * 0.12

    c = H.Clip('HM_F_FlameWave', 36, hits=[12])
    c.src(sh, [(0, 0), (8, 6, 'out'), (11, 7), (12, 11, 'snap'), (14, 11.3), (26, 14), (36, 22, 'io')])
    c.ik('l', gather, [(0, 0), (4, 1), (11, 1), (12, 0)], gather_pole)
    c.ik('l', push, [(11, 0), (12.5, 1), (24, 1), (30, 0)])
    c.add('spine', UP, [(0, 0), (8, -30), (11, -34), (12, 12), (16, 16), (36, 0)])
    c.add('spine', LEFT, [(0, 0), (8, -6), (12, 14), (24, 12), (36, 0)])
    c.add('chest', LEFT, shake(12, 15, 1.5, 1.0))
    c.hips([(0, Z0), (10, V(0, -.02, -.04)), (12, V(0, -.04, .07)), (24, V(0, -.04, .06)), (36, Z0)])
    C.append(c)

    def above(M, f):
        R, F = side_frame(M); return M['head'].translation + UP * 0.55 + F * 0.12 - R * 0.18

    c = H.Clip('HM_M_Storm', 72, hits=[8])
    c.src(ra, [(0, 0), (6, 18, 'out'), (8, 22, 'snap'), (60, 46), (72, 50, 'io')])
    c.ik('l', gather, [(0, 0), (3, 1), (6, 1), (8, 0)], gather_pole)
    c.ik('l', above, [(7, 0), (9, 1), (58, 1), (66, 0)])
    c.add('spine', LEFT, [(0, 0), (6, 6), (8, -12), (12, -14), (58, -10), (68, 0)])
    c.add('chest', UP, shake(10, 58, 1.0, 2.5))
    c.hips([(0, Z0), (6, V(0, -.04, 0)), (8, V(0, .02, -.02)), (58, V(0, 0, -.02)), (72, Z0)])
    C.append(c)

    c = H.Clip('HM_F_Inferno', 72, hits=[14, 29])
    c.src(ra, [(0, 0), (10, 20, 'out'), (12, 22)])
    c.src(ch, [(11, 22), (14, 28, 'snap'), (18, 28.4), (26, 32, 'out'), (50, 34), (72, 48, 'io')], start=11, fade=1.5)
    c.ik('l', gather, [(0, 0), (4, 1), (11, 1), (14, 0)], gather_pole)
    c.add('spine', LEFT, [(0, 0), (10, -12), (12, -14), (14, 13), (18, 15), (29, 10), (31, 13), (50, 8), (72, 0)])
    c.add('chest', UP, shake(14, 18, 2.0) + shake(29, 32, 1.2)[1:])
    c.hips([(0, Z0), (10, V(0, .02, 0)), (14, V(0, -.11, .04)), (19, V(0, -.11, .04)), (50, V(0, -.08, .03)), (72, Z0)])
    C.append(c)
    return C


# skill id -> (clip, class) ; the shots/runner side gets the same mapping via AnimMap keys
CLASS = {'K': 'knight', 'P': 'knight', 'R': 'ranger', 'S': 'ranger', 'M': 'mage', 'F': 'mage'}
