import { glob } from 'glob'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default {
  async load() {
    const root = resolve(__dirname, '../..')
    const manifests = glob.sync('{apps,libraries,internal}/*/package.json', {
      cwd: root,
      ignore: ['**/node_modules/**'],
    })

    return manifests
      .map(p => {
        const pkg = JSON.parse(readFileSync(resolve(root, p), 'utf-8'))
        const type = p.split('/')[0]
        const slug = p.split('/')[1]
        return {
          name: pkg.name ?? slug,
          description: pkg.description ?? '',
          version: pkg.version ?? '',
          status: pkg.nostrwatch?.status ?? 'alpha',
          type,
          slug,
          deprecated: pkg.nostrwatch?.deprecated ?? false,
          link: `/${type}/${slug}/`,
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  },
}
