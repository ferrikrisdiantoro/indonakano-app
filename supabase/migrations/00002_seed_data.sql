-- ============================================================
-- SEED DATA: Master Alat
-- Source: PRD Appendix 11.1 (from Excel INDONAKANO MARET 2026)
-- Migration: 00002_seed_data.sql
-- ============================================================

INSERT INTO public.alat (kode, nama, satuan_default) VALUES
  ('MF-170',        'Main Frame 170',          'unit'),
  ('MF-190',        'Main Frame 190',          'unit'),
  ('LD-90',         'LD 90',                   'unit'),
  ('CB-220',        'Cross Brace 220',         'unit'),
  ('CB-193',        'Cross Brace 193',         'unit'),
  ('CATWALK',       'Catwalk',                 'unit'),
  ('JB-60',         'Jack Base 60',            'unit'),
  ('UH-60',         'U-Head 60',               'unit'),
  ('JOIN-PIN',      'Join Pin',                'unit'),
  ('FIX-CLAMP',     'Fixed Clamp',             'unit'),
  ('SWV-CLAMP',     'Swivel Clamp',            'unit'),
  ('TANGGA-170',    'Tangga 170',              'unit'),
  ('TANGGA-190',    'Tangga 190',              'unit'),
  ('PIPA-1M',       'Pipa 1M',                 'batang'),
  ('PIPA-1.2M',     'Pipa 1.2M',               'batang'),
  ('PIPA-1.5M',     'Pipa 1.5M',               'batang'),
  ('PIPA-2M',       'Pipa 2M',                 'batang'),
  ('PIPA-3M',       'Pipa 3M',                 'batang'),
  ('PIPA-4M',       'Pipa 4M',                 'batang'),
  ('PIPA-6M',       'Pipa 6M',                 'batang'),
  ('PIPA-S',        'Pipa S',                  'unit'),
  ('RODA',          'Roda',                    'unit'),
  ('HOLLOW-5X5X2',  'Hollow 5x5x2M',           'batang'),
  ('HOLLOW-5X5X6',  'Hollow 5x5x6M',           'batang'),
  ('HOLLOW-5X10',   'Hollow 5x10x1.5M',        'batang'),
  ('SABUK-KOLOM',   'Sabuk Kolom 4x6x1M',      'unit'),
  ('SURI-SURI',     'Suri Suri 5x10x1.5M',     'unit'),
  ('WING-NUT',      'Wing Nut',                'unit'),
  ('TIE-ROD-1M',    'Tie Rod 1M',              'unit'),
  ('TIE-ROD-1.2M',  'Tie Rod 1.2M',            'unit'),
  ('TIE-ROD-1.5M',  'Tie Rod 1.5M',            'unit'),
  ('ASHIBA-2M',     'Ashiba 2M',               'unit'),
  ('ASHIBA-4M',     'Ashiba 4M',               'unit'),
  ('HORRY-BEAM',    'Horry Beam',              'unit'),
  ('H-5X10X4M',     'H 5x10x4M',              'batang');

-- ============================================================
-- SEED DATA: Master Klien (awal)
-- Source: PRD Appendix 11.2
-- ============================================================

INSERT INTO public.klien (kode, nama) VALUES
  ('ASTEMO',    'ASTEMO'),
  ('NOK',       'NOK'),
  ('GIVAUDAN',  'GIVAUDAN'),
  ('TIGERSASH', 'TIGERSASH'),
  ('HIRUTA',    'HIRUTA');
