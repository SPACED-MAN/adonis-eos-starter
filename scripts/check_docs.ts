import db from '@adonisjs/lucid/services/db'
import Post from '#models/post'

async function run() {
  const posts = await Post.query().where('type', 'documentation').select('id', 'title', 'status', 'publishedAt')
  console.log('Documentation posts:', JSON.stringify(posts, null, 2))
  
  if (posts.length > 0) {
    const pm = await db.from('post_modules')
      .join('module_instances', 'post_modules.module_id', 'module_instances.id')
      .where('post_modules.post_id', posts[0].id)
      .select('module_instances.type', 'module_instances.props')
    console.log('Modules for first doc post:', JSON.stringify(pm, null, 2))
  }
}

run().then(() => process.exit()).catch(err => { console.error(err); process.exit(1) })

