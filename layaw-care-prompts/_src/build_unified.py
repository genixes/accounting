import pathlib
d = pathlib.Path(__file__).parent
core = (d / "core.txt").read_text()
plat = (d / "platform.txt").read_text().rstrip()
packs = [("dental","DENTAL PACK (clinic type: Dental)"),("glow","GLOW PACK (clinic type: Aesthetic/Derma)"),
         ("kids","KIDS PACK (clinic type: Pediatrics)"),("mama","MAMA PACK (clinic type: OB-GYN/Maternity)"),
         ("vision","VISION PACK (clinic type: Eye/Optical)"),("motion","MOTION PACK (clinic type: Rehab/Physio)")]
body = plat + "\n\n"
body += "GENERAL CLINIC PACK (default, no extras): uses the core modules only.\n\n"
for k, title in packs:
    body += f"----- {title} -----\n{(d / f'{k}.txt').read_text().strip()}\n\n"
body += ("PACK RULE: each pack's PALETTE becomes that pack's accent theme (applied to\n"
         "charts, badges, and highlights), not a full replacement of the Layaw shell.\n")
out = (core.replace('a specialty\nedition of the LAYAW CARE platform for {{CLINIC_TYPE}}', 'a multi-tenant\nplatform serving many clinics and specialties')
           .replace("{{PRODUCT}}", "LAYAW CARE").replace('edition name "{{EDITION}}" as a small gold tag', 'the active specialty pack shown as a small gold tag')
           .replace("======================= EDITION OVERRIDE: {{EDITION_UPPER}} =======================\nWhere this section conflicts with anything above (palette, typography, module\nnames, dashboard KPIs, seed data), THIS SECTION WINS. It replaces generic\nclinical pages with the specialty workspace and adds the specialty modules.",
                    "======================= PLATFORM ARCHITECTURE AND SPECIALTY PACKS =======================\nThis section defines multi-tenancy, onboarding, plans, and the pack engine.\nWhere it conflicts with anything above, THIS SECTION WINS.")
           .replace("{{NICHE}}", body.strip())
           .replace("=================================================================================== ", "")
           .replace("DATA MODEL (core)", "DATA MODEL (core; every entity includes tenantId; add Tenant, Subscription, PackActivation, FeatureFlag, Plan)"))
assert "{{" not in out, [l for l in out.splitlines() if "{{" in l]
(d.parent / "layaw-care-UNIFIED.prompt.txt").write_text(out)
