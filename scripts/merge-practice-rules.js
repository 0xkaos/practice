const begin = '    // BEGIN phrases-practice (managed by the practice repository)'
const end = '    // END phrases-practice'

export function mergePracticeRules(source, fragment) {
  if (!fragment.startsWith(begin) || !fragment.trimEnd().endsWith(end)) throw new Error('Invalid practice rule fragment.')
  const start = source.indexOf(begin)
  const finish = source.indexOf(end)
  if (start !== -1 || finish !== -1) {
    if (start < 0 || finish < start || source.indexOf(begin, start + 1) !== -1 || source.indexOf(end, finish + 1) !== -1) {
      throw new Error('Ambiguous managed rule markers; merge manually.')
    }
    return source.slice(0, start) + fragment.trimEnd() + source.slice(finish + end.length)
  }
  if (source.includes('/phrasePractice/') || !source.includes('match /databases/{database}/documents {')) {
    throw new Error('Unexpected existing practice rules or Firestore structure; merge manually.')
  }
  const closing = source.match(/\n[ \t]*\}\s*\n\}\s*$/u)
  if (!closing) throw new Error('Cannot safely locate the Firestore document scope.')
  return source.slice(0, closing.index) + '\n\n' + fragment.trimEnd() + source.slice(closing.index)
}
