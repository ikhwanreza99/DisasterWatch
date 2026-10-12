# National incident snapshot, 1–12 October 2026

The snapshot contains all 86 records in the downloaded BNPB table within this inclusive date range, grouped into 60 regency/disaster-type markers. Two additional reviewed locations (Palembang and Kotawaringin Barat) bring the map to 62 locations. This is coverage of the retrieved sources, not a guarantee that every disaster in Indonesia was reported or remains active. BMKG/FIRMS layers remain separate.

- Incident source: https://gis.bnpb.go.id/databencana/tabel/pencarian.php
- Table fetched using POST fields `tgl_awal=01/10/2026`, `tgl_akhir=12/10/2026`, `s_kejadian=`, `submit=Cari`; the importer independently filters dates because the server response also contains older records.
- Approximate regional coordinates: https://github.com/coll-j/indonesia-locations-data/blob/main/final_results/kota_kab_lat_long.csv (credit: coll-j; use permitted in repository README). Matched by normalized administrative name, preserving the Kota/Kabupaten distinction. These are representative region coordinates, not incident coordinates or affected-area boundaries.
- Regeneration: `python3 scripts/importBnpbSnapshot.py table.html kota_kab_lat_long.csv 2026-10-12`. Missing coordinates or an empty source abort without replacing the last snapshot.
- This is a reviewed, dated snapshot; no automatic national discovery job is claimed. Reimport and review the snapshot and update the range before publishing a new period.
- Article publication dates remain null when unknown. Event dates are never substituted for publication dates.
- Reviewed detik/RRI article metadata lives in `src/data/currentMedia.ts`. Paid crawler queries now include detik, RRI, ANTARA and Kompas, with exact location and date constraints; returned candidates still require relevance checks. Live paid crawling was not run during this update.
