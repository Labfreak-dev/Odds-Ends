# Elements Core

Layered character art from `elements_core_pack_2.14.24.zip` on the
[Character-asset-gen v1 release](https://github.com/Labfreak-dev/Character-asset-gen/releases/tag/v1),
plus the TDSM style companion from `elements_core_pack_tdsm.zip` on the same release.

| Path | What it is |
|---|---|
| `assets/` | 356 layered PNGs (backextra, backhair, bottom, frontextra, hair, hat, head, top, weapon, shadow) |
| `extras/` | Originals, emotes, palettes, and the RED_ElementsFix plugin |
| `premade/` | Premade sheets for the `100`, `RMMVMZ`, and `RMVX` layouts |
| `guide/` | `Elements Guide.pdf`, two reference spritesheets, and `bowarrow_example.gif` |
| `generator/ReadMe.txt` | How the desktop app expects the `assets/` folders to be laid out |
| `Readme_2.14.24.txt` | Vendor note from the 2.14.2024 update |
| `tdsm/` | TDSM style pack (`style/` csv, originals, `manifest.tds`) and `README.pdf` |

The Elements Character Generator apps are not in this repo. Together with
their native libraries they are almost the entire 119 MB zip (the Windows
executable alone is about 77 MB). Download that zip when you need the app:

```bash
gh release download v1 -R Labfreak-dev/Character-asset-gen -p 'elements_core_pack_2.14.24.zip'
```

`generator/ReadMe.txt` mentions a PDF in an `extras/` folder. In this archive
the guide is `guide/Elements Guide.pdf`.

## License notes from the archive

`Readme_2.14.24.txt` and `generator/ReadMe.txt` do not include a license
grant for the character sheets.

`extras/rmfix_plugin/README.md.txt` says the RED_ElementsFix plugin is free
for commercial and non-commercial projects if you credit Hikitsune-Red
(火狐) and mentions Twitter `@hikitsune_red`. That note covers the plugin
only.
