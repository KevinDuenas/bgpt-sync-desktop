/**
 * File Converter
 * Converts unsupported file formats to supported ones for Pinecone
 */
import fs from 'fs'
import path from 'path'
import { parseStringPromise } from 'xml2js'

export interface ConvertedFile {
  content: Buffer
  convertedFileName: string
  originalFileName: string
  convertedFrom: string // original extension (e.g., 'xml')
}

/**
 * Check if a file needs conversion
 */
export function needsConversion(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase()
  return ext === '.xml'
}

/**
 * Convert XML to JSON
 */
async function convertXmlToJson(xmlContent: string): Promise<string> {
  const result = await parseStringPromise(xmlContent, {
    explicitArray: false,
    mergeAttrs: true,
    trim: true,
  })
  return JSON.stringify(result, null, 2)
}

/**
 * Convert a file to a supported format
 * Returns the converted content as a Buffer and metadata
 */
export async function convertFile(filePath: string): Promise<ConvertedFile | null> {
  const ext = path.extname(filePath).toLowerCase()
  const baseName = path.basename(filePath, ext)
  const originalFileName = path.basename(filePath)

  if (ext === '.xml') {
    try {
      const xmlContent = fs.readFileSync(filePath, 'utf-8')
      const jsonContent = await convertXmlToJson(xmlContent)

      return {
        content: Buffer.from(jsonContent, 'utf-8'),
        convertedFileName: `${baseName}.json`,
        originalFileName,
        convertedFrom: 'xml',
      }
    } catch (error) {
      console.error(`Failed to convert XML file ${filePath}:`, error)
      return null
    }
  }

  return null
}

/**
 * Get the list of supported file extensions (after conversion)
 * These are formats that Pinecone Assistant can process
 */
export function getSupportedExtensions(): string[] {
  return ['.pdf', '.txt', '.md', '.json', '.html', '.docx', '.csv']
}

/**
 * Get the list of convertible extensions
 * These will be converted to a supported format before upload
 */
export function getConvertibleExtensions(): string[] {
  return ['.xml']
}

/**
 * Check if a file can be processed (either directly or after conversion)
 */
export function canProcess(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase()
  return getSupportedExtensions().includes(ext) || getConvertibleExtensions().includes(ext)
}
