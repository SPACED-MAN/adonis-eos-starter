# Working with Modules

A detailed guide to each type of content module available in the system.

## What Are Modules?

Modules are reusable content blocks that you assemble to build pages. Think of them like LEGO bricks—each one does something specific, and you combine them to create complete pages.

## Common Module Actions

All modules share these actions:

- **Drag handle (≡)**: Reorder by dragging up or down
- **Edit**: Open the module editor to change content
- **Delete**: Remove the module from the page
- **Lock**: Prevent accidental changes

## Module Types

### Prose

**Purpose**: Rich text content with paragraphs, headings, lists, and formatting.

**Best For**:

- Article content
- Long-form text
- Documentation

**Fields**:

- **Content**: Rich text editor with formatting tools
- **Background Color**: Optional background style

**Tips**:

- Use headings (H2, H3) to structure content
- Keep paragraphs short for readability
- Add links by selecting text and clicking the link icon

---

### Hero Banner

**Purpose**: Large, attention-grabbing banner at the top of a page.

**Best For**:

- Homepage
- Landing pages
- Major announcements

**Fields**:

- **Title**: Main headline
- **Subtitle**: Supporting text
- **Background Image**: Full-width image
- **CTA Button**: Optional call-to-action
- **Overlay Opacity**: Darken image for text readability

**Tips**:

- Use high-resolution images (1600px+ wide)
- Keep titles short and impactful
- Test readability on different screen sizes

---

### Call-to-Action (CTA)

**Purpose**: Prominent button or link to drive user action.

**Best For**:

- Sign-up prompts
- Download buttons
- "Learn More" links

**Fields**:

- **Label**: Button text
- **URL**: Destination link
- **Style**: Primary, secondary, or outline
- **Size**: Small, medium, or large

**Tips**:

- Use action verbs: "Get Started", "Download Now"
- Make CTAs stand out with contrasting colors
- Limit to 1-2 CTAs per screen for focus

---

### Gallery

**Purpose**: Display multiple images in a grid or slideshow.

**Best For**:

- Photo galleries
- Product showcases
- Before/after comparisons

**Fields**:

- **Images**: Multiple image selection
- **Layout**: Grid or carousel
- **Columns**: Number of columns (grid only)
- **Captions**: Optional per-image captions

**Tips**:

- Use images with similar aspect ratios for clean grids
- Optimize images before upload
- Add alt text for accessibility

---

### Accordion

**Purpose**: Collapsible sections for FAQs or detailed information.

**Best For**:

- FAQs
- Documentation with many sections
- Space-saving layouts

**Fields**:

- **Items**: Repeating sections
  - **Title**: Section heading
  - **Content**: Collapsible content

**Tips**:

- Keep titles concise and descriptive
- Use for secondary information users may skip
- Order items logically (often by importance or frequency)

---

### Form

**Purpose**: Collect user input (contact forms, surveys, etc.)

**Best For**:

- Contact forms
- Newsletter signups
- Feedback collection

**Fields**:

- **Form Selection**: Choose a pre-configured form
- **Success Message**: Shown after submission
- **Submit Button Label**: Customize button text

**Tips**:

- Keep forms short—only ask for essential information
- Clearly indicate required fields
- Test form submissions before going live

---

### Embed (if available)

**Purpose**: Embed external content (videos, maps, social media)

**Best For**:

- YouTube/Vimeo videos
- Google Maps
- Twitter/social feeds

**Fields**:

- **Embed Code**: Paste iframe or embed code
- **Aspect Ratio**: 16:9, 4:3, or custom

**Tips**:

- Always preview embeds before publishing
- Consider privacy implications of third-party embeds
- Use lazy loading for performance

---

## Module Scopes

### Local Modules

- Unique to this post
- Changes only affect this page
- Most common for unique content

### Global Modules

- Shared across multiple posts
- Editing affects all posts using it
- Best for repeated elements (headers, footers, CTAs)

⚠️ **Warning**: Be careful editing global modules—changes appear everywhere they're used!

## Module Groups (Templates)

Module groups allow you to save a pre-defined set of modules that can be used to quickly seed new posts. This is perfect for maintaining consistency across similar pages.

1. Go to **"Module Groups"** in the sidebar
2. Create a new module group for a specific post type
3. Add modules and configure their default properties
4. When creating a new post, select the module group to auto-populate it with those modules

## Best Practices

### Page Structure

- **Start with a hero**: Grab attention immediately
- **Break up text**: Alternate prose with visual modules
- **End with a CTA**: Guide users to the next action

### Performance

- **Limit modules per page**: 10-15 is a good target
- **Optimize images**: Large images slow down pages
- **Test on mobile**: Ensure modules work on small screens

### Accessibility

- **Use proper headings**: Structure content semantically
- **Add alt text**: Describe all images
- **Test keyboard navigation**: Ensure interactive modules work without a mouse

### Consistency

- **Match brand guidelines**: Use approved colors and fonts
- **Reuse successful layouts**: Build a library of working patterns
- **Use global modules**: For elements that should be consistent

## Common Questions

**Q: Can I create custom modules?**
A: Contact your developer or administrator. Custom modules require development work.

**Q: Why can't I edit a module?**
A: It might be locked. Look for a lock icon and unlock it first. Or you may not have permission.

**Q: Can I copy modules between posts?**
A: Some systems support this. Look for "Copy Module" or "Duplicate" actions. Or use module groups/blueprints.

**Q: What's the difference between a module and a block?**
A: They're the same thing! "Module" and "block" are often used interchangeably.

---

**Related**: [Content Management](01-content-management.md) | [For Editors](00-quick-start.md)
