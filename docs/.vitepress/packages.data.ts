import { glob } from 'glob'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default {
  async load() {
    const root = resolve(__dirname, '../..')
    const dirs = glob.sync('{apps,libraries,internal}/*/', {
      cwd: root,
      ignore: ['**/node_modules/**'],
    }).map(d => d.replace(/\/$/, ''))

    return dirs
      .map(d => {
        const parts = d.split('/')
        const type = parts[0]
        const slug = parts[1]
        const pkgPath = resolve(root, d, 'package.json')

        if (existsSync(pkgPath)) {
          const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
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
        } else {
          return {
            name: slug,
            description: '',
            version: '',
            status: 'alpha',
            type,
            slug,
            deprecated: false,
            link: `/${type}/${slug}/`,
          }
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  },
}
