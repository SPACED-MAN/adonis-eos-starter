import BaseModule from '#modules/base'
import type { ModuleConfig } from '#types/module_types'

export default class KitchenSinkModule extends BaseModule {
  /**
   * Kitchen sink is a demo module. Hybrid mode allows
   * testing both static and interactive variants.
   */
  getRenderingMode() {
    return 'hybrid' as const
  }

  getConfig(): ModuleConfig {
    return {
      type: 'kitchen-sink',
      name: 'Kitchen Sink',
      description:
        'A demo module showcasing all supported field types (text, textarea, number, select, multiselect, boolean, date, url, media, object, repeater, richtext).',
      icon: 'flask',
      allowedScopes: ['local', 'global'],
      lockable: false,
      fieldSchema: [
        {
          slug: 'postRefs',
          type: 'post-reference',
          label: 'Post References',
          config: { postTypes: ['blog'], allowMultiple: true },
        },
        { slug: 'title', type: 'text', label: 'Title', required: true, placeholder: 'Enter title' },
        { slug: 'description', type: 'textarea', label: 'Description' },
        { slug: 'count', type: 'number', label: 'Count' },
        {
          slug: 'category',
          type: 'select',
          label: 'Category',
          options: [
            { label: 'General', value: 'general' },
            { label: 'News', value: 'news' },
            { label: 'Updates', value: 'updates' },
          ],
        },
        {
          slug: 'tags',
          type: 'multiselect',
          label: 'Tags',
          options: [
            { label: 'Alpha', value: 'alpha' },
            { label: 'Beta', value: 'beta' },
            { label: 'Gamma', value: 'gamma' },
          ],
        },
        { slug: 'featured', type: 'boolean', label: 'Featured' },
        { slug: 'publishDate', type: 'date', label: 'Publish Date' },
        { slug: 'linkUrl', type: 'url', label: 'Link URL', placeholder: 'https://example.com' },
        {
          slug: 'image',
          type: 'media',
          label: 'Media',
          accept: 'image/*,video/*',
          config: { storeAs: 'id' },
          description: 'Pick an image or video (stores media ID).',
        },
        {
          slug: 'imageVariant',
          type: 'select',
          label: 'Image Variant',
          options: [
            { label: 'Thumb', value: 'thumb' },
            { label: 'Small', value: 'small' },
            { label: 'Medium', value: 'medium' },
            { label: 'Large', value: 'large' },
            { label: 'Hero', value: 'hero' },
            { label: 'Cropped', value: 'cropped' },
          ],
        },
        {
          slug: 'progress',
          type: 'slider',
          label: 'Progress',
          min: 0,
          max: 100,
          step: 5,
          unit: '%',
        },
        {
          slug: 'metadata',
          type: 'object',
          label: 'Metadata',
          fields: [
            { slug: 'author', type: 'text', label: 'Author' },
            { slug: 'readingTime', type: 'number', label: 'Reading Time (min)' },
            { slug: 'attributionRequired', type: 'boolean', label: 'Attribution Required' },
          ],
        },
        {
          slug: 'items',
          type: 'repeater',
          label: 'Items',
          item: {
            slug: 'item',
            type: 'object',
            fields: [
              { slug: 'label', type: 'text', label: 'Label' },
              { slug: 'value', type: 'text', label: 'Value' },
              { slug: 'highlight', type: 'boolean', label: 'Highlight' },
            ],
          },
        },
        {
          slug: 'content',
          type: 'richtext',
          label: 'Rich Text Content',
          required: false,
        },
      ],
      defaultValues: {
        postRefs: [],
        title: 'Kitchen Sink Demo',
        description: 'This module demonstrates all supported field types.',
        count: 3,
        category: 'general',
        tags: ['alpha', 'beta'],
        featured: true,
        publishDate: new Date().toISOString().slice(0, 10),
        linkUrl: 'https://example.com',
        image: '',
        imageVariant: 'large',
        progress: 50,
        metadata: {
          author: 'Ada Lovelace',
          readingTime: 5,
          attributionRequired: false,
        },
        items: [
          { label: 'First', value: 'One', highlight: true },
          { label: 'Second', value: 'Two', highlight: false },
        ],
        content: {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'text', text: 'This is a rich text field powered by Lexical.' }],
              },
              {
                type: 'paragraph',
                children: [{ type: 'text', text: 'Use the module editor to try all field types.' }],
              },
            ],
          },
        },
      },
      allowedPostTypes: [],
    }
  }
}
