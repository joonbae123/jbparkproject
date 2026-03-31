/**
 * ZIP 빌더 - 세션 파일들을 ZIP 아카이브로 패키징
 *
 * Node.js 내장 zlib 모듈을 사용하여 순수 JavaScript로 ZIP 생성.
 * 외부 라이브러리 없이 deflate 알고리즘 기반 ZIP 포맷 구현.
 *
 * 사용:
 *   const buf = createZipBuffer("session-123", "my-project");
 *   // buf는 Buffer (application/zip)
 */

import * as fs from "fs";
import * as path from "path";
import * as zlib from "zlib";

const SANDBOX_BASE = "/tmp/dev-harness";

// ZIP 파일 구조 상수
const LOCAL_FILE_HEADER_SIG = 0x04034b50;
const CENTRAL_DIR_SIG = 0x02014b50;
const END_OF_CENTRAL_DIR_SIG = 0x06054b50;

function dosDate(d: Date): number {
  return (
    ((d.getFullYear() - 1980) << 9) |
    ((d.getMonth() + 1) << 5) |
    d.getDate()
  );
}

function dosTime(d: Date): number {
  return (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
}

function crc32(buf: Buffer): number {
  const table = makeCrcTable();
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeCrcTable(): number[] {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    t[n] = c;
  }
  return t;
}

interface ZipEntry {
  name: string;       // 아카이브 내 경로
  data: Buffer;       // 원본 데이터
  compressed: Buffer; // deflate 압축 데이터
  crc: number;
  modDate: number;
  modTime: number;
  offset: number;     // 로컬 헤더 오프셋
}

/**
 * 세션 디렉토리의 파일들을 ZIP 버퍼로 생성
 */
export function createZipBuffer(sessionId: string, projectName = "ai-harness-project"): Buffer {
  const sessionPath = path.join(SANDBOX_BASE, sessionId);

  if (!fs.existsSync(sessionPath)) {
    throw new Error(`세션 디렉토리 없음: ${sessionId}`);
  }

  // 파일 목록 수집
  const files = collectFiles(sessionPath);
  if (files.length === 0) {
    throw new Error("세션에 파일이 없습니다");
  }

  const prefix = projectName.replace(/[^a-zA-Z0-9-_]/g, "_") + "/";
  const now = new Date();
  const entries: ZipEntry[] = [];

  // 각 파일 압축
  for (const f of files) {
    const raw = fs.readFileSync(f.absPath);
    const compressed = zlib.deflateRawSync(raw, { level: 6 });
    // deflate가 raw보다 크면 저장 방식으로 fallback
    const useCompressed = compressed.length < raw.length;
    entries.push({
      name: prefix + f.relPath,
      data: raw,
      compressed: useCompressed ? compressed : raw,
      crc: crc32(raw),
      modDate: dosDate(now),
      modTime: dosTime(now),
      offset: 0
    });
  }

  // README.md 자동 생성 추가
  const readmeContent = buildReadme(projectName, files.map(f => f.relPath));
  const readmeRaw = Buffer.from(readmeContent, "utf8");
  const readmeCompressed = zlib.deflateRawSync(readmeRaw, { level: 6 });
  const useReadmeCompressed = readmeCompressed.length < readmeRaw.length;
  entries.push({
    name: prefix + "README.md",
    data: readmeRaw,
    compressed: useReadmeCompressed ? readmeCompressed : readmeRaw,
    crc: crc32(readmeRaw),
    modDate: dosDate(now),
    modTime: dosTime(now),
    offset: 0
  });

  // ZIP 바이너리 조립
  const parts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    entry.offset = offset;
    const nameBytes = Buffer.from(entry.name, "utf8");
    const useDeflate = entry.compressed === entry.compressed && entry.compressed.length < entry.data.length;
    const compressionMethod = useDeflate ? 8 : 0;

    const localHeader = Buffer.alloc(30 + nameBytes.length);
    localHeader.writeUInt32LE(LOCAL_FILE_HEADER_SIG, 0);
    localHeader.writeUInt16LE(20, 4);   // version needed
    localHeader.writeUInt16LE(0x0800, 6); // flags: UTF-8
    localHeader.writeUInt16LE(compressionMethod, 8);
    localHeader.writeUInt16LE(entry.modTime, 10);
    localHeader.writeUInt16LE(entry.modDate, 12);
    localHeader.writeUInt32LE(entry.crc, 14);
    localHeader.writeUInt32LE(entry.compressed.length, 18);
    localHeader.writeUInt32LE(entry.data.length, 22);
    localHeader.writeUInt16LE(nameBytes.length, 26);
    localHeader.writeUInt16LE(0, 28); // extra field length
    nameBytes.copy(localHeader, 30);

    parts.push(localHeader);
    parts.push(entry.compressed);
    offset += localHeader.length + entry.compressed.length;
  }

  const centralDirOffset = offset;
  const centralParts: Buffer[] = [];

  for (const entry of entries) {
    const nameBytes = Buffer.from(entry.name, "utf8");
    const useDeflate = entry.compressed.length < entry.data.length;
    const compressionMethod = useDeflate ? 8 : 0;

    const central = Buffer.alloc(46 + nameBytes.length);
    central.writeUInt32LE(CENTRAL_DIR_SIG, 0);
    central.writeUInt16LE(20, 4);   // version made by
    central.writeUInt16LE(20, 6);   // version needed
    central.writeUInt16LE(0x0800, 8); // flags: UTF-8
    central.writeUInt16LE(compressionMethod, 10);
    central.writeUInt16LE(entry.modTime, 12);
    central.writeUInt16LE(entry.modDate, 14);
    central.writeUInt32LE(entry.crc, 16);
    central.writeUInt32LE(entry.compressed.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt16LE(0, 30);   // extra field length
    central.writeUInt16LE(0, 32);   // file comment length
    central.writeUInt16LE(0, 34);   // disk number start
    central.writeUInt16LE(0, 36);   // internal attributes
    central.writeUInt32LE(0, 38);   // external attributes
    central.writeUInt32LE(entry.offset, 42);
    nameBytes.copy(central, 46);

    centralParts.push(central);
  }

  const centralDir = Buffer.concat(centralParts);
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(END_OF_CENTRAL_DIR_SIG, 0);
  endRecord.writeUInt16LE(0, 4);    // disk number
  endRecord.writeUInt16LE(0, 6);    // disk with central dir
  endRecord.writeUInt16LE(entries.length, 8);
  endRecord.writeUInt16LE(entries.length, 10);
  endRecord.writeUInt32LE(centralDir.length, 12);
  endRecord.writeUInt32LE(centralDirOffset, 16);
  endRecord.writeUInt16LE(0, 20);   // comment length

  return Buffer.concat([...parts, centralDir, endRecord]);
}

interface FileEntry {
  absPath: string;
  relPath: string;
}

function collectFiles(dir: string, base = ""): FileEntry[] {
  const result: FileEntry[] = [];
  for (const name of fs.readdirSync(dir)) {
    const abs = path.join(dir, name);
    const rel = base ? `${base}/${name}` : name;
    const stat = fs.statSync(abs);
    if (stat.isDirectory()) {
      result.push(...collectFiles(abs, rel));
    } else {
      result.push({ absPath: abs, relPath: rel });
    }
  }
  return result;
}

function buildReadme(projectName: string, files: string[]): string {
  const fileList = files.map(f => `- \`${f}\``).join("\n");
  return `# ${projectName}

AI Harness v6에 의해 자동 생성된 프로젝트입니다.

## 생성된 파일

${fileList}

## 실행 방법

\`\`\`bash
# Node.js 18+ 필요
node solution.js
\`\`\`

## 주의사항

- 순수 Node.js JavaScript (외부 라이브러리 없음)
- 각 .js 파일은 독립적으로 실행 가능
- solution.js가 진입점 (통합 실행)

---
*Generated by AI Harness v6 Large Project Mode*
`;
}
