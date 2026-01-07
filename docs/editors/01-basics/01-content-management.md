# Content Management

Learn how to create and manage content in Adonis EOS.

## For Editors and Editor Admins

### Accessing the Admin

1. Navigate to `/admin`
2. Log in with your credentials
3. You'll see the dashboard with content overview

### Creating a Page

1. Click **"Posts"** in the sidebar
2. Click **"New Post"**
3. Select **"Page"** as post type
4. Fill in basic information:
   - **Title**: Main page heading
   - **Slug**: URL-friendly identifier
   - **Locale**: Language (en, es, fr, etc.)
   - **Status**: Draft (not visible) or Published
5. Click **"Save Draft"** to continue editing

### Adding Modules

Modules are content blocks that make up your page.

1. Click **"Add Module"** button
2. Browse available modules:
   - **Hero**: Large heading with subtitle
   - **Prose**: Rich text content
   - **Features List**: Feature grid with icons
   - **Gallery**: Image gallery
   - **Form**: Contact or custom forms
   - And many more...
3. Click a module to add it
4. Configure the module properties
5. Save changes

### Editing Modules

1. Click on any module to expand it
2. Edit properties in the form
3. Use **"Move Up/Down"** to reorder
4. Click **"Delete"** to remove
5. Lock important modules to prevent accidental deletion

### Working with Media

#### Uploading Images

1. Go to **"Media"** in sidebar
2. Click **"Upload"** or drag files
3. Add metadata:
   - **Alt text**: Describe the image (accessibility)
   - **Categories**: Tag images (hero, featured, etc.)
4. Click **"Save"**

#### Using Images in Content

1. In a module with an image field
2. Click **"Select Image"**
3. Choose from library or upload new
4. Image is automatically inserted

#### Managing Variants

Images have multiple sizes automatically generated:

- **Small**: 400px wide
- **Medium**: 800px wide
- **Large**: 1200px wide
- **Original**: Full size

Dark mode variants can be created for automatic theme switching.

### Publishing Workflow

#### For Editors

You cannot publish directly. Use this workflow:

1. Create or edit content
2. Click **"Save for Review"** when ready
3. Notify an Editor Admin
4. Editor Admin reviews and publishes

#### For Editor Admins

You can publish content:

1. Review pending content in **"Review"** tab
2. Make any necessary changes
3. Click **"Approve Review"** to publish
4. Or click **"Publish"** directly for your own content

### Managing Different Content Types

#### Pages

General website pages (About, Contact, Services, etc.)

#### Blog Posts

Articles with publication dates, categories, and taxonomies

1. Create new blog post
2. Add modules for content
3. Select taxonomies (categories/tags)
4. Set publish date
5. Add featured media
6. Publish or schedule

#### Profiles

Team member or author profiles

#### Companies

Business or client listings

#### Testimonials

Customer reviews and quotes

### Menus

Manage site navigation:

1. Go to **"Menus"** in sidebar
2. Select a menu (Primary, Footer, etc.)
3. Add menu items:
   - **Custom URL**: External or internal link
   - **Post**: Link to a specific page
   - **Anchor**: Jump to page section
4. Drag to reorder
5. Nest items for dropdown menus
6. Save changes

### Forms

Create custom forms:

1. Go to **"Forms"** in sidebar
2. Click **"New Form"**
3. Add form fields:
   - Text input
   - Email
   - Textarea
   - Select dropdown
   - Checkbox
   - Radio buttons
4. Configure validation rules
5. Set success message
6. Save form
7. View submissions in **"Submissions"** tab

### Search and Filtering

Use the search and filters to find content:

- **Search**: Enter keywords
- **Type**: Filter by content type
- **Status**: Published, Draft, Archived
- **Locale**: Filter by language
- **Taxonomy**: Filter by category

### Keyboard Shortcuts

Speed up your workflow:

- `Ctrl/Cmd + S` - Save
- `Ctrl/Cmd + Enter` - Quick publish (Editor Admin only)
- `Esc` - Close modal
- `Tab` - Navigate form fields

## Tips for Efficient Content Creation

### 1. Use Templates

Create a "template" page and duplicate it for consistency.

### 2. Module Library

Save commonly used module configurations by duplicating posts.

### 3. Media Organization

Use categories to organize images:

- `hero` - Hero section images
- `featured` - Featured post images
- `content` - Content body images
- `logos` - Brand and partner logos

### 4. Draft Everything

Always save as draft first, review, then publish.

### 5. Preview Before Publishing

Use the preview feature to see how content looks before going live.

### 6. Consistent Slugs

Use clear, descriptive slugs:

- ✅ `about-our-company`
- ❌ `page-123`

### 7. SEO Metadata

Always fill in:

- Meta description
- Featured media
- Proper heading hierarchy

See the [SEO & A/B Testing](../03-management/07-seo-and-ab-testing.md) for detailed best practices.

### 8. Accessibility

- Add alt text to all images
- Use semantic heading levels (H1 → H2 → H3)
- Ensure sufficient color contrast
- Test with keyboard navigation

## Common Tasks

### Updating Site Logo

1. Go to **"Settings"**
2. Upload light and dark logo versions
3. Save changes
4. Logos update site-wide

### Creating Landing Pages

1. New Page post
2. Add Hero module
3. Add Features List
4. Add Testimonials
5. Add CTA (Call-to-Action)
6. Publish

### Setting Up Blog

1. Create taxonomy (e.g., "Blog Categories")
2. Add terms (Technology, Design, etc.)
3. Create blog posts
4. Assign to terms
5. Use Blog List module on main blog page

### Managing Translations

See [Internationalization guide](../../developers/05-data/08-internationalization.md) for full details.

## Getting Help

- Check [API Reference](../../developers/02-architecture/05-api-reference.md) for technical details
- Review [Building Modules](../../developers/03-extending-the-cms/04-building-modules.md) for custom modules
- Contact your administrator for permission issues
- Refer to [Roles & Permissions](02-roles-permissions.md) for access questions
