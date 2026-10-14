import pathlib
d = pathlib.Path(__file__).parent
core = (d / "core.txt").read_text()
eds = [("dental","Dental","dental clinics"),("glow","Glow","dermatology and aesthetic clinics"),
       ("vision","Vision","eye clinics and optical shops"),("kids","Kids","pediatric clinics"),
       ("mama","Mama","OB-GYN and maternity clinics"),("motion","Motion","physical therapy and rehab centers")]
for key, ed, ctype in eds:
    out = (core.replace("{{PRODUCT}}", f"LAYAW CARE {ed.upper()}")
               .replace("{{EDITION_UPPER}}", ed.upper()).replace("{{EDITION}}", ed)
               .replace("{{CLINIC_TYPE}}", ctype)
               .replace("{{NICHE}}", (d / f"{key}.txt").read_text().strip()))
    assert "{{" not in out
    (d.parent / f"layaw-care-{key}.prompt.txt").write_text(out)
