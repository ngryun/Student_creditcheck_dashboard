export type Row = {
  학년: number | null
  반: number | null
  번호: number | null
  이름: string | null
  과목학년: number | null
  과목학기: number | null
  교과: string | null
  과목명: string | null
  학점: number | null
}

export type Dataset = {
  rows: Row[]
}

export type CurriculumEntry = {
  과목명: string
  교과: string | null
  학점: number | null
  과목학년: number | null
  과목학기: number | null
  과목구분: string | null
}

export type CurriculumCatalog = Record<string, CurriculumEntry[]>

export type FutureStats = {
  skippedNoId: number
  skippedNoCourse: number
  produced: number
  requiredAdded: number
  notInCatalog: Record<string, number>
  noFutureOffering: Record<string, number>
}

export type StepId = 1 | 2 | 3
