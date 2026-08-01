import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function parseTableStructure(schemaDdl: string) {
  if (!schemaDdl || typeof schemaDdl !== 'string') return [];
  const tables: Array<{ name: string; columns: Array<{ name: string; type: string; constraints?: string }> }> = [];
  const tableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:`?\w+`?\.)?`?(\w+)`?\s*\(([\s\S]*?)\);/gi;
  let tableMatch;
  while ((tableMatch = tableRegex.exec(schemaDdl)) !== null) {
    const tableName = tableMatch[1];
    const columnsBody = tableMatch[2];
    const columns: Array<{ name: string; type: string; constraints?: string }> = [];

    const colLines: string[] = [];
    let current = '';
    let parenDepth = 0;
    for (let i = 0; i < columnsBody.length; i++) {
      const char = columnsBody[i];
      if (char === '(') parenDepth++;
      else if (char === ')') parenDepth--;

      if ((char === ',' || char === '\n') && parenDepth === 0) {
        if (current.trim()) colLines.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    if (current.trim()) colLines.push(current.trim());

    const filteredLines = colLines.filter(l => {
      const u = l.toUpperCase();
      return l && !u.startsWith('PRIMARY') && !u.startsWith('UNIQUE') && !u.startsWith('INDEX') && !u.startsWith('KEY') && !u.startsWith('CONSTRAINT') && !u.startsWith('FOREIGN');
    });

    for (const line of filteredLines) {
      const clean = line.replace(/,$/, '').trim();
      if (!clean) continue;
      const parts = clean.split(/\s+/);
      if (parts.length >= 2) {
        const name = parts[0].replace(/`/g, '');
        let type = '';
        const constraintParts: string[] = [];
        for (let i = 1; i < parts.length; i++) {
          const p = parts[i];
          const pu = p.toUpperCase();
          if (pu === 'NOT' || pu === 'NULL' || pu === 'PRIMARY' || pu === 'KEY' || pu === 'UNIQUE' || pu === 'AUTO_INCREMENT' || pu === 'DEFAULT') {
            constraintParts.push(p);
          } else if (pu.startsWith('REFERENCES')) {
            constraintParts.push(parts.slice(i).join(' '));
            break;
          } else {
            type += (type ? ' ' : '') + p;
          }
        }
        columns.push({ name, type: type || 'VARCHAR', constraints: constraintParts.join(' ') });
      }
    }
    tables.push({ name: tableName, columns });
  }
  return tables;
}

function extractDdlFromProblem(p: any): string {
  // 1. Direct starterCode.schema.setup or starterCode.schema string
  if (p.starterCode && typeof p.starterCode === 'object') {
    if (typeof p.starterCode.schema === 'string') return p.starterCode.schema;
    if (p.starterCode.schema && typeof p.starterCode.schema === 'object' && typeof p.starterCode.schema.setup === 'string') {
      return p.starterCode.schema.setup;
    }
  }

  // 2. Test cases DDL
  if (p.testCases && Array.isArray(p.testCases)) {
    for (const tc of p.testCases) {
      const script = tc.setup || tc.input || '';
      if (/CREATE\s+TABLE/i.test(script)) {
        const ddlMatches = script.match(/CREATE\s+TABLE[\s\S]*?\);/gi);
        if (ddlMatches && ddlMatches.length > 0) {
          return ddlMatches.join('\n');
        }
      }
    }
  }

  return '';
}

async function main() {
  console.log('🔄 Starting CockroachDB SQL Schema Canonical Normalization Migration...');

  const problems = await prisma.problem.findMany({
    where: { problemType: 'sql' },
    include: { testCases: true }
  });

  console.log(`Found ${problems.length} SQL problems to audit and normalize.`);

  let updatedCount = 0;

  for (const prob of problems) {
    const extractedDdl = extractDdlFromProblem(prob);
    const tables = parseTableStructure(extractedDdl);

    const currentStarter: any = typeof prob.starterCode === 'object' && prob.starterCode !== null ? prob.starterCode : {};
    const starterSql = currentStarter.sql || '-- Write your SQL query below\n';

    const canonicalSchema = {
      setup: extractedDdl,
      tables: tables
    };

    await prisma.problem.update({
      where: { id: prob.id },
      data: {
        starterCode: {
          sql: starterSql,
          schema: canonicalSchema
        }
      }
    });

    updatedCount++;
    console.log(`  ✅ Canonicalized [${prob.title}] -> ${tables.length} tables found`);
  }

  console.log(`\n🎉 Migration Complete: Successfully normalized ${updatedCount} SQL problems in CockroachDB!`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
