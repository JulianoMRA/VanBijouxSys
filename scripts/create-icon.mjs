import { Resvg } from '@resvg/resvg-js'
import pngToIco from 'png-to-ico'
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const svgPath = resolve(__dirname, '../resources/icon.svg')
const icoPath = resolve(__dirname, '../resources/icon.ico')

const svg = readFileSync(svgPath, 'utf-8')

const sizes = [16, 32, 48, 64, 128, 256]
const pngBuffers = sizes.map((size) => {
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: size } })
  return Buffer.from(resvg.render().asPng())
})

const ico = await pngToIco(pngBuffers)
writeFileSync(icoPath, ico)
console.log(`✓ Ícone gerado: ${icoPath}`)
