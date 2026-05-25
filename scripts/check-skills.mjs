import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const errors = []

function fail(message) {
  errors.push(message)
}

function readText(file) {
  return readFileSync(file, 'utf8')
}

function parseFrontmatter(text, file) {
  const normalized = text.replace(/\r\n/g, '\n')

  if (!normalized.startsWith('---\n')) {
    fail(`${file} is missing frontmatter`)
    return {}
  }

  const end = normalized.indexOf('\n---', 4)
  if (end === -1) {
    fail(`${file} has unterminated frontmatter`)
    return {}
  }

  const body = normalized.slice(4, end)
  const data = {}

  for (const line of body.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/)
    if (match) {
      data[match[1]] = match[2].replace(/^["']|["']$/g, '')
    }
  }

  return data
}

function findMarkdownLinks(text) {
  const links = []
  const regex = /\[[^\]]+\]\(([^)]+)\)/g
  let match

  while ((match = regex.exec(text))) {
    const target = match[1].split('#')[0]
    if (
      target &&
      !target.includes('://') &&
      !target.startsWith('mailto:') &&
      !target.startsWith('#')
    ) {
      links.push(target)
    }
  }

  return links
}

function checkLocalLinks(file) {
  const text = readText(file)
  const baseDir = path.dirname(file)

  for (const target of findMarkdownLinks(text)) {
    const resolved = path.resolve(baseDir, target)
    if (!existsSync(resolved)) {
      fail(`${path.relative(root, file)} links to missing file: ${target}`)
    }
  }
}

const skillsDir = path.join(root, 'skills')
if (!existsSync(skillsDir)) {
  fail('skills directory is missing')
} else {
  const skillNames = readdirSync(skillsDir).filter((name) => {
    const fullPath = path.join(skillsDir, name)
    return statSync(fullPath).isDirectory()
  })

  if (skillNames.length === 0) {
    fail('skills directory contains no skills')
  }

  for (const skillName of skillNames) {
    const skillPath = path.join(skillsDir, skillName)
    const skillFile = path.join(skillPath, 'SKILL.md')

    if (!existsSync(skillFile)) {
      fail(`${skillName} is missing SKILL.md`)
      continue
    }

    const text = readText(skillFile)
    const frontmatter = parseFrontmatter(text, path.relative(root, skillFile))

    for (const key of ['name', 'description', 'license']) {
      if (!frontmatter[key]) {
        fail(`${path.relative(root, skillFile)} is missing frontmatter key: ${key}`)
      }
    }

    if (frontmatter.name && frontmatter.name !== skillName) {
      fail(`${path.relative(root, skillFile)} name does not match directory: ${frontmatter.name}`)
    }

    checkLocalLinks(skillFile)
  }
}

const marketplaceFile = path.join(root, '.claude-plugin', 'marketplace.json')
if (existsSync(marketplaceFile)) {
  const marketplace = JSON.parse(readText(marketplaceFile))
  const plugins = Array.isArray(marketplace.plugins) ? marketplace.plugins : []

  for (const plugin of plugins) {
    if (!plugin.name) {
      fail('marketplace plugin is missing name')
    }

    if (!plugin.source) {
      fail(`marketplace plugin ${plugin.name || '<unknown>'} is missing source`)
      continue
    }

    const sourceFromRoot = path.resolve(root, plugin.source)
    const sourceFromManifest = path.resolve(path.dirname(marketplaceFile), plugin.source)
    if (!existsSync(sourceFromRoot) && !existsSync(sourceFromManifest)) {
      fail(`marketplace plugin ${plugin.name || '<unknown>'} source is missing: ${plugin.source}`)
    }
  }
}

for (const readme of ['README.md', 'README.en.md']) {
  const file = path.join(root, readme)
  if (existsSync(file)) {
    checkLocalLinks(file)
  }
}

if (errors.length > 0) {
  console.error('Skill checks failed:')
  for (const error of errors) {
    console.error(`- ${error}`)
  }
  process.exit(1)
}

console.log('Skill checks passed.')
