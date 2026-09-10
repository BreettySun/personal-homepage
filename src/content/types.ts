export interface Essay {
  slug: string
  title: string
  date: string       // YYYY-MM-DD
  year: number
  city: string
  weather: string    // 自由文本，如 "阴"、"雨"，只用于展示
  summary: string
  html: string
  wordCount: number
  readingMinutes: number
}

export interface Project {
  slug: string
  name: string
  tagline: string
  stack: string[]
  year: number
  github?: string
  url?: string
  cover?: string
  html: string
}

export interface AboutLink { label: string; href: string }
export interface About { html: string; links: AboutLink[] }
