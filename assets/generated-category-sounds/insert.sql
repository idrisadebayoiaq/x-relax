DELETE FROM sound_categories sc
USING categories c
WHERE sc.category_id = c.id
  AND c.slug IN ('nature','asmr','children','mixes');

INSERT INTO sounds (id, creator_id, title, description, audio_path, audio_url, cover_url, duration_seconds, status, is_premium_only, is_featured)
VALUES
  ('cd7d416d-fb59-415e-b802-6d59bb1ca27a'::uuid, 'b2295012-b600-4d22-bf62-df9dfbe3dba0'::uuid, 'Pine Breeze Field', 'Listen for 20 to 40 minutes to calm an overactive mind with soft open air.', 'generated/cd7d416d-fb59-415e-b802-6d59bb1ca27a.mp3', 'https://bfilhkxyjiofkfqwqyep.supabase.co/storage/v1/object/public/sounds/generated/cd7d416d-fb59-415e-b802-6d59bb1ca27a.mp3', 'https://bfilhkxyjiofkfqwqyep.supabase.co/storage/v1/object/public/covers/catalog/generated/cd7d416d-fb59-415e-b802-6d59bb1ca27a.jpg', 32, 'published', false, false),
  ('c1a1839b-5b7a-4ee1-904b-ca8375002c70'::uuid, 'b2295012-b600-4d22-bf62-df9dfbe3dba0'::uuid, 'Creek Stone Hush', 'Listen for 30 to 45 minutes when anxious. Soft water motion helps attention rest.', 'generated/c1a1839b-5b7a-4ee1-904b-ca8375002c70.mp3', 'https://bfilhkxyjiofkfqwqyep.supabase.co/storage/v1/object/public/sounds/generated/c1a1839b-5b7a-4ee1-904b-ca8375002c70.mp3', 'https://bfilhkxyjiofkfqwqyep.supabase.co/storage/v1/object/public/covers/catalog/generated/c1a1839b-5b7a-4ee1-904b-ca8375002c70.jpg', 34, 'published', false, false),
  ('efe64ba9-d907-4ab7-89d5-8c61962fee63'::uuid, 'b2295012-b600-4d22-bf62-df9dfbe3dba0'::uuid, 'Canopy Soft Drift', 'Play for 25 to 40 minutes for gentle forest focus and soft recovery.', 'generated/efe64ba9-d907-4ab7-89d5-8c61962fee63.mp3', 'https://bfilhkxyjiofkfqwqyep.supabase.co/storage/v1/object/public/sounds/generated/efe64ba9-d907-4ab7-89d5-8c61962fee63.mp3', 'https://bfilhkxyjiofkfqwqyep.supabase.co/storage/v1/object/public/covers/catalog/generated/efe64ba9-d907-4ab7-89d5-8c61962fee63.jpg', 33, 'published', false, false),
  ('e4a21a7b-f719-4746-b416-58696f6785ef'::uuid, 'b2295012-b600-4d22-bf62-df9dfbe3dba0'::uuid, 'Meadow Air Glow', 'Listen for 15 to 30 minutes in the morning to lift mood softly.', 'generated/e4a21a7b-f719-4746-b416-58696f6785ef.mp3', 'https://bfilhkxyjiofkfqwqyep.supabase.co/storage/v1/object/public/sounds/generated/e4a21a7b-f719-4746-b416-58696f6785ef.mp3', 'https://bfilhkxyjiofkfqwqyep.supabase.co/storage/v1/object/public/covers/catalog/generated/e4a21a7b-f719-4746-b416-58696f6785ef.jpg', 31, 'published', false, false),
  ('f7b5072b-eb7a-4672-a2f8-2e3fceb5e045'::uuid, 'b2295012-b600-4d22-bf62-df9dfbe3dba0'::uuid, 'Dusk Woods Whisper', 'Use for 40 to 60 minutes to lower stress with quiet woodland texture.', 'generated/f7b5072b-eb7a-4672-a2f8-2e3fceb5e045.mp3', 'https://bfilhkxyjiofkfqwqyep.supabase.co/storage/v1/object/public/sounds/generated/f7b5072b-eb7a-4672-a2f8-2e3fceb5e045.mp3', 'https://bfilhkxyjiofkfqwqyep.supabase.co/storage/v1/object/public/covers/catalog/generated/f7b5072b-eb7a-4672-a2f8-2e3fceb5e045.jpg', 35, 'published', false, false),
  ('c36da914-5259-4966-9383-f4237260d8ba'::uuid, 'b2295012-b600-4d22-bf62-df9dfbe3dba0'::uuid, 'Soft Texture Crackle', 'Use for 20 to 40 minutes for close textured calm and soft attention.', 'generated/c36da914-5259-4966-9383-f4237260d8ba.mp3', 'https://bfilhkxyjiofkfqwqyep.supabase.co/storage/v1/object/public/sounds/generated/c36da914-5259-4966-9383-f4237260d8ba.mp3', 'https://bfilhkxyjiofkfqwqyep.supabase.co/storage/v1/object/public/covers/catalog/generated/c36da914-5259-4966-9383-f4237260d8ba.jpg', 30, 'published', false, false),
  ('7c7d16f5-20a2-49d1-93fc-b3ae220c2c70'::uuid, 'b2295012-b600-4d22-bf62-df9dfbe3dba0'::uuid, 'Velvet Soft Hiss', 'Listen for 25 to 40 minutes for intimate soft noise and gentle nerves.', 'generated/7c7d16f5-20a2-49d1-93fc-b3ae220c2c70.mp3', 'https://bfilhkxyjiofkfqwqyep.supabase.co/storage/v1/object/public/sounds/generated/7c7d16f5-20a2-49d1-93fc-b3ae220c2c70.mp3', 'https://bfilhkxyjiofkfqwqyep.supabase.co/storage/v1/object/public/covers/catalog/generated/7c7d16f5-20a2-49d1-93fc-b3ae220c2c70.jpg', 32, 'published', false, false),
  ('055948ff-9cbd-4bf1-9091-8783d8437ae9'::uuid, 'b2295012-b600-4d22-bf62-df9dfbe3dba0'::uuid, 'Glass Soft Tone', 'Play for 15 to 30 minutes during light anxiety for a soft focal point.', 'generated/055948ff-9cbd-4bf1-9091-8783d8437ae9.mp3', 'https://bfilhkxyjiofkfqwqyep.supabase.co/storage/v1/object/public/sounds/generated/055948ff-9cbd-4bf1-9091-8783d8437ae9.mp3', 'https://bfilhkxyjiofkfqwqyep.supabase.co/storage/v1/object/public/covers/catalog/generated/055948ff-9cbd-4bf1-9091-8783d8437ae9.jpg', 30, 'published', false, false),
  ('2f5f2a2f-632d-41c3-9469-b3237fd297a8'::uuid, 'b2295012-b600-4d22-bf62-df9dfbe3dba0'::uuid, 'Page Brush Soft', 'Use for 20 to 35 minutes for close page like texture and calm focus.', 'generated/2f5f2a2f-632d-41c3-9469-b3237fd297a8.mp3', 'https://bfilhkxyjiofkfqwqyep.supabase.co/storage/v1/object/public/sounds/generated/2f5f2a2f-632d-41c3-9469-b3237fd297a8.mp3', 'https://bfilhkxyjiofkfqwqyep.supabase.co/storage/v1/object/public/covers/catalog/generated/2f5f2a2f-632d-41c3-9469-b3237fd297a8.jpg', 33, 'published', false, false),
  ('33306949-d649-4444-bff4-88a040d7a674'::uuid, 'b2295012-b600-4d22-bf62-df9dfbe3dba0'::uuid, 'Ember Tick Soft', 'Play for 30 to 50 minutes for intimate evening texture and rest.', 'generated/33306949-d649-4444-bff4-88a040d7a674.mp3', 'https://bfilhkxyjiofkfqwqyep.supabase.co/storage/v1/object/public/sounds/generated/33306949-d649-4444-bff4-88a040d7a674.mp3', 'https://bfilhkxyjiofkfqwqyep.supabase.co/storage/v1/object/public/covers/catalog/generated/33306949-d649-4444-bff4-88a040d7a674.jpg', 34, 'published', false, false),
  ('d10c695a-41e9-4c1e-9ae4-12d0da99705d'::uuid, 'b2295012-b600-4d22-bf62-df9dfbe3dba0'::uuid, 'Soft Lull Chime', 'Listen for 10 to 20 minutes after waking for a gentle start.', 'generated/d10c695a-41e9-4c1e-9ae4-12d0da99705d.mp3', 'https://bfilhkxyjiofkfqwqyep.supabase.co/storage/v1/object/public/sounds/generated/d10c695a-41e9-4c1e-9ae4-12d0da99705d.mp3', 'https://bfilhkxyjiofkfqwqyep.supabase.co/storage/v1/object/public/covers/catalog/generated/d10c695a-41e9-4c1e-9ae4-12d0da99705d.jpg', 28, 'published', false, false),
  ('e122aafa-c4c4-49fb-9e37-19878720a6b3'::uuid, 'b2295012-b600-4d22-bf62-df9dfbe3dba0'::uuid, 'Cloud Soft Hum', 'Play for 20 to 35 minutes for soft open air calm for little listeners.', 'generated/e122aafa-c4c4-49fb-9e37-19878720a6b3.mp3', 'https://bfilhkxyjiofkfqwqyep.supabase.co/storage/v1/object/public/sounds/generated/e122aafa-c4c4-49fb-9e37-19878720a6b3.mp3', 'https://bfilhkxyjiofkfqwqyep.supabase.co/storage/v1/object/public/covers/catalog/generated/e122aafa-c4c4-49fb-9e37-19878720a6b3.jpg', 32, 'published', false, false),
  ('acfe62e0-598c-405f-9237-09ca17a2648b'::uuid, 'b2295012-b600-4d22-bf62-df9dfbe3dba0'::uuid, 'Tiny Rain Patter', 'Listen for 30 to 45 minutes for soft sleep wind down.', 'generated/acfe62e0-598c-405f-9237-09ca17a2648b.mp3', 'https://bfilhkxyjiofkfqwqyep.supabase.co/storage/v1/object/public/sounds/generated/acfe62e0-598c-405f-9237-09ca17a2648b.mp3', 'https://bfilhkxyjiofkfqwqyep.supabase.co/storage/v1/object/public/covers/catalog/generated/acfe62e0-598c-405f-9237-09ca17a2648b.jpg', 33, 'published', false, false),
  ('e6c51eed-5039-451c-92a6-3ff3d406b97e'::uuid, 'b2295012-b600-4d22-bf62-df9dfbe3dba0'::uuid, 'Bird Soft Sparkle', 'Listen for 15 to 25 minutes to lift mood softly without stress.', 'generated/e6c51eed-5039-451c-92a6-3ff3d406b97e.mp3', 'https://bfilhkxyjiofkfqwqyep.supabase.co/storage/v1/object/public/sounds/generated/e6c51eed-5039-451c-92a6-3ff3d406b97e.mp3', 'https://bfilhkxyjiofkfqwqyep.supabase.co/storage/v1/object/public/covers/catalog/generated/e6c51eed-5039-451c-92a6-3ff3d406b97e.jpg', 28, 'published', false, false),
  ('b14cb552-85ab-4d79-b427-49a982476b37'::uuid, 'b2295012-b600-4d22-bf62-df9dfbe3dba0'::uuid, 'Warm Nest Glow', 'Use for 25 to 40 minutes for cozy evening calm.', 'generated/b14cb552-85ab-4d79-b427-49a982476b37.mp3', 'https://bfilhkxyjiofkfqwqyep.supabase.co/storage/v1/object/public/sounds/generated/b14cb552-85ab-4d79-b427-49a982476b37.mp3', 'https://bfilhkxyjiofkfqwqyep.supabase.co/storage/v1/object/public/covers/catalog/generated/b14cb552-85ab-4d79-b427-49a982476b37.jpg', 31, 'published', false, false),
  ('ecbd2ece-39fe-452b-ab16-7ecb96d9c339'::uuid, 'b2295012-b600-4d22-bf62-df9dfbe3dba0'::uuid, 'Rain Wind Soft Blend', 'Use for 45 to 60 minutes for layered rain and air wind down.', 'generated/ecbd2ece-39fe-452b-ab16-7ecb96d9c339.mp3', 'https://bfilhkxyjiofkfqwqyep.supabase.co/storage/v1/object/public/sounds/generated/ecbd2ece-39fe-452b-ab16-7ecb96d9c339.mp3', 'https://bfilhkxyjiofkfqwqyep.supabase.co/storage/v1/object/public/covers/catalog/generated/ecbd2ece-39fe-452b-ab16-7ecb96d9c339.jpg', 35, 'published', false, false),
  ('411a430a-fc90-4d04-9010-91d879224844'::uuid, 'b2295012-b600-4d22-bf62-df9dfbe3dba0'::uuid, 'Fire Rain Night Blend', 'Listen for 40 to 60 minutes for fire and rain calm layering.', 'generated/411a430a-fc90-4d04-9010-91d879224844.mp3', 'https://bfilhkxyjiofkfqwqyep.supabase.co/storage/v1/object/public/sounds/generated/411a430a-fc90-4d04-9010-91d879224844.mp3', 'https://bfilhkxyjiofkfqwqyep.supabase.co/storage/v1/object/public/covers/catalog/generated/411a430a-fc90-4d04-9010-91d879224844.jpg', 36, 'published', false, false),
  ('acc8acc5-617d-4e4c-85df-56ddd44b5e03'::uuid, 'b2295012-b600-4d22-bf62-df9dfbe3dba0'::uuid, 'Ocean Forest Soft Mix', 'Listen for 40 to 60 minutes for shore and woodland air blending.', 'generated/acc8acc5-617d-4e4c-85df-56ddd44b5e03.mp3', 'https://bfilhkxyjiofkfqwqyep.supabase.co/storage/v1/object/public/sounds/generated/acc8acc5-617d-4e4c-85df-56ddd44b5e03.mp3', 'https://bfilhkxyjiofkfqwqyep.supabase.co/storage/v1/object/public/covers/catalog/generated/acc8acc5-617d-4e4c-85df-56ddd44b5e03.jpg', 34, 'published', false, false),
  ('029deae6-b8d5-4375-9c8d-70827c2f298b'::uuid, 'b2295012-b600-4d22-bf62-df9dfbe3dba0'::uuid, 'Soft Storm Drift Mix', 'Play for 30 to 60 minutes for soft storm texture and release.', 'generated/029deae6-b8d5-4375-9c8d-70827c2f298b.mp3', 'https://bfilhkxyjiofkfqwqyep.supabase.co/storage/v1/object/public/sounds/generated/029deae6-b8d5-4375-9c8d-70827c2f298b.mp3', 'https://bfilhkxyjiofkfqwqyep.supabase.co/storage/v1/object/public/covers/catalog/generated/029deae6-b8d5-4375-9c8d-70827c2f298b.jpg', 37, 'published', false, false),
  ('284cc885-0f95-434f-8174-b6b97bdef4cc'::uuid, 'b2295012-b600-4d22-bf62-df9dfbe3dba0'::uuid, 'Bird River Day Blend', 'Listen for 25 to 40 minutes for bright air and flowing water together.', 'generated/284cc885-0f95-434f-8174-b6b97bdef4cc.mp3', 'https://bfilhkxyjiofkfqwqyep.supabase.co/storage/v1/object/public/sounds/generated/284cc885-0f95-434f-8174-b6b97bdef4cc.mp3', 'https://bfilhkxyjiofkfqwqyep.supabase.co/storage/v1/object/public/covers/catalog/generated/284cc885-0f95-434f-8174-b6b97bdef4cc.jpg', 33, 'published', false, false)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  audio_path = EXCLUDED.audio_path,
  audio_url = EXCLUDED.audio_url,
  cover_url = EXCLUDED.cover_url,
  duration_seconds = EXCLUDED.duration_seconds,
  status = 'published',
  updated_at = now();

INSERT INTO sound_categories (sound_id, category_id)
SELECT 'cd7d416d-fb59-415e-b802-6d59bb1ca27a'::uuid, id FROM categories WHERE slug = 'nature'
ON CONFLICT DO NOTHING;
INSERT INTO sound_categories (sound_id, category_id)
SELECT 'c1a1839b-5b7a-4ee1-904b-ca8375002c70'::uuid, id FROM categories WHERE slug = 'nature'
ON CONFLICT DO NOTHING;
INSERT INTO sound_categories (sound_id, category_id)
SELECT 'efe64ba9-d907-4ab7-89d5-8c61962fee63'::uuid, id FROM categories WHERE slug = 'nature'
ON CONFLICT DO NOTHING;
INSERT INTO sound_categories (sound_id, category_id)
SELECT 'e4a21a7b-f719-4746-b416-58696f6785ef'::uuid, id FROM categories WHERE slug = 'nature'
ON CONFLICT DO NOTHING;
INSERT INTO sound_categories (sound_id, category_id)
SELECT 'f7b5072b-eb7a-4672-a2f8-2e3fceb5e045'::uuid, id FROM categories WHERE slug = 'nature'
ON CONFLICT DO NOTHING;
INSERT INTO sound_categories (sound_id, category_id)
SELECT 'c36da914-5259-4966-9383-f4237260d8ba'::uuid, id FROM categories WHERE slug = 'asmr'
ON CONFLICT DO NOTHING;
INSERT INTO sound_categories (sound_id, category_id)
SELECT '7c7d16f5-20a2-49d1-93fc-b3ae220c2c70'::uuid, id FROM categories WHERE slug = 'asmr'
ON CONFLICT DO NOTHING;
INSERT INTO sound_categories (sound_id, category_id)
SELECT '055948ff-9cbd-4bf1-9091-8783d8437ae9'::uuid, id FROM categories WHERE slug = 'asmr'
ON CONFLICT DO NOTHING;
INSERT INTO sound_categories (sound_id, category_id)
SELECT '2f5f2a2f-632d-41c3-9469-b3237fd297a8'::uuid, id FROM categories WHERE slug = 'asmr'
ON CONFLICT DO NOTHING;
INSERT INTO sound_categories (sound_id, category_id)
SELECT '33306949-d649-4444-bff4-88a040d7a674'::uuid, id FROM categories WHERE slug = 'asmr'
ON CONFLICT DO NOTHING;
INSERT INTO sound_categories (sound_id, category_id)
SELECT 'd10c695a-41e9-4c1e-9ae4-12d0da99705d'::uuid, id FROM categories WHERE slug = 'children'
ON CONFLICT DO NOTHING;
INSERT INTO sound_categories (sound_id, category_id)
SELECT 'e122aafa-c4c4-49fb-9e37-19878720a6b3'::uuid, id FROM categories WHERE slug = 'children'
ON CONFLICT DO NOTHING;
INSERT INTO sound_categories (sound_id, category_id)
SELECT 'acfe62e0-598c-405f-9237-09ca17a2648b'::uuid, id FROM categories WHERE slug = 'children'
ON CONFLICT DO NOTHING;
INSERT INTO sound_categories (sound_id, category_id)
SELECT 'e6c51eed-5039-451c-92a6-3ff3d406b97e'::uuid, id FROM categories WHERE slug = 'children'
ON CONFLICT DO NOTHING;
INSERT INTO sound_categories (sound_id, category_id)
SELECT 'b14cb552-85ab-4d79-b427-49a982476b37'::uuid, id FROM categories WHERE slug = 'children'
ON CONFLICT DO NOTHING;
INSERT INTO sound_categories (sound_id, category_id)
SELECT 'ecbd2ece-39fe-452b-ab16-7ecb96d9c339'::uuid, id FROM categories WHERE slug = 'mixes'
ON CONFLICT DO NOTHING;
INSERT INTO sound_categories (sound_id, category_id)
SELECT '411a430a-fc90-4d04-9010-91d879224844'::uuid, id FROM categories WHERE slug = 'mixes'
ON CONFLICT DO NOTHING;
INSERT INTO sound_categories (sound_id, category_id)
SELECT 'acc8acc5-617d-4e4c-85df-56ddd44b5e03'::uuid, id FROM categories WHERE slug = 'mixes'
ON CONFLICT DO NOTHING;
INSERT INTO sound_categories (sound_id, category_id)
SELECT '029deae6-b8d5-4375-9c8d-70827c2f298b'::uuid, id FROM categories WHERE slug = 'mixes'
ON CONFLICT DO NOTHING;
INSERT INTO sound_categories (sound_id, category_id)
SELECT '284cc885-0f95-434f-8174-b6b97bdef4cc'::uuid, id FROM categories WHERE slug = 'mixes'
ON CONFLICT DO NOTHING;
