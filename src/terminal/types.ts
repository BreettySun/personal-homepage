import type { Essay, Project } from '@/content/types'
import type { Theme } from '@/theme/theme'
import type { TerrainParams } from '@/weather/terrainParams'

export type TerminalOutput = string[] | { clear: true }
export interface TerminalContext {
  essays: Essay[]
  projects: Project[]
  navigate(path: string): void
  setTheme(t: Theme): void
  params: TerrainParams
  setManual(patch: Partial<Pick<TerrainParams, 'weather' | 'season' | 'seed' | 'intensity' | 'density'>>): void
  close(): void
}
export interface Command {
  name: string
  usage: string
  description: string
  run(args: string[], ctx: TerminalContext): TerminalOutput | Promise<TerminalOutput>
  complete?(partial: string, ctx: TerminalContext): string[]
}
