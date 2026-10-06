#!/usr/bin/env python3
"""Pack the icons Iron League actually shows into one nearest-neighbour atlas.

Source art stays out of the repo. Pass the curated folder:

    python3 iron-league/tools/pack-icons.py /path/to/curated

16px art is scaled 3x. 32px and 64px art are resized to 48px with nearest
neighbour (no smoothing, no generated pixels).
"""
import json
import sys
from pathlib import Path

from PIL import Image

CELL = 48
COLS = 12
OUT_DIR = Path(__file__).resolve().parents[1] / "assets" / "icons"

# frame id -> path under the curated root
FILES = {
    # Beowulf weapons, common and rare families
    "bw_sword_01_steel": "weapons/bw_sword_01_steel.png",
    "bw_sword_05_gold": "weapons/bw_sword_05_gold.png",
    "bw_sword_07_red": "weapons/bw_sword_07_red.png",
    "bw_bow_03_steel": "weapons/bw_bow_03_steel.png",
    "bw_bow_06_red": "weapons/bw_bow_06_red.png",
    "bw_bow_07_gold": "weapons/bw_bow_07_gold.png",
    "bw_bow_09_purple": "weapons/bw_bow_09_purple.png",
    "bw_staff_02_steel": "weapons/bw_staff_02_steel.png",
    "bw_staff_06_red": "weapons/bw_staff_06_red.png",
    "bw_staff_07_gold": "weapons/bw_staff_07_gold.png",
    "bw_staff_10_dark": "weapons/bw_staff_10_dark.png",
    "bw_tome_02_orange": "weapons/bw_tome_02_orange.png",
    "bw_tome_07_purple": "weapons/bw_tome_07_purple.png",
    "bw_dagger_01_steel": "weapons/bw_dagger_01_steel.png",
    "bw_dagger_03_gold": "weapons/bw_dagger_03_gold.png",
    "bw_assassin_s_dagger": "weapons/bw_assassin_s_dagger.png",
    "bw_poison_dagger": "weapons/bw_poison_dagger.png",
    "bw_mace_02_steel": "weapons/bw_mace_02_steel.png",
    "bw_mace_04_gold": "weapons/bw_mace_04_gold.png",
    "bw_flail_09_gold": "weapons/bw_flail_09_gold.png",
    "bw_flail_10_green": "weapons/bw_flail_10_green.png",
    "bw_broken_spear": "weapons/bw_broken_spear.png",
    "bw_ogre_club": "weapons/bw_ogre_club.png",
    "bw_ninja_star": "weapons/bw_ninja_star.png",
    # CaptainSkolot swords and axes, epic and legendary weapons
    "cs_sword_v4_01_steel": "weapons/alt-captainskolot-64px/cs_sword_v4_01_steel.png",
    "cs_sword_v4_07_gold": "weapons/alt-captainskolot-64px/cs_sword_v4_07_gold.png",
    "cs_sword_v4_10_orange": "weapons/alt-captainskolot-64px/cs_sword_v4_10_orange.png",
    "cs_sword_v4_11_green": "weapons/alt-captainskolot-64px/cs_sword_v4_11_green.png",
    "cs_axe_v1_11_red": "weapons/alt-captainskolot-64px/cs_axe_v1_11_red.png",
    "cs_axe_v1_14_steel": "weapons/alt-captainskolot-64px/cs_axe_v1_14_steel.png",
    "cs_axe_v2_01_gold": "weapons/alt-captainskolot-64px/cs_axe_v2_01_gold.png",
    "cs_axe_v2_06_red": "weapons/alt-captainskolot-64px/cs_axe_v2_06_red.png",
    # Beowulf armor
    "bw_old_leather_armor": "armor/bw_old_leather_armor.png",
    "bw_turtle_shell": "armor/bw_turtle_shell.png",
    "bw_old_helm": "armor/bw_old_helm.png",
    "bw_bloody_helmet": "armor/bw_bloody_helmet.png",
    "bw_old_shield": "armor/bw_old_shield.png",
    "bw_broken_shield": "armor/bw_broken_shield.png",
    "bw_gauntlet_01_red": "armor/bw_gauntlet_01_red.png",
    "bw_gauntlet_05_gold": "armor/bw_gauntlet_05_gold.png",
    # CaptainSkolot shields: 32px epic, 64px legendary
    "cs_shield_001_red": "armor/alt-captainskolot-shields-32px/cs_shield_001_red.png",
    "cs_shield_008_gold": "armor/alt-captainskolot-shields-32px/cs_shield_008_gold.png",
    "cs_shield_015_red": "armor/alt-captainskolot-shields-32px/cs_shield_015_red.png",
    "cs_shield_049_gold": "armor/alt-captainskolot-shields-32px/cs_shield_049_gold.png",
    "cs_shield_v1_01_orange": "armor/alt-captainskolot-shields-64px/cs_shield_v1_01_orange.png",
    "cs_shield_v1_03_gold": "armor/alt-captainskolot-shields-64px/cs_shield_v1_03_gold.png",
    "cs_shield_v2_01_steel": "armor/alt-captainskolot-shields-64px/cs_shield_v2_01_steel.png",
    "cs_shield_v2_07_gold": "armor/alt-captainskolot-shields-64px/cs_shield_v2_07_gold.png",
    # Beowulf trinkets
    "bw_ancient_golden_ring": "trinkets/bw_ancient_golden_ring.png",
    "bw_butterfly_ring": "trinkets/bw_butterfly_ring.png",
    "bw_golden_medallion": "trinkets/bw_golden_medallion.png",
    "bw_ruby": "trinkets/bw_ruby.png",
    "bw_green_gem": "trinkets/bw_green_gem.png",
    "bw_diamond": "trinkets/bw_diamond.png",
    "bw_fire_gem": "trinkets/bw_fire_gem.png",
    "bw_orb_04_gold": "trinkets/bw_orb_04_gold.png",
    "bw_orb_05_purple": "trinkets/bw_orb_05_purple.png",
    # CaptainSkolot potions and tomes
    "cs_potion_01_green": "potions/captainskolot-64px/cs_potion_01_green.png",
    "cs_potion_04_blue": "potions/captainskolot-64px/cs_potion_04_blue.png",
    "cs_potion_09_red": "potions/captainskolot-64px/cs_potion_09_red.png",
    "cs_potion_07_purple": "potions/captainskolot-64px/cs_potion_07_purple.png",
    "cs_magic_book_01_red": "spells/magic-books-64px/cs_magic_book_01_red.png",
    "cs_magic_book_09_blue": "spells/magic-books-64px/cs_magic_book_09_blue.png",
    # Ability marks: spells plus fire and water symbols
    "cs_spell_002_red": "spells/magic-spells-64px/cs_spell_002_red.png",
    "cs_spell_003_red": "spells/magic-spells-64px/cs_spell_003_red.png",
    "cs_spell_004_green": "spells/magic-spells-64px/cs_spell_004_green.png",
    "cs_spell_006_orange": "spells/magic-spells-64px/cs_spell_006_orange.png",
    "cs_spell_007_orange": "spells/magic-spells-64px/cs_spell_007_orange.png",
    "cs_spell_008_pink": "spells/magic-spells-64px/cs_spell_008_pink.png",
    "cs_spell_012_blue": "spells/magic-spells-64px/cs_spell_012_blue.png",
    "cs_spell_014_purple": "spells/magic-spells-64px/cs_spell_014_purple.png",
    "cs_spell_016_red": "spells/magic-spells-64px/cs_spell_016_red.png",
    "cs_spell_021_blue": "spells/magic-spells-64px/cs_spell_021_blue.png",
    "cs_spell_022_orange": "spells/magic-spells-64px/cs_spell_022_orange.png",
    "cs_spell_040_steel": "spells/magic-spells-64px/cs_spell_040_steel.png",
    "cs_fire_symbol_01": "spells/fire-symbols-64px/cs_fire_symbol_01.png",
    "cs_fire_symbol_03": "spells/fire-symbols-64px/cs_fire_symbol_03.png",
    "cs_fire_symbol_05": "spells/fire-symbols-64px/cs_fire_symbol_05.png",
    "cs_water_symbol_01": "spells/water-symbols-64px/cs_water_symbol_01.png",
    "cs_water_symbol_02": "spells/water-symbols-64px/cs_water_symbol_02.png",
    "cs_water_symbol_03": "spells/water-symbols-64px/cs_water_symbol_03.png",
    # Beowulf currency
    "bw_gold_coins": "currency/bw_gold_coins.png",
    "bw_gem_ruby": "currency/bw_gem_ruby.png",
    "bw_token_golden_medallion": "currency/bw_token_golden_medallion.png",
    # 7T4E chests and bags, one tier pair per rarity
    "7t4e_chest_tier1": "loot/7t4e-64px/7t4e_chest_tier1.png",
    "7t4e_chest_tier3": "loot/7t4e-64px/7t4e_chest_tier3.png",
    "7t4e_chest_tier5": "loot/7t4e-64px/7t4e_chest_tier5.png",
    "7t4e_chest_tier7": "loot/7t4e-64px/7t4e_chest_tier7.png",
    "7t4e_bag_tier1": "loot/7t4e-64px/7t4e_bag_tier1.png",
    "7t4e_bag_tier3": "loot/7t4e-64px/7t4e_bag_tier3.png",
    "7t4e_bag_tier5": "loot/7t4e-64px/7t4e_bag_tier5.png",
    "7t4e_bag_tier7": "loot/7t4e-64px/7t4e_bag_tier7.png",
}


def to_cell(im):
    im = im.convert("RGBA")
    if im.size == (CELL, CELL):
        return im
    return im.resize((CELL, CELL), Image.Resampling.NEAREST)


def main():
    if len(sys.argv) != 2:
        print("usage: pack-icons.py CURATED_DIR", file=sys.stderr)
        return 1
    root = Path(sys.argv[1])
    ids = list(FILES)
    rows = (len(ids) + COLS - 1) // COLS
    sheet = Image.new("RGBA", (COLS * CELL, rows * CELL), (0, 0, 0, 0))
    frames = {}
    for i, frame in enumerate(ids):
        src = root / FILES[frame]
        if not src.is_file():
            print("missing", src, file=sys.stderr)
            return 1
        cell = to_cell(Image.open(src))
        x = (i % COLS) * CELL
        y = (i // COLS) * CELL
        sheet.paste(cell, (x, y))
        frames[frame] = {"x": x, "y": y, "w": CELL, "h": CELL}
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    sheet.save(OUT_DIR / "atlas.png")
    meta = {
        "image": "assets/icons/atlas.png",
        "w": sheet.width,
        "h": sheet.height,
        "cell": CELL,
        "frames": frames,
    }
    (OUT_DIR / "atlas.json").write_text(json.dumps(meta, indent=2) + "\n")
    print("packed", len(frames), "frames", sheet.size)
    return 0


if __name__ == "__main__":
    sys.exit(main() or 0)
