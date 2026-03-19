import * as XLSX from 'xlsx'
import type { CurriculumCatalog } from '../types'
import { toNum } from './normalization'
import { loadWorkbookFromBufferOrText } from './xlsx-helpers'

export function parseYearTermFromText(txt: unknown): { y: number | null; t: number | null } {
  if (!txt) return { y: null, t: null }
  const s = String(txt).trim()
  const dash = s.match(/(\d+)\s*[-\/–]\s*(\d+)/)
  if (dash) return { y: Number(dash[1]), t: Number(dash[2]) }
  const ym = s.match(/(\d+)\s*학년/)
  const tm = s.match(/(\d+)\s*학기/)
  return { y: ym ? Number(ym[1]) : null, t: tm ? Number(tm[1]) : null }
}

function buildCurriculumCatalog(wb: XLSX.WorkBook): CurriculumCatalog {
  const name = wb.SheetNames[0]
  const ws = wb.Sheets[name]
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null }) as unknown[][]
  if (!aoa.length) return {}
  const header = ((aoa[0] || []) as unknown[]).map((v) => (v == null ? '' : String(v).trim()))
  const idx = (label: string) => header.findIndex((h) => h.replace(/\s+/g, '') === label)
  const ixSem = idx('학기')
  const ixSub = idx('과목명')
  const ixCred = idx('학점')
  const ixGroup = idx('교과군')
  const ixKind = idx('과목구분')

  const cat: CurriculumCatalog = {}
  for (let r = 1; r < aoa.length; r++) {
    const row = (aoa[r] || []) as unknown[]
    const sem = ixSem >= 0 ? row[ixSem] : null
    const { y: subYear, t: subTerm } = parseYearTermFromText(sem)
    const subName = ixSub >= 0 ? (row[ixSub] != null ? String(row[ixSub]).trim() : null) : null
    const credit = ixCred >= 0 ? toNum(row[ixCred]) : null
    const group = ixGroup >= 0 ? (row[ixGroup] != null ? String(row[ixGroup]).trim() : null) : null
    const kind = ixKind >= 0 ? (row[ixKind] != null ? String(row[ixKind]).trim() : null) : null
    if (!subName) continue
    const rec = { 과목명: subName, 교과: group, 학점: credit, 과목학년: subYear, 과목학기: subTerm, 과목구분: kind }
    if (!cat[subName]) cat[subName] = []
    cat[subName].push(rec)
  }
  return cat
}

export async function parseCurriculumFile(
  buffer: ArrayBuffer,
  fileName: string
): Promise<CurriculumCatalog> {
  const wb = await loadWorkbookFromBufferOrText(buffer, fileName)
  return buildCurriculumCatalog(wb)
}
