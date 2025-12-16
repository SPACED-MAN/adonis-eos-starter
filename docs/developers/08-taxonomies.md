# Taxonomies

Adonis EOS supports code-first taxonomies that define how posts can be organized into categories or tags.

## Define a Taxonomy

Create files in `app/taxonomies/*.ts` exporting one or more configs:

```ts
import type { RegisteredTaxonomyConfig } from '#services/taxonomy_registry'

const lipsum: RegisteredTaxonomyConfig = {
  slug: 'lipsum',
  name: 'Lipsum Categories',
  hierarchical: true,
  freeTagging: false,
  maxSelections: null, // unlimited
}

export default lipsum
```

Fields:

- `slug`: Unique key.
- `name`: Display name.
- `hierarchical`: If true, terms can nest and be reordered.
- `freeTagging`: If true, editors can create terms inline while editing posts.
- `maxSelections`: Limit of terms per post (number) or `null` for unlimited.

Taxonomies are loaded on boot by `start/taxonomies.ts`, which also ensures the taxonomy row exists in DB.

### CLI scaffolding

Use the built-in maker to scaffold a taxonomy config:

```bash
node ace make:taxonomy "Blog Categories" \
  --hierarchical \
  --free-tagging=false \
  --maxSelections=unlimited
```

Flags:

- `--hierarchical` (boolean): enable nesting + reorder.
- `--free-tagging` (boolean): allow inline term creation in the post editor.
- `--maxSelections` (number or `unlimited`): cap terms per post.

## Using in the Post Editor

- Only taxonomies referenced by a post type (`taxonomies: [...]`) appear in that editor.
- Hierarchical taxonomies render nested lists; flat taxonomies render a simple list.
- `maxSelections` disables further picks when the limit is reached.
- If `freeTagging` is true, editors can add new terms inline; otherwise, terms come from the Categories admin page.

## Admin (Categories page)

- Shows taxonomies with their term trees.
- Drag-and-drop reorder is enabled only when `hierarchical` is true.
- Term creation/edit/delete is available; for non-hierarchical taxonomies, ordering is fixed but terms can still be managed.

## API/Storage

- Terms live in `taxonomy_terms`; assignments live in `post_taxonomy_terms`.
- Post updates accept `taxonomyTermIds`; only terms belonging to allowed taxonomies are persisted.
