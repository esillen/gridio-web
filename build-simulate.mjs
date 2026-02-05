import * as esbuild from 'esbuild'
import { mkdirSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outFile = join(__dirname, 'dist-sim', 'simulate.js')

const outDir = dirname(outFile)
if (!existsSync(outDir)) {
  mkdirSync(outDir, { recursive: true })
}
// Remove previous bundle so we never run stale output
if (existsSync(outFile)) {
  const { unlinkSync } = await import('fs')
  unlinkSync(outFile)
}

await esbuild.build({
  entryPoints: [join(__dirname, 'scripts', 'simulate.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: outFile,
  external: [],
  sourcemap: false,
})

// Run the built script
const { spawn } = await import('child_process')
const proc = spawn('node', [outFile], { stdio: 'inherit', cwd: __dirname })
proc.on('exit', (code) => process.exit(code ?? 0))
