-- Track edit lineage for generated assets
-- Allows tracing back to the original image when edits are made

alter table public.project_assets
  add column if not exists parent_asset_id uuid
  references public.project_assets(id)
  on delete set null;

create index if not exists project_assets_parent_asset_id_idx
  on public.project_assets(parent_asset_id);

comment on column public.project_assets.parent_asset_id is 'Reference to parent asset when this asset was created via edit_image';
