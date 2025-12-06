# Working with Translations

Learn how to create and manage multi-language content.

## Understanding Locales

Your CMS supports multiple languages (locales). Common examples:
- `en` - English
- `es` - Spanish
- `fr` - French
- `de` - German

Each post can have translations in multiple locales.

## Creating a Translation

### Option 1: From the Post Editor
1. Open the post you want to translate
2. Look for the language switcher in the header
3. Click **"Add Translation"**
4. Select the target language
5. You'll be redirected to a new post editor with:
   - The same post type
   - A link to the original post
   - Empty fields ready for translation

### Option 2: From the Dashboard
1. In the post list, find the post you want to translate
2. Click the **"Translate"** action
3. Select the target language
4. Fill in the translated content

## Translation Best Practices

### What to Translate
- **Title**: Adapt for the target language and culture
- **Excerpt**: Summarize in the target language
- **Content**: Translate all prose, headings, and text
- **SEO Fields**: Meta titles and descriptions should be translated
- **Alt Text**: Translate image descriptions
- **Button Labels**: CTAs and UI text

### What NOT to Translate
- **Slug**: Usually leave as-is for consistency, or adapt minimally
- **Technical IDs**: Never translate internal references
- **URLs**: External links typically stay the same

### Keep Structure Consistent
- Use the same modules in the same order
- Match the layout and design of the original
- Ensure images and media are appropriate for all locales

## Managing Translations

### Viewing Translation Status
The dashboard shows translation indicators:
- **Filled badge**: Translation exists for this locale
- **Empty badge**: Translation missing
- **Count**: Number of translations available

### Linking Translations
Translations are automatically linked when you create them through the editor. The system tracks:
- **Original Post**: The first version created
- **Translation Family**: All related translations

Users can switch between languages on the public site, and the system shows the corresponding translation.

### Updating Translations
When the original post changes:
1. Navigate to each translation
2. Update the content to match
3. Save changes

⚠️ **Note**: Translations are independent. Changing the original doesn't automatically update translations.

## Translator Role

If you're a **Translator**, you have specialized permissions:
- ✅ Can view and edit existing posts
- ✅ Can create and edit translations
- ✅ Can save for review
- ❌ Cannot create new posts from scratch (except translations)
- ❌ Cannot publish directly (must go through review)
- ❌ Cannot delete posts

## Locale-Specific Content

### URLs
Each translation gets its own URL:
- English: `/about-us`
- Spanish: `/es/about-us` or `/acerca-de`
- French: `/fr/about-us` or `/a-propos`

The URL pattern depends on your system configuration.

### Menus
Menus can be locale-specific:
- Create separate menu structures for each language
- Link to the appropriate translations
- Use locale-specific labels

### SEO
Search engines index each translation separately:
- Use `hreflang` tags (added automatically)
- Optimize meta titles/descriptions per locale
- Translate slugs when appropriate for SEO

## Common Scenarios

### Launching a New Language
1. Identify key content to translate first:
   - Homepage
   - Main navigation pages
   - High-traffic content

2. Create translations systematically
3. Test all links and navigation
4. Announce the new language to your audience

### Maintaining Translations
- Review translations periodically
- Keep them in sync with the original
- Archive outdated translations

### Handling Region Differences
For regional variants (e.g., `en-US` vs `en-GB`):
- Decide if you need separate translations
- Most systems treat these as separate locales
- Consider creating one and adapting as needed

## Translation Tools

### Translation Memory (if available)
Some systems remember previously translated phrases:
- Suggests translations as you type
- Ensures consistency across content
- Speeds up the translation process

### Machine Translation (if enabled)
Some configurations integrate with translation APIs:
- Provides initial draft translations
- **Always review and edit** machine translations
- Best used as a starting point, not final content

## Common Questions

**Q: Do I need to translate every field?**
A: Translate all user-facing text. Technical fields (slugs, IDs) often stay the same.

**Q: Can I delete a translation?**
A: Yes (if you have permission), but the original post remains. Deleting a translation doesn't delete the original.

**Q: What if I don't finish a translation?**
A: Save as Draft and continue later. Incomplete translations aren't visible publicly.

**Q: How do I know which posts need translation?**
A: Check the dashboard for translation status indicators or ask your administrator for a translation report.

---

**Related**: [Content Management](/docs/for-editors/content-management) | [Roles & Permissions](/docs/for-editors/roles-permissions)

