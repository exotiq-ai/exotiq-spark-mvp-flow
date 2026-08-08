
DO $$
DECLARE
  pairs jsonb := '[
    ["72f368f6-e4da-4941-a5ed-fbcb9a204bf6","34fdbdd9-35cc-46d9-885c-0dddb938c7e7"],
    ["3e4f2599-f723-4280-ac67-26a104c3f866","07fb3b68-f234-4782-93ba-138130bbcd85"],
    ["ec00eea3-935a-41b6-a896-067d970579f6","1ee41484-ff42-4dbe-8ef3-ad0aeaa7022b"],
    ["6a60e322-c54e-453a-83b6-b68b5daa9b96","183eddaa-0caa-46c8-a79d-1394b46ba31c"],
    ["27248132-0fc1-481a-abae-16bcdd300462","183eddaa-0caa-46c8-a79d-1394b46ba31c"],
    ["98d063ea-633b-4f47-82b5-100894c99fd7","fba3c037-ff84-4db0-873b-d2c8bdec82ea"],
    ["eb098319-46ef-4567-8afb-fde8cf4b63be","6d9226e3-923b-47cd-919d-e648fea20683"],
    ["b905869a-570c-4532-a79f-95e213fca185","bf0eb2fe-435d-41e2-a82c-d98fd79d6966"],
    ["ae4e70a9-8958-4877-b6ee-41fd742c9ec1","18868daf-c7b4-4f7c-86bd-a6d297bf25a7"],
    ["690cb7fb-8f3b-4a86-aa25-333e772fdec5","16dba868-fd55-48e7-8e08-7dac3ebc8478"],
    ["99f38850-a56d-47cd-99a9-3b69454d239b","58517436-6363-451b-bd79-afeed7b68e34"],
    ["bd0698f3-47fd-4eda-bc33-dee8f902febd","a7a6833c-79b8-4c7b-86e2-8e7619bb3caf"],
    ["7aa90589-f63e-43ee-a927-13edf0cf1924","d3c2638a-7b05-4cee-b907-70ce5084c765"],
    ["2bea149f-cbe8-480a-b56b-c0e600db03c8","bbbe73aa-c0a6-49d7-a684-e7e46fcb27d9"],
    ["e5fd686a-63fd-4c3a-ae16-51f4d9f5e426","6ae8bbc5-e28f-4010-a830-81ec8400688f"],
    ["7ec84ab6-1fa0-4d1b-b78b-b58a9b9a0131","05495f6a-3404-40e5-8e0e-256eb99edcf4"]
  ]'::jsonb;
  pair jsonb;
  dupe uuid;
  keeper uuid;
BEGIN
  FOR pair IN SELECT * FROM jsonb_array_elements(pairs) LOOP
    dupe := (pair->>0)::uuid;
    keeper := (pair->>1)::uuid;

    UPDATE public.vehicle_photos
       SET vehicle_id = keeper,
           photo_type = CASE WHEN photo_type = 'hero' THEN 'exterior' ELSE photo_type END,
           display_order = COALESCE((SELECT MAX(display_order) FROM public.vehicle_photos WHERE vehicle_id = keeper), 0) + 1
     WHERE vehicle_id = dupe;

    DELETE FROM public.vehicles WHERE id = dupe;
  END LOOP;
END $$;
