import { useMemo, useState, useRef, useEffect, type ReactNode } from 'react'
import rawPrereqs from './prereqs.json'
import * as XLSX from 'xlsx'
import type { Dataset, Row } from './types'

function readRowsFromSheet(ws: XLSX.WorkSheet): Row[] {
  const aoa = XLSX.utils.sheet_to_json<any[]>(ws, { header:1, defval:null }) as any[][]
  if (!aoa.length) return []
  const header = (aoa[0] || []).map((h) => (h==null? '' : String(h)))
  const idx = (k: string) => header.indexOf(k)
  const col = {
    y: idx('학년'), c: idx('반'), n: idx('번호'), name: idx('이름'),
    sy: idx('과목학년'), st: idx('과목학기'), group: idx('교과'), subj: idx('과목명'), credit: idx('학점')
  }
  return aoa.slice(1).map((r) => ({
    학년: toNum(r[col.y]), 반: toNum(r[col.c]), 번호: toNum(r[col.n]),
    이름: toStr(r[col.name]), 과목학년: toNum(r[col.sy]), 과목학기: toNum(r[col.st]),
    교과: toStr(r[col.group]), 과목명: toStr(r[col.subj]), 학점: toNum(r[col.credit])
  }))
}

function toNum(v: any): number | null {
  if (v == null) return null
  const s = typeof v === 'string' ? v.trim() : v
  if (s === '') return null
  const n = Number(s)
  return Number.isNaN(n) ? null : n
}
function toStr(v: any): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

// 교과 그룹 정규화: 특정 교과명을 하나의 그룹으로 묶음
function canonGroup(raw: string | null): string {
  if (raw == null) return '기타'
  const s = String(raw).trim()
  if (s === '') return '기타'
  // 기호/폭 정규화
  let normalized = s
    .normalize('NFKC')
    // 다양한 중점 기호를 하나로 통일
    .replace(/[·⋅•∙・ㆍ]/g, '・')
    // 전각 슬래시 통일
    .replace(/／/g, '/')
    // 공백 정리: 구분자 주변 공백 제거
    .replace(/\s*・\s*/g, '・')
    .replace(/\s*\/\s*/g, '/')
    // 괄호 내부 공백 제거: (역사/도덕 포함) -> (역사/도덕포함)
    .replace(/\(([^)]*)\)/g, (_m, inner) => `(${String(inner).replace(/\s+/g, '')})`)

  const target = '기술・가정/제2외국어/한문/교양'
  // 아래 항목들은 모두 하나의 그룹으로 합침
  const cmp = normalized.replace(/\s+/g, '')
  if (
    cmp === target ||
    cmp === '교양' ||
    cmp === '제2외국어' ||
    cmp === '제2외국어/한문' ||
    cmp === '한문' ||
    cmp === '기술・가정' ||
    cmp === '기술・가정/정보'
  ) {
    return target
  }
  return normalized
}

// 과목명에서 위계(로마자) 수준 파싱: ex) "물리학Ⅰ" -> { base:"물리학", level:1 }
function parseHierLevel(name: string | null): { base: string, level: number } | null {
  if (!name) return null
  const s = String(name).trim().normalize('NFKC')
  // 통일: 다양한 로마자 표기를 지원 (유니코드 ⅠⅡⅢ... 및 ASCII I/V/X 조합)
  const asciiRoman = '(?:VIII|VII|VI|IV|IX|III|II|I|X)'
  const unicodeRoman = '[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]'
  const re = new RegExp(`^(.*?)\s*(?:${unicodeRoman}|${asciiRoman})$`)
  const m = s.match(re)
  if (!m) return null
  const tail = s.slice(m[1].length).trim()
  const roman = tail
  const map: Record<string, number> = {
    // ASCII
    'I':1,'II':2,'III':3,'IV':4,'V':5,'VI':6,'VII':7,'VIII':8,'IX':9,'X':10,
    // Unicode Roman numerals
    'Ⅰ':1,'Ⅱ':2,'Ⅲ':3,'Ⅳ':4,'Ⅴ':5,'Ⅵ':6,'Ⅶ':7,'Ⅷ':8,'Ⅸ':9,'Ⅹ':10,
  }
  const key = roman
  const level = map[key as keyof typeof map]
  if (!level) return null
  const base = m[1].trim()
  if (!base) return null
  return { base, level }
}

// 과목명 정규화(선후수 매칭용): 폭/공백/괄호 내부 공백 통일
function normCourseName(name: string | null): string | null {
  if (!name) return null
  return String(name)
    .trim()
    .normalize('NFKC')
    .replace(/\(([^)]*)\)/g, (_m, inner) => `(${String(inner).replace(/\s+/g, '')})`)
}

// 한국사 과목명 판별: 한국사, 한국사1, 한국사2
function isKoreanHistory(name: string | null): boolean {
  if (!name) return false
  const s = String(name).trim().normalize('NFKC')
  return s === '한국사' || s === '한국사1' || s === '한국사2'
}

// JSON 선후수 규칙을 정규화한 맵으로 준비
const PREREQS = (() => {
  const m = new Map<string, string[]>()
  for (const [k, arr] of Object.entries(rawPrereqs as Record<string, string[]>)){
    const nk = normCourseName(k)
    if (!nk) continue
    const reqs = arr.map(normCourseName).filter((x): x is string => Boolean(x))
    m.set(nk, reqs)
  }
  return m
})()

function Upload({ onLoad }: { onLoad: (ds: Dataset) => void }){
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>){
    const f = e.target.files?.[0]; if(!f) return
    const buf = await f.arrayBuffer()
    const wb = XLSX.read(buf)
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = readRowsFromSheet(ws)
    onLoad({ rows })
  }
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <label className="font-semibold">정리완료.xlsx 업로드</label>
      <input type="file" accept=".xlsx,.xls" onChange={handleFile} className="file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-sage-600 file:text-white hover:file:bg-sage-700" />
    </div>
  )
}

function Kpis({ rows }: { rows: Row[] }){
  const total = rows.length
  const students = useMemo(() => {
    const set = new Set<string>()
    for (const r of rows){ if (r.학년!=null && r.반!=null && r.번호!=null) set.add(`${r.학년}-${r.반}-${r.번호}`) }
    return set.size
  }, [rows])
  const creditsByStudent = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of rows){
      if (r.학년==null || r.반==null || r.번호==null) continue
      const k = `${r.학년}-${r.반}-${r.번호}`
      const prev = m.get(k) || 0
      m.set(k, prev + (r.학점 || 0))
    }
    const vals = Array.from(m.values())
    const avg = vals.length ? (vals.reduce((a,b)=>a+b,0)/vals.length) : 0
    return { count: m.size, avg: Math.round(avg*100)/100 }
  }, [rows])
  return (
    <div className="flex gap-3 mt-3 flex-wrap">
      <Kpi title="총 행 수" value={String(total)} />
      <Kpi title="학생 수" value={String(students)} />
      <Kpi title="학생당 평균 학점" value={String(creditsByStudent.avg)} />
    </div>
  )
}

function Kpi({ title, value, note }: { title:string, value:string, note?: ReactNode }){
  return (
    <div className="kpi-card min-w-[160px]">
      <div className="kpi-title">{title}</div>
      <div className="kpi-value">{value}</div>
      {note && <div>{note}</div>}
    </div>
  )
}

function DataTable({ rows }: { rows: Row[] }){
  const cols = ['학년','반','번호','이름','과목학년','과목학기','교과','과목명','학점'] as const
  const first = rows.slice(0, 100)
  return (
    <div className="mt-4 max-h-[480px] overflow-auto border border-sage-200 rounded-xl">
      <table className="w-full border-collapse">
        <thead>
          <tr>{cols.map(c=> <th key={c} className="border-b border-sage-200 p-2 text-left sticky top-0 bg-sage-50">{c}</th>)}</tr>
        </thead>
        <tbody>
          {first.map((r,i)=> (
            <tr key={i} className="odd:bg-white even:bg-sage-50/30">
              {cols.map(c=> <td key={String(c)} className="border-b border-sage-100 p-2">{(r as any)[c] ?? ''}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="text-xs text-slate-500 p-2">표시: {first.length} / 총 {rows.length}</div>
    </div>
  )
}

function BarRow({ label, value, max }:{ label:string, value:number, max:number }){
  const pct = max>0 ? Math.round((value/max)*100) : 0
  return (
    <div className="flex items-center gap-3">
      <div className="w-32 text-sm text-slate-600">{label}</div>
      <div className="flex-1 h-3 bg-sage-100 rounded-full overflow-hidden">
        <div className="h-full bg-sage-500" style={{ width: pct+'%' }} />
      </div>
      <div className="w-12 text-right text-sm">{value}</div>
    </div>
  )
}

export default function App(){
  const [data, setData] = useState<Dataset>({ rows: [] })
  const [selected, setSelected] = useState<string | null>(null)

  // 전체 요약 제거 (요구사항 반영)

  const byStudent = useMemo(() => {
    const m = new Map<string, { key:string, 학년:number|null, 반:number|null, 번호:number|null, 이름:string|null, rows: Row[] }>()
    for (const r of data.rows){
      if (r.학년==null || r.반==null || r.번호==null) continue
      const key = `${r.학년}-${r.반}-${r.번호}`
      const prev = m.get(key)
      if (!prev) m.set(key, { key, 학년:r.학년, 반:r.반, 번호:r.번호, 이름:r.이름 ?? null, rows:[r] })
      else prev.rows.push(r)
    }
    const arr = Array.from(m.values()).map(s => {
      const total = s.rows.reduce((sum, r)=> sum + (r.학점 || 0), 0)
      const grp = new Map<string, number>()
      for (const r of s.rows){
        const g = canonGroup(r.교과); grp.set(g, (grp.get(g)||0) + (r.학점 || 0))
      }
      const subjStr = Array.from(grp, ([k,v])=> `${k}:${v}`).join(', ')
      return { ...s, 총학점: total, 교과별합: subjStr }
    })
    arr.sort((a,b)=> (a.학년! - b.학년!) || (a.반! - b.반!) || (a.번호! - b.번호!))
    const detail = (key:string) => {
      const s = m.get(key); if (!s) return { list:[], byGroup:[] }
      const list = s.rows.map(r=> ({ 교과:canonGroup(r.교과), 과목명:r.과목명||'', 학점:r.학점||0, 과목학년:r.과목학년||null, 과목학기:r.과목학기||null }))
      const grp = new Map<string, number>()
      for (const r of list){ grp.set(r.교과, (grp.get(r.교과)||0) + (r.학점 || 0)) }
      const byGroup = Array.from(grp, ([교과, 총학점])=> ({ 교과, 총학점 }))
      return { list, byGroup }
    }
    return { list: arr, detail }
  }, [data])

  // 학급/학생 선택 UI
  const classes = useMemo(() => {
    const set = new Set<string>()
    for (const r of data.rows){ if (r.학년!=null && r.반!=null) set.add(`${r.학년}-${r.반}`) }
    return Array.from(set).sort((a,b)=> {
      const [ag,ac] = a.split('-').map(Number); const [bg,bc] = b.split('-').map(Number)
      return ag-bg || ac-bc
    })
  }, [data])
  const [klass, setKlass] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const listRef = useRef<HTMLDivElement | null>(null)
  const studentsInClass = useMemo(() => {
    if (!klass) return [] as { key:string, label:string }[]
    const [g,c] = klass.split('-').map(Number)
    const m = new Map<string, string>()
    for (const r of data.rows){
      if (r.학년===g && r.반===c && r.번호!=null){
        const key = `${g}-${c}-${r.번호}`
        m.set(key, `${String(r.번호).padStart(2,'0')} ${r.이름 ?? ''}`)
      }
    }
    const arr = Array.from(m, ([key,label]) => ({ key, label }))
    arr.sort((a,b)=> a.label.localeCompare(b.label, 'ko'))
    return arr
  }, [data, klass])
  const filteredStudents = studentsInClass.filter(s=> s.label.includes(query))
  const selectedIndex = filteredStudents.findIndex(s=> s.key===selected)

  function handleListKey(e: React.KeyboardEvent<HTMLDivElement>){
    if (filteredStudents.length===0) return
    if (e.key==='ArrowDown' || e.key==='ArrowUp'){
      e.preventDefault()
      let idx = selectedIndex
      if (e.key==='ArrowDown') idx = idx<0 ? 0 : Math.min(idx+1, filteredStudents.length-1)
      else idx = idx<0 ? 0 : Math.max(idx-1, 0)
      const next = filteredStudents[idx]
      if (next) setSelected(next.key)
    }
  }

  useEffect(() => {
    if (!selected) return
    const el = listRef.current?.querySelector(`button[data-key="${selected}"]`) as HTMLElement | null
    if (el) el.scrollIntoView({ block: 'nearest' })
  }, [selected])

  // 내보내기: 전체 학생 요약 XLSX 생성
  function exportAll(){
    const rows = data.rows
    if (!rows.length) return
    // 모든 교과 그룹 컬럼 수집
    const groupSet = new Set<string>()
    for (const r of rows){ groupSet.add(canonGroup(r.교과)) }
    const groups = Array.from(groupSet).sort((a,b)=> a.localeCompare(b, 'ko'))

    // 학생별 집계 준비
    const byStu = new Map<string, { 학년:number|null, 반:number|null, 번호:number|null, 이름:string|null, list: Row[] }>()
    for (const r of rows){
      if (r.학년==null || r.반==null || r.번호==null) continue
      const key = `${r.학년}-${r.반}-${r.번호}`
      const ent = byStu.get(key) || { 학년:r.학년, 반:r.반, 번호:r.번호, 이름:r.이름 ?? null, list: [] }
      ent.list.push(r)
      byStu.set(key, ent)
    }
    const foundation = new Set(['국어','수학','영어'])

    // 헤더
    const header = ['학년','반','번호','이름', ...groups, '전체이수학점','기초교과학점','한국사학점','기초교과+한국사비율(%)','점검']
    const aoa: any[][] = [header]

    // 위계/선후수 점검 헬퍼
    function buildChecks(list: { 과목명:string, 교과:string, 학점:number, 과목학년:number|null, 과목학기:number|null }[]){
      // 로마자 위계
      const byBase = new Map<string, Set<number>>()
      for (const r of list){
        const ph = parseHierLevel(r.과목명)
        if (!ph) continue
        const set = byBase.get(ph.base) || new Set<number>()
        set.add(ph.level)
        byBase.set(ph.base, set)
      }
      const seqParts: string[] = []
      for (const [base, set] of byBase){
        const levels = Array.from(set)
        const max = Math.max(...levels)
        const missing: number[] = []
        for (let i=1;i<max;i++) if (!set.has(i)) missing.push(i)
        if (missing.length>0) seqParts.push(`${base}: 누락 ${missing.join(', ')}`)
      }
      // JSON 선후수
      const have = new Set<string>()
      for (const r of list){ const nm = normCourseName(r.과목명); if (nm) have.add(nm) }
      const explicitParts: string[] = []
      for (const [course, reqs] of PREREQS){
        if (!have.has(course)) continue
        const miss = reqs.filter(r => !have.has(r))
        if (miss.length>0) explicitParts.push(`${course}: 선수 누락 → ${miss.join(', ')}`)
      }
      const parts = [] as string[]
      if (seqParts.length) parts.push(`로마자 위계 위반: ${seqParts.join('; ')}`)
      if (explicitParts.length) parts.push(explicitParts.join('; '))
      return parts.join(' | ')
    }

    // 각 학생 행 생성
    const keys = Array.from(byStu.keys()).sort((a,b)=> {
      const [ag,ac,an] = a.split('-').map(Number); const [bg,bc,bn] = b.split('-').map(Number)
      return (ag-bg) || (ac-bc) || (an-bn)
    })
    for (const key of keys){
      const s = byStu.get(key)!;
      const list = s.list.map(r => ({
        교과: canonGroup(r.교과),
        과목명: r.과목명 || '',
        학점: r.학점 || 0,
        과목학년: r.과목학년 ?? null,
        과목학기: r.과목학기 ?? null,
      }))
      const grp = new Map<string, number>()
      for (const r of list){ grp.set(r.교과, (grp.get(r.교과)||0) + (r.학점 || 0)) }
      const total = list.reduce((sum,r)=> sum + (r.학점||0), 0)
      const baseOnly = list.reduce((sum,r)=> sum + (foundation.has(r.교과) ? (r.학점||0) : 0), 0)
      const khOnly = list.reduce((sum,r)=> sum + (isKoreanHistory(r.과목명) ? (r.학점||0) : 0), 0)
      const pct = total>0 ? Math.round(((baseOnly+khOnly)/total)*1000)/10 : 0
      const checkParts: string[] = []
      const hierarchyCheck = buildChecks(list)
      if (hierarchyCheck) checkParts.push(hierarchyCheck)
      if (pct > 50) checkParts.push('기초교과 비율 초과')
      const check = checkParts.join(' | ')

      const row: any[] = [s.학년, s.반, s.번호, s.이름 ?? '']
      for (const g of groups){ row.push(grp.get(g) || 0) }
      row.push(total, baseOnly, khOnly, pct, check)
      aoa.push(row)
    }

    const ws = XLSX.utils.aoa_to_sheet(aoa)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '학생별 요약')
    XLSX.writeFile(wb, '학생별_요약.xlsx', { compression: true })
  }

  const studentDet = selected ? byStudent.detail(selected) : null
  const studentName = useMemo(()=>{
    if (!selected) return ''
    const found = studentsInClass.find(s => s.key===selected)
    return found?.label ?? selected
  }, [studentsInClass, selected])

  return (
    <div className="max-w-6xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-1">과목선택 점검 대시보드</h1>
      <div className="text-slate-600 mb-3">정리완료.xlsx(고정 스키마) 파일을 업로드해 학급/학생별 이수현황을 살펴보세요.</div>
      <div className="card p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Upload onLoad={(ds)=> { setData(ds); setKlass(null); setSelected(null); }} />
          {data.rows.length>0 && (
            <button className="btn btn-primary" onClick={exportAll}>내보내기 (전체 학생 XLSX)</button>
          )}
        </div>
        {data.rows.length>0 && <Kpis rows={data.rows} />}
      </div>

      {data.rows.length>0 && (
        <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
          <div className="md:col-span-1 card p-4">
            <div className="mb-2 font-semibold">학급 선택</div>
            <select className="select mb-3" value={klass ?? ''} onChange={(e)=> { setKlass(e.target.value || null); setSelected(null); }}>
              <option value="">학급을 선택하세요</option>
              {classes.map(k=> <option key={k} value={k}>{k.replace('-', '학년 ') + '반'}</option>)}
            </select>
            {klass && (
              <>
                <div className="mb-1 font-semibold">학생 선택/검색</div>
                <input className="input mb-2" placeholder="이름 또는 번호 검색" value={query} onChange={(e)=> setQuery(e.target.value)} />
                <div
                  className="max-h-[800px] overflow-auto border border-sage-200 rounded-lg"
                  onKeyDown={handleListKey}
                  tabIndex={0}
                  ref={listRef}
                  role="listbox"
                  aria-activedescendant={selected ? `student-${selected}` : undefined}
                >
                  {filteredStudents.map(s => (
                    <button
                      key={s.key}
                      id={`student-${s.key}`}
                      data-key={s.key}
                      className={`w-full text-left px-3 py-2 hover:bg-sage-50 ${selected===s.key?'bg-sage-100':''}`}
                      onClick={()=> setSelected(s.key)}
                      role="option"
                      aria-selected={selected===s.key}
                    >
                      {s.label}
                    </button>
                  ))}
                  {filteredStudents.length===0 && <div className="p-3 text-sm text-slate-500">검색 결과 없음</div>}
                </div>
              </>
            )}
          </div>

          <div className="md:col-span-2 lg:col-span-3 space-y-4">
            <div className="card p-4">
              <div className="font-semibold mb-2">학생별 요약</div>
              <div className="text-sm text-slate-500 mb-3">좌측에서 학급과 학생을 선택하세요.</div>
              {selected && studentDet && (
                <div>
                  <div className="mb-2 font-semibold">{klass?.replace('-', '학년 ') + '반'} · {studentName}</div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {(() => {
                      const total = studentDet.list.reduce((s,r)=> s + (r.학점||0), 0)
                      const foundation = new Set(['국어','수학','영어'])
                      const baseOnly = studentDet.list.reduce((s,r)=> s + (foundation.has(r.교과) ? (r.학점||0) : 0), 0)
                      const khOnly = studentDet.list.reduce((s,r)=> s + (isKoreanHistory(r.과목명) ? (r.학점||0) : 0), 0)
                      const combined = baseOnly + khOnly
                      const pct = total>0 ? Math.round((combined/total)*1000)/10 : 0
                      return (
                        <Kpi
                          title="학생 전체 이수학점"
                          value={String(total)}
                          note={
                            <div className="mt-2">
                              <div className="text-sm text-slate-600">기초교과+한국사</div>
                              <div className="text-xl font-bold">
                                {baseOnly}학점 + {khOnly}학점 (
                                <span className={pct > 50 ? 'text-red-600' : ''}>{pct}%</span>
                                )
                              </div>
                            </div>
                          }
                        />
                      )
                    })()}
                    <div className="card p-3">
                      <div className="text-sm text-slate-600 mb-2">교과별 이수학점</div>
                      <div className="space-y-2">
                        {(() => { const max = Math.max(1, ...studentDet.byGroup.map(x=> x.총학점)); return studentDet.byGroup.map(x=> (
                          <BarRow key={x.교과} label={x.교과} value={x.총학점} max={max} />
                        ))})()}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="text-sm font-semibold mb-2">과목 상세 (교과별)</div>
                    {(() => {
                      // 위계 과목 점검
                      const seq = (() => {
                        const byBase = new Map<string, Set<number>>()
                        for (const r of studentDet.list){
                          const ph = parseHierLevel(r.과목명)
                          if (!ph) continue
                          const set = byBase.get(ph.base) || new Set<number>()
                          set.add(ph.level)
                          byBase.set(ph.base, set)
                        }
                        const violations: { base:string, have:number[], missing:number[] }[] = []
                        for (const [base, set] of byBase){
                          const levels = Array.from(set)
                          const max = Math.max(...levels)
                          const missing: number[] = []
                          for (let i=1;i<max;i++) if (!set.has(i)) missing.push(i)
                          if (missing.length>0) violations.push({ base, have: levels.sort((a,b)=>a-b), missing })
                        }
                        return violations
                      })()
                      // JSON 선후수 점검
                      const explicit = (() => {
                        const have = new Set<string>()
                        for (const r of studentDet.list){
                          const nm = normCourseName(r.과목명)
                          if (nm) have.add(nm)
                        }
                        const out: { course: string, missing: string[] }[] = []
                        for (const [course, reqs] of PREREQS){
                          if (!have.has(course)) continue
                          const miss = reqs.filter(r => !have.has(r))
                          if (miss.length>0) out.push({ course, missing: miss })
                        }
                        return out
                      })()
                      return (
                        <div className="card p-3 mb-3">
                          <div className="text-sm font-semibold mb-2">위계 과목 점검</div>
                          {seq.length===0 && explicit.length===0 && (
                            <div className="text-sm text-slate-600">위계/선후수 위반 없음</div>
                          )}
                          {seq.length>0 && (
                            <>
                              <div className="text-sm text-slate-700 font-medium mb-1">로마자 위계 위반</div>
                              <ul className="list-disc pl-5 space-y-1 mb-2">
                                {seq.map((v,i)=> (
                                  <li key={i} className="text-sm">
                                    <span className="font-medium">{v.base}</span>: 이수 {v.have.join(', ')} → 누락 {v.missing.join(', ')}
                                  </li>
                                ))}
                              </ul>
                            </>
                          )}
                          {explicit.length>0 && (
                            <ul className="list-disc pl-5 space-y-1">
                              {explicit.map((v,i)=> (
                                <li key={i} className="text-sm">
                                  <span className="font-medium">{v.course}</span>: 선수 누락 → {v.missing.join(', ')}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )
                    })()}
                    {(() => {
                      const groupMap = new Map<string, typeof studentDet.list>()
                      for (const r of studentDet.list){
                        const g = r.교과;
                        const arr = groupMap.get(g) || [] as typeof studentDet.list;
                        arr.push(r); groupMap.set(g, arr)
                      }
                      const groups = Array.from(groupMap.entries()).sort((a,b)=> a[0].localeCompare(b[0], 'ko'))
                      return (
                        <div className="grid sm:grid-cols-2 gap-4">
                          {groups.map(([g, list]) => {
                            const sorted = [...list].sort((a,b) => {
                              const ay = a.과목학년 ?? 9999; const by = b.과목학년 ?? 9999
                              if (ay !== by) return ay - by
                              const at = a.과목학기 ?? 9999; const bt = b.과목학기 ?? 9999
                              if (at !== bt) return at - bt
                              return (a.과목명 || '').localeCompare(b.과목명 || '', 'ko')
                            })
                            return (
                            <div key={g} className="card p-3">
                              <div className="font-semibold mb-1">{g}</div>
                              <div className="border border-sage-200 rounded-lg">
                                <table className="w-full border-collapse">
                                  <thead>
                                    <tr>
                                      <th className="sticky top-0 bg-sage-50 p-2 text-left border-b border-sage-200">과목명</th>
                                      <th className="sticky top-0 bg-sage-50 p-2 text-right border-b border-sage-200">학점</th>
                                      <th className="sticky top-0 bg-sage-50 p-2 text-left border-b border-sage-200">과목학년</th>
                                      <th className="sticky top-0 bg-sage-50 p-2 text-left border-b border-sage-200">과목학기</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {sorted.map((r,i) => (
                                      <tr key={i} className="odd:bg-white even:bg-sage-50/30">
                                        <td className="p-2 border-b border-sage-100">{r.과목명}</td>
                                        <td className="p-2 border-b border-sage-100 text-right">{r.학점}</td>
                                        <td className="p-2 border-b border-sage-100">{r.과목학년 ?? ''}</td>
                                        <td className="p-2 border-b border-sage-100">{r.과목학기 ?? ''}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                            )
                          })}
                        </div>
                      )
                    })()}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
