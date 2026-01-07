# Managing Media

Learn how to upload, organize, and use images and files in your content.

## Uploading Media

### From the Media Library

1. Navigate to **Media** in the admin sidebar
2. Click **"Upload"** or drag files into the upload area. You can select and upload **multiple files simultaneously**.
3. Select files from your computer or drag them directly into the dashed dropzone.
4. Files are uploaded and processed automatically in the background.

### From the Post Editor

When editing a module that requires an image or animation:

1. Click the **"Select Media"** button
2. Choose from existing media or switch to the **Upload** tab.
3. You can drag and drop multiple files into the upload area or click the browse button.
4. After uploading, the system automatically selects the newest item for you.
5. Click **"Use Selected"** to insert it.

## Supported File Types

- **Images**: JPG, PNG, GIF, WebP, SVG
- **Animations**: Lottie (JSON), Animated SVG, Animated WebP
- **Documents**: PDF (if configured)
- **Videos**: MP4, WebM (if configured)

Check with your administrator for file size limits and specific format requirements.

## Animations (Lottie & SVG)

The system supports high-performance vector animations:

- **Lottie**: Upload `.json` or `.lottie` files. These use the Lottie player for smooth, scalable animations.
- **Animated SVG**: Standard SVGs with CSS or SMIL animations are supported.
- **Playback Control**: For both Lottie and Videos, you can choose between **Autoplay** (looping in the background), **Inline** (with controls), or **Modal** (opens in a full-screen player).
- **SVG in Modals**: Even static SVGs can be configured to open in a modal player, useful for detailed diagrams or illustrations.

## Image Variants

When you upload an image, the system automatically creates variants:

- **Thumbnail**: Small preview (150x150px)
- **Medium**: Standard size (800px wide)
- **Large**: High resolution (1600px wide)
- **Original**: Your uploaded file (preserved)

The system chooses the appropriate variant based on where the image is used, ensuring fast page loads.

## Dark Mode Images

Some images may look better with different versions for light and dark modes:

1. Upload your light mode image normally
2. In the media editor, upload a dark mode variant
3. The system automatically shows the correct version based on the user's theme

This is optional but recommended for logos and hero images.

## Organizing Media

### Folders (if enabled)

- Create folders to organize your media
- Drag files between folders
- Use descriptive folder names

### Alt Text

Always add alt text to images:

- Improves accessibility for screen readers
- Helps with SEO
- Provides context if images fail to load

### Titles and Captions

- **Title**: Short description of the image
- **Caption**: Longer description or attribution

## Using Media in Content

### In Prose Modules

1. Click the image icon in the rich text editor
2. Select or upload an image
3. Adjust size and alignment as needed

### In Image Modules

Specific image modules (Hero Banner, Gallery, etc.) have dedicated image selectors:

- Click **"Select Media"**
- Choose your image
- Configure display options (size, crop, overlay)

### In Custom Fields

Some post types have custom image fields:

- **Featured Media**: Main media for blog posts
- **Thumbnail**: Small preview image
- **Background Image**: For hero sections

## Best Practices

### Image Optimization

- Upload the highest quality version you have
- The system handles optimization automatically
- Recommended minimum width: 1600px for hero images, 800px for content images

### File Naming

- Use descriptive filenames: `team-photo-2025.jpg` not `IMG_1234.jpg`
- Avoid spaces and special characters
- Use lowercase and hyphens

### Copyright and Licensing

- Only upload images you have permission to use
- Keep track of attribution requirements
- Add credits in the description field when needed (used as the visual caption)

### Accessibility

- Write descriptive alt text (not just "image" or the filename)
- Describe what the image shows, not just what it is
- For decorative images, you can leave alt text empty

## Managing Existing Media

### Editing Media

1. Click on any media item in the library
2. Update alt text, title, or description (caption)
3. Replace the file if needed
4. Save changes

### Deleting Media

⚠️ **Warning**: Deleting media removes it from all posts where it's used!

1. Select the media item
2. Click **"Delete"**
3. Confirm the deletion
4. The system warns you if the media is in use

### Finding Unused Media

Some systems can show you:

- Media not used in any posts
- Media uploaded but never used
- Old media that can be cleaned up

Ask your administrator if this feature is available.

## Common Questions

**Q: Why is my image blurry?**
A: Upload a higher resolution version. The system scales down but can't scale up effectively.

**Q: Can I upload videos?**
A: Video support depends on your configuration. Ask your administrator.

**Q: How do I change an image that's already in a post?**
A: Edit the post, find the module with the image, and click "Select Media" to choose a different image.

**Q: What's the maximum file size?**
A: This varies by configuration. Typically 10MB for images. Large files may be rejected or take longer to upload.

---

**Related**: [Content Management](01-content-management.md) | [Working with Modules](06-modules-guide.md)
