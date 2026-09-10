import type { Command } from '../types'
export const sudo: Command = { name: 'sudo', usage: 'sudo', description: '', run: () => ['你没有权限，去找老王。'] }
