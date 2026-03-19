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

